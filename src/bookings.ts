import type { AvailabilitySlot, Booking, BookingStatus, ProBooking, Professional } from "./types";
import { getSupabaseAdmin } from "./supabaseServer";
import { ensureChat } from "./chats";

export type BookingFailure = { error: string; status: number };

const PREFERENCES = new Set(["Online", "Presencial"]);

type ProJoinedRow = {
  user_id: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  role_title: string;
  bio: string;
  experience: string;
  price_label: string;
  accent: string;
  status: string;
};

type BookingRow = {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot: string;
  preference: string;
  reason: string;
  status: BookingStatus;
  created_at: string;
};

function sortBookings<T extends Booking>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    const aCanceled = a.status === "canceled" ? 1 : 0;
    const bCanceled = b.status === "canceled" ? 1 : 0;
    return aCanceled - bCanceled || b.createdAt - a.createdAt;
  });
}

export async function listApprovedProfessionals(): Promise<Professional[]> {
  const supabase = getSupabaseAdmin();
  const { data: pros, error } = await supabase
    .from("professional_profiles")
    .select("user_id, crm, crm_uf, specialty, role_title, bio, experience, price_label, accent, status")
    .eq("status", "aprovado")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  const proRows = (pros ?? []) as ProJoinedRow[];
  if (proRows.length === 0) return [];

  const doctorIds = proRows.map(p => p.user_id);

  const [{ data: profiles }, { data: slots }, { data: activeBookings }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", doctorIds),
    supabase
      .from("availability")
      .select("doctor_id, slot_label, starts_at, created_at")
      .in("doctor_id", doctorIds)
      .eq("is_active", true)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("doctor_id, slot")
      .in("doctor_id", doctorIds)
      .neq("status", "canceled"),
  ]);

  const nameById = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));
  const occupiedByDoctor = new Map<string, Set<string>>();
  for (const row of activeBookings ?? []) {
    const docId = String(row.doctor_id);
    const set = occupiedByDoctor.get(docId) ?? new Set<string>();
    set.add(String(row.slot));
    occupiedByDoctor.set(docId, set);
  }

  const freeSlotsByDoctor = new Map<string, string[]>();
  for (const row of slots ?? []) {
    const docId = String(row.doctor_id);
    const label = String(row.slot_label);
    if (occupiedByDoctor.get(docId)?.has(label)) continue;
    const list = freeSlotsByDoctor.get(docId) ?? [];
    list.push(label);
    freeSlotsByDoctor.set(docId, list);
  }

  return proRows.map(pro => ({
    id: pro.user_id,
    name: nameById.get(pro.user_id) ?? "Profissional",
    role: pro.role_title || "Médico(a)",
    specialty: pro.specialty,
    crm: pro.crm,
    crmUf: pro.crm_uf,
    bio: pro.bio || `Atendimento em ${pro.specialty} (CRM/${pro.crm_uf} ${pro.crm}).`,
    experience: pro.experience || "Verificado pela equipe",
    price: pro.price_label || "Gratuito (teste)",
    accent: pro.accent || "#7c3aed",
    freeSlots: freeSlotsByDoctor.get(pro.user_id) ?? [],
  }));
}

