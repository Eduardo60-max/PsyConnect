import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import type { Conversation } from "./types";
import { avatarInitial } from "./utils";
import { CrisisNotice } from "./CrisisNotice";

type MessagesScreenProps = {
  conversations: Conversation[];
  activeConversationId: number;
  typingIds: number[];
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
  typingIds,
  unreadIds,
  onSelectConversation,
  onSendMessage,
}: Readonly<MessagesScreenProps>) {
  const [draft, setDraft] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId);
  const isTyping = typingIds.includes(activeConversationId);
  const messageCount = activeConversation?.messages.length ?? 0;

  // Mantém a conversa rolada até a última mensagem
  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeConversationId, messageCount, isTyping]);

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
        {conversations.map(conversation => {
          const unread = unreadIds.includes(conversation.id);
          const typing = typingIds.includes(conversation.id);
          return (
            <button
              key={conversation.id}
              type="button"
              className={
                conversation.id === activeConversationId ? "conversation-item active" : "conversation-item"
              }
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="avatar avatar-small" style={{ backgroundColor: conversation.accent }}>
                {avatarInitial(conversation.name)}
              </div>
              <div className="conversation-item-text">
                <strong>{conversation.name}</strong>
                <span>{conversation.context}</span>
                {typing ? (
                  <p className="typing-preview">digitando...</p>
                ) : (
                  <p className={unread ? "unread-preview" : undefined}>
                    {previewText(conversation.messages.at(-1)?.text)}
                  </p>
                )}
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
              <div>
                <strong>{activeConversation.name}</strong>
                <p>{isTyping ? "digitando..." : activeConversation.context}</p>
              </div>
            </div>

            <div className="chat-messages" ref={messagesRef}>
              {activeConversation.messages.map(message => (
                <div key={message.id} className={message.sender === "me" ? "chat-bubble mine" : "chat-bubble"}>
                  <p>{message.text}</p>
                  <span>{message.time}</span>
                </div>
              ))}

              {isTyping && (
                <div className="chat-bubble typing" aria-live="polite">
                  <span className="typing-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <small className="typing-label">{activeConversation.name} está digitando...</small>
                </div>
              )}
            </div>

            <form onSubmit={handleSend} className="chat-input-row">
              <input
                type="text"
                value={draft}
                onChange={event => setDraft(event.target.value)}
                placeholder="Escreva uma mensagem..."
                maxLength={1000}
              />
              <button type="submit" className="primary-btn small">
                Enviar
              </button>
            </form>
            <p className="chat-note">Demonstração: as respostas dos profissionais são automáticas.</p>
          </>
        ) : (
          <p className="empty-state">Selecione uma conversa para começar.</p>
        )}
      </section>
    </main>
  );
}