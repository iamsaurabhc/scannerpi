import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Receipt } from "./project-dashboard";
import { ReceiptTable } from "./receipt-table";
import { Button } from "./ui/button";
import { Download } from "lucide-react";

interface ReceiptDetailsModalProps {
  receipt: Receipt | null;
  isOpen: boolean;
  onClose: () => void;
  onExport: (receipt: Receipt) => void;
}

export function ReceiptDetailsModal({ 
  receipt, 
  isOpen, 
  onClose,
  onExport 
}: ReceiptDetailsModalProps) {
  if (!receipt) return null;

  // Format the raw data to match the expected ReceiptTable interface
  const formattedData = receipt.raw_data ? {
    date: receipt.raw_data.date || new Date().toLocaleDateString(),
    time: receipt.receipt_time || '',
    total: receipt.raw_data.total || '$0.00',
    merchant: {
      name: receipt.raw_data.merchant?.name || 'Unknown Merchant',
      store_number: receipt.raw_data.merchant?.store_number,
      address: receipt.raw_data.merchant?.address,
      telephone: []
    },
    items: (receipt.raw_data.items || []).map(item => ({
      category: '',
      description: item.description,
      quantity: item.quantity || '1',
      unit_price: item.unit_price || '$0.00',
      total: item.total || '$0.00'
    })),
    subtotal: receipt.subtotal?.toString() || '0.00',
    tax: receipt.tax?.toString() || '0.00',
    payment: {
      method: '',
      card_last4: ''
    }
  } : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] lg:max-w-[1000px] w-[95vw] max-h-[90vh] overflow-hidden px-4 sm:px-6 lg:px-8">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-center">
            Receipt Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative aspect-[4/5] sm:aspect-[3/4] lg:aspect-auto lg:h-[70vh] bg-background rounded-lg overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto pb-16">
            <div className="p-4 sm:p-6 lg:p-8">
              {formattedData && <ReceiptTable data={formattedData} />}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-sm border-t">
            <div className="max-w-[1000px] mx-auto">
              <Button
                onClick={() => onExport(receipt)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Download className="mr-2 h-4 w-4"/>
                Export to CSV
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 