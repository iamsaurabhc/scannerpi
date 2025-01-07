"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { CameraModal } from "./camera-modal";
import { Button } from "./ui/button";
import { Folder, Upload, Clock, Download, Check, X, Loader2, Pencil } from "lucide-react";
import { ReceiptDetailsModal } from "./receipt-details-modal";
import { Input } from "./ui/input";

interface Project {
  id: string;
  name: string;
  created_at: string;
  description?: string;
}

export interface Receipt {
    id: string;
    project_id: string;
    status: 'processing' | 'completed' | 'error';
    receipt_date?: string;
    receipt_time?: string;
    subtotal?: number;
    tax?: number;
    total?: number;
    raw_image_url?: string;
    processing_error?: string;
    created_at: string;
    merchant?: {
      name: string;
      store_number?: string;
      address?: string;
    };
    line_items?: Array<{
      category?: string;
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }>;
    raw_data?: {
      date?: string;
      merchant?: {
        name: string;
        store_number?: string;
        address?: string;
      };
      total?: string;
      items?: Array<{
        description: string;
        quantity: string;
        unit_price: string;
        total: string;
      }>;
    };
}

interface ReceiptPayload {
  id: string;
  project_id: string;
  status: 'processing' | 'completed' | 'error';
  merchant_name?: string;
  total?: string;
  date?: string;
  created_at: string;
  file_url?: string;
  raw_data?: any;
}

