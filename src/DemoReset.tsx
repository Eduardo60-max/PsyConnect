import { useState } from "react";
import { resetDemoRequest } from "./api";
import { NOTIFICATION_KEY_PREFIX } from "./notifications";

function clearStoredNotifications() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith(NOTIFICATION_KEY_PREFIX)) keys.push(key);
  }
  for (const key of keys) window.localStorage.removeItem(key);
}

export function DemoReset() {
  const [busy, setBusy] = useState(false);

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Restaurar os dados de demonstração? Posts, comentários, mensagens, sessões, notificações, diário de humor e participações em grupos voltam ao estado inicial.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await resetDemoRequest();
      clearStoredNotifications();
      window.location.reload();
    } catch {
      setBusy(false);
      window.alert("Não foi possível restaurar os dados agora.");
    }
  };

  return (
    <footer className="demo-footer">
      <button type="button" className="demo-reset-btn" onClick={handleReset} disabled={busy}>
        {busy ? "Restaurando..." : "Modo demonstração: restaurar dados iniciais"}
      </button>
    </footer>
  );
}