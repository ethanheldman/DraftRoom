import { useRef, useEffect, useState } from 'react';
import { XIcon, SendIcon } from 'lucide-react';
import { useDMThread } from '../../hooks/useDMThread';
import { sendNotification } from '../../utils/notifications';

interface DMPanelProps {
  currentUserId: string;
  currentUserName: string;
  currentUserColor: string;
  friend: {
    userId: string;
    name: string;
    color: string;
    handle?: string;
  };
  onClose: () => void;
}

function initials(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function dateSep(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DMPanel({ currentUserId, currentUserName, currentUserColor, friend, onClose }: DMPanelProps) {
  const { messages, loading, appendSent } = useDMThread(currentUserId, friend.userId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');

    const tempId = `temp-${Date.now()}`;
    appendSent({
      id: tempId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderColor: currentUserColor,
      text: trimmed,
      createdAt: new Date().toISOString(),
    });

    await sendNotification({
      toUserId: friend.userId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderColor: currentUserColor,
      type: 'message',
      message: `${currentUserName}: ${trimmed}`,
      metadata: { text: trimmed },
    }).catch(() => {});

    setSending(false);
  }

  // Group messages by date
  const grouped: { date: string; items: typeof messages }[] = [];
  for (const msg of messages) {
    const label = dateSep(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.date === label) last.items.push(msg);
    else grouped.push({ date: label, items: [msg] });
  }

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden shadow-2xl"
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        height: '480px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid hsl(var(--border))' }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: friend.color }}
        >
          {initials(friend.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground truncate">{friend.name}</div>
          {friend.handle && (
            <div className="text-[10px] text-muted-foreground">{friend.handle}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ border: '1px solid hsl(var(--border))' }}
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Say hi to {friend.name}!</p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-2">
                  {group.date}
                </span>
                <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
              </div>

              {group.items.map((msg, i) => {
                const isMine = msg.senderId === currentUserId;
                const showAvatar = !isMine && (i === 0 || group.items[i - 1]?.senderId !== msg.senderId);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 mb-1 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar spacer / avatar */}
                    <div className="w-6 flex-shrink-0">
                      {showAvatar && !isMine && (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ background: msg.senderColor }}
                        >
                          {initials(msg.senderName)}
                        </div>
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className="max-w-[75%] px-3 py-2 rounded-2xl text-xs leading-relaxed"
                      style={
                        isMine
                          ? { background: 'hsl(var(--primary))', color: '#fff', borderBottomRightRadius: '4px' }
                          : { background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderBottomLeftRadius: '4px' }
                      }
                    >
                      {msg.text}
                      <div
                        className="text-[9px] mt-1 opacity-60"
                        style={{ textAlign: isMine ? 'right' : 'left' }}
                      >
                        {timeStr(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div
        className="flex items-center gap-2 px-3 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid hsl(var(--border))' }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Message ${friend.name}…`}
          className="flex-1 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
          style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-30 flex-shrink-0"
          style={{ background: 'hsl(var(--primary))' }}
        >
          <SendIcon className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );
}
