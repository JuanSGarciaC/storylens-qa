/**
 * D9 Swarm Rebuild: un enjambre de cursores de colores construye la página.
 *
 * 1. Escaneo (~1,8 s): las capas ya están ocultas; los agentes giran en el centro
 *    y una línea azul barre la pantalla.
 * 2. Construcción: cada agente toma la siguiente capa visible en orden del DOM,
 *    vuela a su esquina, dibuja un marco de su color con su etiqueta y la revela
 *    (los textos se teclean sin mover el layout).
 * 3. Scroll guiado a 900 px/s, sin pasar de la primera capa sin construir.
 * 4. Reposo: cola tras el ratón; con el ratón quieto 2 s, anillo hacia él.
 * 5. Fin: «N capas reconstruidas en X s». Esc salta al final; ✕ los saca por el
 *    borde más cercano.
 *
 * Solo transform/opacity en el bucle (más el texto que se teclea). Sin
 * dependencias. Quien lo carga comprueba antes `prefers-reduced-motion`.
 */
import "./swarm.css";
import {
  MAX_SPEED,
  agentCount,
  aimAt,
  exitPoint,
  follow,
  guidedScroll,
  lerpAngle,
  ringSlot,
  stepToward,
  type Point,
} from "./geometry";

export type SwarmHandle = { stop(): void };
export type SwarmOptions = {
  /** Contenedor cuyas capas se reconstruyen. */
  root: HTMLElement;
  /** Se llama al terminar la construcción (también si se salta con Esc). */
  onFinish?: (layers: number, seconds: number) => void;
};

/** Atributo que pone el arranque para ocultar todo antes del primer pintado. */
export const PREHIDE_ATTR = "data-sr-pre";

const CONTENT =
  "h1,h2,h3,h4,h5,h6,p,li,a,button,img,svg,picture,video,canvas,label,input,textarea,select,blockquote,pre,table,dt,dd,figure,.badge,.spinner,[data-sr-layer]";
const BOX = ".card,.panel,[data-sr-box]";
const WRAPPERS = new Set([
  "P",
  "LI",
  "DD",
  "DT",
  "FIGURE",
  "BLOCKQUOTE",
  "LABEL",
]);
const SCAN_MS = 1800;
const DRAW_MS = 320;
const BOX_FADE_MS = 300;
const FRAME_FADE_MS = 420;
const FLY_SPEED = 1150;
const TYPE_CPS = 90;
const IDLE_RING_MS = 2000;
const SAFETY_MS = 25000;
const SVG_NS = "http://www.w3.org/2000/svg";

type LayerState = "hidden" | "claimed" | "revealing" | "done";
type TextPart = {
  node: Text;
  full: string;
  wrap: HTMLSpanElement;
  typed: Text;
  pending: HTMLSpanElement;
};
type Layer = {
  el: Element;
  kind: "box" | "content";
  label: string;
  state: LayerState;
  parentBox: Layer | null;
  texts: TextPart[] | null;
  chars: number;
};
type Frame = {
  el: HTMLDivElement;
  target: Element;
  born: number;
  fadeAt: number | null;
};
type Mode = "scan" | "build" | "rest" | "exit";
type AgentStep = "idle" | "fly" | "draw" | "type";
type Agent = {
  el: HTMLDivElement;
  color: string;
  p: Point;
  rot: number;
  step: AgentStep;
  layer: Layer | null;
  tourEl: Element | null;
  frame: Frame | null;
  t0: number;
  typeMs: number;
};

const now = () => performance.now();

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function cursorSvg(color: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 22");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "22");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M1 1v17l4.6-4.3 3.1 6.9 2.9-1.3-3-6.8h6.1z");
  path.setAttribute("fill", color);
  path.setAttribute("stroke", "#0b0b10");
  path.setAttribute("stroke-width", "1.3");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function closeIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M3.5 3.5l9 9m0-9l-9 9");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  svg.append(path);
  return svg;
}

const COLORS = Array.from(
  { length: 14 },
  (_, i) => `hsl(${Math.round(220 + (i * 360) / 14) % 360} 90% 70%)`,
);

