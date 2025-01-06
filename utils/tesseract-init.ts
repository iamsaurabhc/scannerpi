import Tesseract, { Worker, WorkerOptions } from 'tesseract.js';

let worker: Tesseract.Worker | null = null;

export async function initTesseract() {
  if (!worker) {
    worker = await Tesseract.createWorker('eng', 1, {
      workerBlobURL: false,
      workerPath: '/tesseract-worker.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js'
    } as WorkerOptions);
    await worker.recognize('eng');
  }
  return worker;
}

export function getWorker() {
  return worker;
} 