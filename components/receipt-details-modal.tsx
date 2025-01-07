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
  const formattedData = receipt ? {
    date: receipt.receipt_date || new Date(receipt.created_at).toLocaleDateString(),
    time: receipt.receipt_time || '',
    total: receipt.total ? `$${receipt.total.toFixed(2)}` : '$0.00',
    merchant: {
      name: receipt.merchant?.name || 'Unknown Merchant',
      store_number: receipt.merchant?.store_number || '',
      address: receipt.merchant?.address || '',
      telephone: []
    },
    items: (receipt.line_items || []).map(item => ({
      category: item.category || '',
      description: item.description,
      quantity: item.quantity?.toString() || '1',
      unit_price: item.unit_price ? `$${item.unit_price.toFixed(2)}` : '$0.00',
      total: item.total ? `$${item.total.toFixed(2)}` : '$0.00'
    })),
    subtotal: receipt.subtotal ? receipt.subtotal.toString() : '0.00',
    tax: receipt.tax ? receipt.tax.toString() : '0.00',
    payment: {
      method: '',
      card_last4: ''
    }
  } : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-4 sm:px-6 lg:px-8 py-4">
          <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold text-center">
            Receipt Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative h-[calc(90vh-8rem)] bg-background overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto">
            <div className="p-2 sm:p-6 lg:p-8">
              {formattedData && <ReceiptTable data={formattedData} />}
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/80 backdrop-blur-sm border-t">
            <div className="max-w-[1000px] mx-auto px-2 sm:px-0">
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