import { useEffect, useRef } from "react";

// Executa a função a cada "intervalMs" enquanto "enabled" for verdadeiro
export function usePolling(enabled: boolean, intervalMs: number, callback: () => Promise<void> | void) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let running = false;
    const timer = window.setInterval(async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        await callbackRef.current();
      } catch {
        // tenta de novo no próximo ciclo
      } finally {
        running = false;
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);
}