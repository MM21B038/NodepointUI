"use client";

import { cn } from "@/lib/utils";

const MARK_ID = "nodepoint-logo-mark";

interface NodepointLogoProps {
  className?: string;
  size?: number;
  /** Full gradient badge (default) or single-color mark for constrained contexts. */
  variant?: "brand" | "mono";
}

export function NodepointLogo({
  className,
  size = 24,
  variant = "brand",
}: NodepointLogoProps) {
  const gradientId = `${MARK_ID}-bg-${size}`;
  const glowId = `${MARK_ID}-glow-${size}`;

  if (variant === "mono") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        width={size}
        height={size}
        fill="none"
        className={cn("shrink-0 text-primary", className)}
        aria-hidden
      >
        <path
          d="M16 9.5 10.5 20.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M16 9.5 21.5 20.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M16 9.5V23.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="16" cy="9.5" r="3" fill="currentColor" />
        <circle cx="10.5" cy="20.5" r="2.25" fill="currentColor" opacity="0.85" />
        <circle cx="21.5" cy="20.5" r="2.25" fill="currentColor" opacity="0.85" />
        <circle cx="16" cy="23.5" r="1.75" fill="currentColor" opacity="0.7" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={glowId} x1="16" y1="8" x2="16" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#BFDBFE" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
      <path
        d="M16 9.5 10.5 20.5"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.88"
      />
      <path
        d="M16 9.5 21.5 20.5"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.88"
      />
      <path
        d="M16 9.5V23.5"
        stroke="#FFFFFF"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.92"
      />
      <path
        d="M10.5 20.5H21.5"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="16" cy="9.5" r="3.25" fill={`url(#${glowId})`} />
      <circle cx="10.5" cy="20.5" r="2.35" fill="#FFFFFF" opacity="0.96" />
      <circle cx="21.5" cy="20.5" r="2.35" fill="#FFFFFF" opacity="0.96" />
      <circle cx="16" cy="23.5" r="1.85" fill="#E0E7FF" />
    </svg>
  );
}
