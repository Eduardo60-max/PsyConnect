import { useState, type SyntheticEvent } from "react";
import { CrisisNotice } from "./CrisisNotice";
import { CheckRow } from "./AuthFields";
import {
  PANAS_ITEMS,
  PANAS_SCALE,
  countAnswered,
  isComplete,
  type PanasAnswers,
  type PanasMoment,
} from "./panas";

type PanasModalProps = {
  moment: PanasMoment;
  initialAnswers: PanasAnswers;
  needsConsent: boolean;
  submitting: boolean;
  submitError: string;
  onChange: (answers: PanasAnswers) => void; // salva o rascunho a cada resposta
  onSubmit: (answers: PanasAnswers, consentAcceptedAt?: string) => Promise<void> | void;
  onClose: () => void; // fecha mantendo o rascunho
};

const TEXT: Record<PanasMoment, { eyebrow: string; title: string; intro: string; submit: string }> = {
  before: {
    eyebrow: "Antes de começar",
    title: "Como você está se sentindo agora?",
    intro: "Indique em que medida você sente cada emoção neste momento, agora mesmo.",
    submit: "Enviar e começar a sessão",
  },
  after: {
    eyebrow: "Ao encerrar",
    title: "E agora, como você está se sentindo?",
    intro: "Indique em que medida você sente cada emoção neste momento, depois de usar o app.",
    submit: "Enviar e encerrar a sessão",
  },
};

export function PanasModal({
  moment,
  initialAnswers,
  needsConsent,
  submitting,
  submitError,
  onChange,
  onSubmit,
  onClose,
}: Readonly<PanasModalProps>) {
  const [answers, setAnswers] = useState<PanasAnswers>(initialAnswers);
  const [consentChecked, setConsentChecked] = useState(!needsConsent);
  const [consentError, setConsentError] = useState("");
  const [showMissing, setShowMissing] = useState(false);
  const text = TEXT[moment];
  const answered = countAnswered(answers);

  const handlePick = (itemId: number, value: number) => {
    const next = { ...answers, [itemId]: value };
    setAnswers(next);
    onChange(next);
  };

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault();
    if (submitting) return;

    if (!isComplete(answers)) {
      setShowMissing(true);
      const firstMissing = PANAS_ITEMS.find(item => !answers[item.id]);
      if (firstMissing) {
        document.getElementById(`panas-item-${firstMissing.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      return;
    }

    if (needsConsent && !consentChecked) {
      setConsentError("Confirme o consentimento para registrar sua resposta na pesquisa de UX.");
      return;
    }
    setConsentError("");

    await onSubmit(answers, needsConsent ? new Date().toISOString() : undefined);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={text.title}>
      <div className="modal-card modal-card-wide">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h3>{text.title}</h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fechar e continuar depois"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        <p className="group-detail-description">{text.intro}</p>

        <ol className="panas-legend panas-legend-sticky" aria-label="Legenda das respostas">
          {PANAS_SCALE.map(option => (
            <li key={option.value}>
              <strong>{option.value}</strong> {option.label}
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit} noValidate>
          <div className="panas-list">
            {PANAS_ITEMS.map(item => {
              const missing = showMissing && !answers[item.id];
              return (
                <div
                  key={item.id}
                  id={`panas-item-${item.id}`}
                  className={missing ? "panas-item missing" : "panas-item"}
                >
                  <span className="panas-label">{item.label}</span>
                  <div className="panas-options" role="radiogroup" aria-label={item.label}>
                    {PANAS_SCALE.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={answers[item.id] === option.value}
                        aria-label={`${item.label}: ${option.label}`}
                        className={answers[item.id] === option.value ? "panas-option active" : "panas-option"}
                        onClick={() => handlePick(item.id, option.value)}
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="panas-progress" aria-live="polite">
            {answered} de {PANAS_ITEMS.length} respondidas
          </p>

          {needsConsent && (
            <div className="panas-consent-box">
              <CheckRow
                checked={consentChecked}
                onChange={checked => {
                  setConsentChecked(checked);
                  if (checked) setConsentError("");
                }}
                error={consentError}
              >
                Autorizo o registro das minhas respostas de bem-estar emocional (PANAS) de forma anonimizada para
                avaliação de experiência do usuário do PsyConnect, conforme a LGPD.
              </CheckRow>
            </div>
          )}

          {showMissing && !isComplete(answers) && (
            <p className="field-error" role="alert">
              Faltam respostas. Os itens em destaque ainda não foram marcados.
            </p>
          )}

          {submitError && (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          )}

          <button type="submit" className="primary-btn full-width" disabled={submitting}>
            {submitting ? "Enviando respostas..." : text.submit}
          </button>
          <p className="chat-note">Seu rascunho é salvo automaticamente mesmo se o app for fechado.</p>
        </form>

        <div className="auth-crisis">
          <CrisisNotice />
        </div>
      </div>
    </div>
  );
}
