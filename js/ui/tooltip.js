// One shared tooltip that follows the pointer.
let tip;

function el() {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tooltip";
    tip.setAttribute("role", "status");
    document.body.appendChild(tip);
  }
  return tip;
}

export function showTip(evt, html) {
  const t = el();
  t.innerHTML = html;
  t.classList.add("show");
  const pad = 14;
  const { innerWidth: w, innerHeight: h } = window;
  const r = t.getBoundingClientRect();
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  if (x + r.width > w - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > h - 8) y = evt.clientY - r.height - pad;
  t.style.left = x + "px";
  t.style.top = y + "px";
}

export function hideTip() {
  if (tip) tip.classList.remove("show");
}

// Build tooltip HTML from a title and rows of [label, value, color?].
export function tipHtml(title, rows) {
  return (
    `<div class="t-title">${title}</div>` +
    rows
      .map(([k, v, c]) => `<div class="t-row"><span>${c ? `<i style="background:${c}"></i>` : ""}${k}</span><b>${v}</b></div>`)
      .join("")
  );
}
