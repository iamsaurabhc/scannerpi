import { CameraModal } from "./camera-modal";

export default function Header() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <h1 className="bg-gradient-to-r from-cyan-600 via-blue-600 to-pink-600 bg-clip-text text-transparent text-5xl lg:text-6xl font-bold text-center">
        ScannerPI
      </h1>
      <div className="flex flex-col gap-4 text-center">
        {/* <h2 className="text-xl lg:text-3xl font-semibold">
          Scan Receipts, Export in CSV
        </h2> */}
        <h3 className="text-xl lg:text-2xl text-muted-foreground">
          Advanced LLM Vision AI and OCR
        </h3>
      </div>
      <p className="text-lg lg:text-xl !leading-relaxed mx-auto max-w-2xl text-center text-muted-foreground">
        Automate expense tracking, sales, bills and anything else - export to structured CSV format. Powered by advanced AI for accurate data extraction.
      </p>
      <div className="flex gap-4 justify-center">
        <CameraModal projectId="demo"/>
      </div>
    </div>
  );
}