export function startSwarm({ root, onFinish }: SwarmOptions): SwarmHandle {
  const html = document.documentElement;
  const layers: Layer[] = [];
  const known = new WeakSet<Element>();
  const frames: Frame[] = [];
  const cleanups: (() => void)[] = [];
  const start = now();
  let mode: Mode = "scan";
  let mult = 1;
  let raf = 0;
  let last = start;
  let scanLeft = SCAN_MS;
  let userScrolled = false;
  let scrollY = window.scrollY;
  let mouse: Point | null = null;
  let lastMove = start;
  let stopped = false;
  let finished = false;
  let wakeTimer = 0;

  // ---------- Capas ----------

  function addLayer(
    node: Element,
    kind: Layer["kind"],
    parentBox: Layer | null,
  ) {
    known.add(node);
    const r = node.getBoundingClientRect();
    if (r.width * r.height < 4) return null; // p. ej. .visually-hidden: nada que dibujar
    const layer: Layer = {
      el: node,
      kind,
      label: kind === "box" ? "frame" : node.tagName.toLowerCase(),
      state: "hidden",
      parentBox,
      texts: null,
      chars: 0,
    };
    node.setAttribute(
      "data-sr-state",
      kind === "box" ? "box-hidden" : "hidden",
    );
    layers.push(layer);
    return layer;
  }

  /** p, li… sin texto propio que solo agrupan otras capas: se baja a sus hijas. */
  function isWrapper(node: Element): boolean {
    if (!WRAPPERS.has(node.tagName)) return false;
    for (const child of Array.from(node.childNodes))
      if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim())
        return false;
    return node.querySelector(CONTENT) !== null;
  }

  function collect(parent: Element, box: Layer | null) {
    for (const child of Array.from(parent.children)) {
      if (child.hasAttribute("data-sr-ui")) continue;
      if (known.has(child)) {
        if (child.matches(BOX))
          collect(child, layers.find((l) => l.el === child) ?? box);
        continue;
      }
      if (child.matches(BOX)) {
        collect(child, addLayer(child, "box", box) ?? box);
      } else if (child.matches(CONTENT) && !isWrapper(child)) {
        addLayer(child, "content", box);
      } else {
        collect(child, box);
      }
    }
  }

  function rescan() {
    const before = layers.length;
    collect(root, null);
    if (layers.length !== before) {
      layers.sort((a, b) =>
        a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1,
      );
      updateBar();
    }
  }

  function splitText(layer: Layer) {
    const parts: TextPart[] = [];
    const walker = document.createTreeWalker(layer.el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text;
      if (!node.data.trim()) continue;
      const full = node.data;
      // Un único hijo envuelve lo tecleado y lo pendiente: en un contenedor flex
      // sigue siendo un solo elemento y el layout no se mueve.
      const wrap = document.createElement("span");
      const typed = document.createTextNode("");
      const pending = document.createElement("span");
      pending.setAttribute("data-sr-pending", "");
      pending.textContent = full;
      wrap.append(typed, pending);
      parts.push({ node, full, wrap, typed, pending });
    }
    for (const part of parts) {
      part.node.data = "";
      part.node.after(part.wrap);
    }
    layer.texts = parts;
    layer.chars = parts.reduce((sum, p) => sum + p.full.length, 0);
  }

  function setTyped(layer: Layer, count: number) {
    let left = count;
    for (const part of layer.texts ?? []) {
      const k = Math.max(0, Math.min(part.full.length, left));
      left -= part.full.length;
      if (part.typed.data.length !== k) {
        part.typed.data = part.full.slice(0, k);
        part.pending.textContent = part.full.slice(k);
      }
    }
  }

  function restoreText(layer: Layer) {
    for (const part of layer.texts ?? []) {
      // Si React cambió el texto entretanto, se respeta su valor.
      if (part.node.data === "") part.node.data = part.full;
      part.wrap.remove();
    }
    layer.texts = null;
  }

  function reveal(layer: Layer, instant = false) {
    if (layer.state === "done") return;
    restoreText(layer);
    if (instant) layer.el.removeAttribute("data-sr-state");
    else
      layer.el.setAttribute(
        "data-sr-state",
        layer.kind === "box" ? "box-in" : "in",
      );
    layer.state = "done";
    if (!instant) {
      const node = layer.el;
      const t = window.setTimeout(() => {
        if (node.getAttribute("data-sr-state")?.endsWith("in"))
          node.removeAttribute("data-sr-state");
      }, BOX_FADE_MS + 60);
      cleanups.push(() => clearTimeout(t));
    }
    updateBar();
  }

  const doneCount = () => layers.filter((l) => l.state === "done").length;

  // ---------- Capa visual ----------

  const overlay = el("div", "sr-overlay");
  overlay.setAttribute("aria-hidden", "true");
  overlay.setAttribute("data-sr-ui", "");
  const sweep = el("div", "sr-sweep");
  overlay.append(sweep);

  const count = agentCount(window.innerWidth);
  const center = (): Point => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const agents: Agent[] = Array.from({ length: count }, (_, i) => {
    const color = COLORS[(i * 5) % COLORS.length];
    const node = el("div", "sr-agent");
    node.append(cursorSvg(color));
    overlay.append(node);
    return {
      el: node,
      color,
      p: center(),
      rot: 0,
      step: "idle" as AgentStep,
      layer: null,
      tourEl: null,
      frame: null,
      t0: 0,
      typeMs: 0,
    };
  });

  // Barra inferior
  const bar = el("div", "sr-bar");
  bar.setAttribute("data-sr-ui", "");
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Enjambre que construye la página");
  const dot = el("span", "sr-bar__dot");
  dot.setAttribute("aria-hidden", "true");
  const agentsStat = el("span", "sr-bar__stat sr-bar__stat--agents");
  agentsStat.innerHTML = `<b>${count}</b> agentes`;
  const layersStat = el("span", "sr-bar__stat");
  const track = el("span", "sr-bar__track");
  track.setAttribute("aria-hidden", "true");
  const fill = el("span", "sr-bar__fill");
  track.append(fill);
  const msg = el("span", "sr-bar__msg");
  msg.setAttribute("role", "status");
  const tourBtn = el("button", "sr-bar__btn");
  tourBtn.type = "button";
  tourBtn.textContent = "Tour";
  tourBtn.disabled = true;
  const speedBtn = el("button", "sr-bar__btn");
  speedBtn.type = "button";
  const closeBtn = el("button", "sr-bar__btn sr-bar__close");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Cerrar el enjambre");
  closeBtn.append(closeIcon());
  bar.append(
    dot,
    agentsStat,
    layersStat,
    track,
    msg,
    tourBtn,
    speedBtn,
    closeBtn,
  );

  function updateSpeedBtn() {
    speedBtn.textContent = `${mult}×`;
    speedBtn.setAttribute("aria-label", `Velocidad ${mult}×`);
    speedBtn.setAttribute("aria-pressed", String(mult === 4));
  }
  updateSpeedBtn();

  function updateBar() {
    const done = doneCount();
    layersStat.innerHTML = `<b>${done}/${layers.length}</b> capas`;
    fill.style.transform = `scaleX(${layers.length ? done / layers.length : 0})`;
  }

  // ---------- Marcos ----------

  function makeFrame(target: Element, label: string, color: string): Frame {
    const node = el("div", "sr-frame");
    node.style.setProperty("--c", color);
    for (const side of ["t", "r", "b", "l"])
      node.append(el("span", `sr-frame__e sr-frame__e--${side}`));
    const tag = el("span", "sr-frame__tag");
    tag.textContent = label;
    node.append(tag);
    const r = target.getBoundingClientRect();
    node.style.width = `${r.width + 8}px`;
    node.style.height = `${r.height + 8}px`;
    overlay.append(node);
    const frame = { el: node, target, born: now(), fadeAt: null };
    frames.push(frame);
    return frame;
  }

  function drawFrame(frame: Frame, p: number) {
    const a = Math.min(1, p * 2);
    const b = Math.max(0, Math.min(1, p * 2 - 1));
    const [top, right, bottom, left] = Array.from(
      frame.el.children,
    ) as HTMLElement[];
    top.style.transform = `scaleX(${a})`;
    left.style.transform = `scaleY(${a})`;
    right.style.transform = `scaleY(${b})`;
    bottom.style.transform = `scaleX(${b})`;
  }

  // ---------- Control ----------

  function finish() {
    if (finished) return;
    finished = true;
    for (const layer of layers) reveal(layer, true);
    for (const agent of agents) {
      agent.step = "idle";
      agent.layer = null;
      if (agent.frame) agent.frame.fadeAt ??= now();
    }
    html.removeAttribute(PREHIDE_ATTR);
    root.removeAttribute("aria-busy");
    sweep.remove();
    mode = "rest";
    const seconds = (now() - start) / 1000;
    const n = layers.length;
    msg.textContent = `${n} capas reconstruidas en ${seconds.toFixed(1)} s`;
    bar.classList.add("sr-bar--done");
    tourBtn.disabled = false;
    updateBar();
    onFinish?.(n, seconds);
    // Sin ratón (táctil) no hay reposo que seguir: salen solos y no tapan el texto.
    if (!window.matchMedia("(pointer: fine)").matches) {
      const t = window.setTimeout(close, 2500);
      cleanups.push(() => clearTimeout(t));
    }
    wake();
  }

  function startTour() {
    if (mode !== "rest") return;
    const targets = layers
      .map((l) => l.el)
      .filter((node) => {
        if (!node.isConnected) return false;
        const r = node.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      });
    tourQueue = targets;
    wake();
  }
  let tourQueue: Element[] = [];

  function close() {
    if (mode === "exit") return;
    if (!finished) finish();
    mode = "exit";
    bar.classList.add("sr-bar--out");
    wake();
  }

  function destroy() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    clearTimeout(wakeTimer);
    observer.disconnect();
    for (const fn of cleanups) fn();
    for (const layer of layers) reveal(layer, true);
    html.removeAttribute(PREHIDE_ATTR);
    root.removeAttribute("aria-busy");
    overlay.remove();
    bar.remove();
  }

  // ---------- Bucle ----------

  function wake() {
    if (stopped || raf) return;
    last = now();
    raf = requestAnimationFrame(tick);
  }

  function claimNext(): Layer | null {
    const vh = window.innerHeight;
    for (const layer of layers) {
      if (layer.state !== "hidden") continue;
      if (!layer.el.isConnected) {
        layer.state = "done";
        continue;
      }
      if (
        layer.parentBox &&
        (layer.parentBox.state === "hidden" ||
          layer.parentBox.state === "claimed")
      )
        return null; // el contenedor va primero
      const r = layer.el.getBoundingClientRect();
      if (r.bottom <= 0) {
        reveal(layer, true); // ya quedó arriba (el usuario se adelantó)
        continue;
      }
      // Todavía fuera de la pantalla (salvo que el scroll ya no pueda bajar más).
      const atBottom =
        window.scrollY >= document.documentElement.scrollHeight - vh - 1;
      if (r.top > vh * (atBottom ? 0.995 : 0.92)) return null;
      layer.state = "claimed";
      return layer;
    }
    return null;
  }

  function corner(target: Element): Point {
    const r = target.getBoundingClientRect();
    return { x: r.left - 4, y: r.top - 4 };
  }

  function tick(time: number) {
    raf = 0;
    if (stopped) return;
    try {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      const moving = step(time, dt);
      if (moving) raf = requestAnimationFrame(tick);
    } catch (error) {
      console.warn("Swarm Rebuild se detuvo:", error);
      destroy();
    }
  }

  /** Avanza un fotograma; devuelve false si todo quedó en reposo. */
  function step(time: number, dt: number): boolean {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const sdt = dt * mult;
    let active = mode !== "rest";

    if (mode === "scan") {
      scanLeft -= sdt * 1000;
      const p = 1 - Math.max(0, scanLeft) / SCAN_MS;
      sweep.style.transform = `translate3d(0, ${p * vh}px, 0)`;
      sweep.style.opacity = String(Math.sin(Math.PI * p));
      const c = center();
      agents.forEach((agent, i) => {
        const slot = ringSlot(c, i, agents.length, time / 380);
        agent.p = follow(
          agent.p,
          { x: slot.x * 0.6 + c.x * 0.4, y: slot.y * 0.6 + c.y * 0.4 },
          10,
          dt,
        );
        agent.rot = aimAt(agent.p, c);
      });
      if (scanLeft <= 0) {
        mode = "build";
        sweep.remove();
      }
    } else if (mode === "build") {
      for (const agent of agents) {
        if (agent.step === "idle") {
          const layer = claimNext();
          if (layer) {
            agent.layer = layer;
            agent.step = "fly";
          }
        }
        runAgent(agent, time, dt);
      }
      // Idle: se reúnen abajo, esperando la siguiente capa.
      agents.forEach((agent, i) => {
        if (agent.step !== "idle") return;
        const slot = ringSlot(
          { x: vw / 2, y: vh * 0.82 },
          i,
          agents.length,
          time / 900,
        );
        agent.p = follow(agent.p, slot, 6, dt);
        agent.rot = lerpAngle(agent.rot, 0, 0.1);
      });
      // Scroll guiado hacia la primera capa sin construir.
      if (!userScrolled) {
        const pending = layers.find(
          (l) => l.state === "hidden" && l.el.isConnected,
        );
        const top = pending
          ? pending.el.getBoundingClientRect().top + window.scrollY
          : null;
        const max = document.documentElement.scrollHeight - vh;
        const next = guidedScroll(window.scrollY, top, vh, max, dt);
        if (next !== window.scrollY) {
          scrollY = next;
          window.scrollTo(0, Math.round(scrollY));
        }
      }
      const busy = agents.some((a) => a.step !== "idle");
      if (!busy && layers.every((l) => l.state === "done" || !l.el.isConnected))
        finish();
    } else if (mode === "rest") {
      for (const agent of agents) {
        if (agent.step === "idle" && tourQueue.length) {
          agent.tourEl = tourQueue.shift() ?? null;
          if (agent.tourEl) agent.step = "fly";
        }
        if (agent.step !== "idle") runAgent(agent, time, dt);
      }
      active = rest(time, dt, vw, vh) || agents.some((a) => a.step !== "idle");
    } else {
      // exit: cada agente sale por el borde más cercano
      let out = 0;
      for (const agent of agents) {
        const target = exitPoint(agent.p, vw, vh);
        const res = stepToward(agent.p, target, 1500, dt);
        agent.p = res.point;
        if (res.arrived) out++;
      }
      if (out === agents.length) {
        destroy();
        return false;
      }
      active = true;
    }

    // Marcos: seguir a su capa y desvanecerse
    for (let i = frames.length - 1; i >= 0; i--) {
      const frame = frames[i];
      const r = frame.target.getBoundingClientRect();
      frame.el.style.transform = `translate3d(${r.left - 4}px, ${r.top - 4}px, 0)`;
      if (frame.fadeAt !== null) {
        const k = (time - frame.fadeAt) / FRAME_FADE_MS;
        frame.el.style.opacity = String(Math.max(0, 1 - k));
        if (k >= 1) {
          frame.el.remove();
          frames.splice(i, 1);
        }
      }
      active = true;
    }

    for (const agent of agents) {
      agent.el.style.transform = `translate3d(${agent.p.x}px, ${agent.p.y}px, 0) rotate(${agent.rot}deg)`;
    }
    return active;
  }

  function runAgent(agent: Agent, time: number, dt: number) {
    const target = agent.layer?.el ?? agent.tourEl;
    if (!target || !target.isConnected) {
      if (agent.layer) reveal(agent.layer, true);
      endTask(agent, time);
      return;
    }
    const label =
      agent.layer?.label ??
      (target.matches(BOX) ? "frame" : target.tagName.toLowerCase());
    if (agent.step === "fly") {
      const to = corner(target);
      const dist = Math.hypot(to.x - agent.p.x, to.y - agent.p.y);
      const speed = Math.min(
        MAX_SPEED,
        Math.min(FLY_SPEED * mult, 260 + dist * 7 * mult),
      );
      const res = stepToward(agent.p, to, speed, dt);
      agent.p = res.point;
      agent.rot = lerpAngle(agent.rot, 0, 0.2);
      if (res.arrived) {
        agent.step = "draw";
        agent.t0 = time;
        agent.frame = makeFrame(target, label, agent.color);
        drawFrame(agent.frame, 0);
      }
      return;
    }
    const r = target.getBoundingClientRect();
    if (agent.step === "draw") {
      const p = Math.min(1, ((time - agent.t0) * mult) / DRAW_MS);
      if (agent.frame) drawFrame(agent.frame, p);
      // Recorre el borde superior y luego el derecho, como si lo trazara.
      const w = r.width + 8;
      const h = r.height + 8;
      const along =
        p < 0.5 ? { x: w * p * 2, y: 0 } : { x: w, y: h * (p * 2 - 1) };
      agent.p = stepToward(
        agent.p,
        { x: r.left - 4 + along.x, y: r.top - 4 + along.y },
        MAX_SPEED,
        dt,
      ).point;
      if (p >= 1) {
        const layer = agent.layer;
        if (!layer) {
          endTask(agent, time);
          return;
        }
        layer.state = "revealing";
        if (layer.kind === "box") {
          reveal(layer);
          endTask(agent, time);
          return;
        }
        splitText(layer);
        layer.el.setAttribute("data-sr-state", layer.chars ? "typing" : "in");
        if (!layer.chars) {
          reveal(layer);
          endTask(agent, time);
          return;
        }
        agent.step = "type";
        agent.t0 = time;
        agent.typeMs = Math.min(
          1100,
          Math.max(140, (layer.chars / TYPE_CPS) * 1000),
        );
      }
      return;
    }
    if (agent.step === "type" && agent.layer) {
      const p = Math.min(1, ((time - agent.t0) * mult) / agent.typeMs);
      setTyped(agent.layer, Math.round(agent.layer.chars * p));
      agent.p = stepToward(
        agent.p,
        { x: r.right + 4, y: r.bottom + 4 },
        MAX_SPEED,
        dt,
      ).point;
      if (p >= 1) {
        reveal(agent.layer, true);
        endTask(agent, time);
      }
    }
  }

  function endTask(agent: Agent, time: number) {
    if (agent.frame) agent.frame.fadeAt = time + 120 / mult;
    agent.frame = null;
    agent.layer = null;
    agent.tourEl = null;
    agent.step = "idle";
  }

  /** Reposo: cola tras el ratón; quieto 2 s, anillo con las puntas hacia él. */
  function rest(time: number, dt: number, vw: number, vh: number): boolean {
    const anchor: Point = mouse ?? {
      x: vw / 2,
      y: vh - (bar.getBoundingClientRect().height || 48) - 90,
    };
    const ring = mouse === null || time - lastMove >= IDLE_RING_MS;
    let moved = 0;
    agents.forEach((agent, i) => {
      if (agent.step !== "idle") return;
      const before = agent.p;
      if (ring) {
        const slot = ringSlot(anchor, i, agents.length);
        agent.p = follow(agent.p, slot, 7, dt);
        agent.rot = lerpAngle(agent.rot, aimAt(agent.p, anchor), 0.18);
      } else {
        const lead =
          i === 0 ? { x: anchor.x + 14, y: anchor.y + 18 } : agents[i - 1].p;
        agent.p = follow(agent.p, lead, i === 0 ? 16 : 12, dt);
        agent.rot = lerpAngle(agent.rot, 0, 0.15);
      }
      moved = Math.max(
        moved,
        Math.hypot(agent.p.x - before.x, agent.p.y - before.y),
      );
    });
    if (moved > 0.03) return true;
    // En reposo no se gasta ni un fotograma: despierta a los 2 s para el anillo.
    if (!ring) {
      clearTimeout(wakeTimer);
      wakeTimer = window.setTimeout(
        wake,
        Math.max(0, IDLE_RING_MS - (time - lastMove)) + 16,
      );
    }
    return false;
  }

  // ---------- Eventos ----------

  function on<E extends Event>(
    target: EventTarget,
    type: string,
    fn: (event: E) => void,
    opts?: AddEventListenerOptions,
  ) {
    const listener = fn as EventListener;
    target.addEventListener(type, listener, opts);
    cleanups.push(() => target.removeEventListener(type, listener, opts));
  }

  on<PointerEvent>(
    window,
    "pointermove",
    (event) => {
      if (event.pointerType !== "mouse") return;
      mouse = { x: event.clientX, y: event.clientY };
      lastMove = now();
      wake();
    },
    { passive: true },
  );
  on<KeyboardEvent>(window, "keydown", (event) => {
    if (event.key === "Escape" && !finished) {
      finish();
      return;
    }
    if (
      [
        "ArrowDown",
        "ArrowUp",
        "PageDown",
        "PageUp",
        " ",
        "Home",
        "End",
      ].includes(event.key)
    )
      userScrolled = true;
  });
  on(window, "wheel", () => (userScrolled = true), { passive: true });
  on(window, "touchmove", () => (userScrolled = true), { passive: true });
  on(window, "resize", wake);
  on(document, "visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else wake();
  });
  // Si el teclado llega a una capa aún oculta, se termina al instante.
  on<FocusEvent>(root, "focusin", (event) => {
    const target = event.target as Element | null;
    if (!finished && target?.closest("[data-sr-state]")) finish();
  });
  on(closeBtn, "click", close);
  on(tourBtn, "click", startTour);
  on(speedBtn, "click", () => {
    mult = mult === 1 ? 4 : 1;
    updateSpeedBtn();
  });

  // Capas que llegan después (p. ej. la lista tras la petición) se ocultan antes
  // de pintarse: los callbacks de MutationObserver corren antes del render.
  const observer = new MutationObserver(() => {
    if (!finished) rescan();
  });

  // ---------- Arranque ----------
  root.setAttribute("aria-busy", "true");
  rescan();
  observer.observe(root, { childList: true, subtree: true });
  document.body.append(overlay, bar);
  html.removeAttribute(PREHIDE_ATTR); // las capas ya están ocultas una a una
  updateBar();
  const safety = window.setTimeout(() => finish(), SAFETY_MS);
  cleanups.push(() => clearTimeout(safety));
  wake();

  return { stop: destroy };
}
