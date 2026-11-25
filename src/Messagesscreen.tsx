import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import type { Conversation } from "./types";
import { avatarInitial } from "./utils";
import { CrisisNotice } from "./CrisisNotice";
import { ReportModal } from "./ReportModal";

type MessagesScreenProps = {
  conversations: Conversation[];
  activeConversationId: number;
  unreadIds: number[];
  onSelectConversation: (id: number) => void;
  onSendMessage: (conversationId: number, text: string) => void;
};

function previewText(text: string | undefined, max = 60) {
  if (!text) return "Nenhuma mensagem ainda";
  return text.length > max ? `${text.slice(0, max).trimEnd()}...` : text;
}

export function MessagesScreen({
  conversations,
  activeConversationId,
  unreadIds,
  onSelectConversation,
  onSendMessage,
}: Readonly<MessagesScreenProps>) {
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const activeConversation =
    conversations.find(conversation => conversation.id === activeConversationId) ?? conversations[0];
  const activeId = activeConversation?.id ?? 0;
  const messageCount = activeConversation?.messages.length ?? 0;

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeId, messageCount]);

  const handleSend = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!draft.trim() || !activeConversation) return;
    onSendMessage(activeConversation.id, draft.trim());
    setDraft("");
  };

  return (
    <main className="screen messages-layout">
      <section className="conversation-list">
        <p className="eyebrow">Mensagens</p>
        {conversations.length === 0 && (
          <p className="comments-empty">
            Você ainda não tem conversas. Elas aparecem depois que você agenda uma sessão com um profissional.
          </p>
        )}
        {conversations.map(conversation => {
          const unread = unreadIds.includes(conversation.id);
          return (
            <button
              key={conversation.id}
              type="button"
              className={conversation.id === activeId ? "conversation-item active" : "conversation-item"}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="avatar avatar-small" style={{ backgroundColor: conversation.accent }}>
                {avatarInitial(conversation.name)}
              </div>
              <div className="conversation-item-text">
                <strong>{conversation.name}</strong>
                <span>{conversation.context}</span>
                <p className={unread ? "unread-preview" : undefined}>
                  {previewText(conversation.messages.at(-1)?.text)}
                </p>
              </div>
              {unread && <span className="unread-badge" aria-label="Mensagem nova">1</span>}
            </button>
          );
        })}
        <CrisisNotice />
      </section>

      <section className="chat-panel">
        {activeConversation ? (
          <>
            <div className="chat-header">
              <div className="avatar avatar-small" style={{ backgroundColor: activeConversation.accent }}>
                {avatarInitial(activeConversation.name)}
              </div>
              <div className="pro-chat-title">
                <strong>{activeConversation.name}</strong>
                <p>{activeConversation.context}</p>
              </div>
              <button type="button" className="text-link muted-link" onClick={() => setReporting(true)}>
                Denunciar
              </button>
            </div>

            {reportNotice && <output className="auth-success">{reportNotice}</output>}

            <div className="chat-messages" ref={messagesRef}>
              {activeConversation.messages.length === 0 && (
                <p className="comments-empty">Ainda não há mensagens. Escreva a primeira.</p>
              )}
              {activeConversation.messages.map(message => (
                <div key={message.id} className={message.sender === "me" ? "chat-bubble mine" : "chat-bubble"}>
                  <p>{message.text}</p>
                  <span>{message.time}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="chat-input-row">
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem..."
                maxLength={1000}
              />
              <button type="submit" className="primary-btn small" disabled={!draft.trim()}>
                Enviar
              </button>
            </form>
            <p className="chat-note">Mensagens não substituem atendimento de emergência. Em crise, ligue 188 (CVV).</p>
          </>
        ) : (
          <p className="empty-state">Agende uma sessão para começar a conversar com um profissional.</p>
        )}
      </section>

      {reporting && activeConversation && (
        <ReportModal
          targetType="user"
          targetId={activeConversation.otherUserId}
          reportedUserId={activeConversation.otherUserId}
          targetLabel={activeConversation.name}
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
