import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

const MAX_SCALE = 5;
/** Vertical drag (at normal size) that closes the viewer. */
const CLOSE_DISTANCE = 110;

/**
 * Full-screen photo with pinch and double-tap zoom. Closes with the × button,
 * Escape, or by swiping the photo up or down.
 */
export default function PhotoViewer({ src, alt, onClose }: Props) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number; x: number; y: number; px: number; py: number } | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const points = () => [...pointers.current.values()];
  const distance = () => {
    const [a, b] = points();
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function start(e: ReactPointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [p] = points();
    gesture.current = {
      dist: pointers.current.size === 2 ? distance() : 0,
      scale: view.scale,
      x: view.x,
      y: view.y,
      px: p.x,
      py: p.y,
    };
    setDragging(true);
  }

  function move(e: ReactPointerEvent) {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (pointers.current.size === 2 && g.dist > 0) {
      const scale = Math.min(MAX_SCALE, Math.max(1, (g.scale * distance()) / g.dist));
      setView((v) => ({ ...v, scale }));
      return;
    }
    const [p] = points();
    setView((v) => ({ ...v, x: g.x + p.x - g.px, y: g.y + p.y - g.py }));
  }

  function end(e: ReactPointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      // One finger of a pinch lifted: continue panning from here.
      const [p] = points();
      gesture.current = { dist: 0, scale: view.scale, x: view.x, y: view.y, px: p.x, py: p.y };
      return;
    }
    gesture.current = null;
    setDragging(false);
    const now = Date.now();
    const tapped = Math.abs(view.x) < 8 && Math.abs(view.y) < 8;
    if (view.scale === 1) {
      if (Math.abs(view.y) > CLOSE_DISTANCE) return onClose();
      if (tapped && now - lastTap.current < 300) {
        setView({ scale: 2.5, x: 0, y: 0 });
        lastTap.current = 0;
        return;
      }
      setView({ scale: 1, x: 0, y: 0 });
    } else if (now - lastTap.current < 300) {
      setView({ scale: 1, x: 0, y: 0 });
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
  }

  const fade = view.scale === 1 ? Math.max(0.35, 1 - Math.abs(view.y) / 400) : 1;

  return (
    <div className="photo-viewer" role="dialog" aria-modal="true" aria-label={alt} style={{ backgroundColor: `rgb(0 0 0 / ${fade})` }}>
      <button type="button" className="photo-viewer-close" onClick={onClose} aria-label="Schließen">
        ×
      </button>
      <div
        className="photo-viewer-stage"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: dragging ? "none" : "transform 0.2s ease",
          }}
        />
      </div>
      <p className="photo-viewer-hint">Zum Schließen nach oben oder unten wischen</p>
    </div>
  );
}
