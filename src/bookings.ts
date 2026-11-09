import { Database } from "bun:sqlite";

const db = new Database("psyconect.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expertId INTEGER NOT NULL,
    expertName TEXT NOT NULL,
    expertRole TEXT NOT NULL,
    specialty TEXT NOT NULL,
    price TEXT NOT NULL,
    accent TEXT NOT NULL,
    slot TEXT NOT NULL,
    preference TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  )
`);

// Migração: nome do paciente (para o painel do profissional)
try {
  db.run("ALTER TABLE bookings ADD COLUMN patientName TEXT NOT NULL DEFAULT ''");
} catch {
  // coluna já existe
}

export const BOOKING_SLOTS = ["Hoje • 16:00", "Hoje • 18:30", "Amanhã • 09:30", "Quarta • 14:00"];
const PREFERENCES = ["Online", "Presencial"];

export type DbBooking = {
  id: string;
  expertId: number;
  expertName: string;
  expertRole: string;
  specialty: string;
  price: string;
  accent: string;
  slot: string;
  preference: string;
  reason: string;
  status: string;
  createdAt: number;
};

export type ProBooking = DbBooking & { patientEmail: string; patientName: string };

export type NewBooking = Omit<DbBooking, "id" | "status" | "createdAt"> & { email: string; patientName?: string };

export type BookingFailure = { error: string; status: number };

const COLUMNS =
  "id, expertId, expertName, expertRole, specialty, price, accent, slot, preference, reason, status, createdAt";

function sortBookings<T extends DbBooking>(rows: T[]): T[] {
  return rows.sort((a, b) => {
    const aCanceled = a.status === "canceled" ? 1 : 0;
    const bCanceled = b.status === "canceled" ? 1 : 0;
    return (
      aCanceled - bCanceled ||
      BOOKING_SLOTS.indexOf(a.slot) - BOOKING_SLOTS.indexOf(b.slot) ||
      a.createdAt - b.createdAt
    );
  });
}

// ---- Dados de exemplo (pacientes fictícios) ----
const DEMO_BOOKINGS = [
  { id: "demo-booking-1", email: "ana.souza@exemplo.com", patientName: "Ana Souza", expertId: 1, expertName: "Dra. Camila Nogueira", expertRole: "Psicóloga clínica", specialty: "Ansiedade e burnout", price: "R$ 180", accent: "#7c3aed", slot: "Hoje • 18:30", preference: "Online", reason: "Ansiedade antes de reuniões e dificuldade para desligar a mente à noite." },
  { id: "demo-booking-2", email: "lucas.prado@exemplo.com", patientName: "Lucas Prado", expertId: 1, expertName: "Dra. Camila Nogueira", expertRole: "Psicóloga clínica", specialty: "Ansiedade e burnout", price: "R$ 180", accent: "#7c3aed", slot: "Amanhã • 09:30", preference: "Presencial", reason: "Esgotamento no trabalho e pouca energia ao longo do dia." },
  { id: "demo-booking-3", email: "carlos.lima@exemplo.com", patientName: "Carlos Lima", expertId: 2, expertName: "Dr. João Pereira", expertRole: "Psicoterapeuta", specialty: "Relacionamentos", price: "R$ 160", accent: "#0f766e", slot: "Hoje • 16:00", preference: "Presencial", reason: "Conflitos frequentes em casa e dificuldade de comunicação." },
  { id: "demo-booking-4", email: "bia.ramos@exemplo.com", patientName: "Bia Ramos", expertId: 3, expertName: "Dra. Lívia Andrade", expertRole: "Neuropsicóloga", specialty: "Autoconhecimento", price: "R$ 200", accent: "#be123c", slot: "Quarta • 14:00", preference: "Online", reason: "Quero entender meu padrão de foco e procrastinação." },
];

function seedDemoBookings() {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO bookings (id, email, patientName, expertId, expertName, expertRole, specialty, price, accent, slot, preference, reason, status, createdAt)
     VALUES ($id, $email, $patientName, $expertId, $expertName, $expertRole, $specialty, $price, $accent, $slot, $preference, $reason, 'confirmed', $createdAt)`,
  );
  let offset = 0;
  for (const booking of DEMO_BOOKINGS) {
    insert.run({
      $id: booking.id,
      $email: booking.email,
      $patientName: booking.patientName,
      $expertId: booking.expertId,
      $expertName: booking.expertName,
      $expertRole: booking.expertRole,
      $specialty: booking.specialty,
      $price: booking.price,
      $accent: booking.accent,
      $slot: booking.slot,
      $preference: booking.preference,
      $reason: booking.reason,
      $createdAt: Date.now() + offset++,
    });
  }
}

const existing = db.query("SELECT COUNT(*) AS count FROM bookings").get() as { count: number };
if (existing.count === 0) seedDemoBookings();

// ---- Paciente ----
export function listBookings(email: string): DbBooking[] {
  const rows = db.query(`SELECT ${COLUMNS} FROM bookings WHERE email = $email`).all({ $email: email }) as DbBooking[];
  return sortBookings(rows);
}

