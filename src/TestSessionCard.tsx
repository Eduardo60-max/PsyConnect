import { useEffect, useState } from "react";
import { PanasModal } from "./PanasModal";
import {
  downloadCsv,
  loadStore,
  saveStore,
  scorePanas,
  type PanasAnswers,
  type PanasMoment,
  type PanasStore,
} from "./panas";

type TestSessionCardProps = {
  email: string;
};

export function TestSessionCard({ email }: Readonly<TestSessionCardProps>) {
  const [store, setStore] = useState<PanasStore>(() => loadStore(email));
  const [modal, setModal] = useState<PanasMoment | null>(null);

  useEffect(() => {
    saveStore(email, store);
  }, [email, store]);

  const completedSessions = new Set(
    store.records.filter(record => record.moment === "after").map(record => record.sessionId),
  ).size;

  const handleDraft = (moment: PanasMoment, answers: PanasAnswers) => {
    setStore(current => ({ ...current, drafts: { ...current.drafts, [moment]: answers } }));
  };

  const handleSubmit = (moment: PanasMoment, answers: PanasAnswers) => {
    const score = scorePanas(answers);
    if (!score) return;

    setStore(current => {
      const sessionId =
        moment === "before" ? `s-${Date.now()}` : (current.active?.sessionId ?? `s-${Date.now()}`);
      const { [moment]: _removed, ...restDrafts } = current.drafts;

      return {
        ...current,
        active: moment === "before" ? { sessionId, startedAt: new Date().toISOString() } : null,
        drafts: restDrafts,
        records: [
          ...current.records,
          {
            sessionId,
            moment,
            answers,
            positive: score.positive,
            negative: score.negative,
            answeredAt: new Date().toISOString(),
          },
        ],
      };
    });
    setModal(null);
  };

  const hasActive = Boolean(store.active);
  const hasDraft = (moment: PanasMoment) => Object.keys(store.drafts[moment] ?? {}).length > 0;

  return (
    <div className="insight-card test-session-card">
      <p className="eyebrow">Teste do app</p>
      <h3>Sessão de teste</h3>

      {hasActive ? (
        <>
          <p className="test-session-status">
            ● Sessão em andamento. Use o app com calma e, quando terminar, encerre a sessão.
          </p>
          <button type="button" className="primary-btn full-width" onClick={() => setModal("after")}>
            {hasDraft("after") ? "Continuar e encerrar a sessão" : "Encerrar sessão"}
          </button>
        </>
      ) : (
        <>
          <p>
            Antes de usar o app, responda 20 perguntas rápidas sobre como você está se sentindo. Leva cerca de 2
            minutos.
          </p>
          <button type="button" className="primary-btn full-width" onClick={() => setModal("before")}>
            {hasDraft("before") ? "Continuar a resposta" : "Começar sessão de teste"}
          </button>
        </>
      )}

      {completedSessions > 0 && !hasActive && (
        <p className="mood-saved">Obrigado! Você já concluiu {completedSessions} sessão(ões) de teste. 💜</p>
      )}

      {store.records.length > 0 && (
        <button type="button" className="text-link test-session-export" onClick={() => downloadCsv(store)}>
          Baixar respostas (CSV, para a equipe de pesquisa)
        </button>
      )}

      {modal && (
        <PanasModal
          key={modal}
          moment={modal}
          initialAnswers={store.drafts[modal] ?? {}}
          onChange={answers => handleDraft(modal, answers)}
          onSubmit={answers => handleSubmit(modal, answers)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}