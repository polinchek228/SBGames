import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export default function CustomCursor() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [dot, setDot] = useState({ x: -100, y: -100 });
  const [clicking, setClicking] = useState(false);
  const [hovering, setHovering] = useState(false);
  const rafRef = useRef(null);
  const targetRef = useRef({ x: -100, y: -100 });

  useEffect(() => {
    const onMove = (e) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      setDot({ x: e.clientX, y: e.clientY });
    };
    const onDown = () => setClicking(true);
    const onUp   = () => setClicking(false);

    const onEnter = (e) => {
      if (e.target.closest("button, a, input, textarea, [role=button], label")) {
        setHovering(true);
      }
    };
    const onLeave = (e) => {
      if (e.target.closest("button, a, input, textarea, [role=button], label")) {
        setHovering(false);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup",   onUp);
    document.addEventListener("mouseover",  onEnter);
    document.addEventListener("mouseout",   onLeave);

    // Smooth ring follows
    const animate = () => {
      setPos(prev => ({
        x: prev.x + (targetRef.current.x - prev.x) * 0.15,
        y: prev.y + (targetRef.current.y - prev.y) * 0.15,
      }));
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup",   onUp);
      document.removeEventListener("mouseover",  onEnter);
      document.removeEventListener("mouseout",   onLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <>
      {/* Outer ring — лагирует */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          x: pos.x - 16,
          y: pos.y - 16,
          width: hovering ? 36 : 32,
          height: hovering ? 36 : 32,
          borderRadius: "50%",
          border: hovering ? "1.5px solid rgba(99,149,255,0.8)" : "1.5px solid rgba(255,255,255,0.35)",
          transform: `translate(${pos.x - 16}px, ${pos.y - 16}px) scale(${clicking ? 0.85 : hovering ? 1.3 : 1})`,
          transition: "width 0.2s, height 0.2s, border-color 0.2s, transform 0.1s",
          mixBlendMode: "difference",
        }}
      />
      {/* Inner dot — точный */}
      <div
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          transform: `translate(${dot.x - 3}px, ${dot.y - 3}px)`,
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: hovering ? "#6395ff" : "rgba(255,255,255,0.9)",
          transition: "background 0.2s",
        }}
      />
    </>
  );
}
