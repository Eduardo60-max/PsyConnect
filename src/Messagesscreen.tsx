import { useState, type FormEvent } from "react";
import type { Conversation } from "./types";
import { avatarInitial } from "./utils";

type MessagesScreenProps = {
  conversations: Conversation[];
  activeConversationId: number;
  onSelectConversation: (id: number) => void;
  onSendMessage: (conversationId: number, text: string) => void;
};

export function MessagesScreen({
  conversations,
  activeConversationId,
  onSelectConversation,
  onSendMessage,
}: MessagesScreenProps) {
  const [draft, setDraft] = useState("");
  const activeConversation = conversations.find(conversation => conversation.id === activeConversationId);

  const handleSend = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || !activeConversation) return;
    onSendMessage(activeConversation.id, draft.trim());
    setDraft("");
  };

  return (
    <main className="screen messages-layout">
      <section className="conversation-list">
        <p className="eyebrow">Mensagens</p>
        {conversations.map(conversation => (
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
              <p>{conversation.messages[conversation.messages.length - 1]?.text ?? "Nenhuma mensagem ainda"}</p>
            </div>
          </button>
        ))}
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
                <p>{activeConversation.context}</p>
              </div>
            </div>

            <div className="chat-messages">
              {activeConversation.messages.map((message: { id: number; sender: string; text: string; time: string }) => (
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
              />
              <button type="submit" className="primary-btn small">
                Enviar
              </button>
            </form>
          </>
        ) : (
          <p className="empty-state">Selecione uma conversa para começar.</p>
        )}
      </section>
    </main>
  );
}