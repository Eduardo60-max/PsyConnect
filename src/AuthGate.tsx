import { useState, type SyntheticEvent } from "react";
import { professionals } from "./data";
import { avatarInitial } from "./utils";

export type CurrentUser = {
  name: string;
  email: string;
  role?: "patient" | "pro";
  proId?: string;
};

type AuthGateProps = {
  onLogin: (user: CurrentUser) => void;
};

export function AuthGate({ onLogin }: Readonly<AuthGateProps>) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [showPro, setShowPro] = useState(false);

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Preencha nome e e-mail para continuar.");
      return;
    }
    if (!consent) {
      setError("É necessário aceitar o tratamento de dados para usar o PsyConect.");
      return;
    }
    setError("");
    onLogin({ name: name.trim(), email: email.trim(), role: "patient" });
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="brand-mark">PsyConect</p>
        <h2>Entrar na plataforma</h2>
        <p className="auth-subtitle">
          Conecte-se a grupos de apoio e profissionais qualificados. Seus dados de saúde são tratados com cuidado
          e nunca compartilhados sem o seu consentimento.
        </p>

        <form onSubmit={handleSubmit} className="booking-form">
          <label>
            <span>Nome</span>
            <input type="text" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required />
          </label>
          <label>
            <span>E-mail</span>
            <input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="seu@email.com" required />
          </label>

          <label className="create-group-toggle-row auth-consent-row">
            <span>
              Li e aceito o tratamento dos meus dados pessoais e de saúde conforme a LGPD, para fins de participação
              em grupos e acompanhamento profissional.
            </span>
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="primary-btn full-width">
            Entrar
          </button>
        </form>

        <div className="auth-divider">
          <span>ou</span>
        </div>

        <button
          type="button"
          className="secondary-btn full-width"
          onClick={() => setShowPro(current => !current)}
          aria-expanded={showPro}
        >
          Entrar como profissional (demonstração)
        </button>

        {showPro && (
          <ul className="suggested-group-list pro-login-list">
            {professionals.map(professional => (
              <li key={professional.id}>
                <button
                  type="button"
                  className="suggested-group-item"
                  onClick={() =>
                    onLogin({
                      name: professional.name,
                      email: `${professional.id}@profissional.psyconect`,
                      role: "pro",
                      proId: professional.id,
                    })
                  }
                >
                  <span className="avatar avatar-small" style={{ backgroundColor: professional.accent }}>
                    {avatarInitial(professional.name)}
                  </span>
                  <span>
                    <strong>{professional.name}</strong>
                    <span className="suggested-group-meta">
                      {professional.role} · {professional.specialty}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}