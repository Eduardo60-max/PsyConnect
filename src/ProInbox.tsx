import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import type { ProChat } from "./types";
import { avatarInitial } from "./utils";
import { ReportModal } from "./ReportModal";

type ProInboxProps = {
  chats: ProChat[];
  activeChatId: number;
  onSelect: (id: number) => void;
  onSend: (chatId: number, text: string) => Promise<string | null>;
};

const QUICK_REPLIES = [
  "Olá! Obrigado(a) por me contar. Como você está se sentindo agora?",
  "Vamos conversar sobre isso com calma na nossa próxima sessão.",
  "Lembre-se: um passo de cada vez já é progresso. Estou aqui por você.",
];

function needsReply(chat: ProChat) {
  return chat.messages.at(-1)?.sender === "them";
}

export function ProInbox({ chats, activeChatId, onSelect, onSend }: Readonly<ProInboxProps>) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);

  const active = chats.find(chat => chat.id === activeChatId);
  const messageCount = active?.messages.length ?? 0;

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeChatId, messageCount]);

  const handleSelect = (id: number) => {
    setError("");
    setReportNotice("");
    setDraft("");
    onSelect(id);
  };

  const handleSend = async (event: SyntheticEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !active || sending) return;

    setSending(true);
    setError("");
    const failure = await onSend(active.id, text);
    setSending(false);
    if (failure) setError(failure);
    else setDraft("");
  };

  return (
    <main className="screen messages-layout">
      <section className="conversation-list">
        <p className="eyebrow">Pacientes</p>
        {chats.length === 0 && (
          <p className="comments-empty">Nenhuma conversa ainda. Elas aparecem quando um paciente agenda com você.</p>
        )}
        {chats.map(chat => {
          const waiting = needsReply(chat);
          return (
            <button
              key={chat.id}
              type="button"
              className={chat.id === activeChatId ? "conversation-item active" : "conversation-item"}
              onClick={() => handleSelect(chat.id)}
            >
              <div className="avatar avatar-small" style={{ backgroundColor: chat.accent }}>
                {avatarInitial(chat.name)}
              </div>
              <div className="conversation-item-text">
                <strong>{chat.name}</strong>
                <span>{chat.patientEmail}</span>
                <p className={waiting ? "unread-preview" : undefined}>
                  {chat.messages.at(-1)?.text ?? "Nenhuma mensagem ainda"}
                </p>
              </div>
              {waiting && (
                <span className="unread-badge" aria-label="Aguardando resposta">
                  1
                </span>
              )}
            </button>
          );
        })}
      </section>

      <section className="chat-panel">
        {active ? (
          <>
            <div className="chat-header">
              <div className="avatar avatar-small" style={{ backgroundColor: active.accent }}>
                {avatarInitial(active.name)}
              </div>
              <div className="pro-chat-title">
                <strong>{active.name}</strong>
                <p>{active.patientEmail}</p>
              </div>
              <button type="button" className="text-link muted-link" onClick={() => setReporting(true)}>
                Denunciar
              </button>
            </div>

            {reportNotice && <output className="auth-success">{reportNotice}</output>}

            <div className="chat-messages" ref={messagesRef}>
              {active.messages.length === 0 && (
                <p className="comments-empty">Ainda não há mensagens. Escreva a primeira.</p>
              )}
              {active.messages.map(message => (
                <div key={message.id} className={message.sender === "me" ? "chat-bubble mine" : "chat-bubble"}>
                  <p>{message.text}</p>
                  <span>{message.time}</span>
                </div>
              ))}
            </div>

            <div className="quick-replies">
              {QUICK_REPLIES.map(reply => (
                <button key={reply} type="button" className="quick-reply" onClick={() => setDraft(reply)}>
                  {reply}
                </button>
              ))}
            </div>

            <form onSubmit={handleSend} className="chat-input-row">
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="Escreva a sua resposta..."
                maxLength={1000}
              />
              <button type="submit" className="primary-btn small" disabled={sending || !draft.trim()}>
                {sending ? "..." : "Enviar"}
              </button>
            </form>
            {error && <p className="field-error">{error}</p>}
          </>
        ) : (
          <p className="empty-state">Selecione uma conversa.</p>
        )}
      </section>

      {reporting && active && (
        <ReportModal
          targetType="user"
          targetId={active.otherUserId}
          reportedUserId={active.otherUserId}
          targetLabel={active.name}
          onClose={() => setReporting(false)}
          onSubmitted={() => {
            setReporting(false);
            setReportNotice("Denúncia enviada para a equipe de moderação.");
          }}
        />
      )}
    </main>
  );
}
