"use client";

import { useState, useRef } from "react";

const STREAMSHARE_URL = "https://streamshare.wireway.ch";

type CameraUploadProps = {
  onUrl: (url: string) => void;
  currentUrl?: string;
};

export function CameraUpload({ onUrl, currentUrl }: CameraUploadProps) {
  const [mode, setMode] = useState<"idle" | "camera" | "uploading">("idle");
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMode("idle");
  }

  async function startCamera() {
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setMode("idle");
    }
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopCamera();
      await uploadToStreamshare(blob);
    }, "image/jpeg", 0.85);
  }

  async function uploadToStreamshare(blob: Blob) {
    setMode("uploading");
    try {
      const file = new File([blob], `produkt-${Date.now()}.jpg`, { type: "image/jpeg" });

      const createRes = await fetch(`${STREAMSHARE_URL}/api/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name }),
      });
      if (!createRes.ok) throw new Error("Upload failed");
      const { fileIdentifier } = await createRes.json();

      const ws = new WebSocket(`${STREAMSHARE_URL.replace("https", "wss")}/api/upload/${fileIdentifier}`);
      await new Promise<void>((resolve, reject) => {
        ws.onopen = async () => {
          const reader = new FileReader();
          reader.onload = () => {
            ws.send(reader.result as ArrayBuffer);
          };
          reader.onerror = () => reject(new Error("File read failed"));
          reader.readAsArrayBuffer(file);

          ws.onmessage = (msg) => {
            if (msg.data === "ACK") {
              ws.close();
              resolve();
            }
          };
          ws.onerror = () => reject(new Error("WebSocket error"));
        };
      });

      const url = `${STREAMSHARE_URL}/download/${fileIdentifier}`;
      setPreviewUrl(url);
      onUrl(url);
    } catch {
      setMode("idle");
    }
  }

  return (
    <div className="space-y-3">
      {currentUrl && currentUrl === previewUrl && previewUrl && (
        <img src={previewUrl} alt="" className="h-32 w-32 rounded-xl border border-line object-contain p-2 bg-tile" />
      )}

      {mode === "camera" && (
        <div className="relative bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} autoPlay playsInline className="w-full aspect-[4/3] object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
            <button onClick={stopCamera} className="rounded-full bg-white/80 px-5 py-2 text-sm font-bold text-ink backdrop-blur hover:bg-white transition-colors">Abbrechen</button>
            <button onClick={capture} className="rounded-full bg-accent px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 transition-colors">Foto machen</button>
          </div>
        </div>
      )}

      {mode === "uploading" && (
        <div className="flex items-center gap-3 text-sm text-mute">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
          Foto wird hochgeladen...
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="url"
          value={previewUrl}
          onChange={(e) => { setPreviewUrl(e.target.value); onUrl(e.target.value); }}
          placeholder="https://..."
          className="flex-1 rounded-xl border border-line bg-white px-5 py-3 outline-none focus:border-accent transition-colors text-sm"
        />
        <button
          type="button"
          onClick={startCamera}
          disabled={mode !== "idle"}
          className="rounded-xl bg-surf border border-line px-4 py-3 text-sm font-bold hover:bg-tile transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Kamera
        </button>
      </div>
    </div>
  );
}
