"use client";

import { useId } from "react";
import { getAuthRole, type AuthRole } from "@/lib/authRoleConfig";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

const HUB = { cx: 80, cy: 48 };

const NODES = [
  { cx: 80, cy: 48, r: 5, delay: "0s", floatDelay: "0s" },
  { cx: 48, cy: 88, r: 4, delay: "0.35s", floatDelay: "0.6s" },
  { cx: 112, cy: 88, r: 4, delay: "0.7s", floatDelay: "1.2s" },
  { cx: 80, cy: 118, r: 3.5, delay: "1.05s", floatDelay: "1.8s" },
] as const;

const EDGES = [
  { a: 0, b: 1, path: "M80,48 L48,88", reverse: false, packetBegin: "0s", dur: "2.4s" },
  { a: 0, b: 2, path: "M80,48 L112,88", reverse: true, packetBegin: "0.5s", dur: "2.7s" },
  { a: 0, b: 3, path: "M80,48 L80,118", reverse: false, packetBegin: "1s", dur: "2.2s" },
  { a: 1, b: 3, path: "M48,88 L80,118", reverse: true, packetBegin: "1.4s", dur: "2.9s" },
  { a: 2, b: 3, path: "M112,88 L80,118", reverse: false, packetBegin: "1.8s", dur: "2.5s" },
] as const;

const ORBIT_CENTER = { cx: 80, cy: 82 };
const SPARKLES = [
  { angle: 0, r: 54, delay: "0s" },
  { angle: 72, r: 50, delay: "0.4s" },
  { angle: 144, r: 56, delay: "0.8s" },
  { angle: 216, r: 52, delay: "1.2s" },
  { angle: 288, r: 55, delay: "1.6s" },
] as const;

function sparklePosition(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    cx: ORBIT_CENTER.cx + radius * Math.cos(rad),
    cy: ORBIT_CENTER.cy + radius * Math.sin(rad),
  };
}

