"use client";

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Camera, X, RotateCw, Upload, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { ReceiptTable } from "./receipt-table";
import { processImage } from "@/app/components/ocr-processor";
import { extractDateFromText, extractLineItemsFromText, extractMerchantFromText, extractTotalFromText } from "@/utils/helper";

interface ExtractedData {
  date: string;
  time: string;
  total: string;
  subtotal: string;
  tax: string;
  merchant: {
    name: string;
    store_number?: string;
    address?: string;
    telephone?: string[];
  };
  items: Array<{
    category: string;
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
  }>;
  payment: {
    method: string;
    card_last4: string;
  };
}

interface CameraModalProps {
  onUploadComplete?: (extractedData: any, imageData: string) => Promise<void>;
  projectId: string;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  hideDefaultButtons?: boolean;
}

export function CameraModal({ 
  onUploadComplete, 
  projectId,
  onOpenChange,
  defaultOpen = false,
  hideDefaultButtons = false 
}: CameraModalProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState("camera");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: { exact: 'environment' }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Couldn't access rear camera, falling back:", err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackErr) {
        console.error("Error accessing camera:", fallbackErr);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const captureImage = async () => {
    if (videoRef.current) {
      setIsLoading(true);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        
        setCapturedImage(imageData);
        setIsCameraActive(false);
        stopCamera();
  
        const parsedData = await simulateDataExtraction(imageData);
        setExtractedData(parsedData);
        setActiveTab("data");
      } catch (error) {
        console.error('Error processing image:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsOpen(true);
      setIsCameraActive(false);
      setIsLoading(true);
      
      try {
        const imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          
          reader.onload = (e) => {
            const result = e.target?.result as string;
            if (!result) {
              reject(new Error('Failed to read image file'));
              return;
            }
            resolve(result);
          };
          
          reader.onerror = () => {
            reject(new Error('Error reading file'));
          };
          
          reader.readAsDataURL(file);
        });

        setCapturedImage(imageData);
        const parsedData = await simulateDataExtraction(imageData);
        
        if (parsedData) {
          setExtractedData(parsedData);
          setActiveTab("data");
        }
      } catch (error) {
        console.error('Error processing file:', error);
        setProcessingStatus('Error: ' + (error as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const simulateDataExtraction = async (imageData?: string) => {
    try {
      console.log('Starting data extraction...');
      setProcessingStatus('Preparing image...');
      
      const dataToProcess = imageData || capturedImage;
      if (!dataToProcess) {
        throw new Error('No image data available');
      }

      console.log('Sending request to API:', {
        imageDataLength: dataToProcess?.length,
        projectId
      });

      console.log('Sending image to API...');
      setProcessingStatus('Processing receipt...');
      
      if (!onUploadComplete) {
        throw new Error('Upload handler not provided');
      }

      const requestBody: any = { 
        image: dataToProcess
      };

      // Only include projectId if it exists
      if (projectId) {
        requestBody.projectId = projectId;
      }

      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `Failed to process receipt: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('API response:', result);
      
      if (!result) {
        throw new Error('No data returned from API');
      }

      setProcessingStatus('Formatting data...');
      
      // Format the data to match our interface
      const parsedData = {
        date: result.date || new Date().toLocaleDateString(),
        time: result.time || '',
        total: result.total || '$0.00',
        merchant: {
          name: result.merchant?.name || 'Unknown Merchant',
          store_number: result.merchant?.store_number,
          address: result.merchant?.address,
          telephone: result.merchant?.telephone
        },
        items: (result.items || []).map((item: any) => ({
          category: item.category || '',
          description: item.description || 'Unknown Item',
          quantity: item.quantity || '1',
          unit_price: item.unit_price || '$0.00',
          total: item.total || '$0.00'
        })),
        subtotal: result.subtotal,
        tax: result.tax,
        payment: result.payment
      };

      // Only call onUploadComplete if it exists
      if (onUploadComplete) {
        await onUploadComplete(parsedData, imageData || '');
      }
      
      return parsedData;
    } catch (error: any) {
      console.error('Error processing receipt:', {
        message: error.message,
        stack: error.stack,
        error
      });
      setProcessingStatus('Error: ' + (error as Error).message);
      throw error;
    }
  };

  const resetCamera = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setIsCameraActive(true);
    startCamera();
  };

  const cleanupState = () => {
    stopCamera();
    setCapturedImage(null);
    setExtractedData(null);
    setIsLoading(false);
    setProcessingStatus('');
  };

  const exportToCSV = () => {
    if (!extractedData) return;

    // Prepare the CSV data with more detailed columns
    const headers = [
      'Receipt Date',
      'Receipt Time',
      'Merchant Name',
      'Store Number',
      'Address',
      'Phone',
      'Category',
      'Item Description',
      'Quantity',
      'Unit Price',
      'Item Total',
      'Receipt Subtotal',
      'Tax',
      'Receipt Total',
      'Payment Method',
      'Card Last 4'
    ];
    
    const rows: string[][] = [];

    // Add items rows with all receipt details
    extractedData.items.forEach(item => {
      rows.push([
        extractedData.date || '',
        extractedData.time || '',
        extractedData.merchant.name || '',
        extractedData.merchant.store_number || '',
        extractedData.merchant.address || '',
        extractedData.merchant.telephone?.[0] || '',
        item.category || '',
        item.description || '',
        item.quantity || '1',
        item.unit_price || '$0.00',
        item.total || '$0.00',
        extractedData.subtotal || '$0.00',
        extractedData.tax || '$0.00',
        extractedData.total || '$0.00',
        extractedData.payment?.method || '',
        extractedData.payment?.card_last4 || ''
      ]);
    });

    // Convert to CSV string with proper escaping
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(cell => {
          // Escape special characters and wrap in quotes
          const escaped = cell.replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',')
      )
    ].join('\n');

    // Create and trigger download with formatted filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `receipt_export_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddFilesClick = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (extractedData) {
      setActiveTab("data");
    }
  }, [extractedData]);

  useEffect(() => {
    return () => {
      // Cleanup workers when component unmounts
      cleanupState();
    };
  }, []);

  // Update parent when internal state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  // Update internal state when parent changes defaultOpen
  useEffect(() => {
    setIsOpen(defaultOpen);
    if (defaultOpen) {
      setIsCameraActive(true);
      startCamera();
    }
  }, [defaultOpen]);

  return (
    <>
      {!hideDefaultButtons && (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setIsOpen(true);
              cleanupState();
              setIsCameraActive(true);
              startCamera();
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-full px-6"
          >
            <Camera className="mr-2 h-4 w-4" />
            Scan
          </Button>
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              data-file-input
            />
            <Button
              onClick={handleAddFilesClick}
              variant="outline"
              className="inline-flex items-center justify-center rounded-full px-6"
            >
              <Upload className="mr-2 h-4 w-4" />
              Add Files
            </Button>
          </>
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          cleanupState();
        }
        setIsOpen(open);
      }}>
        <DialogContent className="sm:max-w-[800px] w-[95vw] max-h-[90vh] overflow-hidden rounded-lg p-0">
          <div className="relative h-full">
            <div className="relative w-full h-[90vh] bg-gray-900 overflow-hidden">
              {isLoading ? (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center flex-col gap-4 z-10">
                  <div className="animate-spin">
                    <RotateCw className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-white text-center text-sm font-medium">{processingStatus}</p>
                </div>
              ) : isCameraActive ? (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none border-2 border-white/20 m-4 rounded-lg"></div>
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                    <Button
                      onClick={captureImage}
                      className="rounded-full w-16 h-16 bg-white shadow-lg hover:bg-gray-100 transition-colors"
                      disabled={isLoading}
                    >
                      <Camera className="h-8 w-8 text-black" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full bg-gray-100">
                  {capturedImage && (
                    <img
                      src={capturedImage}
                      alt="Captured receipt"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="absolute top-0 left-0 right-0 bg-black/30 backdrop-blur-sm">
              <DialogHeader className="px-6 py-4">
                <DialogTitle className="text-xl font-semibold text-white">
                  Scan Receipt
                </DialogTitle>
              </DialogHeader>
            </div>

            {extractedData && (
              <div className="absolute bottom-0 left-0 right-0 bg-white border-t">
                <div className="p-6">
                  <ReceiptTable data={extractedData} />
                  <Button
                    onClick={exportToCSV}
                    className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-11"
                  >
                    <Download className="mr-2 h-5 w-5"/>
                    Export to CSV
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 