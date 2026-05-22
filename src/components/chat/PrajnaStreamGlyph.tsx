"use client";
// @refresh reset

import { cn } from "@/lib/utils";

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300] as const;

interface PrajnaStreamGlyphProps {
  className?: string;
  size?: "sm" | "md";
}

const sizeClass = {
  sm: "h-[1.125rem] w-[1.125rem]",
  md: "h-5 w-5",
} as const;

/**
 * Morphing asterisk for live **response** streaming (not pre-stream connecting UI).
 * Uses HTML layers (not SVG) so Tailwind transform animations work in all browsers.
 */
export function PrajnaStreamGlyph({ className, size = "sm" }: PrajnaStreamGlyphProps) {
  return (
    <span
      className={cn(
        "relative inline-block shrink-0 align-text-bottom leading-none overflow-visible",
        sizeClass[size],
        className
      )}
      aria-hidden
    >
      <span className="relative block h-full w-full overflow-visible">
        <span
          className={cn(
            "absolute inset-0 will-change-transform",
            "animate-stream-glyph-spin motion-reduce:animate-none"
          )}
        >
          <span
            className={cn(
              "absolute inset-0 will-change-transform",
              "animate-stream-glyph-counter motion-reduce:animate-none"
            )}
          >
            {PETAL_ANGLES.map((deg, i) => (
              <span
                key={deg}
                className="absolute inset-0"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <span
                  className={cn(
                    "absolute bottom-1/2 left-1/2 block w-[2.5px] -translate-x-1/2",
                    "h-[44%] origin-bottom rounded-full",
                    "bg-gradient-to-t from-violet-700 via-fuchsia-400 to-violet-300",
                    "will-change-[transform,opacity]",
                    "animate-stream-ray motion-reduce:animate-none"
                  )}
                  style={{ animationDelay: `${i * 0.11}s` }}
                />
              </span>
            ))}
          </span>
        </span>
        <span className="absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2">
          <span
            className={cn(
              "block h-full w-full rounded-full",
              "bg-gradient-to-br from-violet-600 via-fuchsia-400 to-violet-300",
              "will-change-[transform,opacity]",
              "animate-stream-core motion-reduce:animate-none"
            )}
          />
        </span>
      </span>
    </span>
  );
}
