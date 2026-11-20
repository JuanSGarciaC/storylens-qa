/*
 * Landing de StoryLens QA. Sin dependencias.
 * Todo el contenido está en el HTML con su estado final: este script solo lo anima.
 * Con prefers-reduced-motion no hace nada.
 */
(() => {
  const root = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) {
    root.classList.remove("js-hero");
    return;
  }
  root.classList.add("js-motion", "js-draw");

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n, dec) => n.toFixed(dec).replace(".", ",");

  /** A7: cuenta de 0 al valor de data-to. */
  function countUp(el, ms) {
    const to = Number(el.dataset.to);
    const dec = Number(el.dataset.dec || 0);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - t, 3)), dec);
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = fmt(0, dec);
    requestAnimationFrame(step);
  }

  /* ---------- A1, A2, A6, H1: al entrar en pantalla ---------- */
  document.querySelectorAll("[data-stagger]").forEach((list) => {
    [...list.children].forEach((child, i) =>
      child.style.setProperty("--i", String(i)),
    );
  });
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        io.unobserve(el);
        if (el.hasAttribute("data-draw")) el.classList.add("drawn");
        else el.classList.add("in");
        if (el.hasAttribute("data-chart"))
          el.querySelectorAll(".count").forEach((c) => countUp(c, 1100));
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
  );
  document
    .querySelectorAll(
      "[data-reveal], [data-stagger], [data-chart], [data-draw]",
    )
    .forEach((el) => io.observe(el));

  /* ---------- H2 + B2: la demo del hero se usa sola ---------- */
  const demo = document.getElementById("demo");
  if (!demo) return;
  const fields = [...demo.querySelectorAll(".type")];
  const result = demo.querySelector(".demo-result");
  const findings = [...demo.querySelectorAll(".findings li")];
  const button = demo.querySelector(".fake-btn");
  const status = demo.querySelector(".demo-status");
  const score = demo.querySelector(".score .count");
  const replay = demo.querySelector(".replay");
  const statusText = status.textContent;

  // Cada letra en su span: el texto pendiente es invisible pero ocupa su sitio (sin saltos).
  const chars = fields.map((field) => {
    const out = [];
    const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.textContent.trim()) continue; // espacios entre <li>
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent.replace(/\s+/g, " ")) {
        const span = document.createElement("span");
        span.className = "t-ch";
        span.textContent = ch;
        frag.append(span);
        out.push(span);
      }
      node.replaceWith(frag);
    }
    return out;
  });
  root.classList.add("js-hero", "hero-ready"); // por si el seguro de 3 s ya la quitó

  let run = 0;
  async function play() {
    const id = ++run;
    const alive = () => id === run;
    const fast = innerWidth < 600; // móvil: sin tecleo, el resto igual
    replay.hidden = false; // ocupa su sitio desde el principio: sin saltos al aparecer
    replay.style.visibility = "hidden";
    result.classList.remove("on");
    findings.forEach((li) => li.classList.remove("on"));
    demo.querySelectorAll("mark").forEach((m) => m.classList.remove("on"));
    chars.flat().forEach((c) => c.classList.toggle("pending", !fast));
    await sleep(500);

    if (!fast) {
      for (const list of chars) {
        for (const c of list) {
          if (!alive()) return;
          c.classList.remove("pending");
          await sleep(c.textContent === " " ? 10 : 24);
        }
        await sleep(220);
      }
    }

    await sleep(300);
    if (!alive()) return;
    button.classList.add("press");
    status.textContent = "analizando…";
    await sleep(160);
    button.classList.remove("press");
    await sleep(450);
    if (!alive()) return;
    status.textContent = statusText;
    result.classList.add("on");
    countUp(score, 900);
    await sleep(250);

    for (const li of findings) {
      if (!alive()) return;
      li.classList.add("on");
      const mark = demo.querySelector(`mark[data-f="${li.dataset.f}"]`);
      if (mark) mark.classList.add("on");
      await sleep(280);
    }
    replay.style.visibility = "";
  }

  replay.addEventListener("click", play);
  play();
})();