function findOwned(email: string, id: string): (DbBooking & { email: string }) | null {
  return db
    .query(`SELECT ${COLUMNS}, email FROM bookings WHERE id = $id AND email = $email`)
    .get({ $id: id, $email: email }) as (DbBooking & { email: string }) | null;
}

function hasConflict(email: string, expertId: number, slot: string, excludeId = ""): boolean {
  const row = db
    .query(
      `SELECT 1 FROM bookings
       WHERE email = $email AND expertId = $expertId AND slot = $slot AND status != 'canceled' AND id != $excludeId`,
    )
    .get({ $email: email, $expertId: expertId, $slot: slot, $excludeId: excludeId });
  return Boolean(row);
}

export function createBooking(input: NewBooking): BookingFailure | null {
  if (!BOOKING_SLOTS.includes(input.slot)) return { error: "Horário inválido.", status: 400 };
  if (!PREFERENCES.includes(input.preference)) return { error: "Preferência inválida.", status: 400 };
  if (hasConflict(input.email, input.expertId, input.slot)) {
    return { error: "Você já tem uma sessão com este profissional neste horário.", status: 409 };
  }

  db.prepare(
    `INSERT INTO bookings (id, email, patientName, expertId, expertName, expertRole, specialty, price, accent, slot, preference, reason, status, createdAt)
     VALUES ($id, $email, $patientName, $expertId, $expertName, $expertRole, $specialty, $price, $accent, $slot, $preference, $reason, 'confirmed', $createdAt)`,
  ).run({
    $id: `booking-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    $email: input.email,
    $patientName: input.patientName ?? "",
    $expertId: input.expertId,
    $expertName: input.expertName,
    $expertRole: input.expertRole,
    $specialty: input.specialty,
    $price: input.price,
    $accent: input.accent,
    $slot: input.slot,
    $preference: input.preference,
    $reason: input.reason,
    $createdAt: Date.now(),
  });
  return null;
}

export function cancelBooking(email: string, id: string): BookingFailure | null {
  const booking = findOwned(email, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Esta sessão já foi cancelada.", status: 400 };

  db.prepare("UPDATE bookings SET status = 'canceled' WHERE id = $id").run({ $id: id });
  return null;
}

export function rescheduleBooking(email: string, id: string, slot: string): BookingFailure | null {
  if (!BOOKING_SLOTS.includes(slot)) return { error: "Horário inválido.", status: 400 };

  const booking = findOwned(email, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Não é possível remarcar uma sessão cancelada.", status: 400 };
  if (booking.slot === slot) return { error: "Escolha um horário diferente do atual.", status: 400 };
  if (hasConflict(email, booking.expertId, slot, id)) {
    return { error: "Você já tem uma sessão com este profissional neste horário.", status: 409 };
  }

  db.prepare("UPDATE bookings SET slot = $slot, status = 'rescheduled' WHERE id = $id").run({ $slot: slot, $id: id });
  return null;
}

// ---- Profissional ----
export function listBookingsForExpert(expertId: number): ProBooking[] {
  const rows = db
    .query(`SELECT ${COLUMNS}, email AS patientEmail, patientName FROM bookings WHERE expertId = $expertId`)
    .all({ $expertId: expertId }) as ProBooking[];
  return sortBookings(rows);
}

function findForExpert(expertId: number, id: string): (DbBooking & { email: string }) | null {
  return db
    .query(`SELECT ${COLUMNS}, email FROM bookings WHERE id = $id AND expertId = $expertId`)
    .get({ $id: id, $expertId: expertId }) as (DbBooking & { email: string }) | null;
}

export function cancelBookingAsExpert(expertId: number, id: string): BookingFailure | null {
  const booking = findForExpert(expertId, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Esta sessão já foi cancelada.", status: 400 };

  db.prepare("UPDATE bookings SET status = 'canceled' WHERE id = $id").run({ $id: id });
  return null;
}

export function rescheduleBookingAsExpert(expertId: number, id: string, slot: string): BookingFailure | null {
  if (!BOOKING_SLOTS.includes(slot)) return { error: "Horário inválido.", status: 400 };

  const booking = findForExpert(expertId, id);
  if (!booking) return { error: "Sessão não encontrada.", status: 404 };
  if (booking.status === "canceled") return { error: "Não é possível remarcar uma sessão cancelada.", status: 400 };
  if (booking.slot === slot) return { error: "Escolha um horário diferente do atual.", status: 400 };
  if (hasConflict(booking.email, expertId, slot, id)) {
    return { error: "O paciente já tem uma sessão com você neste horário.", status: 409 };
  }

  db.prepare("UPDATE bookings SET slot = $slot, status = 'rescheduled' WHERE id = $id").run({ $slot: slot, $id: id });
  return null;
}

// Usado pelo "Modo demonstração"
export function resetBookings() {
  db.run("DELETE FROM bookings");
  seedDemoBookings();
}