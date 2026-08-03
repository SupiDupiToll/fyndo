"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

let scannerId = 0;

type CameraOption = { deviceId: string; label: string };

let activeScanner: Html5Qrcode | null = null;

function stopQr(qr: Html5Qrcode | null) {
  if (!qr) return;
  if (activeScanner === qr) activeScanner = null;
  try {
    qr.stop();
  } catch {
    // already stopped or never started
  }
  try {
    qr.clear();
  } catch {
    // ignore
  }
}

function waitForFrames(containerId: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      const container = document.getElementById(containerId);
      const video = container?.querySelector<HTMLVideoElement>("video");
      if (video && video.videoWidth > 0 && video.readyState >= 2) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 150);
  });
}

function sortBackFirst(list: CameraOption[]): CameraOption[] {
  const frontRe = /front|user|webcam|integrated|vorne|vorder|facetime/i;
  const backRe = /back|rear|environment|hinten|rück/i;
  return [...list].sort((a, b) => {
    const rank = (c: CameraOption) =>
      backRe.test(c.label) ? 0 : frontRe.test(c.label) ? 2 : 1;
    return rank(a) - rank(b);
  });
}

export function CardScanner({
  onScan,
  onError,
}: {
  onScan: (text: string) => void;
  onError: (message: string) => void;
}) {
  const elementIdRef = useRef<string>(`fyndo-card-scanner-${++scannerId}`);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const camerasRef = useRef<CameraOption[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [cameras, setCameras] = useState<CameraOption[]>([]);

  function resolveConfig(idx: number): MediaTrackConstraints {
    const list = camerasRef.current;
    if (list.length > 0) {
      const cam = list[idx % list.length];
      if (cam.deviceId) return { deviceId: { exact: cam.deviceId } };
    }
    return idx % 2 === 0 ? { facingMode: "environment" } : { facingMode: "user" };
  }

  useEffect(() => {
    let cancelled = false;

    const style = document.createElement("style");
    style.textContent = `#${elementIdRef.current} video { width: 100% !important; height: 100% !important; object-fit: cover; }`;
    document.head.appendChild(style);

    async function syncCameras(qr: Html5Qrcode) {
      if (cancelled) return;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const list = sortBackFirst(
          devices
            .filter((d) => d.kind === "videoinput")
            .map((d) => ({ deviceId: d.deviceId, label: d.label || "Kamera" })),
        );
        if (list.length === 0) return;
        camerasRef.current = list;
        setCameras(list);
        let idx = 0;
        try {
          const settings = qr.getRunningTrackSettings();
          if (settings.deviceId) {
            const match = list.findIndex((d) => d.deviceId === settings.deviceId);
            if (match >= 0) idx = match;
          }
        } catch {
          // fall back to back camera
        }
        setCameraIdx(idx);
      } catch {
        // ignore, switching still works via facingMode fallback
      }
    }

    async function run() {
      const configs = [resolveConfig(cameraIdx)];
      if (camerasRef.current.length === 0) configs.push({});

      for (const config of configs) {
        if (cancelled) return;
        stopQr(activeScanner);
        const qr = new Html5Qrcode(elementIdRef.current, { verbose: false });
        activeScanner = qr;
        qrRef.current = qr;
        try {
          await qr.start(
            config,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (text) => {
              if (cancelled) return;
              stopQr(qr);
              onScan(text);
            },
            () => {},
          );
          const framesOk = await waitForFrames(elementIdRef.current, 2500);
          if (!framesOk) {
            stopQr(qr);
            continue;
          }
          void syncCameras(qr);
          return;
        } catch {
          stopQr(qr);
        }
      }

      if (!cancelled) {
        onError("Kamera konnte nicht gestartet werden. Bitte Kamera-Berechtigung erlauben.");
      }
    }

    void run();

    return () => {
      cancelled = true;
      stopQr(activeScanner);
      stopQr(qrRef.current);
      document.getElementById(style.id)?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIdx]);

  const cameraCount = Math.max(cameras.length, 2);
  const currentLabel = cameras.length > 0 ? cameras[cameraIdx % cameras.length].label : null;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-64 h-64 sm:w-72 sm:h-72 overflow-hidden rounded-2xl border-2 border-dashed border-accent/50 bg-black">
        <div
          ref={(el) => {
            if (el) el.id = elementIdRef.current;
          }}
          className="w-full h-full"
        />
      </div>
      <button
        type="button"
        onClick={() => setCameraIdx((i) => (i + 1) % cameraCount)}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-accent hover:bg-surf"
      >
        <i className="fa-solid fa-camera-rotate text-accent" />
        Kamera wechseln
        {currentLabel && <span className="max-w-32 truncate text-mute font-normal">{currentLabel}</span>}
      </button>
      <p className="mt-4 text-sm text-mute max-w-sm">
        Halte den QR-Code deiner Karte in das Kamerafeld. Deine Bestellnummer wird danach hier angezeigt.
      </p>
    </div>
  );
}
