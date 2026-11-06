import { useState } from "react";
import { resetDemoRequest } from "./api";

export function DemoReset() {
  const [busy, setBusy] = useState(false);

  const handleReset = async () => {
    const confirmed = window.confirm(
      "Restaurar os dados de demonstração? Posts, comentários, mensagens, diário de humor e participações em grupos voltam ao estado inicial.",
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await resetDemoRequest();
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