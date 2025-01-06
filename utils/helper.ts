// Helper functions to extract information from text
export function extractDateFromText(text: string, words: Array<any>): string {
    // Enhanced date regex to catch more formats
    const dateRegex = /(?:\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})|(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/g;
    const match = text.match(dateRegex);
    console.log('Date extraction:', { text: text.substring(0, 100), match });
    return match ? match[0] : "";
  }
  
  export function extractTotalFromText(text: string, words: Array<any>): string {
    // Enhanced regex to catch more total amount formats
    const totalRegex = /(?:total|amount|sum|due|balance).*?\$?\s*(\d+\.?\d*)/i;
    const match = text.match(totalRegex);
    console.log('Total extraction:', { text: text.substring(0, 100), match });
    return match ? `$${match[1]}` : "";
  }
  
 export function extractMerchantFromText(text: string, words: Array<any>): string {
    // Look for merchant name in first few lines
    const lines = text.split('\n').slice(0, 3);
    // Filter out lines that look like dates or amounts
    const potentialMerchants = lines.filter(line => {
      const isDate = /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(line);
      const isAmount = /\$?\d+\.\d{2}/.test(line);
      return !isDate && !isAmount && line.trim().length > 0;
    });
    
    const merchant = potentialMerchants[0]?.trim() || "";
    console.log('Merchant extraction:', { lines, merchant });
    return merchant;
  }
  
  export function extractLineItemsFromText(
    text: string, 
    words?: Array<{text: string; bounds: any}>
  ): Array<{ description: string; amount: number; bounds?: any }> {
    const items: Array<{ description: string; amount: number; bounds?: any }> = [];
    
    if (!words) return items;
  
    // Sort words by Y position to group them into lines
    const sortedWords = [...words].sort((a, b) => a.bounds.y0 - b.bounds.y0);
    
    // Group words that are on the same line (within a small Y threshold)
    const yThreshold = 5; // pixels
    let currentLine: typeof words = [];
    let currentY = sortedWords[0]?.bounds.y0;
  
    sortedWords.forEach(word => {
      if (Math.abs(word.bounds.y0 - currentY) <= yThreshold) {
        currentLine.push(word);
      } else {
        // Process the current line
        const line = processLine(currentLine);
        if (line) items.push(line);
        
        // Start new line
        currentLine = [word];
        currentY = word.bounds.y0;
      }
    });
  
    // Process the last line
    const lastLine = processLine(currentLine);
    if (lastLine) items.push(lastLine);
  
    return items;
  }
  
  export function processLine(
    words: Array<{text: string; bounds: any}>
  ): { description: string; amount: number; bounds: any } | null {
    if (words.length === 0) return null;
  
    // Sort words by X position
    const sortedWords = [...words].sort((a, b) => a.bounds.x0 - b.bounds.x0);
    
    // Find potential price at the end of the line
    const priceRegex = /\$?\d+\.?\d*/;
    const lastWord = sortedWords[sortedWords.length - 1];
    
    if (priceRegex.test(lastWord.text)) {
      const amount = parseFloat(lastWord.text.replace('$', ''));
      const description = sortedWords
        .slice(0, -1)
        .map(w => w.text)
        .join(' ')
        .trim();
  
      return {
        description,
        amount,
        bounds: {
          x0: Math.min(...words.map(w => w.bounds.x0)),
          y0: Math.min(...words.map(w => w.bounds.y0)),
          x1: Math.max(...words.map(w => w.bounds.x1)),
          y1: Math.max(...words.map(w => w.bounds.y1))
        }
      };
    }
  
    return null;
  } 