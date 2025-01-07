"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { CameraModal } from "./camera-modal";
import { Button } from "./ui/button";
import { Folder, Upload, Clock } from "lucide-react";

interface Project {
  id: string;
  name: string;
  created_at: string;
  description?: string;
}

interface Receipt {
  id: string;
  project_id: string;
  status: 'processing' | 'completed' | 'error';
  merchant_name?: string;
  total?: string;
  date?: string;
  created_at: string;
  file_url?: string;
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
      supabase.removeChannel(channel);
    };
  }, [selectedProject, supabase]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        return;
      }

      if (data) {
        setProjects(data);
        if (data.length > 0 && !selectedProject) {
          setSelectedProject(data[0]);
          fetchReceipts(data[0].id);
        } else if (data.length === 0) {
          // Create default project if none exists
          createDefaultProject();
        }
      }
    } catch (error) {
      console.error('Error in fetchProjects:', error);
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
      }
    } catch (error) {
      console.error('Error creating default project:', error);
    }
  };

  const fetchReceipts = async (projectId: string) => {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (data) {
      setReceipts(data);
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

  return (
    <div className="space-y-8">
      <div className="bg-card rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">
              {selectedProject?.name || 'Select a Project'}
            </h2>
          </div>
          <CameraModal onUploadComplete={handleReceiptUpload} projectId={selectedProject?.id || ''} />
        </div>

        {receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No receipts found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Start by scanning or uploading your first receipt
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  {receipt.file_url && (
                    <img 
                      src={receipt.file_url} 
                      alt="Receipt thumbnail" 
                      className="w-12 h-12 object-cover rounded-md"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {receipt.merchant_name || 'Processing...'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {receipt.date || new Date(receipt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-medium">{receipt.total || '...'}</span>
                  {receipt.status === 'processing' && (
                    <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {receipt.status === 'error' && (
                    <span className="text-destructive">Error processing receipt</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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