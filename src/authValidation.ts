export type FieldErrors = Record<string, string>;

export const UF_LIST = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const SPECIALTIES = [
  "Ansiedade e burnout",
  "Relacionamentos",
  "Autoconhecimento",
  "Sono",
  "Emagrecimento saudável",
  "Treinos e desafios",
  "Outra",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function validateName(value: string): string | null {
  const name = value.trim().replaceAll(/\s+/g, " ");
  if (!name) return "Informe o seu nome completo.";
  if (name.length < 5 || !name.includes(" ")) return "Informe nome e sobrenome.";
  if (name.length > 80) return "O nome pode ter no máximo 80 caracteres.";
  return null;
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Informe o seu e-mail.";
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Esse e-mail não parece válido. Confira se digitou certo.";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "Crie uma senha.";
  if (value.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (value.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Use letras e números na senha.";
  return null;
}

export function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "Repita a senha.";
  if (password !== confirm) return "As senhas não são iguais.";
  return null;
}

// Regra provisória: só maiores de 18 anos. Ajuste se a faculdade/comitê decidir diferente.
export function validateBirthDate(value: string): string | null {
  if (!value) return "Informe a data de nascimento.";
  const birth = new Date(`${value}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return "Data de nascimento inválida.";

  const now = new Date();
  if (birth > now) return "A data de nascimento não pode estar no futuro.";

  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthday =
    now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;

  if (age > 120) return "Data de nascimento inválida.";
  if (age < 18) return "Por enquanto o PsyConnect é só para maiores de 18 anos.";
  return null;
}

export function validateCrm(value: string): string | null {
  const digits = value.replaceAll(/[.\s-]/g, "");
  if (!digits) return "Informe o número do CRM.";
  if (!/^\d{4,7}$/.test(digits)) return "O CRM deve ter de 4 a 7 números.";
  return null;
}

export function validateUf(value: string): string | null {
  return (UF_LIST as readonly string[]).includes(value) ? null : "Escolha o estado do CRM.";
}

export function validateSpecialty(value: string): string | null {
  return (SPECIALTIES as readonly string[]).includes(value) ? null : "Escolha a sua especialidade.";
}

export function requireChecked(checked: boolean, message: string): string | null {
  return checked ? null : message;
}

// Junta só os erros que existem
export function collectErrors(entries: Record<string, string | null>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, message] of Object.entries(entries)) {
    if (message) errors[field] = message;
  }
  return errors;
}