"use client";

/**
 * Adapted from KokonutUI AttractButton (MIT, @dorianbaffier)
 * https://kokonutui.com
 */
import { Magnet } from "lucide-react";
import { motion, useAnimation } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AttractButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  particleCount?: number;
  label?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
}

export function AttractButton({
  className,
  particleCount = 14,
  label = "Jetzt bestellen",
  ...props
}: AttractButtonProps) {
  const [isAttracting, setIsAttracting] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesControl = useAnimation();

  useEffect(() => {
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 360 - 180,
      y: Math.random() * 360 - 180,
    }));
    setParticles(newParticles);
  }, [particleCount]);

  const handleInteractionStart = useCallback(async () => {
    setIsAttracting(true);
    await particlesControl.start({
      x: 0,
      y: 0,
      transition: { type: "spring", stiffness: 50, damping: 10 },
    });
  }, [particlesControl]);

  const handleInteractionEnd = useCallback(async () => {
    setIsAttracting(false);
    await particlesControl.start((i) => ({
      x: particles[i].x,
      y: particles[i].y,
      transition: { type: "spring", stiffness: 100, damping: 15 },
    }));
  }, [particlesControl, particles]);

  return (
    <button
      className={cn(
        "relative touch-none overflow-visible rounded-full bg-accent px-10 py-6 text-xl sm:text-2xl font-black text-white",
        "shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)] transition-all duration-300",
        "hover:bg-accent-hover active:scale-[0.97]",
        className,
      )}
      onMouseEnter={handleInteractionStart}
      onMouseLeave={handleInteractionEnd}
      onTouchStart={handleInteractionStart}
      onTouchEnd={handleInteractionEnd}
      {...props}
    >
      {particles.map((_, index) => (
        <motion.div
          key={index}
          animate={particlesControl}
          custom={index}
          initial={{ x: particles[index].x, y: particles[index].y }}
          className={cn(
            "absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white",
            "transition-opacity duration-300",
            isAttracting ? "opacity-100" : "opacity-30",
          )}
        />
      ))}
      <span className="relative flex w-full items-center justify-center gap-3">
        <Magnet
          className={cn(
            "h-5 w-5 transition-transform duration-300",
            isAttracting && "scale-125 rotate-12",
          )}
        />
        {label}
      </span>
    </button>
  );
}
