import { useState } from "react";
import type { BookingStatus, ProBooking } from "./types";
import { avatarInitial } from "./utils";
import { colorFor } from "./proUtils";

type ProAgendaProps = {
  bookings: ProBooking[];
  slots: string[];
  onCancel: (id: string) => Promise<string | null>;
  onReschedule: (id: string, slot: string) => Promise<string | null>;
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: "Confirmada",
  rescheduled: "Remarcada",
  canceled: "Cancelada",
};

type Feedback = { id: string; kind: "ok" | "error"; text: string };

export function ProAgenda({ bookings, slots, onCancel, onReschedule }: Readonly<ProAgendaProps>) {
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const upcoming = bookings.filter(booking => booking.status !== "canceled");
  const canceled = bookings.filter(booking => booking.status === "canceled");

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
    setFeedback({ id: booking.id, kind: "ok", text: `Sessão remarcada para ${newSlot}. O paciente foi avisado.` });
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
          <div className="avatar" style={{ backgroundColor: colorFor(booking.patientEmail) }}>
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
            <p>Escolha o novo horário:</p>
            <div className="availability-list">
              {slots
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
          <h2>Suas sessões com os pacientes.</h2>
        </div>
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