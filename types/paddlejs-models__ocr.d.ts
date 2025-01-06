declare module '@paddlejs-models/ocr' {
  interface OCRResult {
    text: string;
    // Add other properties if needed based on the actual API response
  }

  export function init(): Promise<void>;
  export function recognize(image: string): Promise<OCRResult>;
}