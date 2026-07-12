import { useCallback, useEffect, useRef, useState } from "react";
import {
  CollisionStartEvent,
  Color,
  DisplayMode,
  Engine,
  Scene,
  Timer,
  vec,
} from "excalibur";
import { Shell } from "./components/Shell";
import { Ship } from "./actors/Ship";
import { spawnAsteroid } from "./actors/Asteroid";
import { useHighScore } from "./hooks/useHighScore";
import type { GamePhase } from "./types";

const LS_KEY = "astrodrift2_highscore";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const [phase, setPhase] = useState<GamePhase>("menu");
  const [score, setScore] = useState(0);
  const [highScore, updateHighScore] = useHighScore(LS_KEY);

  // Live refs so async callbacks never close over stale state
  const scoreRef = useRef(0);
  const phaseRef = useRef<GamePhase>("menu");
  const activeSceneRef = useRef<Scene | null>(null);

  const stopGame = useCallback(
    (finalScore: number) => {
      if (phaseRef.current !== "playing") return;
      phaseRef.current = "over";
      updateHighScore(finalScore);
      setPhase("over");

      const scene = activeSceneRef.current;
      if (scene) {
        scene.actors.forEach((a) => {
          if (!(a instanceof Ship)) a.kill();
        });
      }
    },
    [updateHighScore],
  );

  const startGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    phaseRef.current = "playing";
    scoreRef.current = 0;
    setScore(0);
    setPhase("playing");

    const scene = new Scene();
    activeSceneRef.current = scene;

    const ship = new Ship(engine.drawWidth / 2, engine.drawHeight / 2);
    scene.add(ship);

    // Pointer steering
    engine.input.pointers.primary.on("move", (evt) => {
      if (phaseRef.current === "playing") ship.setTarget(evt.worldPos);
    });
    engine.input.pointers.primary.on("down", (evt) => {
      if (phaseRef.current === "playing") ship.setTarget(evt.worldPos);
    });
    engine.input.pointers.primary.on("up", () => {
      ship.clearTarget();
    });

    // Collision → game over
    ship.on("collisionstart", (_evt: CollisionStartEvent) => {
      ship.kill();
      stopGame(scoreRef.current);
    });

    // Score ticker: +1 per 100 ms = 10 pts/s
    const scoreTimer = new Timer({
      interval: 100,
      repeats: true,
      fcn: () => {
        if (phaseRef.current !== "playing") return;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      },
    });
    scene.addTimer(scoreTimer);
    scoreTimer.start();

    // Asteroid spawner — one-shot timers so interval can shrink over time
    let spawnDelay = 1400;

    function scheduleNextSpawn(): void {
      if (phaseRef.current !== "playing") return;
      const t = new Timer({
        interval: spawnDelay,
        repeats: false,
        fcn: () => {
          if (phaseRef.current !== "playing") return;
          scene.add(spawnAsteroid(engine));
          spawnDelay = Math.max(400, spawnDelay - 18);
          scheduleNextSpawn();
        },
      });
      scene.addTimer(t);
      t.start();
    }

    // Seed with a few asteroids right away
    for (let i = 0; i < 3; i++) {
      scene.add(spawnAsteroid(engine));
    }
    scheduleNextSpawn();

    const sceneName = `game_${Date.now()}`;
    engine.addScene(sceneName, scene);
    void engine.goToScene(sceneName);
  }, [stopGame]);

  // Boot Excalibur once
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const game = new Engine({
      canvasElement,
      displayMode: DisplayMode.FillContainer,
      backgroundColor: Color.fromRGB(4, 6, 20),
    });

    engineRef.current = game;
    void game.start();

    return () => {
      game.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sidebar content
  const sidebar = (
    <div className="flex flex-col gap-5 px-6 py-4 flex-1">
      <div>
        <div
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: "var(--muted)" }}
        >
          Best
        </div>
        <div
          className="text-3xl font-bold tabular-nums"
          style={{ fontFamily: "Fraunces, serif", color: "#00f5ff" }}
        >
          {highScore}
        </div>
      </div>
      {phase === "playing" && (
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--muted)" }}
          >
            Score
          </div>
          <div
            className="text-3xl font-bold tabular-nums"
            style={{ fontFamily: "Fraunces, serif", color: "#a855f7" }}
          >
            {score}
          </div>
        </div>
      )}
      <div className="mt-auto">
        <div
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: "var(--muted)" }}
        >
          Controls
        </div>
        <ul className="text-sm space-y-1" style={{ color: "var(--ink)" }}>
          <li>🖱 Tap / click to steer</li>
          <li>⬆⬇⬅➡ Arrow keys</li>
          <li>WASD also works</li>
        </ul>
      </div>
    </div>
  );

  return (
    <Shell sidebar={sidebar}>
      <div className="relative w-full h-full" style={{ background: "#040614" }}>
        <canvas ref={canvasRef} className="w-full h-full" />

        {/* Live score HUD (mobile / in-canvas) */}
        {phase === "playing" && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full text-sm font-bold tabular-nums pointer-events-none select-none"
            style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(0,245,255,0.35)",
              color: "#00f5ff",
              fontFamily: "Fraunces, serif",
              letterSpacing: "0.05em",
              textShadow: "0 0 10px #00f5ff",
            }}
          >
            {score}
          </div>
        )}

        {/* ── START SCREEN ── */}
        {phase === "menu" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-8"
            style={{ background: "rgba(4,6,20,0.82)" }}
          >
            <div className="text-center">
              <h1
                className="text-5xl md:text-7xl font-bold mb-3"
                style={{
                  fontFamily: "Fraunces, serif",
                  color: "#00f5ff",
                  textShadow: "0 0 40px #00f5ff, 0 0 80px #00f5ff55",
                }}
              >
                ASTRO DRIFT
              </h1>
              <p className="text-base md:text-lg" style={{ color: "#a0aec0" }}>
                Dodge the asteroids. Survive as long as you can.
              </p>
            </div>

            {highScore > 0 && (
              <div
                className="px-6 py-2 rounded-full text-sm font-semibold"
                style={{
                  background: "rgba(168,85,247,0.15)",
                  border: "1px solid rgba(168,85,247,0.5)",
                  color: "#a855f7",
                }}
              >
                Best: {highScore}
              </div>
            )}

            <button
              onClick={startGame}
              className="px-10 py-4 rounded-2xl text-lg font-bold tracking-wide transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #00f5ff22, #a855f722)",
                border: "2px solid #00f5ff",
                color: "#00f5ff",
                fontFamily: "Manrope, sans-serif",
                textShadow: "0 0 12px #00f5ff",
                boxShadow: "0 0 30px #00f5ff44, inset 0 0 20px #00f5ff11",
                minWidth: "180px",
                minHeight: "56px",
              }}
            >
              LAUNCH
            </button>

            <p className="text-xs" style={{ color: "#4a5568" }}>
              Tap / click to steer · Arrow keys / WASD
            </p>
          </div>
        )}

        {/* ── GAME OVER SCREEN ── */}
        {phase === "over" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-7"
            style={{ background: "rgba(4,6,20,0.88)" }}
          >
            <h2
              className="text-4xl md:text-6xl font-bold"
              style={{
                fontFamily: "Fraunces, serif",
                color: "#ff2d78",
                textShadow: "0 0 40px #ff2d78, 0 0 80px #ff2d7855",
              }}
            >
              DESTROYED
            </h2>

            <div className="flex gap-10 text-center">
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: "#4a5568" }}
                >
                  Score
                </div>
                <div
                  className="text-4xl font-bold tabular-nums"
                  style={{
                    fontFamily: "Fraunces, serif",
                    color: "#a855f7",
                    textShadow: "0 0 20px #a855f7",
                  }}
                >
                  {score}
                </div>
              </div>
              <div>
                <div
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: "#4a5568" }}
                >
                  Best
                </div>
                <div
                  className="text-4xl font-bold tabular-nums"
                  style={{
                    fontFamily: "Fraunces, serif",
                    color: "#00f5ff",
                    textShadow: "0 0 20px #00f5ff",
                  }}
                >
                  {highScore}
                </div>
              </div>
            </div>

            {score > 0 && score >= highScore && (
              <div
                className="px-5 py-1.5 rounded-full text-sm font-bold"
                style={{
                  background: "rgba(0,245,255,0.1)",
                  border: "1px solid #00f5ff",
                  color: "#00f5ff",
                  textShadow: "0 0 8px #00f5ff",
                }}
              >
                ✦ NEW BEST ✦
              </div>
            )}

            <button
              onClick={startGame}
              className="px-10 py-4 rounded-2xl text-lg font-bold tracking-wide transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #ff2d7822, #a855f722)",
                border: "2px solid #ff2d78",
                color: "#ff2d78",
                fontFamily: "Manrope, sans-serif",
                textShadow: "0 0 12px #ff2d78",
                boxShadow: "0 0 30px #ff2d7844, inset 0 0 20px #ff2d7811",
                minWidth: "180px",
                minHeight: "56px",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
}
