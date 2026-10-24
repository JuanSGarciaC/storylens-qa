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
  ["fg / bg", "#ededed", "#000000", TEXT],
  ["muted / bg", "#a1a1a1", "#000000", TEXT],
  ["muted / surface", "#a1a1a1", "#0a0a0a", TEXT],
  ["muted / glow", "#a1a1a1", "#0b1a3a", TEXT],
  ["accent / bg", "#6ea8ff", "#000000", TEXT],
  ["accent-2 / bg", "#b79cff", "#000000", TEXT],
  ["ok / bg", "#4ade80", "#000000", TEXT],
  ["warn / bg", "#fbbf24", "#000000", TEXT],
  ["danger / bg", "#ff7b7b", "#000000", TEXT],
  ["btn primary", "#000000", "#ededed", TEXT],
  ["btn danger", "#000000", "#ff7b7b", TEXT],
  ["fg / alert", "#ededed", "#1a0a0a", TEXT],
  ["danger / alert", "#ff7b7b", "#1a0a0a", TEXT],
  ["badge ok", "#4ade80", "#06190d", TEXT],
  ["badge warn", "#fbbf24", "#1c1403", TEXT],
  ["badge danger", "#ff7b7b", "#1f0a0a", TEXT],
  ["badge info", "#6ea8ff", "#071428", TEXT],
  ["badge neutral", "#a1a1a1", "#141414", TEXT],
  ["line-control / bg (no texto)", "#7a7a7a", "#000000", NON_TEXT],
  ["line-control / glow (no texto)", "#7a7a7a", "#0b1a3a", NON_TEXT],
  ["focus accent / bg (no texto)", "#6ea8ff", "#000000", NON_TEXT],
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
