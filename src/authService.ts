import type { CurrentUser } from "./types";
import { API_BASE_URL } from "./runtimeConfig";
import { getAuthRedirectUrl } from "./nativeBridge";
import { getSupabaseClient } from "./supabaseClient";

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
  acceptedTruthAt: string;
};

export type PatientSignupResult = {
  user: CurrentUser | null;
  needsEmailConfirmation: boolean;
};

export type DoctorSignupResult = {
  needsEmailConfirmation: boolean;
};

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirme o seu e-mail antes de entrar. Verifique a caixa de entrada e o spam.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "Já existe uma conta cadastrada com esse e-mail.";
  }
  if (lower.includes("password should be at least") || lower.includes("weak password")) {
    return "A senha precisa ter pelo menos 8 caracteres com letras e números.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns minutos e tente novamente.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  return message || "Não foi possível concluir a operação agora.";
}

async function fetchProfileWithToken(accessToken: string): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    let msg = `Falha ao carregar perfil (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      // mantém mensagem padrão
    }
    throw new Error(msg);
  }
  return res.json() as Promise<CurrentUser>;
}

async function checkLoginRateLimit(email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login-guard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (res.status === 429) {
    let message = "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // mantém mensagem padrão
    }
    throw new Error(message);
  }
}

export async function loginRequest(email: string, password: string): Promise<CurrentUser> {
  const cleanEmail = email.trim().toLowerCase();
  await checkLoginRateLimit(cleanEmail);

  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }
  if (!data.session?.access_token) {
    throw new Error("Não foi possível iniciar a sessão. Tente novamente.");
  }

  return fetchProfileWithToken(data.session.access_token);
}

export async function registerPatientRequest(input: PatientSignup): Promise<PatientSignupResult> {
  const supabase = await getSupabaseClient();
  const cleanEmail = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: input.password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        role: "paciente",
        name: input.name.trim(),
        birthDate: input.birthDate,
        acceptedTermsAt: input.acceptedTermsAt,
        acceptedHealthDataAt: input.acceptedHealthDataAt,
      },
    },
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }

  // Quando a confirmação de e-mail está ativa no Supabase, session vem null
  if (!data.session?.access_token) {
    return { user: null, needsEmailConfirmation: true };
  }

  const user = await fetchProfileWithToken(data.session.access_token);
  return { user, needsEmailConfirmation: false };
}

export async function registerDoctorRequest(input: DoctorSignup): Promise<DoctorSignupResult> {
  const supabase = await getSupabaseClient();
  const cleanEmail = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: input.password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        role: "medico",
        name: input.name.trim(),
        crm: input.crm,
        crmUf: input.crmUf,
        specialty: input.specialty,
        acceptedTermsAt: input.acceptedTermsAt,
        acceptedTruthAt: input.acceptedTruthAt,
      },
    },
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }

  // Médico nasce "pendente": mesmo se houver sessão imediata, encerramos aqui ou devolvemos estado pendente
  if (data.session?.access_token) {
    await fetchProfileWithToken(data.session.access_token).catch(() => null);
    await supabase.auth.signOut().catch(() => null);
  }

  return { needsEmailConfirmation: !data.session };
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) {
    throw new Error(translateAuthError(error.message));
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) {
    throw new Error(translateAuthError(error.message));
  }
}

export async function updatePasswordRequest(newPassword: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    throw new Error(translateAuthError(error.message));
  }
}

export async function restoreSessionUser(): Promise<CurrentUser | null> {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return fetchProfileWithToken(token);
}

export async function logoutRequest(): Promise<void> {
  try {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignora falha de rede ao encerrar sessão localmente
  }
}
