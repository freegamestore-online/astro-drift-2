import {
  Actor,
  Canvas,
  CollisionType,
  Color,
  Engine,
  Keys,
  PolygonCollider,
  Vector,
  vec,
} from "excalibur";

export class Ship extends Actor {
  private targetPos: Vector | null = null;
  private readonly speed = 260;

  constructor(x: number, y: number) {
    super({
      pos: vec(x, y),
      collider: new PolygonCollider({
        points: [vec(0, -18), vec(12, 14), vec(0, 8), vec(-12, 14)],
      }),
      color: Color.Transparent,
    });
    this.body.collisionType = CollisionType.Active;
  }

  onInitialize(_engine: Engine): void {
    const canvas = new Canvas({
      width: 44,
      height: 44,
      draw: (ctx: CanvasRenderingContext2D) => {
        ctx.clearRect(0, 0, 44, 44);
        ctx.save();
        ctx.translate(22, 22);

        // Outer glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00f5ff";

        // Ship body
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(13, 14);
        ctx.lineTo(0, 7);
        ctx.lineTo(-13, 14);
        ctx.closePath();
        ctx.strokeStyle = "#00f5ff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = "rgba(0, 245, 255, 0.10)";
        ctx.fill();

        // Engine dot
        ctx.beginPath();
        ctx.arc(0, 9, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#00f5ff";
        ctx.fill();

        ctx.restore();
      },
    });
    this.graphics.use(canvas);
  }

  setTarget(pos: Vector): void {
    this.targetPos = pos;
  }

  clearTarget(): void {
    this.targetPos = null;
  }

  onPreUpdate(engine: Engine, delta: number): void {
    const kb = engine.input.keyboard;
    let dx = 0;
    let dy = 0;

    if (kb.isHeld(Keys.Left) || kb.isHeld(Keys.A)) dx -= 1;
    if (kb.isHeld(Keys.Right) || kb.isHeld(Keys.D)) dx += 1;
    if (kb.isHeld(Keys.Up) || kb.isHeld(Keys.W)) dy -= 1;
    if (kb.isHeld(Keys.Down) || kb.isHeld(Keys.S)) dy += 1;

    const hasKeyInput = dx !== 0 || dy !== 0;

    if (hasKeyInput) {
      this.targetPos = null;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      this.vel = vec((dx / len) * this.speed, (dy / len) * this.speed);
    } else if (this.targetPos) {
      const diff = this.targetPos.sub(this.pos);
      const dist = diff.magnitude;
      if (dist < 6) {
        this.vel = vec(0, 0);
      } else {
        const norm = diff.normalize();
        const approachSpeed = Math.min(this.speed, dist / (delta / 1000));
        this.vel = norm.scale(Math.min(approachSpeed, this.speed));
      }
    } else {
      this.vel = vec(0, 0);
    }

    // Clamp to screen bounds
    const w = engine.drawWidth;
    const h = engine.drawHeight;
    this.pos.x = Math.max(22, Math.min(w - 22, this.pos.x));
    this.pos.y = Math.max(22, Math.min(h - 22, this.pos.y));
  }
}
