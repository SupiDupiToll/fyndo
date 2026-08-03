"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

let scannerId = 0;

const FALLBACK_CONFIGS: MediaTrackConstraints[] = [
  { facingMode: "environment" },
  { facingMode: "user" },
  {},
];

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

export function CardScanner({
  onScan,
  onError,
}: {
  onScan: (text: string) => void;
  onError: (message: string) => void;
}) {
  const elementIdRef = useRef<string>(`fyndo-card-scanner-${++scannerId}`);
  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let cancelled = false;

    const style = document.createElement("style");
    style.textContent = `#${elementIdRef.current} video { width: 100% !important; height: 100% !important; object-fit: cover; }`;
    document.head.appendChild(style);

    async function start() {
      for (const config of FALLBACK_CONFIGS) {
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
          return;
        } catch {
          stopQr(qr);
        }
      }

      if (!cancelled) {
        onError("Kamera konnte nicht gestartet werden. Bitte Kamera-Berechtigung erlauben.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      stopQr(activeScanner);
      stopQr(qrRef.current);
      document.getElementById(style.id)?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <p className="mt-5 text-sm text-mute max-w-sm">
        Halte den QR-Code deiner Karte in das Kamerafeld. Deine Bestellnummer wird danach hier angezeigt.
      </p>
    </div>
  );
}
