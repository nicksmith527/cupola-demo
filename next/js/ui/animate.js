// Small animation helpers shared by every view.

export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Animate an element's number from its last shown value to `to`.
// The last value is remembered on the element, so a refresh counts up from
// where it was rather than from zero.
export function countUp(el, to, format = (n) => Math.round(n).toLocaleString(), duration = 1200) {
  if (!el) return;
  const from = el._value ?? 0;
  el._value = to;
  if (reducedMotion() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  cancelAnimationFrame(el._raf);
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    el.textContent = format(from + (to - from) * easeOutCubic(t));
    if (t < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

// Set bar widths on the next frame so the CSS transition runs from 0.
export function growBars(root) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.querySelectorAll("[data-width]").forEach((el) => {
        el.style.width = el.dataset.width;
      });
    })
  );
}

// Briefly outline a tile whose value just changed.
export function flash(el) {
  if (!el) return;
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}

// Prepare SVG paths for a "draw-on" animation.
export function drawPaths(svg) {
  svg.querySelectorAll("path.draw").forEach((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.strokeDasharray = `${len} ${len}`;
    p.style.setProperty("--len", len);
  });
}
