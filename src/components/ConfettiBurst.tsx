"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = [
  "#10b981", // emerald
  "#34d399",
  "#f59e0b", // amber
  "#fbbf24",
  "#f43f5e", // rose
  "#fb7185",
  "#818cf8", // indigo
  "#38bdf8", // sky
  "#a78bfa", // violet
];

const PIECE_COUNT = 70;

interface Piece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  width: number;
  height: number;
  color: string;
  drift: number;
  spin: number;
}

function makePiece(id: number): Piece {
  return {
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.7,
    duration: 2.2 + Math.random() * 1.7,
    width: 7 + Math.random() * 6,
    height: 3 + Math.random() * 4,
    color: COLORS[id % COLORS.length],
    drift: (Math.random() - 0.5) * 60,
    spin: 360 + Math.random() * 720,
  };
}

/**
 * A brief, dependency-free confetti burst. Rendered above everything when
 * the daily goal is reached; pieces fall for a couple of seconds and the
 * overlay removes itself. Respects prefers-reduced-motion via the global
 * media query. `pieces` lets callers render a smaller, quicker burst (e.g.
 * per-solve celebrations).
 */
export function ConfettiBurst({ pieces = PIECE_COUNT }: { pieces?: number }) {
  const pieceList = useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.min(pieces, 200)) }, (_, i) =>
        makePiece(i),
      ),
    [pieces],
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="confetti-overlay pointer-events-none fixed inset-0 z-[70] overflow-hidden"
    >
      {pieceList.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.width,
              height: p.height,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--drift": `${p.drift}px`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