export default function ProjectDashboard({ userId }: { userId: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    const channel = supabase
      .channel('receipts')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'receipts',
          filter: `project_id=eq.${selectedProject.id}`
        },
        (payload: { new: ReceiptPayload }) => {
          setReceipts(prev => 
            prev.map(receipt => 
              receipt.id === payload.new.id 
                ? {
                    id: payload.new.id,
                    project_id: payload.new.project_id,
                    status: payload.new.status,
                    merchant_name: payload.new.merchant_name,
                    total: payload.new.total,
                    date: payload.new.date,
                    created_at: payload.new.created_at,
                    file_url: payload.new.file_url
                  } as Receipt
                : receipt
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel).then(() => {
        console.log('Subscription cleaned up');
      }).catch(error => {
        console.error('Error cleaning up subscription:', error);
      });
    };
  }, [selectedProject, supabase]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      // Log the project data for debugging
      console.log('Fetched projects:', projectData);

      if (projectData && projectData.length > 0) {
        setProjects(projectData);
        setSelectedProject(projectData[0]);
        // Ensure we fetch receipts after setting the project
        await fetchReceipts(projectData[0].id);
      } else {
        // Only create default project if no projects exist
        await createDefaultProject();
      }
    } catch (error) {
      console.error('Error in fetchProjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([
          {
            name: 'My First Project',
            user_id: userId,
            description: 'Default project for receipts'
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProjects([data]);
        setSelectedProject(data);
        fetchReceipts(data.id);
      }
    } catch (error) {
      console.error('Error creating default project:', error);
    }
  };

  const fetchReceipts = async (projectId: string) => {
    console.log('Fetching receipts for project:', projectId);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          receipt_merchants (
            merchant:merchants (
              name,
              store_number,
              address
            )
          ),
          line_items!line_items_receipt_id_fkey (
            category,
            description,
            quantity,
            unit_price,
            total
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receipts:', error);
        return;
      }

      if (!data) {
        console.log('No receipts found for project:', projectId);
        setReceipts([]);
        return;
      }

      const transformedReceipts = data.map(receipt => ({
        id: receipt.id,
        project_id: receipt.project_id,
        status: receipt.status,
        receipt_date: receipt.receipt_date,
        receipt_time: receipt.receipt_time,
        subtotal: receipt.subtotal,
        tax: receipt.tax,
        total: receipt.total,
        raw_image_url: receipt.raw_image_url,
        processing_error: receipt.processing_error,
        created_at: receipt.created_at,
        merchant: receipt.receipt_merchants?.[0]?.merchant || null,
        line_items: receipt.line_items || [],
        raw_data: receipt.raw_data
      }));

      console.log('Transformed receipts:', transformedReceipts);
      setReceipts(transformedReceipts);
    } catch (error) {
      console.error('Unexpected error in fetchReceipts:', error);
      setReceipts([]);
    }
  };

  const handleReceiptUpload = async (extractedData: any, imageData: string) => {
    if (!selectedProject) return;

    try {
      // Convert base64 to blob
      const base64Response = await fetch(imageData);
      const blob = await base64Response.blob();

      // Upload to Supabase Storage
      const fileName = `receipts/${selectedProject.id}/${Date.now()}.jpg`;
      const { data: fileData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);

      // Create receipt record
      const { data, error } = await supabase
        .from('receipts')
        .insert([
          {
            project_id: selectedProject.id,
            status: 'processing',
            merchant_name: extractedData.merchant?.name,
            total: extractedData.total,
            date: extractedData.date,
            file_url: publicUrl,
            raw_data: extractedData
          }
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setReceipts(prev => [data, ...prev]);
        
        // Start background processing
        processReceiptInBackground(data.id);
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
    }
  };

  const processReceiptInBackground = async (receiptId: string) => {
    try {
      if (!selectedProject) {
        throw new Error('No project selected');
      }

      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          receiptId,
          projectId: selectedProject.id 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process receipt');
      }
    } catch (error) {
      console.error('Error processing receipt:', error);
      
      // Update receipt status to error
      await supabase
        .from('receipts')
        .update({ status: 'error' })
        .eq('id', receiptId);
    }
  };

  const processReceipt = async (imageData: string) => {
    try {
      if (!selectedProject) {
        throw new Error('No project selected');
      }

      const response = await fetch('/api/process-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: imageData,
          projectId: selectedProject.id 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process receipt');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error processing receipt:', error);
      throw error;
    }
  };

  const exportReceiptToCSV = (receipt: Receipt) => {
    if (!receipt.raw_data) {
      console.error('No raw data available for export');
      return;
    }

    try {
      const data = receipt.raw_data;
      const headers = [
        'Receipt Date',
        'Merchant Name',
        'Total',
        'Item Description',
        'Quantity',
        'Unit Price',
        'Item Total'
      ];
      
      // Ensure items array exists
      if (!Array.isArray(data.items)) {
        throw new Error('Invalid receipt data format');
      }

      const rows = data.items.map((item: any) => [
        data.date || receipt.receipt_date || receipt.created_at,
        data.merchant?.name || receipt.merchant?.name || 'Unknown Merchant',
        data.total || receipt.total || '0.00',
        item.description || 'Unknown Item',
        item.quantity || '1',
        item.unit_price || '0.00',
        item.total || '0.00'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => 
          row.map(cell => {
            const escaped = String(cell || '').replace(/"/g, '""');
            return `"${escaped}"`;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `receipt_${receipt.id}_${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href); // Clean up
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      // Here you could add a UI notification for the error
    }
  };

  const handleSaveProjectName = async () => {
    if (!selectedProject || !editedName.trim()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: editedName.trim() })
        .eq('id', selectedProject.id);

      if (error) throw error;

      setProjects(prev => 
        prev.map(project => 
          project.id === selectedProject.id 
            ? { ...project, name: editedName.trim() }
            : project
        )
      );
      setSelectedProject(prev => prev ? { ...prev, name: editedName.trim() } : null);
      setIsEditing(false);
      
      // Show toast or feedback here if you have a toast component
    } catch (error) {
      console.error('Error updating project name:', error);
      // Show error toast or feedback here
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-8 max-w-[800px] mx-auto w-full">
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="bg-card rounded-lg p-4 sm:p-6 shadow-sm border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-8 text-lg font-semibold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveProjectName();
                      } else if (e.key === 'Escape') {
                        setIsEditing(false);
                      }
                    }}
                  />
                  <div className="flex items-center gap-1">
                    {isSaving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <button
                          onClick={handleSaveProjectName}
                          className="p-1 hover:bg-primary/10 rounded-full text-primary"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="p-1 hover:bg-destructive/10 rounded-full text-destructive"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditedName(selectedProject?.name || '');
                      setIsEditing(true);
                    }}
                    className="group relative flex items-center"
                  >
                    <h2 className="text-lg sm:text-xl font-semibold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 transition-colors cursor-pointer">
                      {selectedProject?.name || 'Select a Project'}
                    </h2>
                    <Pencil className="h-4 w-4 ml-2 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
            <CameraModal onUploadComplete={handleReceiptUpload} projectId={selectedProject?.id || ''} />
          </div>

          {receipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <Upload className="h-8 sm:h-12 w-8 sm:w-12 text-muted-foreground mb-4" />
              <h3 className="text-base sm:text-lg font-medium mb-2">No receipts found</h3>
              <p className="text-sm text-muted-foreground mb-6 px-4">
                Start by scanning or uploading your first receipt
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="py-3 sm:py-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer px-2 sm:px-4"
                  onClick={() => {
                    setSelectedReceipt(receipt);
                    setIsDetailsModalOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    {receipt.raw_image_url && (
                      <img 
                        src={receipt.raw_image_url} 
                        alt="Receipt thumbnail" 
                        className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-md flex-shrink-0"
                      />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm sm:text-base truncate">
                        {receipt.status === 'completed' 
                          ? receipt.merchant?.name || 'Unknown Merchant'
                          : receipt.status === 'error'
                          ? 'Error Processing'
                          : 'Processing...'}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">
                        {receipt.receipt_date 
                          ? new Date(receipt.receipt_date).toLocaleDateString()
                          : new Date(receipt.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-base sm:text-lg font-medium whitespace-nowrap">
                      {receipt.total ? `$${receipt.total.toFixed(2)}` : '...'}
                    </span>
                    <div className="flex items-center">
                      {receipt.status === 'processing' && (
                        <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {receipt.status === 'completed' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden sm:inline-flex"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportReceiptToCSV(receipt);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {receipt.status === 'error' && (
                        <span className="text-destructive text-xs sm:text-sm" title={receipt.processing_error}>
                          Error
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ReceiptDetailsModal
        receipt={selectedReceipt}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedReceipt(null);
        }}
        onExport={exportReceiptToCSV}
      />
    </div>
  );
}

export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h2 className="text-lg font-semibold mb-2">Something went wrong!</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Try again
      </button>
    </div>
  );
} 