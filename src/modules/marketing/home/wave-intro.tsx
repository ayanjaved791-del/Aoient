"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Opening effect for the home hero: an ocean wave rolls in from the left and
 * carries the hero text away; 1.5 s after the wave has gone the headline
 * words drop back into place from above, then the rest returns.
 *
 * The wave is drawn on a canvas every frame (moving front, leaning crest,
 * ragged trailing edge that thins out, live foam, spray and a wet trail), so
 * it never looks like a flat picture sliding across.
 *
 * Progressive enhancement: the text is plain, visible HTML. Nothing runs with
 * reduced motion or in a background tab. Elements opt in with `wash-word`
 * (falls back in) or `wash-block` (rises back in); timing follows the wave.
 */
const SWEEP_S = 1.9; // time for the whole wave, tail included, to cross the screen
const PAUSE_AFTER_S = 1.5; // empty hero after the wave, before the headline returns
const WORD_STAGGER_S = 0.11;
const FALL_S = 0.9;

export function WaveIntro({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState !== "visible") return;
    const frame = requestAnimationFrame(() => setPlaying(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const root = ref.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.scale(dpr, dpr);

    // Text to carry: its position on screen, and whether the wave has reached it.
    const targets = [...root.querySelectorAll<HTMLElement>(".wash-word, .wash-block")].map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width * 0.3, y: r.top + r.height / 2, word: el.classList.contains("wash-word"), hit: false };
    });
    root.classList.add("wave-intro");

    const thickness = Math.max(W * 0.5, 360);
    const travel = W * 1.05 + thickness + 260;
    const speed = travel / SWEEP_S;
    const start = performance.now();
    const timers: number[] = [];

    // Deterministic noise so foam shimmers rather than flickers randomly.
    const hash = (n: number) => {
      const s = Math.sin(n * 127.1) * 43758.5453;
      return s - Math.floor(s);
    };
    const base = (t: number) => -W * 0.05 + speed * t;
    const front = (y: number, t: number) => {
      const lean = Math.min(110, W * 0.09) * Math.max(0, 1 - y / (H * 0.5)) ** 2; // crest leads
      const wobble = 13 * Math.sin(y * 0.011 + t * 6) + 8 * Math.sin(y * 0.029 - t * 9) + 4 * Math.sin(y * 0.07 + t * 15);
      return base(t) + lean + wobble;
    };
    const back = (y: number, t: number) =>
      base(t) - thickness * (0.9 + 0.07 * Math.sin(y * 0.006 + t * 3)) - 22 * Math.sin(y * 0.021 - t * 5) - 10 * Math.sin(y * 0.055 + t * 7);

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; wet?: boolean };
    const particles: P[] = [];
    let raf = 0;
    let last = start;

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);
      const step = 8;

      if (t <= SWEEP_S) {
        // Water body: a ragged band between the trailing edge and the front.
        const body = new Path2D();
        body.moveTo(back(0, t), 0);
        for (let y = 0; y <= H + step; y += step) body.lineTo(front(y, t), y);
        for (let y = H + step; y >= 0; y -= step) body.lineTo(back(y, t), y);
        body.closePath();

        const b = base(t);
        const g = ctx.createLinearGradient(b - thickness - 60, 0, b + 40, 0);
        g.addColorStop(0, "rgba(10,70,120,0)");
        g.addColorStop(0.14, "rgba(6,55,105,0.75)");
        g.addColorStop(0.45, "#05386a");
        g.addColorStop(0.75, "#0b5f9f");
        g.addColorStop(0.92, "#1a8ccb");
        g.addColorStop(1, "#5cc9ee");
        ctx.fillStyle = g;
        ctx.fill(body);
        const v = ctx.createLinearGradient(0, 0, 0, H);
        v.addColorStop(0, "rgba(160,232,255,0.28)");
        v.addColorStop(0.4, "rgba(255,255,255,0)");
        v.addColorStop(1, "rgba(1,15,34,0.45)");
        ctx.fillStyle = v;
        ctx.fill(body);

        // Currents inside the water, following the front.
        ctx.lineCap = "round";
        for (const [off, a] of [[70, 0.18], [150, 0.12], [250, 0.09], [360, 0.06]] as const) {
          ctx.beginPath();
          for (let y = 0; y <= H; y += step) {
            const x = front(y, t - 0.04) - off - 14 * Math.sin(y * 0.02 + off);
            if (y === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = `rgba(200,240,255,${a})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Curling lip at the crest, with shadow underneath.
        const f0 = front(0, t);
        const fh = front(H * 0.2, t);
        ctx.beginPath();
        ctx.moveTo(f0 - 30, 0);
        ctx.bezierCurveTo(f0 + 60, H * 0.01, f0 + 95, H * 0.07, f0 + 70, H * 0.13);
        ctx.bezierCurveTo(f0 + 55, H * 0.17, fh + 10, H * 0.2, fh - 10, H * 0.21);
        ctx.lineTo(fh - 40, H * 0.2);
        ctx.closePath();
        const lip = ctx.createLinearGradient(f0 - 40, 0, f0 + 90, 0);
        lip.addColorStop(0, "#1a8ccb");
        lip.addColorStop(1, "#8fe0f6");
        ctx.fillStyle = lip;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(fh + 18, H * 0.17, 26, H * 0.045, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(2,26,51,0.35)";
        ctx.fill();

        // Foam along the front and over the lip: bright core, soft halo, bubbles.
        ctx.beginPath();
        for (let y = 0; y <= H; y += step) {
          const x = front(y, t);
          if (y === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(170,225,245,0.45)";
        ctx.lineWidth = 18;
        ctx.stroke();
        ctx.strokeStyle = "rgba(250,254,255,0.95)";
        ctx.lineWidth = 6;
        ctx.stroke();
        const bucket = Math.floor(t * 16);
        for (let y = 0, i = 0; y <= H; y += 5, i++) {
          const n = hash(i * 3.1 + bucket * 0.7);
          if (n < 0.35) continue;
          const x = front(y, t) + (hash(i + bucket) - 0.35) * 22;
          ctx.beginPath();
          ctx.arc(x, y, 1.5 + n * 6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.55 + n * 0.4})`;
          ctx.fill();
        }
        for (let k = 0; k < 26; k++) {
          const n = hash(k * 9.7 + bucket);
          const x = f0 - 20 + n * 110;
          const y = H * 0.005 + hash(k * 4.3 + bucket) * H * 0.12;
          ctx.beginPath();
          ctx.arc(x, y, 2 + n * 7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${0.6 + n * 0.35})`;
          ctx.fill();
        }

        // Spray from the crest; wet foam left behind at the trailing edge.
        for (let k = 0; k < 7; k++) {
          const y = Math.random() * H * 0.45;
          particles.push({ x: front(y, t), y, vx: speed * (0.9 + Math.random() * 0.5), vy: -120 - Math.random() * 260, life: 0, max: 0.45 + Math.random() * 0.35, r: 1.2 + Math.random() * 3 });
        }
        for (let k = 0; k < 5; k++) {
          const y = Math.random() * H;
          particles.push({ x: back(y, t) + 20 + Math.random() * 40, y, vx: 0, vy: 0, life: 0, max: 0.7 + Math.random() * 0.6, r: 1.5 + Math.random() * 3.5, wet: true });
        }

        // Carry the text the moment the front reaches it.
        for (const tg of targets) {
          if (!tg.hit && front(tg.y, t) >= tg.x) {
            tg.hit = true;
            tg.el.classList.add("is-washed");
          }
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += (p.wet ? 0 : 900) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = 1 - p.life / p.max;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.wet ? `rgba(110,180,225,${0.45 * a})` : `rgba(240,250,255,${0.9 * a})`;
        ctx.fill();
      }

      if (t <= SWEEP_S || particles.length) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);

    // After the wave: wait, drop the words in order, then bring back the rest.
    for (const tg of targets) if (!tg.hit) timers.push(window.setTimeout(() => tg.el.classList.add("is-washed"), SWEEP_S * 1000));
    const fallAt = (SWEEP_S + PAUSE_AFTER_S) * 1000;
    const words = targets.filter((x) => x.word);
    const blocks = targets.filter((x) => !x.word);
    words.forEach((w, i) => timers.push(window.setTimeout(() => w.el.classList.add("is-falling"), fallAt + i * WORD_STAGGER_S * 1000)));
    const backAt = fallAt + words.length * WORD_STAGGER_S * 1000 + 250;
    blocks.forEach((b, i) => timers.push(window.setTimeout(() => b.el.classList.add("is-back"), backAt + i * 80)));
    const doneAt = Math.max(backAt + blocks.length * 80 + 700, fallAt + words.length * WORD_STAGGER_S * 1000 + FALL_S * 1000 + 100);
    timers.push(
      window.setTimeout(() => {
        // Mark as done (stops the elements' load-in fades from replaying), then tidy up.
        root.classList.replace("wave-intro", "wave-done");
        for (const tg of targets) tg.el.classList.remove("is-washed", "is-falling", "is-back");
        setPlaying(false);
      }, doneAt),
    );

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [playing]);

  return (
    <div ref={ref}>
      {children}
      {playing && <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[60] h-dvh w-screen" />}
    </div>
  );
}
