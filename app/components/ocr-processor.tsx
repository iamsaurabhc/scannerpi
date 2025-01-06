import Tesseract, { createWorker, createScheduler, Worker, WorkerOptions } from 'tesseract.js';

// Create a scheduler for parallel processing
const scheduler = createScheduler();
let workers: Worker[] = [];
const NUM_WORKERS = 2; // Number of workers to create

async function initializeWorkers() {
  if (workers.length === 0) {
    // Create single worker with optimized settings
    const worker = await createWorker('eng', 1, {
      workerBlobURL: false,
      workerPath: '/tesseract-worker.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js',
      logger: m => console.log('OCR Progress:', m)
    } as WorkerOptions);

    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/$-():',
      tessjs_create_pdf: '0',
      tessjs_create_hocr: '0',
      tessjs_create_tsv: '0',
    });

    workers.push(worker);
    scheduler.addWorker(worker);
  }
  return scheduler;
}

export async function processImage(imageData: string) {
  try {
    console.log('Starting OCR processing...');
    
    if (!imageData.startsWith('data:image')) {
      throw new Error('Invalid image data format');
    }
    
    console.log('Processing image, data length:', imageData.length);
    
    const img = new Image();
    img.src = imageData;
    img.onload = () => {
      console.log('Image dimensions:', img.width, 'x', img.height);
    };
    
    const currentScheduler = await initializeWorkers();

    // Process the entire image instead of splitting
    const result = await currentScheduler.addJob('recognize', imageData);

    if (!result.data.text) {
      throw new Error('OCR failed to extract text');
    }

    console.log('OCR completed with confidence:', result.data.confidence);
    console.log('Extracted text:', result.data.text.substring(0, 100));
    
    return {
      text: result.data.text,
      confidence: result.data.confidence,
      words: (result.data.words || []).map(word => ({
        text: word.text,
        confidence: word.confidence,
        bounds: {
          x0: word.bbox.x0,
          y0: word.bbox.y0,
          x1: word.bbox.x1,
          y1: word.bbox.y1
        }
      }))
    };
  } catch (error) {
    console.error('OCR Processing Error:', error);
    throw error;
  }
}

// Cleanup function to terminate workers
export async function cleanup() {
  if (workers.length > 0) {
    await scheduler.terminate();
    workers = [];
  }
} 