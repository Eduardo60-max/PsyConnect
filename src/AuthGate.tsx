import { useState } from "react";
import { professionals } from "./data";
import { avatarInitial } from "./utils";
import { CrisisNotice } from "./CrisisNotice";
import { LegalModal } from "./LegalModal";
import { LoginForm } from "./LoginForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { PatientSignupForm } from "./PatientSignupForm";
import { DoctorSignupForm } from "./DoctorSignupForm";
import {
  loginRequest,
  registerDoctorRequest,
  registerPatientRequest,
  requestPasswordReset,
  type DoctorSignup,
  type PatientSignup,
} from "./authService";

export type CurrentUser = {
  name: string;
  email: string;
  role?: "patient" | "pro";
  proId?: string;
};

type AuthGateProps = {
  onLogin: (user: CurrentUser) => void;
};

type View = "login" | "chooseProfile" | "patientSignup" | "doctorSignup" | "doctorPending" | "forgot";

// Atalho só para desenvolvimento (some no build de produção). Remover quando o painel
// do profissional passar a usar contas reais.
const SHOW_DEV_SHORTCUT = process.env.NODE_ENV !== "production";

export function AuthGate({ onLogin }: Readonly<AuthGateProps>) {
  const [view, setView] = useState<View>("login");
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [showDev, setShowDev] = useState(false);

  const handleLogin = async (email: string, password: string) => {
    onLogin(await loginRequest(email, password));
  };

  const handlePatientSignup = async (data: PatientSignup) => {
    onLogin(await registerPatientRequest(data));
  };

  const handleDoctorSignup = async (data: DoctorSignup) => {
    await registerDoctorRequest(data);
    setView("doctorPending");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="brand-mark">PsyConect</p>

        {view === "login" && (
          <>
            <LoginForm
              onSubmit={handleLogin}
              onForgot={() => setView("forgot")}
              onCreateAccount={() => setView("chooseProfile")}
            />

            {SHOW_DEV_SHORTCUT && (
              <div className="dev-login">
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setShowDev(current => !current)}
                  aria-expanded={showDev}
                >
                  Atalho de desenvolvimento: entrar como profissional
                </button>
                {showDev && (
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
            )}
          </>
        )}

        {view === "forgot" && <ForgotPasswordForm onSubmit={requestPasswordReset} onBack={() => setView("login")} />}

        {view === "chooseProfile" && (
          <>
            <button type="button" className="text-link auth-back" onClick={() => setView("login")}>
              ← Voltar
            </button>
            <p className="eyebrow">Criar conta</p>
            <h2>Como você quer usar o PsyConnect?</h2>
            <div className="auth-profile-grid">
              <button type="button" className="profile-option" onClick={() => setView("patientSignup")}>
                <span className="profile-option-icon" aria-hidden="true">
                  💜
                </span>
                <strong>Sou paciente</strong>
                <span>Quero participar de grupos e agendar sessões com profissionais.</span>
              </button>
              <button type="button" className="profile-option" onClick={() => setView("doctorSignup")}>
                <span className="profile-option-icon" aria-hidden="true">
                  🩺
                </span>
                <strong>Sou médico</strong>
                <span>Quero atender pacientes e administrar grupos. O cadastro passa por aprovação.</span>
              </button>
            </div>
          </>
        )}

        {view === "patientSignup" && (
          <PatientSignupForm
            onSubmit={handlePatientSignup}
            onBack={() => setView("chooseProfile")}
            onOpenLegal={setLegal}
          />
        )}

        {view === "doctorSignup" && (
          <DoctorSignupForm
            onSubmit={handleDoctorSignup}
            onBack={() => setView("chooseProfile")}
            onOpenLegal={setLegal}
          />
        )}

        {view === "doctorPending" && (
          <>
            <p className="eyebrow">Cadastro enviado</p>
            <h2>Cadastro em análise</h2>
            <output className="auth-success">
              Recebemos o seu cadastro. A nossa equipe vai conferir o seu CRM e você será avisado por e-mail quando o
              acesso for liberado.
            </output>
            <button type="button" className="primary-btn full-width" onClick={() => setView("login")}>
              Voltar para o login
            </button>
          </>
        )}

        <div className="auth-crisis">
          <CrisisNotice />
        </div>
      </div>

      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}