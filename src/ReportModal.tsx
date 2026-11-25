import { useState, type SyntheticEvent } from "react";
import type { ReportTargetType } from "./types";
import { createReportRequest } from "./api";

type ReportModalProps = {
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId?: string;
  targetLabel: string;
  onClose: () => void;
  onSubmitted: () => void;
};

const REASONS = [
  "Ofensa, assédio ou desrespeito",
  "Conteúdo gatilho ou risco à saúde",
  "Spam, golpe ou divulgação indevida",
  "Outro motivo",
];

export function ReportModal({
  targetType,
  targetId,
  reportedUserId,
  targetLabel,
  onClose,
  onSubmitted,
}: Readonly<ReportModalProps>) {
  const [selectedReason, setSelectedReason] = useState(REASONS[0]!);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;
    const reasonText = details.trim() ? `${selectedReason}: ${details.trim()}` : selectedReason;
    setBusy(true);
    setError("");
    try {
      await createReportRequest({
        targetType,
        targetId,
        reportedUserId,
        reason: reasonText,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a denúncia.");
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Denunciar conteúdo" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Segurança da comunidade</p>
            <h3>Denunciar {targetLabel}</h3>
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="booking-form">
          <label>
            Motivo da denúncia
            <select value={selectedReason} onChange={e => setSelectedReason(e.target.value)}>
              {REASONS.map(reason => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>

          <label>
            Detalhes adicionais (opcional)
            <textarea
              rows={3}
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Explique o que aconteceu para ajudar a moderação..."
              maxLength={300}
            />
          </label>

          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="primary-btn full-width" disabled={busy}>
            {busy ? "Enviando..." : "Enviar denúncia"}
          </button>
        </form>
      </div>
    </div>
  );
}
