// One shared, imperative tooltip element reused by every D3 chart.
let el = null;

function ensure() {
  if (!el) {
    el = document.createElement("div");
    el.className = "viz-tooltip";
    document.body.appendChild(el);
  }
  return el;
}

export function showTip(html, event) {
  const t = ensure();
  t.innerHTML = html;
  t.style.opacity = "1";
  moveTip(event);
}

export function moveTip(event) {
  const t = ensure();
  const pad = 14;
  let x = event.clientX + pad;
  let y = event.clientY + pad;
  const r = t.getBoundingClientRect();
  if (x + r.width > window.innerWidth) x = event.clientX - r.width - pad;
  if (y + r.height > window.innerHeight) y = event.clientY - r.height - pad;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}

export function hideTip() {
  if (el) el.style.opacity = "0";
}
