import { useState, type SyntheticEvent } from "react";
import { CheckRow, Field, LegalLinks, PasswordField } from "./AuthFields";
import {
  collectErrors,
  requireChecked,
  todayISO,
  validateBirthDate,
  validateConfirm,
  validateEmail,
  validateName,
  validatePassword,
  type FieldErrors,
} from "./authValidation";
import type { PatientSignup } from "./authService";

type PatientSignupFormProps = {
  onSubmit: (data: PatientSignup) => Promise<void>;
  onBack: () => void;
  onOpenLegal: (kind: "terms" | "privacy") => void;
};

export function PatientSignupForm({ onSubmit, onBack, onOpenLegal }: Readonly<PatientSignupFormProps>) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [healthData, setHealthData] = useState(false);
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
      name: validateName(name),
      email: validateEmail(email),
      birthDate: validateBirthDate(birthDate),
      password: validatePassword(password),
      confirm: validateConfirm(password, confirm),
      terms: requireChecked(terms, "Aceite os termos e a política de privacidade para continuar."),
      healthData: requireChecked(healthData, "Precisamos do seu consentimento para tratar dados de saúde."),
    });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFormError("");
    const now = new Date().toISOString();
    try {
      await onSubmit({
        name: name.trim().replaceAll(/\s+/g, " "),
        email: email.trim(),
        birthDate,
        password,
        acceptedTermsAt: now,
        acceptedHealthDataAt: now,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível criar a conta agora. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="text-link auth-back" onClick={onBack}>
        ← Voltar
      </button>
      <p className="eyebrow">Cadastro de paciente</p>
      <h2>Criar a sua conta</h2>
      <p className="auth-subtitle">Leva menos de um minuto. Você confirma o e-mail depois.</p>

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <Field label="Nome completo" error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={event => {
              setName(event.target.value);
              clear("name");
            }}
            placeholder="Nome e sobrenome"
            autoComplete="name"
            maxLength={80}
            aria-invalid={Boolean(errors.name)}
          />
        </Field>

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

        <Field label="Data de nascimento" error={errors.birthDate}>
          <input
            type="date"
            value={birthDate}
            max={todayISO()}
            onChange={event => {
              setBirthDate(event.target.value);
              clear("birthDate");
            }}
            autoComplete="bday"
            aria-invalid={Boolean(errors.birthDate)}
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
          hint="Mínimo de 8 caracteres, com letras e números."
          autoComplete="new-password"
        />

        <PasswordField
          label="Repita a senha"
          value={confirm}
          onChange={value => {
            setConfirm(value);
            clear("confirm");
          }}
          error={errors.confirm}
          autoComplete="new-password"
        />

        <CheckRow
          checked={terms}
          onChange={value => {
            setTerms(value);
            clear("terms");
          }}
          error={errors.terms}
        >
          Li e aceito os <LegalLinks onOpen={onOpenLegal} />.
        </CheckRow>

        <CheckRow
          checked={healthData}
          onChange={value => {
            setHealthData(value);
            clear("healthData");
          }}
          error={errors.healthData}
        >
          Autorizo o tratamento dos meus dados de saúde (como humor e motivo das sessões), conforme a LGPD, para
          participar de grupos e acompanhamento profissional.
        </CheckRow>

        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={busy}>
          {busy ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
    </>
  );
}