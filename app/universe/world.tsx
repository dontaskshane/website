'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './universe.module.css';

export type WorldPhoto = {
  id: string;
  url: string;
  width: number;
  height: number;
};

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Placement = {
  x: number;
  y: number;
  rot: number;
  w: number;
  h: number;
};

export default function World({ photos }: { photos: WorldPhoto[] }) {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [idle, setIdle] = useState(true);
  const [zoomPct, setZoomPct] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const justDragged = useRef(false);

  useEffect(() => {
    setIsMobile(navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    setReady(true);
  }, []);

  const placements: Placement[] = useMemo(() => {
    const rnd = mulberry32(271);
    const SPREAD_W = isMobile ? 3000 : 4200;
    const SPREAD_H = isMobile ? 2000 : 2800;
    const MIN_SEP = 220;
    const DISPLAY_BASE = isMobile ? 180 : 240;
    const out: Placement[] = [];
    for (let i = 0; i < photos.length; i++) {
      let x = 0,
        y = 0,
        ok = false,
        attempts = 0;
      while (!ok && attempts < 120) {
        attempts++;
        x = rnd() * SPREAD_W;
        y = rnd() * SPREAD_H;
        ok = true;
        for (const p of out) {
          if (Math.hypot(x - p.x, y - p.y) < MIN_SEP) {
            ok = false;
            break;
          }
        }
      }
      const rot = (rnd() - 0.5) * 3;
      const scale = 0.75 + rnd() * 0.5;
      const base = DISPLAY_BASE * scale;
      const r = photos[i].width / photos[i].height;
      const w = r >= 1 ? base : base * r;
      const h = r >= 1 ? base / r : base;
      out.push({ x, y, rot, w: Math.round(w), h: Math.round(h) });
    }
    return out;
  }, [photos, isMobile]);

  const SPREAD_W = isMobile ? 3000 : 4200;
  const SPREAD_H = isMobile ? 2000 : 2800;

  // Pan/zoom engine — imperative, identical feel to the original
  useEffect(() => {
    if (!ready) return;
    const stage = stageRef.current;
    const world = worldRef.current;
    if (!stage || !world) return;

    const CENTER_X = SPREAD_W / 2;
    const CENTER_Y = SPREAD_H / 2;
    const MIN_Z = 0.2,
      MAX_Z = 4;
    let tx = 0,
      ty = 0,
      tz = 1;
    let vx = 0,
      vy = 0;
    let lastMoveT = 0,
      lastMoveX = 0,
      lastMoveY = 0;
    let inertiaRAF: number | null = null;
    let depthRAF: number | null = null;
    let dragging = false,
      sx = 0,
      sy = 0,
      ox = 0,
      oy = 0,
      dragDist = 0;
    let zoomPillT: ReturnType<typeof setTimeout>;
    const touches: Record<number, { x: number; y: number }> = {};

    const tiles = tileRefs.current.filter(Boolean) as HTMLDivElement[];

    function updateDepth() {
      depthRAF = null;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const maxD = Math.hypot(cx, cy) * 1.6;
      for (let i = 0; i < tiles.length; i++) {
        const p = placements[i];
        if (!p) continue;
        const sxp = p.x * tz + tx - cx;
        const syp = p.y * tz + ty - cy;
        const d = Math.hypot(sxp, syp);
        const k = Math.min(1, d / maxD);
        tiles[i].style.opacity = (1 - k * 0.45).toFixed(3);
      }
    }
    function scheduleDepth() {
      if (!isMobile && !depthRAF) depthRAF = requestAnimationFrame(updateDepth);
    }

    function apply() {
      world!.style.transform = `translate(${tx}px, ${ty}px) scale(${tz})`;
      scheduleDepth();
    }

    function centerView() {
      tx = window.innerWidth / 2 - CENTER_X * tz;
      ty = window.innerHeight / 2 - CENTER_Y * tz;
      apply();
    }

    function showZoomPill() {
      setZoomPct(Math.round(tz * 100));
      clearTimeout(zoomPillT);
      zoomPillT = setTimeout(() => setZoomPct(null), 1400);
    }

    function stopInertia() {
      if (inertiaRAF) {
        cancelAnimationFrame(inertiaRAF);
        inertiaRAF = null;
      }
    }

    function runInertia() {
      const DECAY = 0.94;
      let lastT = performance.now();
      function tick(now: number) {
        const dt = Math.min(now - lastT, 64);
        lastT = now;
        const f = Math.pow(DECAY, dt / 16.67);
        tx += vx * dt;
        ty += vy * dt;
        vx *= f;
        vy *= f;
        apply();
        if (Math.abs(vx) + Math.abs(vy) > 0.02)
          inertiaRAF = requestAnimationFrame(tick);
        else inertiaRAF = null;
      }
      inertiaRAF = requestAnimationFrame(tick);
    }

    const onMouseDown = (e: MouseEvent) => {
      stopInertia();
      dragging = true;
      dragDist = 0;
      sx = e.clientX;
      sy = e.clientY;
      ox = tx;
      oy = ty;
      vx = vy = 0;
      lastMoveT = performance.now();
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      document.body.classList.add(styles.dragging);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - sx,
        dy = e.clientY - sy;
      dragDist = Math.max(dragDist, Math.hypot(dx, dy));
      tx = ox + dx;
      ty = oy + dy;
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveT);
      vx = (e.clientX - lastMoveX) / dt;
      vy = (e.clientY - lastMoveY) / dt;
      lastMoveT = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      apply();
    };

    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove(styles.dragging);
      justDragged.current = dragDist > 4;
      setTimeout(() => (justDragged.current = false), 80);
      if (Math.hypot(vx, vy) > 0.15) runInertia();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopInertia();
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZ = Math.max(MIN_Z, Math.min(MAX_Z, tz * f));
      const mx = e.clientX,
        my = e.clientY;
      tx = mx - (mx - tx) * (newZ / tz);
      ty = my - (my - ty) * (newZ / tz);
      tz = newZ;
      apply();
      showZoomPill();
    };

    const onTouchStart = (e: TouchEvent) => {
      stopInertia();
      for (const t of Array.from(e.changedTouches)) {
        touches[t.identifier] = { x: t.clientX, y: t.clientY };
      }
      if (Object.keys(touches).length === 1) {
        const t = e.touches[0];
        sx = t.clientX;
        sy = t.clientY;
        ox = tx;
        oy = ty;
        dragging = true;
        dragDist = 0;
        vx = vy = 0;
        lastMoveT = performance.now();
        lastMoveX = t.clientX;
        lastMoveY = t.clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const keys = Object.keys(touches);
      if (e.touches.length === 1 && keys.length === 1) {
        const t = e.touches[0];
        const dx = t.clientX - sx,
          dy = t.clientY - sy;
        dragDist = Math.max(dragDist, Math.hypot(dx, dy));
        tx = ox + dx;
        ty = oy + dy;
        const now = performance.now();
        const dt = Math.max(1, now - lastMoveT);
        vx = (t.clientX - lastMoveX) / dt;
        vy = (t.clientY - lastMoveY) / dt;
        lastMoveT = now;
        lastMoveX = t.clientX;
        lastMoveY = t.clientY;
        apply();
      } else if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        const prevA = touches[a.identifier],
          prevB = touches[b.identifier];
        if (!prevA || !prevB) return;
        const prevDist = Math.hypot(prevA.x - prevB.x, prevA.y - prevB.y);
        const curDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const f = curDist / Math.max(1, prevDist);
        const cx = (a.clientX + b.clientX) / 2,
          cy = (a.clientY + b.clientY) / 2;
        const newZ = Math.max(MIN_Z, Math.min(MAX_Z, tz * f));
        tx = cx - (cx - tx) * (newZ / tz);
        ty = cy - (cy - ty) * (newZ / tz);
        tz = newZ;
        apply();
        showZoomPill();
        touches[a.identifier] = { x: a.clientX, y: a.clientY };
        touches[b.identifier] = { x: b.clientX, y: b.clientY };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) delete touches[t.identifier];
      if (e.touches.length === 0) {
        dragging = false;
        justDragged.current = dragDist > 6;
        setTimeout(() => (justDragged.current = false), 100);
        if (Math.hypot(vx, vy) > 0.15) runInertia();
      }
    };

    const onResize = () => {
      apply();
    };
    const onGesture = (e: Event) => e.preventDefault();

    stage.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('touchstart', onTouchStart, { passive: false });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);
    document.addEventListener('gesturestart', onGesture);

    centerView();

    return () => {
      stopInertia();
      if (depthRAF) cancelAnimationFrame(depthRAF);
      clearTimeout(zoomPillT);
      stage.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('gesturestart', onGesture);
      document.body.classList.remove(styles.dragging);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isMobile, placements]);

  // Back button: always visible on touch, fades after idle on desktop
  useEffect(() => {
    if (!ready) return;
    if (isMobile) {
      setIdle(false);
      return;
    }
    let idleT: ReturnType<typeof setTimeout>;
    const rouse = () => {
      setIdle(false);
      clearTimeout(idleT);
      idleT = setTimeout(() => setIdle(true), 2600);
    };
    window.addEventListener('mousemove', rouse);
    rouse();
    return () => {
      clearTimeout(idleT);
      window.removeEventListener('mousemove', rouse);
    };
  }, [ready, isMobile]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) setLightbox(null);
        else window.location.href = '/';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  return (
    <div className={styles.screen}>
      <div className={styles.stage} ref={stageRef}>
        {!isMobile && ready && (
          <video
            className={styles.bgvid}
            autoPlay
            muted
            loop
            playsInline
            src="/images/background_video.MOV"
            onCanPlay={(e) => {
              e.currentTarget.playbackRate = 0.4;
            }}
          />
        )}
        <div className={styles.world} ref={worldRef}>
          {ready &&
            photos.map((p, i) => {
              const pl = placements[i];
              return (
                <div
                  key={p.id}
                  ref={(el) => {
                    tileRefs.current[i] = el;
                  }}
                  className={styles.tile}
                  style={{
                    left: pl.x,
                    top: pl.y,
                    width: pl.w,
                    height: pl.h,
                    transform: `translate(-50%, -50%) rotate(${pl.rot}deg)`,
                  }}
                  onClick={(e) => {
                    if (justDragged.current) return;
                    setLightbox(p.url);
                    e.stopPropagation();
                  }}
                >
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    sizes="300px"
                    quality={65}
                    draggable={false}
                    className={styles.tileImg}
                  />
                </div>
              );
            })}
        </div>
      </div>

      <Link
        href="/"
        className={`${styles.back} ${idle ? styles.backHidden : ''}`}
        aria-label="Home"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 13L5 8L10 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Shane Wetzel</span>
      </Link>

      <div className={`${styles.zoomPill} ${zoomPct !== null ? styles.show : ''}`}>
        {zoomPct ?? 100}%
      </div>

      {lightbox && (
        <div className={styles.lb} onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className={styles.lbImg} />
        </div>
      )}
    </div>
  );
}
