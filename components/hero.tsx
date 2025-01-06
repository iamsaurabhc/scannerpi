import { CameraModal } from "./camera-modal";

export default function Header() {
  return (
    <div className="flex flex-col gap-8 items-center">
      <h1 className="bg-gradient-to-r from-cyan-600 via-blue-600 to-pink-600 bg-clip-text text-transparent text-5xl lg:text-6xl font-bold text-center">
        ScannerPI
      </h1>
      <p className="text-xl lg:text-2xl !leading-relaxed mx-auto max-w-2xl text-center text-muted-foreground">
        Transform your paper receipts and invoices into structured, actionable data with our intelligent scanning solution
      </p>
      <div className="flex gap-4 justify-center">
        <CameraModal />
      </div>
    </div>
  );
}
