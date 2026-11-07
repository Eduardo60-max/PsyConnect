import { useEffect, useRef, useState } from "react";
import { timeAgo, type AppNotification, type NotificationKind } from "./notifications";

type NotificationBellProps = {
  items: AppNotification[];
  onOpenItem: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
};

const ICONS: Record<NotificationKind, string> = {
  booking: "📅",
  message: "💬",
  group: "👥",
  challenge: "🏅",
  system: "💜",
};

export function NotificationBell({ items, onOpenItem, onMarkAllRead, onClear }: Readonly<NotificationBellProps>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter(item => !item.read).length;

  // Fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const handleOpenItem = (notification: AppNotification) => {
    setOpen(false);
    onOpenItem(notification);
  };

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        type="button"
        className="theme-toggle notif-btn"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-label={unread > 0 ? `Notificações: ${unread} não lidas` : "Notificações"}
        title="Notificações"
      >
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" aria-label="Notificações">
          <div className="notif-panel-header">
            <strong>Notificações</strong>
            <div className="notif-panel-actions">
              <button type="button" className="text-link" onClick={onMarkAllRead} disabled={unread === 0}>
                Marcar como lidas
              </button>
              <button type="button" className="text-link" onClick={onClear} disabled={items.length === 0}>
                Limpar
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="notif-empty">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="notif-list">
              {items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.read ? "notif-item" : "notif-item unread"}
                    onClick={() => handleOpenItem(item)}
                  >
                    <span className="notif-icon" aria-hidden="true">
                      {ICONS[item.kind]}
                    </span>
                    <span className="notif-text">
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <small>{timeAgo(item.createdAt)}</small>
                    </span>
                    {!item.read && <span className="notif-dot" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}