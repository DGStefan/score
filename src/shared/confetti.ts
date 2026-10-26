/** Lichtgewicht confetti zonder externe library. */

interface ConfettiOptions {
  /** Startpunt in pixels (viewport). Standaard: midden bovenin. */
  x?: number;
  y?: number;
  /** Aantal snippers. */
  count?: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
}

const COLORS = ['#2f6f5e', '#4fa88f', '#e8b93a', '#e0775f', '#5b8def', '#c86bd6', '#f4f1ea'];
const DURATION = 3200; // ms

export function confetti({ x, y, count = 140 }: ConfettiOptions = {}): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const resize = (): void => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);

  const originX = x ?? innerWidth / 2;
  const originY = y ?? innerHeight / 3;
  const pieces: Piece[] = Array.from({ length: count }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 6 + Math.random() * 9;
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#e8b93a',
      life: 0.7 + Math.random() * 0.3,
    };
  });

  const start = performance.now();
  let last = start;

  const frame = (now: number): void => {
    const dt = Math.min(2, (now - last) / 16.7);
    last = now;
    const t = (now - start) / DURATION;
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    for (const p of pieces) {
      p.vy += 0.35 * dt; // zwaartekracht
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;

      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(1, Math.cos(p.rotation * 2)); // "flapperen"
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      removeEventListener('resize', resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}
