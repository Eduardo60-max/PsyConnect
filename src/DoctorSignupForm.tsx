import { useState, type SyntheticEvent } from "react";
import { CheckRow, Field, LegalLinks, PasswordField } from "./AuthFields";
import {
  SPECIALTIES,
  UF_LIST,
  collectErrors,
  requireChecked,
  validateConfirm,
  validateCrm,
  validateEmail,
  validateName,
  validatePassword,
  validateSpecialty,
  validateUf,
  type FieldErrors,
} from "./authValidation";
import type { DoctorSignup } from "./authService";

type DoctorSignupFormProps = {
  onSubmit: (data: DoctorSignup) => Promise<void>;
  onBack: () => void;
  onOpenLegal: (kind: "terms" | "privacy") => void;
};

export function DoctorSignupForm({ onSubmit, onBack, onOpenLegal }: Readonly<DoctorSignupFormProps>) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [truth, setTruth] = useState(false);
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
      crm: validateCrm(crm),
      crmUf: validateUf(crmUf),
      specialty: validateSpecialty(specialty),
      password: validatePassword(password),
      confirm: validateConfirm(password, confirm),
      terms: requireChecked(terms, "Aceite os termos e a política de privacidade para continuar."),
      truth: requireChecked(truth, "Confirme que as informações são verdadeiras."),
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
        crm: crm.replaceAll(/[.\s-]/g, ""),
        crmUf,
        specialty,
        password,
        acceptedTermsAt: now,
        acceptedTruthAt: now,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Não foi possível enviar o cadastro agora. Tente de novo.");
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="text-link auth-back" onClick={onBack}>
        ← Voltar
      </button>
      <p className="eyebrow">Cadastro de médico</p>
      <h2>Cadastrar como profissional</h2>
      <p className="auth-notice">
        Depois do cadastro, a nossa equipe confere o seu CRM. Você só aparece para os pacientes depois da aprovação.
      </p>

      <form onSubmit={handleSubmit} className="booking-form" noValidate>
        <Field label="Nome completo" error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={event => {
              setName(event.target.value);
              clear("name");
            }}
            placeholder="Como no seu registro profissional"
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

        <div className="auth-row">
          <Field label="CRM" error={errors.crm}>
            <input
              type="text"
              value={crm}
              onChange={event => {
                setCrm(event.target.value);
                clear("crm");
              }}
              placeholder="Somente números"
              inputMode="numeric"
              maxLength={12}
              aria-invalid={Boolean(errors.crm)}
            />
          </Field>

          <Field label="UF do CRM" error={errors.crmUf}>
            <select
              value={crmUf}
              onChange={event => {
                setCrmUf(event.target.value);
                clear("crmUf");
              }}
              aria-invalid={Boolean(errors.crmUf)}
            >
              <option value="">UF</option>
              {UF_LIST.map(uf => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Especialidade" error={errors.specialty}>
          <select
            value={specialty}
            onChange={event => {
              setSpecialty(event.target.value);
              clear("specialty");
            }}
            aria-invalid={Boolean(errors.specialty)}
          >
            <option value="">Escolha uma opção</option>
            {SPECIALTIES.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
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
          checked={truth}
          onChange={value => {
            setTruth(value);
            clear("truth");
          }}
          error={errors.truth}
        >
          Declaro que as informações são verdadeiras e autorizo a verificação do meu registro profissional.
        </CheckRow>

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

        {formError && (
          <p className="auth-error" role="alert">
            {formError}
          </p>
        )}

        <button type="submit" className="primary-btn full-width" disabled={busy}>
          {busy ? "Enviando cadastro..." : "Enviar cadastro"}
        </button>
      </form>
    </>
  );
}