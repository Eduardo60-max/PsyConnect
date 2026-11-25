import { useEffect, useState } from "react";
import type { CurrentUser } from "./types";
import { PanasModal } from "./PanasModal";
import { fetchMyPanasRecords, submitPanasRequest } from "./api";
import {
  loadPanasDraftState,
  savePanasDraftState,
  type PanasAnswers,
  type PanasDraftState,
  type PanasMoment,
  type PanasRecord,
} from "./panas";

type TestSessionCardProps = {
  user: CurrentUser;
  onUserUpdated: (user: CurrentUser) => void;
  onActiveChange?: (active: boolean) => void;
};

export function TestSessionCard({ user, onUserUpdated, onActiveChange }: Readonly<TestSessionCardProps>) {
  const [draftState, setDraftState] = useState<PanasDraftState>({ active: null, drafts: {} });
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [records, setRecords] = useState<PanasRecord[]>([]);
  const [modal, setModal] = useState<PanasMoment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    let active = true;
    setDraftLoaded(false);
    loadPanasDraftState(user.id)
      .then(loaded => {
        if (!active) return;
        setDraftState(loaded);
        setDraftLoaded(true);
      })
      .catch(() => {
        if (active) setDraftLoaded(true);
      });

    fetchMyPanasRecords()
      .then(loaded => {
        if (active) setRecords(loaded);
      })
      .catch(() => {
        // se falhar ao carregar histórico remoto, mantém card utilizável
      });

    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    if (!draftLoaded) return;
    void savePanasDraftState(user.id, draftState);
    onActiveChange?.(Boolean(draftState.active));
  }, [user.id, draftState, draftLoaded, onActiveChange]);

  const completedSessions = new Set(
    records.filter(record => record.moment === "after").map(record => record.sessionId),
  ).size;

  const handleDraft = (moment: PanasMoment, answers: PanasAnswers) => {
    setDraftState(current => ({ ...current, drafts: { ...current.drafts, [moment]: answers } }));
  };

  const handleSubmit = async (moment: PanasMoment, answers: PanasAnswers, consentAcceptedAt?: string) => {
    const sessionId =
      moment === "before" ? `s-${Date.now()}` : (draftState.active?.sessionId ?? `s-${Date.now()}`);

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await submitPanasRequest({
        sessionId,
        moment,
        answers,
        consentAcceptedAt,
      });
      setRecords(response.records);
      if (consentAcceptedAt && !user.acceptedHealthDataAt) {
        onUserUpdated({ ...user, acceptedHealthDataAt: consentAcceptedAt });
      }
      setDraftState(current => {
        const { [moment]: _removed, ...restDrafts } = current.drafts;
        return {
          active: moment === "before" ? { sessionId, startedAt: new Date().toISOString() } : null,
          drafts: restDrafts,
        };
      });
      setModal(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Não foi possível salvar no servidor. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  const hasActive = Boolean(draftState.active);
  const hasDraft = (moment: PanasMoment) => Object.keys(draftState.drafts[moment] ?? {}).length > 0;

  return (
    <div className="insight-card test-session-card">
      <p className="eyebrow">Avaliação de experiência (PANAS)</p>
      <h3>Sessão de teste</h3>

      {hasActive ? (
        <>
          <p className="test-session-status">
            ● Sessão em andamento. Use o app com calma e, quando terminar, responda o encerramento.
          </p>
          <button
            type="button"
            className="primary-btn full-width"
            onClick={() => {
              setSubmitError("");
              setModal("after");
            }}
          >
            {hasDraft("after") ? "Continuar e encerrar a sessão" : "Encerrar sessão"}
          </button>
        </>
      ) : (
        <>
          <p>
            Antes de usar o app, responda 20 perguntas rápidas sobre como você está se sentindo. Ao final, responda
            novamente.
          </p>
          <button
            type="button"
            className="primary-btn full-width"
            onClick={() => {
              setSubmitError("");
              setModal("before");
            }}
          >
            {hasDraft("before") ? "Continuar a resposta" : "Começar sessão de teste"}
          </button>
        </>
      )}

      {completedSessions > 0 && !hasActive && (
        <p className="mood-saved">Obrigado! Você já concluiu {completedSessions} sessão(ões) de teste. 💜</p>
      )}

      {modal && (
        <PanasModal
          key={modal}
          moment={modal}
          initialAnswers={draftState.drafts[modal] ?? {}}
          needsConsent={!user.acceptedHealthDataAt}
          submitting={submitting}
          submitError={submitError}
          onChange={answers => handleDraft(modal, answers)}
          onSubmit={(answers, consentAt) => handleSubmit(modal, answers, consentAt)}
          onClose={() => {
            if (!submitting) setModal(null);
          }}
        />
      )}
    </div>
  );
}
