/**
 * TEMPORÁRIO: simula o servidor de login enquanto o Supabase não está ligado.
 * Na próxima parte, troque o corpo destas funções por chamadas ao Supabase Auth.
 * As telas só dependem destas assinaturas, então nada mais precisa mudar.
 */
import type { CurrentUser } from "./AuthGate";

export type PatientSignup = {
  name: string;
  email: string;
  birthDate: string;
  password: string;
  acceptedTermsAt: string;
  acceptedHealthDataAt: string;
};

export type DoctorSignup = {
  name: string;
  email: string;
  crm: string;
  crmUf: string;
  specialty: string;
  password: string;
  acceptedTermsAt: string;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._-]/)[0] || "Paciente";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export async function loginRequest(email: string, _password: string): Promise<CurrentUser> {
  await wait(500);
  return { name: nameFromEmail(email), email: email.trim().toLowerCase(), role: "patient" };
}

export async function registerPatientRequest(data: PatientSignup): Promise<CurrentUser> {
  await wait(600);
  return { name: data.name.trim(), email: data.email.trim().toLowerCase(), role: "patient" };
}

// Médico nasce "pendente": não entra no app até a equipe aprovar
export async function registerDoctorRequest(_data: DoctorSignup): Promise<void> {
  await wait(600);
}

export async function requestPasswordReset(_email: string): Promise<void> {
  await wait(500);
}