import React, { useState, useRef, useEffect, useCallback } from "react";
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
        alpha: true,
      });
      viewer.renderer.setClearColor(0x000000, 0);
      viewer.controls.enableRotate = true;
      viewer.controls.enableZoom = false;
      viewer.controls.autoRotate = true;
      viewer.controls.autoRotateSpeed = 0.7;
      viewer.fov = 40;
      viewer.zoom = 0.9;
      viewer.camera.position.set(0, 18, 60);

      // Throttle render loop to ~30fps to cut GPU usage
      viewer.clock.autoStart = false;
      let lastFrame = 0;
      // skinview3d manages its own RAF loop; limit via global RAF override on the viewer
      // We use the IntersectionObserver to stop/resume instead
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

      // Pause rendering when off-screen
      const io = new IntersectionObserver(([entry]) => {
        if (!viewerRef.current) return;
        viewerRef.current.renderPaused = !entry.isIntersecting;
      }, { threshold: 0.01 });
      if (canvasRef.current) io.observe(canvasRef.current);
      viewerRef.current._io = io;
    };
    init();
    return () => {
      cancelled = true;
      if (viewerRef.current?._io) viewerRef.current._io.disconnect();
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, [username, customSkin]);

  useEffect(() => {
    if (viewerRef.current && !loading) applyAnimation(viewerRef.current, animIdx);
  }, [animIdx, loading]);

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3 h-full"
      style={{ background: "rgba(10,10,18,0.88)" }}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold"
        style={{ color: "rgba(255,255,255,0.35)" }}>3D Скин</p>

      <div className="flex-1 flex items-center justify-center relative min-h-0 rounded-xl overflow-hidden"
        style={{ background: "rgba(0,0,0,0.35)" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <div className="w-5 h-5 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{
            cursor: "grab",
            display: "block",
            opacity: loading ? 0 : 1,
            transition: "opacity 0.4s",
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] uppercase tracking-widest"
          style={{ color: "rgba(255,255,255,0.3)" }}>Анимация</p>
        <div className="grid grid-cols-2 gap-1">
          {ANIMATIONS.map(({ label }, i) => (
            <button
              key={label}
              onClick={() => setAnimIdx(i)}
              className="relative text-[10px] py-1.5 rounded-lg transition-colors duration-150 overflow-hidden"
              style={{
                color: animIdx === i ? "#93c5fd" : "rgba(255,255,255,0.25)",
                background: animIdx === i ? "rgba(37,99,235,0.18)" : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
