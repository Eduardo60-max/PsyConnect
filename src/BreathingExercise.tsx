import { useEffect, useState } from "react";

const PHASES = [
  { id: "inhale", label: "Inspire pelo nariz", seconds: 4, scale: 1 },
  { id: "hold", label: "Segure o ar", seconds: 7, scale: 1 },
  { id: "exhale", label: "Solte devagar pela boca", seconds: 8, scale: 0.55 },
] as const;

const CYCLE_SECONDS = PHASES.reduce((sum, phase) => sum + phase.seconds, 0);

function getPhase(elapsed: number) {
  let t = elapsed % CYCLE_SECONDS;
  for (const phase of PHASES) {
    if (t < phase.seconds) return { phase, remaining: phase.seconds - t };
    t -= phase.seconds;
  }
  return { phase: PHASES[0], remaining: PHASES[0].seconds };
}

export function BreathingExercise() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setElapsed(current => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const handleToggle = () => {
    if (running) {
      setRunning(false);
      setElapsed(0);
    } else {
      setElapsed(0);
      setRunning(true);
    }
  };

  const { phase, remaining } = getPhase(elapsed);
  const cycles = Math.floor(elapsed / CYCLE_SECONDS);
  const scale = running ? phase.scale : 0.55;

  return (
    <div className="insight-card breathing-card">
      <p className="eyebrow">Respiração 4-7-8</p>
      <h3>Um minuto para desacelerar</h3>

      <div className="breathing-stage" aria-live="polite">
        <div
          className="breathing-circle"
          style={{ transform: `scale(${scale})`, transitionDuration: running ? `${phase.seconds}s` : "0.6s" }}
        >
          <span className="breathing-count">{running ? remaining : ""}</span>
        </div>
      </div>

      <p className="breathing-label">{running ? phase.label : "Inspire 4s, segure 7s, solte 8s."}</p>
      {running && cycles > 0 && (
        <p className="breathing-cycles">{cycles} {cycles === 1 ? "ciclo completo" : "ciclos completos"}</p>
      )}

      <button type="button" className="primary-btn full-width" onClick={handleToggle}>
        {running ? "Parar" : "Começar"}
      </button>
    </div>
  );
}