export default function AuthNodeIllustration({
  className,
  role,
}: {
  className?: string;
  role?: AuthRole;
}) {
  const uid = useId().replace(/:/g, "");
  const reducedMotion = usePrefersReducedMotion();
  const accent = role ? getAuthRole(role) : null;
  const isAdmin = role === "admin";
  const strokeMain = isAdmin
    ? "hsl(var(--brand-group))"
    : "hsl(var(--brand-workspace))";
  const strokeAccent = isAdmin ? "hsl(var(--primary))" : "hsl(var(--brand-chat))";

  const lineGrad = `${uid}-line`;
  const coreGrad = `${uid}-core`;
  const packetGrad = `${uid}-packet`;
  const glowFilter = `${uid}-glow`;

  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[220px]",
        !reducedMotion && "motion-reduce:animate-none animate-auth-illustration-drift",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-[-12%] rounded-full blur-2xl transition-colors duration-700 motion-reduce:transition-none",
          accent
            ? cn("bg-gradient-to-br opacity-75", accent.surfaces.glow)
            : "bg-primary/15 dark:bg-primary/20",
          !reducedMotion && "motion-reduce:animate-none animate-auth-glow"
        )}
      />
      <div
        className={cn(
          "absolute inset-[-6%] rounded-full blur-xl opacity-40 transition-opacity duration-700",
          isAdmin ? "bg-brand-group/30" : "bg-brand-workspace/25",
          !reducedMotion && "motion-reduce:animate-none animate-auth-glow [animation-delay:1.2s]"
        )}
        aria-hidden
      />

      <svg
        viewBox="0 0 160 160"
        className="relative w-full drop-shadow-md"
        aria-hidden
      >
        <defs>
          <linearGradient id={lineGrad} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={strokeMain} stopOpacity="0.12" />
            <stop offset="45%" stopColor={strokeMain} stopOpacity="0.7" />
            <stop offset="100%" stopColor={strokeAccent} stopOpacity="0.35" />
          </linearGradient>
          <radialGradient id={coreGrad}>
            <stop offset="0%" stopColor={strokeMain} stopOpacity="1" />
            <stop offset="55%" stopColor={strokeMain} stopOpacity="0.65" />
            <stop offset="100%" stopColor={strokeAccent} stopOpacity="0.2" />
          </radialGradient>
          <radialGradient id={packetGrad}>
            <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity="0.95" />
            <stop offset="100%" stopColor={strokeMain} stopOpacity="0.4" />
          </radialGradient>
          <filter id={glowFilter} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Counter-rotating outer orbit */}
        <g
          className={cn(
            !reducedMotion && "motion-reduce:animate-none animate-auth-orbit-reverse"
          )}
          style={{ transformOrigin: `${ORBIT_CENTER.cx}px ${ORBIT_CENTER.cy}px` }}
        >
          <circle
            cx={ORBIT_CENTER.cx}
            cy={ORBIT_CENTER.cy}
            r="58"
            fill="none"
            stroke={strokeMain}
            strokeOpacity="0.08"
            strokeWidth="0.75"
            strokeDasharray="2 10"
          />
        </g>

        {/* Primary orbit + sparkles */}
        <g
          className={cn(!reducedMotion && "motion-reduce:animate-none animate-auth-orbit")}
          style={{ transformOrigin: `${ORBIT_CENTER.cx}px ${ORBIT_CENTER.cy}px` }}
        >
          <circle
            cx={ORBIT_CENTER.cx}
            cy={ORBIT_CENTER.cy}
            r="52"
            fill="none"
            stroke={strokeMain}
            strokeOpacity="0.14"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx={ORBIT_CENTER.cx}
            cy={ORBIT_CENTER.cy}
            r="52"
            fill="none"
            stroke={`url(#${lineGrad})`}
            strokeOpacity="0.35"
            strokeWidth="1.5"
            strokeDasharray="20 108"
            strokeLinecap="round"
          />

          {SPARKLES.map(({ angle, r, delay }) => {
            const { cx, cy } = sparklePosition(angle, r);
            return (
              <circle
                key={angle}
                cx={cx}
                cy={cy}
                r="1.5"
                fill={strokeAccent}
                fillOpacity="0.85"
                className={cn(!reducedMotion && "motion-reduce:animate-none animate-auth-sparkle")}
                style={{ animationDelay: delay }}
              />
            );
          })}
        </g>

        {/* Hub ripple rings */}
        {[0, 0.95, 1.9].map((begin, i) => (
          <circle
            key={i}
            cx={HUB.cx}
            cy={HUB.cy}
            r={14}
            fill="none"
            stroke={strokeMain}
            strokeWidth="1"
            strokeOpacity="0.3"
          >
            {!reducedMotion ? (
              <>
                <animate
                  attributeName="r"
                  values="12;26"
                  dur="2.8s"
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="stroke-opacity"
                  values="0.45;0"
                  dur="2.8s"
                  begin={`${begin}s`}
                  repeatCount="indefinite"
                />
              </>
            ) : null}
          </circle>
        ))}

        {/* Edge base + flowing dashes */}
        {EDGES.map(({ a, b, path, reverse }, i) => (
          <g key={path}>
            <line
              x1={NODES[a].cx}
              y1={NODES[a].cy}
              x2={NODES[b].cx}
              y2={NODES[b].cy}
              stroke={strokeMain}
              strokeOpacity="0.12"
              strokeWidth="1"
              strokeLinecap="round"
            />
            <line
              x1={NODES[a].cx}
              y1={NODES[a].cy}
              x2={NODES[b].cx}
              y2={NODES[b].cy}
              stroke={`url(#${lineGrad})`}
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeDasharray="6 26"
              className={cn(
                !reducedMotion &&
                  (reverse
                    ? "motion-reduce:animate-none animate-auth-dash-travel-reverse"
                    : "motion-reduce:animate-none animate-auth-dash-travel")
              )}
              style={{ animationDelay: `${i * 0.22}s` }}
            />
            <line
              x1={NODES[a].cx}
              y1={NODES[a].cy}
              x2={NODES[b].cx}
              y2={NODES[b].cy}
              stroke={strokeAccent}
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="2 30"
              strokeOpacity="0.5"
              className={cn(!reducedMotion && "motion-reduce:animate-none animate-auth-edge")}
              style={{ animationDelay: `${i * 0.18 + 0.4}s` }}
            />
          </g>
        ))}

        {/* Traveling data packets along edges */}
        {!reducedMotion
          ? EDGES.map(({ path, packetBegin, dur }) => (
              <g key={`packet-${path}`}>
                <circle r="2.75" fill={`url(#${packetGrad})`} filter={`url(#${glowFilter})`}>
                  <animateMotion
                    dur={dur}
                    repeatCount="indefinite"
                    path={path}
                    begin={packetBegin}
                    calcMode="spline"
                    keySplines="0.4 0 0.2 1"
                    keyTimes="0;1"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.35;1;0.35"
                    dur={dur}
                    repeatCount="indefinite"
                    begin={packetBegin}
                  />
                  <animate
                    attributeName="r"
                    values="2;3.25;2"
                    dur={dur}
                    repeatCount="indefinite"
                    begin={packetBegin}
                  />
                </circle>
              </g>
            ))
          : null}

        {/* Satellite node halos + cores */}
        {NODES.map((node, i) => {
          const isHub = i === 0;
          return (
            <g
              key={i}
              className={cn(
                !reducedMotion &&
                  !isHub &&
                  "motion-reduce:animate-none animate-auth-node-float"
              )}
              style={
                !isHub && !reducedMotion
                  ? { animationDelay: node.floatDelay, transformOrigin: `${node.cx}px ${node.cy}px` }
                  : undefined
              }
            >
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r + 7}
                fill={strokeMain}
                fillOpacity="0.06"
                className={cn(!reducedMotion && "motion-reduce:animate-none animate-auth-node-pulse")}
                style={{ animationDelay: node.delay }}
              />
              {!isHub ? (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r + 3}
                  fill="none"
                  stroke={strokeAccent}
                  strokeWidth="0.75"
                  strokeOpacity="0.2"
                  className={cn(!reducedMotion && "motion-reduce:animate-none animate-auth-node-pulse")}
                  style={{ animationDelay: `calc(${node.delay} + 0.5s)` }}
                />
              ) : null}
              <circle
                cx={node.cx}
                cy={node.cy}
                r={node.r}
                fill={isHub ? `url(#${coreGrad})` : "hsl(var(--card))"}
                stroke={strokeMain}
                strokeWidth={isHub ? 2 : 1.5}
                strokeOpacity={isHub ? 0.65 : 0.4}
                filter={isHub ? `url(#${glowFilter})` : undefined}
              >
                {isHub && !reducedMotion ? (
                  <animate
                    attributeName="r"
                    values={`${node.r};${node.r + 1.25};${node.r}`}
                    dur="3.2s"
                    repeatCount="indefinite"
                  />
                ) : null}
              </circle>
              {isHub ? (
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={2}
                  fill="hsl(var(--foreground))"
                  fillOpacity="0.9"
                >
                  {!reducedMotion ? (
                    <animate
                      attributeName="opacity"
                      values="0.5;1;0.5"
                      dur="2.2s"
                      repeatCount="indefinite"
                    />
                  ) : null}
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
