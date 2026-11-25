import { useState } from "react";
import type { CurrentUser } from "./types";
import { CrisisNotice } from "./CrisisNotice";

type PendingDoctorScreenProps = {
  user: CurrentUser;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onRefreshStatus: () => Promise<void>;
  onLogout: () => void;
};

export function PendingDoctorScreen({
  user,
  theme,
  onToggleTheme,
  onRefreshStatus,
  onLogout,
}: Readonly<PendingDoctorScreenProps>) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const pro = user.professional;
  const isRejected = pro?.status === "recusado";

  const handleCheck = async () => {
    setChecking(true);
    setError("");
    try {
      await onRefreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível verificar agora.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-mark">PsyConnect</p>
          <span className="brand-subtitle">Cadastro profissional</span>
        </div>
        <div className="topbar-user">
          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className="screen pending-doctor-wrap">
        <div className="insight-card pending-doctor-card">
          <p className="eyebrow">{isRejected ? "Cadastro recusado" : "Em análise"}</p>
          <h2>
            {isRejected
              ? "Seu cadastro profissional não foi aprovado"
              : "Seu cadastro está em análise pela equipe"}
          </h2>

          {isRejected ? (
            <div className="auth-notice pending-rejected">
              <strong>Motivo informado:</strong>{" "}
              {pro?.rejectionReason || "Os dados do CRM não puderam ser validados nesta etapa."}
            </div>
          ) : (
            <p className="group-detail-description">
              Olá, <strong>{user.name}</strong>. Recebemos seu registro (CRM/{pro?.crmUf} {pro?.crm} ·{" "}
              {pro?.specialty}). Enquanto a equipe verifica seu CRM, as telas de atendimento permanecem bloqueadas.
            </p>
          )}

          <div className="summary-card">
            <div>
              <strong>CRM</strong>
              <p>
                {pro?.crm} / {pro?.crmUf}
              </p>
            </div>
            <div>
              <strong>Especialidade</strong>
              <p>{pro?.specialty}</p>
            </div>
          </div>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          {!isRejected && (
            <button type="button" className="primary-btn full-width" onClick={handleCheck} disabled={checking}>
              {checking ? "Verificando..." : "Verificar aprovação novamente"}
            </button>
          )}

          <div className="auth-crisis">
            <CrisisNotice />
          </div>
        </div>
      </main>
    </div>
  );
}
