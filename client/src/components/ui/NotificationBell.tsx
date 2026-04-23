import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BellIcon, CheckCheckIcon } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { NOTIF_ICONS } from '../../utils/notifications';
import SharedScriptPreview from '../Community/SharedScriptPreview';

interface Props {
  userId: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell({ userId }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [previewScript, setPreviewScript] = useState<{ id: string; senderName: string } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(userId);

  function openDropdown() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const dropdown = open && createPortal(
    <div
      ref={dropdownRef}
      className="w-80 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        zIndex: 9999,
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid hsl(var(--border))' }}
      >
        <span className="text-sm font-bold text-foreground">Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheckIcon className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto" style={{ maxHeight: '360px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">🔔</div>
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Squad activity will show up here</p>
          </div>
        ) : (
          notifications.map((n) => {
            const sharedScriptId = n.type === 'share'
              ? (n.metadata as Record<string, unknown>)?.sharedScriptId as string | undefined
              : undefined;

            return (
              <div
                key={n.id}
                className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                style={{
                  borderBottom: '1px solid hsl(var(--border))',
                  background: n.read ? 'transparent' : 'hsl(var(--primary) / 0.05)',
                }}
                onClick={() => markRead(n.id)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = n.read ? 'transparent' : 'hsl(var(--primary) / 0.05)'; }}
              >
                {/* Sender avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ background: n.senderColor }}
                >
                  {(n.senderName || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-1.5">
                    <span className="text-sm flex-shrink-0">{NOTIF_ICONS[n.type]}</span>
                    <p className="text-xs text-foreground leading-snug break-words">{n.message}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>

                  {/* View script button for share notifications */}
                  {sharedScriptId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markRead(n.id);
                        setPreviewScript({ id: sharedScriptId, senderName: n.senderName });
                        setOpen(false);
                      }}
                      className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-90"
                      style={{ background: 'hsl(var(--primary))', color: '#fff' }}
                    >
                      📖 Read Script
                    </button>
                  )}
                </div>

                {!n.read && (
                  <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'hsl(var(--primary))' }} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={buttonRef}
        onClick={openDropdown}
        className="relative flex items-center justify-center w-8 h-8 rounded-xl transition-colors hover:bg-secondary"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        style={{ border: '1px solid hsl(var(--border))' }}
      >
        <BellIcon className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
            style={{ background: 'hsl(var(--primary))' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {dropdown}
      {previewScript && (
        <SharedScriptPreview
          sharedScriptId={previewScript.id}
          senderName={previewScript.senderName}
          onClose={() => setPreviewScript(null)}
        />
      )}
    </>
  );
}
