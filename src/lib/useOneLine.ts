import { useCallback, useRef } from "react";

/** Shrinks the text a little (in half-pixel steps, down to 10px) until it fits on one line. */
function fitOneLine(el: HTMLElement) {
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && size > 10) {
    size -= 0.5;
    el.style.fontSize = `${size}px`;
  }
}

/** Callback ref: fits the element on one line now and again whenever its width changes. */
export function useOneLine() {
  const observer = useRef<ResizeObserver | null>(null);
  return useCallback((el: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    let width = -1;
    observer.current = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitOneLine(el);
    });
    observer.current.observe(el);
  }, []);
}
