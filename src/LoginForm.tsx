import { useState, type SyntheticEvent } from "react";
import { Field, PasswordField } from "./AuthFields";
import { collectErrors, validateEmail, type FieldErrors } from "./authValidation";

type LoginFormProps = {
  onSubmit: (email: string, password: string) => Promise<void>;
  onForgot: () => void;
  onCreateAccount: () => void;
};

export function LoginForm({ onSubmit, onForgot, onCreateAccount }: Readonly<LoginFormProps>) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const clear = (field: string) => {
    setFormError("");
    setErrors(current => {
      if (!current[field]) return current;
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  };

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;

    const found = collectErrors({
      email: validateEmail(email),
      password: password ? null : "Informe a sua senha.",
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFormError("");
    try {
      await onSubmit(email.trim(), password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível entrar agora. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <>
      <p className="eyebrow">Bem-vindo(a) de volta</p>
      <h2>Entrar na plataforma</h2>
      <p className="auth-subtitle">Use o e-mail e a senha que você cadastrou.</p>

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <Field label="E-mail" error={errors.email}>
          <input
            type="email"
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              clear("email");
            }}
            placeholder="seu@email.com"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            aria-invalid={Boolean(errors.email)}
          />
        </Field>

        <PasswordField
          label="Senha"
          value={password}
          onChange={value => {
            setPassword(value);
            clear("password");
          }}
          error={errors.password}
          autoComplete="current-password"
          placeholder="Sua senha"
        />

        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={busy}>
          {busy ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div className="auth-links">
        <button type="button" className="text-link" onClick={onForgot}>
          Esqueci a minha senha
        </button>
        <button type="button" className="text-link" onClick={onCreateAccount}>
          Criar conta
        </button>
      </div>
    </>
  );
}