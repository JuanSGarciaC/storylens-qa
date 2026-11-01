// Verifica pares de contraste WCAG AA. Uso: node scripts/contrast.mjs
const lum = (h) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const TEXT = 4.5;
const NON_TEXT = 3;
const pairs = [
  ["fg / bg", "#ececf1", "#0b0b10", TEXT],
  ["fg / surface", "#ececf1", "#13131a", TEXT],
  ["muted / bg", "#a3a3b2", "#0b0b10", TEXT],
  ["muted / surface", "#a3a3b2", "#13131a", TEXT],
  ["muted / surface-2", "#a3a3b2", "#1b1b24", TEXT],
  ["muted / glow", "#a3a3b2", "#191a34", TEXT],
  ["accent / bg", "#8b9cff", "#0b0b10", TEXT],
  ["accent / surface", "#8b9cff", "#13131a", TEXT],
  ["accent / glow", "#8b9cff", "#191a34", TEXT],
  ["accent-2 / bg", "#c4a7ff", "#0b0b10", TEXT],
  ["ok / surface", "#4ade80", "#13131a", TEXT],
  ["warn / surface", "#fbbf24", "#13131a", TEXT],
  ["danger / surface", "#ff7b7b", "#13131a", TEXT],
  ["btn primary", "#ffffff", "#4f46e5", TEXT],
  ["btn primary hover", "#ffffff", "#5b54f0", TEXT],
  ["btn ghost", "#ececf1", "#24242f", TEXT],
  ["btn danger", "#000000", "#ff7b7b", TEXT],
  ["fg / nav activo", "#ececf1", "#1c1d38", TEXT],
  ["fg / alert", "#ececf1", "#1a0a0f", TEXT],
  ["danger / alert", "#ff7b7b", "#1a0a0f", TEXT],
  // Insignias: color al 10-12 % sobre la tarjeta (mezcla ya calculada).
  ["badge ok", "#4ade80", "#192724", TEXT],
  ["badge warn", "#fbbf24", "#2a241b", TEXT],
  ["badge danger", "#ff7b7b", "#2b1d24", TEXT],
  ["badge info", "#8b9cff", "#212336", TEXT],
  ["badge neutral", "#a3a3b2", "#1b1b24", TEXT],
  ["line-control / bg (no texto)", "#6b6b7b", "#0b0b10", NON_TEXT],
  ["line-control / surface-2 (no texto)", "#6b6b7b", "#1b1b24", NON_TEXT],
  ["focus accent / bg (no texto)", "#8b9cff", "#0b0b10", NON_TEXT],
];
let fail = false;
for (const [name, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) fail = true;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name} ${fg}/${bg} ${r.toFixed(2)} (min ${min})`,
  );
}
process.exit(fail ? 1 : 0);
