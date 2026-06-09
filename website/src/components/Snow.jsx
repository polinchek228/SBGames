import React from "react";

const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left:     10 + (i * 3.2) % 85,
  size:     8 + (i * 7) % 8,
  delay:    (i * 1.3) % 12,
  duration: 12 + (i * 2.1) % 14,
  sym:      ["❄", "✦", "✲", "❊"][i % 4],
}));

export default function Snow() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
      {FLAKES.map(f => (
        <span key={f.id} className="snowflake"
          style={{ left:`${f.left}%`, fontSize:`${f.size}px`, animationDelay:`${f.delay}s`, animationDuration:`${f.duration}s` }}
        >{f.sym}</span>
      ))}
    </div>
  );
}
