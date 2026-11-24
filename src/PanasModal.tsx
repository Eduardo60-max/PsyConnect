import { useState, type SyntheticEvent } from "react";
import { CrisisNotice } from "./CrisisNotice";
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
  onChange: (answers: PanasAnswers) => void; // salva o rascunho a cada resposta
  onSubmit: (answers: PanasAnswers) => void;
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

export function PanasModal({ moment, initialAnswers, onChange, onSubmit, onClose }: Readonly<PanasModalProps>) {
  const [answers, setAnswers] = useState<PanasAnswers>(initialAnswers);
  const [showMissing, setShowMissing] = useState(false);
  const text = TEXT[moment];
  const answered = countAnswered(answers);

  const handlePick = (itemId: number, value: number) => {
    const next = { ...answers, [itemId]: value };
    setAnswers(next);
    onChange(next);
  };

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!isComplete(answers)) {
      setShowMissing(true);
      return;
    }
    onSubmit(answers);
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={text.title}>
      <div className="modal-card modal-card-wide">
        <div className="modal-header">
          <div>
            <p className="eyebrow">{text.eyebrow}</p>
            <h3>{text.title}</h3>
          </div>
          <button type="button" className="icon-btn" aria-label="Fechar e continuar depois" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="group-detail-description">{text.intro}</p>

        <ol className="panas-legend" aria-label="Legenda das respostas">
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
                <div key={item.id} className={missing ? "panas-item missing" : "panas-item"}>
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
          {showMissing && !isComplete(answers) && (
            <p className="field-error" role="alert">
              Faltam respostas. Os itens em destaque ainda não foram marcados.
            </p>
          )}

          <button type="submit" className="primary-btn full-width">
            {text.submit}
          </button>
          <p className="chat-note">Suas respostas ficam salvas se você fechar e voltar depois.</p>
        </form>

        <div className="auth-crisis">
          <CrisisNotice />
        </div>
      </div>
    </div>
  );
}