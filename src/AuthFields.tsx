import { useState, type ReactNode } from "react";

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function Field({ label, error, hint, children }: Readonly<FieldProps>) {
  return (
    <label className={error ? "auth-field has-error" : "auth-field"}>
      <span>{label}</span>
      {children}
      {hint && !error && <small className="auth-hint">{hint}</small>}
      {error && (
        <small className="auth-field-error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
}

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder,
}: Readonly<PasswordFieldProps>) {
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} error={error} hint={hint}>
      <div className="password-wrap">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={72}
          aria-invalid={Boolean(error)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    </Field>
  );
}

type CheckRowProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
};

export function CheckRow({ checked, onChange, error, children }: Readonly<CheckRowProps>) {
  return (
    <div className={error ? "auth-check has-error" : "auth-check"}>
      <label>
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
        <span>{children}</span>
      </label>
      {error && (
        <small className="auth-field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

type LegalLinksProps = {
  onOpen: (kind: "terms" | "privacy") => void;
};

// "Termos de uso" e "Política de privacidade" como links que abrem a janela
export function LegalLinks({ onOpen }: Readonly<LegalLinksProps>) {
  return (
    <>
      <button type="button" className="text-link" onClick={() => onOpen("terms")}>
        Termos de uso
      </button>{" "}
      e a{" "}
      <button type="button" className="text-link" onClick={() => onOpen("privacy")}>
        Política de privacidade
      </button>
    </>
  );
}