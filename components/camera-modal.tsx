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
}

export function CameraModal({ onUploadComplete, projectId }: CameraModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState("camera");

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: { ideal: 'environment' }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
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
      console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size
      });

      if (!file.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }
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
            console.log('File read successfully, data length:', result.length);
            resolve(result);
          };
          
          reader.onerror = () => {
            reject(new Error('Error reading file'));
          };
          
          reader.readAsDataURL(file);
        });

        console.log('Starting image processing...');
        setCapturedImage(imageData);
        setIsCameraActive(false);
        
        const parsedData = await simulateDataExtraction(imageData);
        console.log('Processing completed:', parsedData);
        
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

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setIsOpen(true);
            cleanupState();
            setIsCameraActive(true);
            startCamera();
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center"
        >
          <Camera className="mr-2 h-4 w-4" />
          Open Camera
        </Button>
        <Button
          onClick={() => {
            setIsOpen(true);
            cleanupState();
            setIsCameraActive(false);
          }}
          variant="outline"
          className="inline-flex items-center justify-center"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload File
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
          cleanupState();
        }
        setIsOpen(open);
      }}>
        <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-hidden px-4 sm:px-6 lg:px-8">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-center">
              {!extractedData ? "Scan Receipt" : "OCR Results"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto">
              <TabsTrigger value="camera">Camera</TabsTrigger>
              <TabsTrigger value="data" disabled={!extractedData}>Results</TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-4 w-full">
              <div className="relative aspect-[4/5] sm:aspect-[3/4] lg:aspect-[16/10] bg-black rounded-lg overflow-hidden max-h-[70vh]">
                {isLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center flex-col gap-4 z-10">
                    <div className="animate-spin text-2xl">⭮</div>
                    <p className="text-white text-center">{processingStatus}</p>
                  </div>
                )}
                {isCameraActive ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain md:object-cover"
                    />
                    <Button
                      onClick={captureImage}
                      className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="animate-spin mr-2">⭮</span>
                          Processing...
                        </>
                      ) : (
                        'Capture Receipt'
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {capturedImage ? (
                      <div className="relative w-full h-full">
                        <img
                          src={capturedImage}
                          alt="Captured receipt"
                          className="w-full h-full object-contain md:object-cover"
                        />
                        <Button
                          onClick={resetCamera}
                          variant="secondary"
                          className="absolute top-4 right-4"
                        >
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-4">
                        <label className="cursor-pointer w-full">
                          <Input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                          <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <Upload className="h-6 w-6 md:h-8 md:w-8" />
                            <span className="text-sm text-center">Click to upload or drag and drop</span>
                            <span className="text-xs text-center">PNG, JPG, JPEG image types</span>
                          </div>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-4">
              <div className="relative aspect-[4/5] sm:aspect-[3/4] lg:aspect-auto lg:h-[70vh] bg-background rounded-lg overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto pb-0">
                  <div className="p-4 sm:p-6 lg:p-8">
                    {extractedData && <ReceiptTable data={extractedData} />}
                  </div>
                </div>
                
                {extractedData && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-sm border-t">
                    <div className="max-w-[1000px] mx-auto">
                      <Button
                        onClick={exportToCSV}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Download className="mr-2 h-4 w-4"/>
                        Export to CSV
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
} 