export async function listDoctorAvailability(doctorId: string): Promise<AvailabilitySlot[]> {
  const supabase = getSupabaseAdmin();
  const [{ data: slots, error }, { data: activeBookings }] = await Promise.all([
    supabase
      .from("availability")
      .select("id, slot_label, starts_at, is_active, created_at")
      .eq("doctor_id", doctorId)
      .eq("is_active", true)
      .order("starts_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("slot")
      .eq("doctor_id", doctorId)
      .neq("status", "canceled"),
  ]);

  if (error) throw new Error(error.message);

  const occupied = new Set((activeBookings ?? []).map(b => String(b.slot)));
  return (slots ?? []).map(row => ({
    id: String(row.id),
    slotLabel: String(row.slot_label),
    startsAt: row.starts_at ? String(row.starts_at) : null,
    isActive: Boolean(row.is_active),
    booked: occupied.has(String(row.slot_label)),
  }));
}

export async function addDoctorSlot(
  doctorId: string,
  slotLabel: string,
  startsAt?: string | null,
): Promise<BookingFailure | null> {
  const cleanLabel = slotLabel.trim().slice(0, 60);
  if (cleanLabel.length < 3) return { error: "Informe um horário válido (ex: Ter 25/11 • 14:00).", status: 400 };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("availability").upsert(
    {
      doctor_id: doctorId,
      slot_label: cleanLabel,
      starts_at: startsAt || null,
      is_active: true,
    },
    { onConflict: "doctor_id,slot_label" },
  );

  if (error) return { error: error.message, status: 500 };
  return null;
}

export async function removeDoctorSlot(doctorId: string, slotId: string): Promise<BookingFailure | null> {
  const supabase = getSupabaseAdmin();
  const { data: slot } = await supabase
    .from("availability")
    .select("id, slot_label")
    .eq("id", slotId)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (!slot) return { error: "Horário não encontrado.", status: 404 };

  const { data: booked } = await supabase
    .from("bookings")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("slot", String(slot.slot_label))
    .neq("status", "canceled")
    .maybeSingle();

  if (booked) {
    return { error: "Este horário possui uma sessão marcada. Cancele ou remarque antes de removê-lo.", status: 409 };
  }

  const { error } = await supabase.from("availability").delete().eq("id", slotId).eq("doctor_id", doctorId);
  if (error) return { error: error.message, status: 500 };
  return null;
}

export async function listBookings(patientId: string): Promise<Booking[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, patient_id, doctor_id, slot, preference, reason, status, created_at")
    .eq("patient_id", patientId);

  if (error) throw new Error(error.message);
  const bookingRows = (rows ?? []) as BookingRow[];
  if (bookingRows.length === 0) return [];

  const doctorIds = [...new Set(bookingRows.map(b => b.doctor_id))];
  const [{ data: profiles }, { data: pros }] = await Promise.all([
    supabase.from("profiles").select("id, name").in("id", doctorIds),
    supabase
      .from("professional_profiles")
      .select("user_id, role_title, specialty, price_label, accent")
      .in("user_id", doctorIds),
  ]);

  const nameMap = new Map((profiles ?? []).map(p => [String(p.id), String(p.name)]));
  const proMap = new Map((pros ?? []).map(p => [String(p.user_id), p]));

  return sortBookings(
    bookingRows.map(row => {
      const pro = proMap.get(row.doctor_id);
      return {
        id: row.id,
        doctorId: row.doctor_id,
        expertName: nameMap.get(row.doctor_id) ?? "Profissional",
        expertRole: pro?.role_title ? String(pro.role_title) : "Médico(a)",
        specialty: pro?.specialty ? String(pro.specialty) : "Atendimento",
        price: pro?.price_label ? String(pro.price_label) : "Gratuito (teste)",
        accent: pro?.accent ? String(pro.accent) : "#7c3aed",
        slot: row.slot,
        preference: row.preference,
        reason: row.reason,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
      };
    }),
  );
}

export async function createBooking(
  patientId: string,
  input: { doctorId: string; slot: string; preference: string; reason: string },
): Promise<BookingFailure | null> {
  const doctorId = input.doctorId.trim();
  const slot = input.slot.trim();
  const preference = input.preference.trim();
  const reason = input.reason.trim().slice(0, 500);

  if (!doctorId) return { error: "Profissional inválido.", status: 400 };
  if (doctorId === patientId) return { error: "Você não pode agendar uma sessão consigo mesmo.", status: 400 };
  if (!PREFERENCES.has(preference)) return { error: "Preferência inválida.", status: 400 };
  if (!reason) return { error: "Conte o motivo da sessão.", status: 400 };

  const supabase = getSupabaseAdmin();

  const { data: pro } = await supabase
    .from("professional_profiles")
    .select("user_id, status")
    .eq("user_id", doctorId)
    .maybeSingle();

  if (!pro || pro.status !== "aprovado") {
    return { error: "Este profissional ainda não está disponível para agendamentos.", status: 400 };
  }

  const { data: availabilityRow } = await supabase
    .from("availability")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("slot_label", slot)
    .eq("is_active", true)
    .maybeSingle();

  if (!availabilityRow) {
    return { error: "Horário inválido ou não cadastrado pelo profissional.", status: 400 };
  }

  const { error } = await supabase.from("bookings").insert({
    id: `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    patient_id: patientId,
    doctor_id: doctorId,
    availability_id: availabilityRow.id,
    slot,
    preference,
    reason,
    status: "confirmed",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Esse horário acabou de ser ocupado por outro paciente. Escolha outro.", status: 409 };
    }
    return { error: error.message, status: 500 };
  }

  await ensureChat(patientId, doctorId);
  return null;
}

export async function cancelBooking(patientId: string, id: string): Promise<BookingFailure | null> {
  const supabase = getSupabaseAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Esta sessão já foi cancelada.", status: 400 };

  const { error } = await supabase.from("bookings").update({ status: "canceled" }).eq("id", id);
  if (error) return { error: error.message, status: 500 };
  return null;
}

export async function rescheduleBooking(patientId: string, id: string, slot: string): Promise<BookingFailure | null> {
  const cleanSlot = slot.trim();
  const supabase = getSupabaseAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, doctor_id, slot, status")
    .eq("id", id)
    .eq("patient_id", patientId)
    .maybeSingle();

  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Não é possível remarcar uma sessão cancelada.", status: 400 };
  if (booking.slot === cleanSlot) return { error: "Escolha um horário diferente do atual.", status: 400 };

  const { data: availabilityRow } = await supabase
    .from("availability")
    .select("id")
    .eq("doctor_id", booking.doctor_id)
    .eq("slot_label", cleanSlot)
    .eq("is_active", true)
    .maybeSingle();

  if (!availabilityRow) return { error: "Horário indisponível.", status: 400 };

  const { error } = await supabase
    .from("bookings")
    .update({ slot: cleanSlot, availability_id: availabilityRow.id, status: "rescheduled" })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Este horário já está ocupado.", status: 409 };
    return { error: error.message, status: 500 };
  }
  return null;
}

export async function listBookingsForDoctor(doctorId: string): Promise<ProBooking[]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("id, patient_id, doctor_id, slot, preference, reason, status, created_at")
    .eq("doctor_id", doctorId);

  if (error) throw new Error(error.message);
  const bookingRows = (rows ?? []) as BookingRow[];
  if (bookingRows.length === 0) return [];

  const patientIds = [...new Set(bookingRows.map(b => b.patient_id))];
  const [{ data: patients }, { data: pro }] = await Promise.all([
    supabase.from("profiles").select("id, name, email").in("id", patientIds),
    supabase
      .from("professional_profiles")
      .select("role_title, specialty, price_label, accent")
      .eq("user_id", doctorId)
      .maybeSingle(),
  ]);

  const patientMap = new Map(
    (patients ?? []).map(p => [String(p.id), { name: String(p.name), email: String(p.email) }]),
  );

  return sortBookings(
    bookingRows.map(row => {
      const patient = patientMap.get(row.patient_id);
      return {
        id: row.id,
        doctorId: row.doctor_id,
        expertName: "",
        expertRole: pro?.role_title ? String(pro.role_title) : "Médico(a)",
        specialty: pro?.specialty ? String(pro.specialty) : "Atendimento",
        price: pro?.price_label ? String(pro.price_label) : "Gratuito (teste)",
        accent: pro?.accent ? String(pro.accent) : "#7c3aed",
        slot: row.slot,
        preference: row.preference,
        reason: row.reason,
        status: row.status,
        createdAt: new Date(row.created_at).getTime(),
        patientId: row.patient_id,
        patientName: patient?.name ?? "Paciente",
        patientEmail: patient?.email ?? "",
      };
    }),
  );
}

export async function cancelBookingAsDoctor(doctorId: string, id: string): Promise<BookingFailure | null> {
  const supabase = getSupabaseAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Esta sessão já foi cancelada.", status: 400 };

  const { error } = await supabase.from("bookings").update({ status: "canceled" }).eq("id", id);
  if (error) return { error: error.message, status: 500 };
  return null;
}

export async function rescheduleBookingAsDoctor(
  doctorId: string,
  id: string,
  slot: string,
): Promise<BookingFailure | null> {
  const cleanSlot = slot.trim();
  const supabase = getSupabaseAdmin();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, slot, status")
    .eq("id", id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Não é possível remarcar uma sessão cancelada.", status: 400 };
  if (booking.slot === cleanSlot) return { error: "Escolha um horário diferente do atual.", status: 400 };

  const { data: availabilityRow } = await supabase
    .from("availability")
    .select("id")
    .eq("doctor_id", doctorId)
    .eq("slot_label", cleanSlot)
    .eq("is_active", true)
    .maybeSingle();

  if (!availabilityRow) return { error: "Cadastre esse horário na sua disponibilidade antes de remarcar.", status: 400 };

  const { error } = await supabase
    .from("bookings")
    .update({ slot: cleanSlot, availability_id: availabilityRow.id, status: "rescheduled" })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "Já existe outra sessão marcada neste horário.", status: 409 };
    return { error: error.message, status: 500 };
  }
  return null;
}
