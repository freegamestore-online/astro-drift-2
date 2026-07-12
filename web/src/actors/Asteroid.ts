import {
  Actor,
  Canvas,
  CircleCollider,
  CollisionType,
  Color,
  Engine,
  vec,
} from "excalibur";

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Generate a lumpy asteroid polygon for drawing */
function asteroidPoints(radius: number, numPoints: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const r = radius * randomBetween(0.72, 1.0);
    pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return pts;
}

const GLOW_COLORS = ["#ff6b35", "#ff2d78", "#a855f7", "#facc15", "#fb923c"] as const;

export class Asteroid extends Actor {
  private readonly _radius: number;
  private readonly _pts: { x: number; y: number }[];
  private readonly _glowColor: string;
  private readonly _canvasSize: number;

  constructor(
    x: number,
    y: number,
    radius: number,
    vx: number,
    vy: number,
    spin: number,
    glowColor: string,
  ) {
    super({
      pos: vec(x, y),
      collider: new CircleCollider({ radius: radius * 0.78 }),
      color: Color.Transparent,
    });
    this.body.collisionType = CollisionType.Passive;
    this.vel = vec(vx, vy);
    this.angularVelocity = spin;
    this._radius = radius;
    this._glowColor = glowColor;
    this._canvasSize = Math.ceil(radius * 2 + 12);
    this._pts = asteroidPoints(radius - 2, 9 + Math.floor(Math.random() * 4));
  }

  onInitialize(_engine: Engine): void {
    const size = this._canvasSize;
    const pts = this._pts;
    const glowColor = this._glowColor;

    const canvas = new Canvas({
      width: size,
      height: size,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);

        ctx.shadowBlur = 14;
        ctx.shadowColor = glowColor;

        ctx.beginPath();
        if (pts.length > 0) {
          const first = pts[0];
          if (first) {
            ctx.moveTo(first.x, first.y);
          }
          for (let i = 1; i < pts.length; i++) {
            const pt = pts[i];
            if (pt) ctx.lineTo(pt.x, pt.y);
          }
          ctx.closePath();
        }
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = `${glowColor}18`;
        ctx.fill();

        ctx.restore();
      },
    });
    this.graphics.use(canvas);
  }

  onPreUpdate(engine: Engine, _delta: number): void {
    const margin = this._radius + 20;
    const w = engine.drawWidth;
    const h = engine.drawHeight;
    if (
      this.pos.x < -margin ||
      this.pos.x > w + margin ||
      this.pos.y < -margin ||
      this.pos.y > h + margin
    ) {
      this.kill();
    }
  }
}

export function spawnAsteroid(engine: Engine): Asteroid {
  const w = engine.drawWidth;
  const h = engine.drawHeight;
  const radius = randomBetween(18, 46);
  const speed = randomBetween(55, 145);
  const spin = randomBetween(-1.8, 1.8);
  const colorIndex = Math.floor(Math.random() * GLOW_COLORS.length);
  const glowColor: string = GLOW_COLORS[colorIndex] ?? "#ff6b35";

  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;

  switch (edge) {
    case 0: // top
      x = randomBetween(0, w);
      y = -radius - 10;
      vx = randomBetween(-0.5, 0.5) * speed;
      vy = randomBetween(0.4, 1.0) * speed;
      break;
    case 1: // bottom
      x = randomBetween(0, w);
      y = h + radius + 10;
      vx = randomBetween(-0.5, 0.5) * speed;
      vy = -randomBetween(0.4, 1.0) * speed;
      break;
    case 2: // left
      x = -radius - 10;
      y = randomBetween(0, h);
      vx = randomBetween(0.4, 1.0) * speed;
      vy = randomBetween(-0.5, 0.5) * speed;
      break;
    default: // right
      x = w + radius + 10;
      y = randomBetween(0, h);
      vx = -randomBetween(0.4, 1.0) * speed;
      vy = randomBetween(-0.5, 0.5) * speed;
      break;
  }

  return new Asteroid(x, y, radius, vx, vy, spin, glowColor);
}
