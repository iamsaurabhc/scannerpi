import { extractDateFromText, extractLineItemsFromText, extractMerchantFromText, extractTotalFromText } from "@/utils/helper";
import { NextResponse } from "next/server";
import Tesseract from 'tesseract.js';

interface StructuredReceipt {
  date?: string;
  total?: string;
  merchant?: string;
  line_items?: Array<{
    description?: string;
    amount?: number;
    bounds?: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
  words?: Array<{
    text: string;
    confidence: number;
    bounds: {
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    };
  }>;
}

export async function POST(request: Request) {
  try {
    console.log('Starting receipt processing...');
    const { image } = await request.json();
    
    // Process the image with Tesseract with detailed logging
    const result = await Tesseract.recognize(
      image,
      'eng',
      { 
        logger: m => console.log('OCR Status:', m.status),
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js'
      }
    );
    
    // Log the detailed OCR results
    console.log('OCR Completed. Results:', {
      text: result.data.text,
      confidence: result.data.confidence,
      words: result.data.words?.length,
      paragraphs: result.data.paragraphs?.length,
      lines: result.data.lines?.length,
    });

    // Continue with the existing parsing logic
    const extractedText = result.data.text;
    const words = result.data.words?.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bounds: {
        x0: word.bbox.x0,
        y0: word.bbox.y0,
        x1: word.bbox.x1,
        y1: word.bbox.y1
      }
    }));

    const parsedData = {
      date: extractDateFromText(extractedText, words),
      total: extractTotalFromText(extractedText, words),
      merchant: extractMerchantFromText(extractedText, words),
      line_items: extractLineItemsFromText(extractedText, words),
      words: words
    };

    console.log('Parsed receipt data:', parsedData);
    
    // Format and return the data as before
    const formattedData = {
      date: parsedData.date || "",
      total: parsedData.total || "",
      merchant: parsedData.merchant || "",
      line_items: (parsedData.line_items || []).map(item => ({
        description: item.description || 'Unknown Item',
        amount: item.amount ? `$${item.amount}` : '$0.00'
      }))
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error processing receipt:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to process receipt' },
      { status: 500 }
    );
  }
}

