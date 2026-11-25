import { useState, type SyntheticEvent } from "react";
import type { AvailabilitySlot, BookingStatus, ProBooking } from "./types";
import { avatarInitial } from "./utils";
import { colorFor } from "./proUtils";

type ProAgendaProps = {
  bookings: ProBooking[];
  availability: AvailabilitySlot[];
  onAddSlot: (slotLabel: string, startsAt?: string | null) => Promise<string | null>;
  onRemoveSlot: (slotId: string) => Promise<string | null>;
  onCancel: (id: string) => Promise<string | null>;
  onReschedule: (id: string, slot: string) => Promise<string | null>;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmada",
  rescheduled: "Remarcada",
  canceled: "Cancelada",
};

type Feedback = { id: string; kind: "ok" | "error"; text: string };

function formatDateSlot(dateStr: string, timeStr: string): { label: string; iso: string | null } {
  if (!dateStr || !timeStr) return { label: "", iso: null };
  const date = new Date(`${dateStr}T${timeStr}:00`);
  if (Number.isNaN(date.getTime())) return { label: "", iso: null };
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const dayMonth = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return { label: `${capWeekday} ${dayMonth} • ${timeStr}`, iso: date.toISOString() };
}

export function ProAgenda({
  bookings,
  availability,
  onAddSlot,
  onRemoveSlot,
  onCancel,
  onReschedule,
}: Readonly<ProAgendaProps>) {
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeInput, setTimeInput] = useState("14:00");
  const [slotBusy, setSlotBusy] = useState(false);
  const [slotFeedback, setSlotFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const freeSlots = availability.filter(slot => !slot.booked).map(slot => slot.slotLabel);
  const upcoming = bookings.filter(booking => booking.status !== "canceled");
  const canceled = bookings.filter(booking => booking.status === "canceled");

  const handleAddSlot = async (event: SyntheticEvent) => {
    event.preventDefault();
    const { label, iso } = formatDateSlot(dateInput, timeInput);
    if (!label || slotBusy) return;

    setSlotBusy(true);
    setSlotFeedback(null);
    const failure = await onAddSlot(label, iso);
    setSlotBusy(false);
    setSlotFeedback(failure ? { kind: "error", text: failure } : { kind: "ok", text: `Horário ${label} adicionado.` });
  };

  const handleRemoveSlot = async (slot: AvailabilitySlot) => {
    setSlotBusy(true);
    setSlotFeedback(null);
    const failure = await onRemoveSlot(slot.id);
    setSlotBusy(false);
    if (failure) setSlotFeedback({ kind: "error", text: failure });
  };

  const handleCancel = async (booking: ProBooking) => {
    const patient = booking.patientName || "o paciente";
    if (!window.confirm(`Cancelar a sessão com ${patient} (${booking.slot})? O paciente será avisado.`)) return;

    setBusyId(booking.id);
    const failure = await onCancel(booking.id);
    setBusyId(null);
    setRescheduleId(null);
    setFeedback(failure ? { id: booking.id, kind: "error", text: failure } : null);
  };

  const handleStartReschedule = (booking: ProBooking) => {
    setFeedback(null);
    setNewSlot("");
    setRescheduleId(current => (current === booking.id ? null : booking.id));
  };

  const handleConfirmReschedule = async (booking: ProBooking) => {
    if (!newSlot) return;

    setBusyId(booking.id);
    const failure = await onReschedule(booking.id, newSlot);
    setBusyId(null);

    if (failure) {
      setFeedback({ id: booking.id, kind: "error", text: failure });
      return;
    }
    setRescheduleId(null);
    setFeedback({ id: booking.id, kind: "ok", text: `Sessão remarcada para ${newSlot}.` });
    setNewSlot("");
  };

  const renderCard = (booking: ProBooking) => {
    const isCanceled = booking.status === "canceled";
    const isRescheduling = rescheduleId === booking.id;
    const isBusy = busyId === booking.id;
    const cardFeedback = feedback?.id === booking.id ? feedback : null;
    const patient = booking.patientName || "Paciente";

    return (
      <article key={booking.id} className={isCanceled ? "booking-card canceled" : "booking-card"}>
        <div className="booking-card-top">
          <div className="avatar" style={{ backgroundColor: colorFor(booking.patientEmail || booking.patientId) }}>
            {avatarInitial(patient)}
          </div>
          <div className="booking-card-title">
            <h3>{patient}</h3>
            <p>{booking.patientEmail}</p>
          </div>
          <span className={`status-badge status-${booking.status}`}>{STATUS_LABEL[booking.status]}</span>
        </div>

        <div className="booking-card-meta">
          <span>🕒 {booking.slot}</span>
          <span>{booking.preference === "Online" ? "💻 Online" : "📍 Presencial"}</span>
          <span>{booking.price}</span>
        </div>

        <p className="booking-reason">
          <strong>Motivo:</strong> {booking.reason}
        </p>

        {!isCanceled && (
          <div className="booking-actions">
            <button type="button" className="secondary-btn small" onClick={() => handleStartReschedule(booking)} disabled={isBusy}>
              {isRescheduling ? "Fechar" : "Remarcar"}
            </button>
            <button type="button" className="secondary-btn small danger-btn" onClick={() => handleCancel(booking)} disabled={isBusy}>
              {isBusy && !isRescheduling ? "Cancelando..." : "Cancelar"}
            </button>
          </div>
        )}

        {isRescheduling && (
          <div className="reschedule-box">
            <p>Escolha o novo horário disponível:</p>
            {freeSlots.filter(s => s !== booking.slot).length === 0 ? (
              <p className="comments-empty">Adicione outro horário livre acima antes de remarcar.</p>
            ) : (
              <>
                <div className="availability-list">
                  {freeSlots
                    .filter(slot => slot !== booking.slot)
                    .map(slot => (
                      <button
                        key={slot}
                        type="button"
                        className={newSlot === slot ? "availability-btn active" : "availability-btn"}
                        onClick={() => setNewSlot(slot)}
                        aria-pressed={newSlot === slot}
                      >
                        {slot}
                      </button>
                    ))}
                </div>
                <button
                  type="button"
                  className="primary-btn small"
                  onClick={() => handleConfirmReschedule(booking)}
                  disabled={!newSlot || isBusy}
                >
                  {isBusy ? "Remarcando..." : "Confirmar novo horário"}
                </button>
              </>
            )}
          </div>
        )}

        {cardFeedback && (
          <p className={cardFeedback.kind === "ok" ? "booking-feedback ok" : "field-error"}>{cardFeedback.text}</p>
        )}
      </article>
    );
  };

  return (
    <main className="screen my-bookings">
      <section className="section-heading">
        <div>
          <p className="eyebrow">Agenda</p>
          <h2>Disponibilidade e sessões com pacientes.</h2>
        </div>
      </section>

      <section className="insight-card availability-manager">
        <p className="eyebrow">Seus horários livres</p>
        <h3>Cadastrar disponibilidade</h3>
        <p className="group-detail-description">
          Os pacientes veem apenas os horários que você abrir aqui e cada horário só pode ser ocupado por um paciente.
        </p>

        <form onSubmit={handleAddSlot} className="slot-add-form">
          <label>
            Data
            <input
              type="date"
              value={dateInput}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => setDateInput(e.target.value)}
              required
            />
          </label>
          <label>
            Horário
            <input type="time" value={timeInput} onChange={e => setTimeInput(e.target.value)} required />
          </label>
          <button type="submit" className="primary-btn small" disabled={slotBusy}>
            {slotBusy ? "Salvando..." : "+ Abrir horário"}
          </button>
        </form>

        {slotFeedback && (
          <p className={slotFeedback.kind === "ok" ? "booking-feedback ok" : "field-error"}>{slotFeedback.text}</p>
        )}

        {availability.length === 0 ? (
          <p className="comments-empty">Nenhum horário aberto ainda. Adicione um acima para receber agendamentos.</p>
        ) : (
          <ul className="slot-chip-list">
            {availability.map(slot => (
              <li key={slot.id} className={slot.booked ? "slot-chip booked" : "slot-chip"}>
                <span>{slot.slotLabel}</span>
                <small>{slot.booked ? "Ocupado" : "Livre"}</small>
                {!slot.booked && (
                  <button
                    type="button"
                    className="slot-remove-btn"
                    aria-label={`Remover horário ${slot.slotLabel}`}
                    disabled={slotBusy}
                    onClick={() => handleRemoveSlot(slot)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="group-section">
        <h3 className="group-section-title">Marcadas ({upcoming.length})</h3>
        {upcoming.length === 0 ? (
          <p className="empty-state">Nenhuma sessão marcada. Quando um paciente agendar com você, ela aparece aqui.</p>
        ) : (
          <div className="bookings-list">{upcoming.map(renderCard)}</div>
        )}
      </div>

      {canceled.length > 0 && (
        <div className="group-section">
          <h3 className="group-section-title">Canceladas ({canceled.length})</h3>
          <div className="bookings-list">{canceled.map(renderCard)}</div>
        </div>
      )}
    </main>
  );
}
