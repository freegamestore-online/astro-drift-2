import { useEffect, useRef } from "react";
import { Actor, Color, DisplayMode, Engine, vec } from "excalibur";
import { Shell } from "./components/Shell";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const game = new Engine({
      canvasElement,
      displayMode: DisplayMode.FillContainer,
      backgroundColor: Color.fromHex("#0f172a"),
    });

    // Actors are typed OOP entities: position, velocity, graphics and
    // collision come built in — subclass Actor for real game objects.
    const block = new Actor({
      pos: vec(200, 200),
      width: 100,
      height: 100,
      color: Color.fromHex("#2563eb"),
    });
    block.angularVelocity = 1;
    game.add(block);

    void game.start();
    return () => game.dispose();
  }, []);

  return (
    <Shell>
      <div className="w-full h-full min-h-[400px]">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </Shell>
  );
}
