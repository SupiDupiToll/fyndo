"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { PosLockMedia } from "@/lib/pos-settings";
import { AttractButton } from "@/components/kokonutui/attract-button";
import { ShimmerText } from "@/components/kokonutui/shimmer-text";

type LockScreenProps = {
  vendorName: string;
  media: PosLockMedia[];
  onStart: () => void;
};

const SLIDE_INTERVAL_MS = 6000;

export function LockScreen({ vendorName, media, onStart }: LockScreenProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (media.length < 2) return;
    const t = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % media.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(t);
  }, [media.length]);

  const hasMedia = media.length > 0;

  return (
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden bg-ink select-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {hasMedia ? (
        <div className="absolute inset-0">
          {media.map((item, idx) => {
            const active = idx === activeIndex;
            const layerCls = `absolute inset-0 transition-opacity duration-1000 ${active ? "opacity-100" : "opacity-0"}`;
            return (
              <div key={`${item.type}-${item.url}`} className={layerCls} aria-hidden={!active}>
                {item.type === "video" ? (
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt=""
                    className={`h-full w-full object-cover ${active ? "animate-[kenburns_20s_ease-in-out_infinite]" : ""}`}
                    draggable={false}
                  />
                )}
              </div>
            );
          })}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/30 to-ink/40" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-accent via-ink to-ink">
          {[
            { top: "-10%", left: "-10%", size: 380, delay: 0 },
            { top: "55%", left: "60%", size: 420, delay: 1.4 },
            { top: "10%", left: "70%", size: 240, delay: 0.7 },
          ].map((orb, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-accent/25 blur-3xl"
              style={{
                top: orb.top,
                left: orb.left,
                width: orb.size,
                height: orb.size,
              }}
              animate={{ y: [0, -24, 0], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 9 + i * 2, delay: orb.delay, repeat: Infinity, ease: "easeInOut" }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-10 sm:py-14 text-center text-white">
        <motion.div
          className="mt-6 sm:mt-10 flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur border border-white/20"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <i className="fa-solid fa-basket-shopping text-2xl" />
          </motion.div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.3em] text-white/70">
            Tippen &amp; Bestellen
          </p>
          <ShimmerText
            text={`${vendorName}.`}
            className="mt-3 text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight"
          />
        </motion.div>

        <motion.div
          className="w-full max-w-md pb-4 sm:pb-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: "easeOut" }}
        >
          <AttractButton
            onClick={onStart}
            label="Jetzt bestellen"
            className="w-full"
            aria-label="Jetzt bestellen"
          />
          <motion.p
            className="mt-4 text-sm text-white/70"
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <i className="fa-solid fa-hand-pointer mr-1.5" />
            Tippen Sie auf den Bildschirm, um zu starten
          </motion.p>
        </motion.div>
      </div>

      <style>{`@keyframes kenburns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }`}</style>
    </motion.div>
  );
}
