import { useCallback, useEffect, useRef, useState } from "react";
import {
  Color,
  DisplayMode,
  Engine,
  Font,
  Label,
  Scene,
  TextAlign,
  Timer,
  vec,
} from "excalibur";
import { Shell } from "./components/Shell";
import { Ship } from "./actors/Ship";
import { spawnAsteroid } from "./actors/Asteroid";

// ─── localStorage helpers ────────────────────────────────────────────────────
const HS_KEY = "astrodrift_highscore";
function loadHighScore(): number {
  return parseInt(localStorage.getItem(HS_KEY) ?? "0", 10) || 0;
}
function saveHighScore(s: number): void {
  localStorage.setItem(HS_KEY, String(s));
}

// ─── Shared font ─────────────────────────────────────────────────────────────
function makeFont(size: number, bold = false): Font {
  return new Font({ size, family: "Manrope", bold, textAlign: TextAlign.Center });
}

// ─── Play scene ──────────────────────────────────────────────────────────────
function buildPlayScene(
  engine: Engine,
  onGameOver: (survivalMs: number) => void,
): Scene {
  const scene = new Scene();
  let elapsed = 0; // ms survived
  let alive = true;

  // Ship — centred
  const ship = new Ship(engine.drawWidth / 2, engine.drawHeight / 2);
  scene.add(ship);

  // Pointer steering
  engine.input.pointers.primary.on("move", (evt) => {
    if (alive) ship.setTarget(evt.worldPos);
  });
  engine.input.pointers.primary.on("down", (evt) => {
    if (alive) ship.setTarget(evt.worldPos);
  });

  // HUD labels
  const scoreLabel = new Label({
    text: "0s",
    pos: vec(engine.drawWidth / 2, 36),
    font: makeFont(22, true),
    color: Color.fromHex("#00f5ff"),
  });
  scene.add(scoreLabel);

  const hsLabel = new Label({
    text: `Best: ${loadHighScore()}s`,
    pos: vec(engine.drawWidth / 2, 62),
    font: makeFont(14),
    color: Color.fromHex("#94a3b8"),
  });
  scene.add(hsLabel);

  // Asteroid spawner — starts slow, ramps up
  let spawnInterval = 1800; // ms
  const spawnTimer = new Timer({
    interval: 100, // tick every 100 ms, check elapsed
    repeats: true,
    fcn: () => {
      if (!alive) return;
      elapsed += 100;

      // Update score display
      const secs = Math.floor(elapsed / 1000);
      scoreLabel.text = `${secs}s`;

      // Ramp: every 5 s shorten the interval (floor 400 ms)
      const newInterval = Math.max(400, 1800 - Math.floor(elapsed / 5000) * 180);
      if (newInterval !== spawnInterval) {
        spawnInterval = newInterval;
      }

      // Spawn based on ramp — use probability so we don't need nested timers
      const spawnChance = 100 / spawnInterval; // fraction of 100 ms tick
      if (Math.random() < spawnChance) {
        const asteroid = spawnAsteroid(engine);
        scene.add(asteroid);

        // Collision detection
        asteroid.on("collisionstart", (evt) => {
          if (!alive) return;
          if (evt.other === ship) {
            alive = false;
            onGameOver(elapsed);
          }
        });
      }
    },
  });
  scene.add(spawnTimer);
  spawnTimer.start();

  return scene;
}

