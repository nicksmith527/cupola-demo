export const int = (n) => Math.round(n).toLocaleString("en-US");
export const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
export const moneyK = (n) =>
  n >= 1e6 ? "$" + (n / 1e6).toFixed(2) + "M" : n >= 1e4 ? "$" + Math.round(n / 1e3) + "K" : money(n);
export const pct = (n, d = 0) => (n * 100).toFixed(d) + "%";
export const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`);
export const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "a" : "p"}`;
export const shortDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
export const time = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
