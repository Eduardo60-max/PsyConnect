import { useState } from "react";
import type { CurrentUser } from "./types";
import { CrisisNotice } from "./CrisisNotice";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { LegalModal } from "./LegalModal";
import { LoginForm } from "./LoginForm";
import { PatientSignupForm } from "./PatientSignupForm";
import { DoctorSignupForm } from "./DoctorSignupForm";
import { ResetPasswordForm } from "./ResetPasswordForm";
import {
  loginRequest,
  registerDoctorRequest,
  registerPatientRequest,
  requestPasswordReset,
  resendConfirmationEmail,
  restoreSessionUser,
  updatePasswordRequest,
  type DoctorSignup,
  type PatientSignup,
} from "./authService";

type AuthGateProps = {
  onLogin: (user: CurrentUser) => void;
  initialMode?: "login" | "recovery";
  initialNotice?: string;
  initialError?: string;
  onClearExternalNotice?: () => void;
};

type View =
  | "login"
  | "chooseProfile"
  | "patientSignup"
  | "patientConfirm"
  | "doctorSignup"
  | "doctorPending"
  | "forgot"
  | "resetPassword";

export function AuthGate({
  onLogin,
  initialMode = "login",
  initialNotice = "",
  initialError = "",
  onClearExternalNotice,
}: Readonly<AuthGateProps>) {
  const [view, setView] = useState<View>(initialMode === "recovery" ? "resetPassword" : "login");
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [doctorNeedsEmailConfirm, setDoctorNeedsEmailConfirm] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [resendMessage, setResendMessage] = useState("");
  const [localNotice, setLocalNotice] = useState("");

  const notice = localNotice || initialNotice;

  const switchView = (next: View) => {
    setLocalNotice("");
    setResendState("idle");
    setResendMessage("");
    onClearExternalNotice?.();
    setView(next);
  };

  const handleLogin = async (email: string, password: string) => {
    onClearExternalNotice?.();
    onLogin(await loginRequest(email, password));
  };

  const handlePatientSignup = async (data: PatientSignup) => {
    const result = await registerPatientRequest(data);
    if (result.user) {
      onLogin(result.user);
      return;
    }
    setPendingEmail(data.email.trim().toLowerCase());
    setView("patientConfirm");
  };

  const handleDoctorSignup = async (data: DoctorSignup) => {
    const result = await registerDoctorRequest(data);
    setPendingEmail(data.email.trim().toLowerCase());
    setDoctorNeedsEmailConfirm(result.needsEmailConfirmation);
    setView("doctorPending");
  };

  const handleResend = async () => {
    if (!pendingEmail || resendState === "sending") return;
    setResendState("sending");
    setResendMessage("");
    try {
      await resendConfirmationEmail(pendingEmail);
      setResendState("sent");
      setResendMessage("Novo link enviado. Confira a caixa de entrada e o spam.");
    } catch (error) {
      setResendState("error");
      setResendMessage(error instanceof Error ? error.message : "Não foi possível reenviar agora.");
    }
  };

  const handleResetPassword = async (newPassword: string) => {
    await updatePasswordRequest(newPassword);
    const restored = await restoreSessionUser().catch(() => null);
    if (restored) {
      onLogin(restored);
      return;
    }
    setLocalNotice("Senha atualizada com sucesso! Agora você já pode entrar.");
    setView("login");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="brand-mark">PsyConnect</p>

        {notice && view === "login" && (
          <output className="auth-success">{notice}</output>
        )}
        {initialError && view === "login" && (
          <p className="auth-error auth-banner-error" role="alert">
            {initialError}
          </p>
        )}

        {view === "login" && (
          <LoginForm
            onSubmit={handleLogin}
            onForgot={() => switchView("forgot")}
            onCreateAccount={() => switchView("chooseProfile")}
          />
        )}

        {view === "forgot" && <ForgotPasswordForm onSubmit={requestPasswordReset} onBack={() => switchView("login")} />}

        {view === "resetPassword" && (
          <ResetPasswordForm onSubmit={handleResetPassword} onCancel={() => switchView("login")} />
        )}

        {view === "chooseProfile" && (
          <>
            <button type="button" className="text-link auth-back" onClick={() => switchView("login")}>
              ← Voltar
            </button>
            <p className="eyebrow">Criar conta</p>
            <h2>Como você quer usar o PsyConnect?</h2>
            <div className="auth-profile-grid">
              <button type="button" className="profile-option" onClick={() => switchView("patientSignup")}>
                <span className="profile-option-icon" aria-hidden="true">
                  💜
                </span>
                <strong>Sou paciente</strong>
                <span>Quero participar de grupos e agendar sessões com profissionais.</span>
              </button>
              <button type="button" className="profile-option" onClick={() => switchView("doctorSignup")}>
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
            onBack={() => switchView("chooseProfile")}
            onOpenLegal={setLegal}
          />
        )}

        {view === "patientConfirm" && (
          <>
            <p className="eyebrow">Confirme seu e-mail</p>
            <h2>Quase lá!</h2>
            <output className="auth-success">
              Enviamos um link de confirmação para <strong>{pendingEmail}</strong>. Toque no link do e-mail para ativar
              sua conta e entrar. Confira também a caixa de spam.
            </output>
            <div className="auth-confirm-actions">
              <button type="button" className="primary-btn full-width" onClick={() => switchView("login")}>
                Já confirmei, ir para o login
              </button>
              <button
                type="button"
                className="secondary-btn full-width"
                onClick={handleResend}
                disabled={resendState === "sending"}
              >
                {resendState === "sending" ? "Reenviando..." : "Reenviar e-mail de confirmação"}
              </button>
              {resendMessage && (
                <p className={resendState === "error" ? "auth-error" : "mood-saved"} role="status">
                  {resendMessage}
                </p>
              )}
            </div>
          </>
        )}

        {view === "doctorSignup" && (
          <DoctorSignupForm
            onSubmit={handleDoctorSignup}
            onBack={() => switchView("chooseProfile")}
            onOpenLegal={setLegal}
          />
        )}

        {view === "doctorPending" && (
          <>
            <p className="eyebrow">Cadastro enviado</p>
            <h2>Cadastro em análise</h2>
            <output className="auth-success">
              Recebemos o seu cadastro. A nossa equipe vai conferir o seu CRM e liberar o acesso após aprovação.
              {doctorNeedsEmailConfirm
                ? ` Também enviamos um link de confirmação para ${pendingEmail} — confirme o e-mail para conseguir acompanhar o status ao entrar.`
                : ""}
            </output>
            <button type="button" className="primary-btn full-width" onClick={() => switchView("login")}>
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
