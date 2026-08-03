"use client";

/**
 * Adapted from KokonutUI ParticleButton success burst (MIT, @dorianbaffier)
 * https://kokonutui.com
 */
import { motion } from "motion/react";

const COLORS = ["#ffffff", "#c7d2fe", "#93c5fd", "#a5b4fc", "#e0e7ff"];

export function SuccessBurst() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    angle: (i / 24) * Math.PI * 2,
    distance: 90 + Math.random() * 110,
    size: 5 + Math.random() * 7,
    delay: Math.random() * 0.15,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: COLORS[p.id % COLORS.length],
          }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            scale: 1,
            opacity: 0,
          }}
          transition={{
            duration: 1.1,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
