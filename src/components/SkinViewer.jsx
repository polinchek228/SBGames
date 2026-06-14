import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import * as skinview3d from "skinview3d";

const ANIMATIONS = [
  { label: "Стоя",   anim: null },
  { label: "Ходьба", anim: "walk" },
  { label: "Бег",    anim: "run" },
  { label: "Взмах",  anim: "fly" },
];

export default function SkinViewer({ username, customSkin }) {
  const canvasRef = useRef(null);
  const viewerRef = useRef(null);
  const [animIdx, setAnimIdx] = useState(1);
  const [loading, setLoading] = useState(true);

  const applyAnimation = (viewer, idx) => {
    viewer.animation = null;
    if (idx === 1) viewer.animation = new skinview3d.WalkingAnimation();
    else if (idx === 2) viewer.animation = new skinview3d.RunningAnimation();
    else if (idx === 3) viewer.animation = new skinview3d.FlyingAnimation();
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!canvasRef.current) return;
      setLoading(true);
      if (viewerRef.current) { viewerRef.current.dispose(); viewerRef.current = null; }

      const viewer = new skinview3d.SkinViewer({
        canvas: canvasRef.current,
        width: 180,
        height: 200,
        background: 0x000000,
      });
      viewer.renderer.setClearColor(0x000000, 0);
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = false;
      viewer.controls.autoRotate = true;
      viewer.controls.autoRotateSpeed = 0.7;
      viewer.fov = 40;
      viewer.zoom = 0.9;
      viewer.camera.position.set(0, 18, 60);
      viewerRef.current = viewer;

      try {
        await viewer.loadSkin(customSkin || `https://minotar.net/skin/${username}`);
      } catch {
        await viewer.loadSkin("https://minotar.net/skin/MHF_Steve");
      }

      if (!cancelled) {
        applyAnimation(viewer, animIdx);
        setLoading(false);
      }
    };
    init();
    return () => { cancelled = true; viewerRef.current?.dispose(); };
  }, [username, customSkin]);

  useEffect(() => {
    if (viewerRef.current && !loading) applyAnimation(viewerRef.current, animIdx);
  }, [animIdx, loading]);

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 h-full"
      style={{ background: "rgba(255,255,255,0.03)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
        style={{ color: "rgba(255,255,255,0.18)" }}>3D Скин</p>

      <div className="flex-1 flex items-center justify-center relative min-h-0 rounded-xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.4)" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
          </div>
        )}
        <motion.canvas
          ref={canvasRef}
          animate={{ opacity: loading ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          style={{ cursor: "grab", display: "block" }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.18)" }}>Анимация</p>
        <div className="grid grid-cols-2 gap-1">
          {ANIMATIONS.map(({ label }, i) => (
            <motion.button key={label} onClick={() => setAnimIdx(i)} whileTap={{ scale: 0.94 }}
              className="relative text-[10px] py-1.5 rounded-lg transition-colors duration-150 overflow-hidden"
              style={{ color: animIdx === i ? "#93c5fd" : "rgba(255,255,255,0.25)" }}
            >
              {animIdx === i && (
                <motion.div layoutId="anim-bg"
                  className="absolute inset-0 rounded-lg"
                  style={{ background: "rgba(37,99,235,0.18)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
