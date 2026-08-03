"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

let scannerId = 0;

function stopQr(qr: Html5Qrcode | null) {
  if (!qr) return;
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

export function CardScanner({
  onScan,
  onError,
}: {
  onScan: (text: string) => void;
  onError: (message: string) => void;
}) {
  const elementIdRef = useRef<string>(`fyndo-card-scanner-${++scannerId}`);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const runningRef = useRef(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const qr = new Html5Qrcode(elementIdRef.current, { verbose: false });
      qrRef.current = qr;
      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            if (cancelled || finishedRef.current) return;
            finishedRef.current = true;
            runningRef.current = false;
            stopQr(qr);
            onScan(text);
          },
          () => {},
        );
        runningRef.current = true;
      } catch {
        if (!cancelled) {
          onError("Kamera konnte nicht gestartet werden. Bitte Kamera-Berechtigung erlauben.");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (runningRef.current || !finishedRef.current) {
        stopQr(qrRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-64 h-64 sm:w-72 sm:h-72 overflow-hidden rounded-2xl border-2 border-dashed border-accent/50 bg-black flex items-center justify-center">
        <div ref={(el) => {
          if (el) el.id = elementIdRef.current;
        }} className="w-full h-full" />
      </div>
      <p className="mt-5 text-sm text-mute max-w-sm">
        Halte den QR-Code deiner Karte in das Kamerafeld. Deine Bestellnummer wird danach hier angezeigt.
      </p>
    </div>
  );
}
