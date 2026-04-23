import { useEffect, useState } from 'react';
import { PlayIcon, PauseIcon, EyeIcon, EyeOffIcon } from 'lucide-react';

interface StatusBarProps {
  pages: number;
  pageGoal: number;
  words: number;
  writingTime: number;
  thinkingTime: number;
  isWritingRunning: boolean;
  isThinkingRunning: boolean;
  onToggleWriting: () => void;
  onToggleThinking: () => void;
  saving: boolean;
  lastSaved: Date | null;
  /** True when edits have happened since the last successful save. */
  dirty?: boolean;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSavedTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const TIMERS_HIDDEN_KEY = 'sr-timers-hidden';

export default function StatusBar({
  pages,
  pageGoal,
  words,
  writingTime,
  thinkingTime,
  isWritingRunning,
  isThinkingRunning,
  onToggleWriting,
  onToggleThinking,
  saving,
  lastSaved,
  dirty = false,
}: StatusBarProps) {
  // Some writers find the ticking timers anxiety-inducing. Remember the hide
  // preference across sessions. Toggle lives on the far right of the status
  // bar so it's discoverable but not in the way.
  const [timersHidden, setTimersHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(TIMERS_HIDDEN_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(TIMERS_HIDDEN_KEY, timersHidden ? '1' : '0'); } catch { /* quota */ }
  }, [timersHidden]);

  const pagePct = pageGoal > 0 ? Math.min(100, Math.round((pages / pageGoal) * 100)) : 0;

  return (
    <div className="no-print flex items-center justify-between px-4 py-1.5 bg-background text-xs text-muted-foreground select-none flex-shrink-0 font-geist font-mono" style={{ borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
      {/* Left: page counter */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium cursor-help"
            // Clarified label — previously "Pg 1 / 120" read as "page 1 of a
            // 120-page doc" when really 120 is the goal.
            title={`Page ${pages} — goal ${pageGoal} (${pagePct}% complete)`}
            style={{
              background: pages >= pageGoal ? 'hsl(var(--primary))' : 'hsl(var(--secondary))',
              color: pages >= pageGoal ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
            }}
          >
            Pg {pages} · goal {pageGoal}
          </span>
        </div>

        <span>{words.toLocaleString()} Words</span>

        {/* Timers only render when the user hasn't hidden them */}
        {!timersHidden && (
          <>
            <span className="mx-2 opacity-20">·</span>

            <button
              onClick={onToggleWriting}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${isWritingRunning ? 'text-primary' : 'text-muted-foreground'}`}
              title="Time spent actively typing in this session. Click to pause/resume."
            >
              {isWritingRunning ? (
                <PauseIcon size={10} fill="currentColor" strokeWidth={0} />
              ) : (
                <PlayIcon size={10} fill="currentColor" strokeWidth={0} />
              )}
              Writing: {formatTime(writingTime)}
            </button>

            <span className="mx-2 opacity-20">·</span>

            <button
              onClick={onToggleThinking}
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${isThinkingRunning ? 'text-primary' : 'text-muted-foreground'}`}
              title="Time spent not typing but with the editor focused. Click to pause/resume."
            >
              {isThinkingRunning ? (
                <PauseIcon size={10} fill="currentColor" strokeWidth={0} />
              ) : (
                <PlayIcon size={10} fill="currentColor" strokeWidth={0} />
              )}
              Thinking: {formatTime(thinkingTime)}
            </button>
          </>
        )}

        {/* Timer visibility toggle */}
        <button
          onClick={() => setTimersHidden(v => !v)}
          className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
          title={timersHidden ? 'Show writing timers' : 'Hide writing timers'}
          aria-label={timersHidden ? 'Show writing timers' : 'Hide writing timers'}
        >
          {timersHidden ? <EyeIcon size={11} /> : <EyeOffIcon size={11} />}
        </button>
      </div>

      {/* Right: save status — three states: saving / dirty (unsaved) / saved. */}
      <div className="flex items-center gap-1" title={saving ? 'Saving now' : dirty ? 'You have unsaved changes — autosave fires in a couple seconds' : lastSaved ? `Last saved ${formatSavedTime(lastSaved)}` : 'No saves yet'}>
        {saving ? (
          <>
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span>Saving…</span>
          </>
        ) : dirty ? (
          <>
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Unsaved changes</span>
          </>
        ) : lastSaved ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Saved {formatSavedTime(lastSaved)}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
