"use client";

/**
 * Adapted from KokonutUI ShimmerText (MIT, @dorianbaffier)
 * https://kokonutui.com
 */
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function ShimmerText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <motion.div
      className="relative overflow-hidden"
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.6 }}
    >
      <motion.span
        animate={{
          backgroundPosition: ["200% center", "-200% center"],
        }}
        className={cn(
          "inline-block bg-[length:200%_100%] bg-gradient-to-r from-white via-white/40 to-white bg-clip-text text-transparent",
          className,
        )}
        transition={{
          duration: 3.2,
          ease: "linear",
          repeat: Number.POSITIVE_INFINITY,
        }}
      >
        {text}
      </motion.span>
    </motion.div>
  );
}
