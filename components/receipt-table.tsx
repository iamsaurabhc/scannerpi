import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface ReceiptTableProps {
  data: {
    date: string;
    time?: string;
    total: string;
    merchant: {
      name: string;
      store_number?: string;
      address?: string;
      telephone?: string[];
    };
    items: Array<{
      category?: string;
      description: string;
      quantity: string;
      unit_price: string;
      total: string;
    }>;
    subtotal?: string;
    tax?: string;
    payment?: {
      method: string;
      card_last4: string;
    };
  };
}

export function ReceiptTable({ data }: ReceiptTableProps) {
  // Calculate subtotal and tax if available
  const subtotal = data.items.reduce((sum, item) => {
    const amount = parseFloat(item.unit_price?.replace('$', '') || '0') * parseFloat(item.quantity || '1');
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const total = parseFloat(data.total.replace('$', ''));
  const tax = parseFloat(data.tax || '0');

  return (
    <div className="flex flex-col h-full">
      {/* Receipt Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-2 sm:p-6">
        {/* Merchant Card - Full Width on Mobile, 1/3 on Desktop */}
        <div className="p-4 sm:p-6 border rounded-lg bg-card sm:col-span-1 col-span-full order-1">
          <div className="text-sm sm:text-base text-muted-foreground">Merchant</div>
          <div className="font-medium break-words text-sm sm:text-lg">{data.merchant.name || 'N/A'}</div>
          {data.merchant.store_number && (
            <div className="text-xs sm:text-sm text-muted-foreground mt-2">{data.merchant.store_number}</div>
          )}
          {data.merchant.address && (
            <div className="text-xs sm:text-sm text-muted-foreground mt-2 break-words">{data.merchant.address}</div>
          )}
        </div>
        
        {/* Container for Date and Total - 2/3 width on desktop */}
        <div className="grid grid-cols-2 gap-4 col-span-full sm:col-span-2 order-2">
          {/* Date Card */}
          <div className="p-4 sm:p-6 border rounded-lg bg-card">
            <div className="text-sm sm:text-base text-muted-foreground">Date</div>
            <div className="text-primary text-sm sm:text-lg">{data.date || 'N/A'}</div>
          </div>
          
          {/* Total Card */}
          <div className="p-4 sm:p-6 border rounded-lg bg-card">
            <div className="text-sm sm:text-base text-muted-foreground">Total</div>
            <div className="font-medium text-primary text-sm sm:text-lg">{data.total || '$0.00'}</div>
          </div>
        </div>
      </div>

      {/* Items Table - Single table structure */}
      <div className="border rounded-lg shadow-sm mt-6 flex-1">
        <div className="overflow-auto max-h-[calc(100vh-350px)] sm:max-h-[calc(100vh-300px)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[40%] sm:w-[35%] min-w-[120px]">Item</TableHead>
                <TableHead className="hidden sm:table-cell w-[25%] min-w-[120px]">Category</TableHead>
                <TableHead className="w-[20%] sm:w-[10%] min-w-[60px] text-right">Qty</TableHead>
                <TableHead className="hidden sm:table-cell w-[15%] sm:w-[10%] min-w-[80px] text-right">Unit</TableHead>
                <TableHead className="w-[20%] sm:w-[10%] min-w-[80px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="break-words">
                    <div className="text-xs sm:text-base">{item.description}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{item.category || 'N/A'}</TableCell>
                  <TableCell className="text-right text-xs sm:text-base">{item.quantity || '1'}</TableCell>
                  <TableCell className="text-right text-xs sm:text-base">{item.unit_price || '$0.00'}</TableCell>
                  <TableCell className="text-right font-medium text-xs sm:text-base">
                    ${((parseFloat(item.unit_price?.replace('$', '') || '0') * parseFloat(item.quantity || '1')).toFixed(2))}
                  </TableCell>
                </TableRow>
              ))}
              {/* Summary rows as part of the main table */}
              <TableRow className="border-t-2">
                <TableCell colSpan={2} className="font-medium md:hidden">Subtotal</TableCell>
                <TableCell colSpan={3} className="font-medium hidden md:table-cell">Subtotal</TableCell>
                <TableCell className="text-right font-medium">${subtotal.toFixed(2)}</TableCell>
              </TableRow>
              {tax > 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="font-medium md:hidden">Tax</TableCell>
                  <TableCell colSpan={3} className="font-medium hidden md:table-cell">Tax</TableCell>
                  <TableCell className="text-right font-medium">${tax.toFixed(2)}</TableCell>
                </TableRow>
              )}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={2} className="font-bold md:hidden">Total</TableCell>
                <TableCell colSpan={3} className="font-bold hidden md:table-cell">Total</TableCell>
                <TableCell className="text-right font-bold">{data.total}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

interface BoundingBoxOverlayProps {
  words: Array<{
    text: string;
    bounds: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  imageWidth: number;
  imageHeight: number;
}

function BoundingBoxOverlay({ words, imageWidth, imageHeight }: BoundingBoxOverlayProps) {
  return (
    <svg
      className="absolute inset-0"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      style={{ pointerEvents: 'none' }}
    >
      {words.map((word, i) => (
        <rect
          key={i}
          x={word.bounds.x0}
          y={word.bounds.y0}
          width={word.bounds.x1 - word.bounds.x0}
          height={word.bounds.y1 - word.bounds.y0}
          fill="none"
          stroke="rgba(255, 0, 0, 0.5)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}