// ─── React component ─────────────────────────────────────────────────────────
type Phase = "start" | "playing" | "gameover";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const [phase, setPhase] = useState<Phase>("start");
  const [lastScore, setLastScore] = useState(0);
  const [highScore, setHighScore] = useState(loadHighScore);

  // Teardown helper
  const disposeEngine = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
  }, []);

  // Start / restart the Excalibur engine
  const startGame = useCallback(() => {
    disposeEngine();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine({
      canvasElement: canvas,
      displayMode: DisplayMode.FillContainer,
      backgroundColor: Color.fromHex("#060918"),
      suppressConsoleBootMessage: true,
    });
    engineRef.current = engine;

    const handleGameOver = (survivalMs: number) => {
      const secs = Math.floor(survivalMs / 1000);
      setLastScore(secs);
      setHighScore((prev) => {
        const next = Math.max(prev, secs);
        if (next > prev) saveHighScore(next);
        return next;
      });
      setPhase("gameover");
      // Don't dispose — keep canvas alive for overlay
    };

    const playScene = buildPlayScene(engine, handleGameOver);
    engine.addScene("play", playScene);

    void engine.start().then(() => {
      void engine.goToScene("play");
    });

    setPhase("playing");
  }, [disposeEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disposeEngine();
  }, [disposeEngine]);

  // ── Neon star-field background painted on a separate canvas ────────────────
  const bgRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = bgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = c.offsetWidth;
    c.height = c.offsetHeight;
    for (let i = 0; i < 120; i++) {
      const x = Math.random() * c.width;
      const y = Math.random() * c.height;
      const r = Math.random() * 1.4 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,220,255,${Math.random() * 0.7 + 0.2})`;
      ctx.fill();
    }
  }, []);

  return (
    <Shell>
      <div className="relative w-full h-full min-h-[400px] overflow-hidden">
        {/* Star-field — always visible */}
        <canvas ref={bgRef} className="absolute inset-0 w-full h-full" style={{ background: "#060918" }} />

        {/* Excalibur canvas — mounted always, game runs when phase=playing/gameover */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: phase === "start" ? 0 : 1, transition: "opacity 0.3s" }}
        />

        {/* ── START SCREEN ── */}
        {phase === "start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
            <h1
              className="text-5xl md:text-6xl font-bold leading-tight"
              style={{
                fontFamily: "Fraunces, serif",
                color: "#00f5ff",
                textShadow: "0 0 30px #00f5ff, 0 0 60px #00f5ff88",
              }}
            >
              Astro Drift
            </h1>
            <p className="text-base md:text-lg max-w-xs" style={{ color: "#94a3b8", fontFamily: "Manrope, sans-serif" }}>
              Steer your ship through the asteroid field.<br />
              Survive as long as you can.
            </p>
            <div className="text-sm" style={{ color: "#475569", fontFamily: "Manrope, sans-serif" }}>
              Arrow keys / WASD &nbsp;·&nbsp; Tap / Click to move
            </div>
            {loadHighScore() > 0 && (
              <div className="text-sm font-semibold" style={{ color: "#facc15", textShadow: "0 0 10px #facc1588" }}>
                Best: {loadHighScore()}s
              </div>
            )}
            <button
              onClick={startGame}
              className="mt-2 px-10 py-4 rounded-full font-bold text-lg tracking-wide transition-transform active:scale-95"
              style={{
                fontFamily: "Manrope, sans-serif",
                background: "transparent",
                border: "2px solid #00f5ff",
                color: "#00f5ff",
                boxShadow: "0 0 24px #00f5ff66, inset 0 0 12px #00f5ff22",
                minWidth: "180px",
              }}
            >
              Launch
            </button>
          </div>
        )}

        {/* ── GAME OVER OVERLAY ── */}
        {phase === "gameover" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center"
            style={{ background: "rgba(6,9,24,0.82)", backdropFilter: "blur(6px)" }}
          >
            <h2
              className="text-4xl md:text-5xl font-bold"
              style={{
                fontFamily: "Fraunces, serif",
                color: "#ff2d78",
                textShadow: "0 0 28px #ff2d78, 0 0 60px #ff2d7866",
              }}
            >
              Destroyed
            </h2>
            <div style={{ fontFamily: "Manrope, sans-serif" }}>
              <div className="text-3xl font-bold" style={{ color: "#00f5ff", textShadow: "0 0 16px #00f5ff88" }}>
                {lastScore}s survived
              </div>
              {lastScore >= highScore && lastScore > 0 && (
                <div className="mt-1 text-sm font-semibold" style={{ color: "#facc15", textShadow: "0 0 10px #facc1588" }}>
                  ★ New Best!
                </div>
              )}
              {lastScore < highScore && (
                <div className="mt-1 text-sm" style={{ color: "#94a3b8" }}>
                  Best: {highScore}s
                </div>
              )}
            </div>
            <button
              onClick={startGame}
              className="mt-2 px-10 py-4 rounded-full font-bold text-lg tracking-wide transition-transform active:scale-95"
              style={{
                fontFamily: "Manrope, sans-serif",
                background: "transparent",
                border: "2px solid #00f5ff",
                color: "#00f5ff",
                boxShadow: "0 0 24px #00f5ff66, inset 0 0 12px #00f5ff22",
                minWidth: "180px",
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
