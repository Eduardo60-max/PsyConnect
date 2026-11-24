import { useState, type SyntheticEvent } from "react";
import { Field } from "./AuthFields";
import { validateEmail } from "./authValidation";

type ForgotPasswordFormProps = {
  onSubmit: (email: string) => Promise<void>;
  onBack: () => void;
};

export function ForgotPasswordForm({ onSubmit, onBack }: Readonly<ForgotPasswordFormProps>) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;

    const problem = validateEmail(email);
    setError(problem ?? "");
    if (problem) return;

    setBusy(true);
    setFormError("");
    try {
      await onSubmit(email.trim());
      setSent(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Não foi possível enviar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <>
        <p className="eyebrow">Recuperar senha</p>
        <h2>Confira o seu e-mail</h2>
        <output className="auth-success">
          Se existir uma conta com <strong>{email.trim()}</strong>, enviamos um link para criar uma nova senha.
          Olhe também a caixa de spam.
        </output>
        <button type="button" className="primary-btn full-width" onClick={onBack}>
          Voltar para o login
        </button>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Recuperar senha</p>
      <h2>Esqueci a minha senha</h2>
      <p className="auth-subtitle">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <Field label="E-mail" error={error}>
          <input
            type="email"
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              setError("");
              setFormError("");
            }}
            placeholder="seu@email.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            aria-invalid={Boolean(error)}
          />
        </Field>

        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={busy}>
          {busy ? "Enviando..." : "Enviar link"}
        </button>
      </form>

      <div className="auth-links">
        <button type="button" className="text-link" onClick={onBack}>
          ← Voltar para o login
        </button>
      </div>
    </>
  );
}