import { useState, type SyntheticEvent } from "react";
import { PasswordField } from "./AuthFields";
import { collectErrors, validateConfirm, validatePassword, type FieldErrors } from "./authValidation";

type ResetPasswordFormProps = {
  onSubmit: (newPassword: string) => Promise<void>;
  onCancel: () => void;
};

export function ResetPasswordForm({ onSubmit, onCancel }: Readonly<ResetPasswordFormProps>) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      password: validatePassword(password),
      confirm: validateConfirm(password, confirm),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFormError("");
    try {
      await onSubmit(password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
      setBusy(false);
    }
  };

  return (
    <>
      <p className="eyebrow">Nova senha</p>
      <h2>Crie sua nova senha</h2>
      <p className="auth-subtitle">Escolha uma senha segura com pelo menos 8 caracteres, letras e números.</p>

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <PasswordField
          label="Nova senha"
          value={password}
          onChange={value => {
            setPassword(value);
            clear("password");
          }}
          error={errors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
          autoComplete="new-password"
        />

        <PasswordField
          label="Repita a nova senha"
          value={confirm}
          onChange={value => {
            setConfirm(value);
            clear("confirm");
          }}
          error={errors.confirm}
          autoComplete="new-password"
        />

        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={busy}>
          {busy ? "Salvando senha..." : "Salvar nova senha"}
        </button>
      </form>

      <div className="auth-links">
        <button type="button" className="text-link" onClick={onCancel}>
          ← Voltar para o login
        </button>
      </div>
    </>
  );
}
