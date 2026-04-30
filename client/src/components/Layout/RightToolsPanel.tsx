import { useState, useEffect, useMemo } from 'react';
import type { ScriptNode } from '../../types/screenplay';

export type ToolTab = 'stats' | 'characters' | 'notes';

interface RightToolsPanelProps {
  nodes: ScriptNode[];
  onClose: () => void;
  activeTab?: ToolTab;
  onTabChange?: (tab: ToolTab) => void;
  notes?: string;
  onNotesChange?: (s: string) => void;
  pageGoal?: number;
}

// ── Script analytics ──────────────────────────────────────────────────────────

function computeStats(nodes: ScriptNode[]) {
  const sceneCount = nodes.filter(n => n.type === 'scene_heading').length;
  const actionCount = nodes.filter(n => n.type === 'action').length;
  const dialogueCount = nodes.filter(n => n.type === 'dialogue').length;

  // Rough page estimate: ~50 elements per page (industry: 1 page ≈ 50–55 lines)
  // We keep the raw value around for runtime math (needs finer granularity
  // than 0.1-page buckets) while still exposing the rounded value for display.
  const estimatedPagesRaw = Math.max(0, nodes.length / 52);
  const estimatedPages = Math.max(1, parseFloat(estimatedPagesRaw.toFixed(1)));

  // Character → dialogue line count
  const charMap: Record<string, number> = {};
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type === 'dialogue') {
      // walk back to find the character name
      for (let j = i - 1; j >= 0; j--) {
        if (nodes[j].type === 'character') {
          const name = nodes[j].content.trim().replace(/\s*\(.*\)$/, '').toUpperCase().trim();
          if (name) charMap[name] = (charMap[name] || 0) + 1;
          break;
        }
        if (nodes[j].type === 'scene_heading') break;
      }
    }
  }

  // Scene lengths (element count between headings)
  const scenes: { heading: string; elements: number }[] = [];
  let cur: { heading: string; elements: number } | null = null;
  for (const n of nodes) {
    if (n.type === 'scene_heading') {
      if (cur) scenes.push(cur);
      cur = { heading: n.content.slice(0, 32), elements: 0 };
    } else if (cur) {
      cur.elements++;
    }
  }
  if (cur) scenes.push(cur);

  const uniqueChars = Object.keys(charMap).length;
  const totalDialogue = dialogueCount;

  // Act guess based on the canonical 25/50/25 three-act split — matches
  // BeatSheetView and the Story Structure lesson. Previously this used 0.85
  // for the Act II/III boundary, leaving Act III only 15% and disagreeing
  // with the rest of the app.
  //
  // For very short scripts the math is meaningless (a 1-page draft would
  // show as 0/1/0 pages, since `Math.round(0.25) === 0`). We surface a
  // `tooShort` flag instead so the panel can show a proper placeholder
  // until there's enough script to reason about structure.
  const actBreakdown = (() => {
    const total = estimatedPagesRaw;
    if (total < 3) {
      return { act1Pages: 0, act2Pages: 0, act3Pages: 0, total: 0, tooShort: true as const };
    }
    const act1End = total * 0.25;
    const act2End = total * 0.75;
    return {
      act1Pages: Math.round(act1End),
      act2Pages: Math.round(act2End - act1End),
      act3Pages: Math.round(total - act2End),
      total: Math.round(total),
      tooShort: false as const,
    };
  })();

  return { sceneCount, actionCount, dialogueCount: totalDialogue, estimatedPages, estimatedPagesRaw, charMap, uniqueChars, scenes, actBreakdown };
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl py-3"
      style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
      <span className="text-xl font-bold" style={{ color }}>{value}</span>
      <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Stats panel ───────────────────────────────────────────────────────────────

function StatsPanel({ nodes, pageGoal = 110 }: { nodes: ScriptNode[]; pageGoal?: number }) {
  const stats = useMemo(() => computeStats(nodes), [nodes]);
  const [sessionSecs, setSessionSecs] = useState(0);

  // Session timer only ticks when the tab/window is actually active. Previously
  // it kept counting if the user was in another tab or had the window minimised,
  // inflating "time spent writing" into meaningless numbers.
  useEffect(() => {
    let active = !document.hidden;
    const onVis = () => { active = !document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => { if (active) setSessionSecs(s => s + 1); }, 1000);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const pct = Math.min(100, Math.round((stats.estimatedPages / pageGoal) * 100));
  const sessionMin = Math.floor(sessionSecs / 60);
  const sessionSec = sessionSecs % 60;

  const topChar = Object.entries(stats.charMap).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-4 p-3 overflow-y-auto h-full">

      {/* Core numbers */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox value={Math.round(stats.estimatedPages)} label="pages" color="hsl(var(--foreground))" />
        <StatBox value={stats.sceneCount} label="scenes" color="hsl(var(--foreground))" />
        <StatBox value={stats.uniqueChars} label="chars" color="hsl(var(--foreground))" />
      </div>

      {/* Page progress */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Page Goal</span>
          <span className="text-[10px] font-bold" style={{ color: pct >= 100 ? '#34d399' : 'hsl(var(--primary))' }}>
            {Math.round(stats.estimatedPages)}<span className="text-muted-foreground font-normal">/{pageGoal}</span>
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 100 ? '#34d399' : 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">{pct}% complete</p>
      </div>

      {/* Act breakdown */}
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Act Breakdown</p>
        {stats.actBreakdown.tooShort ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Add more pages to see how your script splits across the three acts.
          </p>
        ) : (
          <div className="space-y-1.5">
            {[
              { label: 'Act I',   pages: stats.actBreakdown.act1Pages },
              { label: 'Act II',  pages: stats.actBreakdown.act2Pages },
              { label: 'Act III', pages: stats.actBreakdown.act3Pages },
            ].map(act => {
              const pct = stats.actBreakdown.total > 0
                ? Math.round((act.pages / stats.actBreakdown.total) * 100)
                : 0;
              return (
                <div key={act.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-10 shrink-0">{act.label}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'hsl(var(--primary))' }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{act.pages}p</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogue breakdown */}
      <div className="rounded-2xl p-3 space-y-2" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Script Mix</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Dialogue</span>
          <span className="text-[10px] font-semibold text-foreground">{stats.dialogueCount} {stats.dialogueCount === 1 ? 'line' : 'lines'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Action</span>
          <span className="text-[10px] font-semibold text-foreground">{stats.actionCount} {stats.actionCount === 1 ? 'line' : 'lines'}</span>
        </div>
        {topChar && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-14 shrink-0">Top voice</span>
            <span className="text-[10px] font-semibold text-primary truncate">{topChar[0]}</span>
          </div>
        )}
      </div>

      {/* Session timer */}
      <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Session</p>
          <p className="text-sm font-bold text-foreground tabular-nums">
            {String(sessionMin).padStart(2, '0')}:{String(sessionSec).padStart(2, '0')}
          </p>
        </div>
      </div>

      {/* Estimated runtime */}
      <div className="rounded-2xl p-3 flex items-center gap-3" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.1)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Runtime</p>
          <p className="text-sm font-bold text-foreground" title="Industry rule-of-thumb: 1 screenplay page ≈ 1 minute of screen time.">
            {(() => {
              // Use unrounded estimatedPages for runtime so the number updates
              // live as the writer types. Previously toFixed(1) quantised to
              // 0.1-page buckets, making the runtime look frozen at "1m" for
              // every edit to a short script.
              const pages = Math.max(0, stats.estimatedPagesRaw ?? stats.estimatedPages);
              const totalSeconds = Math.round(pages * 60);
              const h = Math.floor(totalSeconds / 3600);
              const m = Math.floor((totalSeconds % 3600) / 60);
              const s = totalSeconds % 60;
              if (h > 0) return `${h}h ${m}m`;
              if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
              return `${s}s`;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Characters panel ──────────────────────────────────────────────────────────

function CharactersPanel({ nodes }: { nodes: ScriptNode[] }) {
  const { charMap } = useMemo(() => computeStats(nodes), [nodes]);

  const sorted = Object.entries(charMap).sort((a, b) => b[1] - a[1]);
  const maxLines = sorted[0]?.[1] ?? 1;

  // Appearance order (first scene each character shows up)
  const firstScene: Record<string, number> = {};
  let sceneNum = 0;
  for (const n of nodes) {
    if (n.type === 'scene_heading') sceneNum++;
    if (n.type === 'character') {
      const name = n.content.trim().replace(/\s*\(.*\)$/, '').toUpperCase().trim();
      if (name && firstScene[name] === undefined) firstScene[name] = sceneNum;
    }
  }

  const colors = ['#a78bfa', '#60a5fa', '#34d399', '#f59e0b', '#f87171', '#fb923c', '#e879f9', '#94a3b8'];

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <p className="text-xs text-muted-foreground">No characters yet.<br />Add dialogue to see voice stats.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3 overflow-y-auto h-full">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {sorted.length} speaking {sorted.length === 1 ? 'role' : 'roles'}
      </p>

      {sorted.map(([name, count], i) => {
        const barPct = Math.round((count / maxLines) * 100);
        const color = colors[i % colors.length];
        const fs = firstScene[name];
        return (
          <div key={name} className="rounded-2xl p-2.5 transition-colors"
            style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: color }}>
                  {name.charAt(0)}
                </div>
                <span className="text-[11px] font-semibold text-foreground truncate">{name}</span>
              </div>
              <span className="text-[10px] font-bold shrink-0 ml-1" style={{ color }}>{count}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${barPct}%`, background: color }} />
            </div>
            {fs !== undefined && (
              <p className="text-[9px] text-muted-foreground mt-1">First appears: scene {fs}</p>
            )}
          </div>
        );
      })}

      {sorted.length > 0 && (
        <div className="mt-2 rounded-2xl p-3" style={{ background: 'hsl(var(--primary) / 0.05)', border: '1px solid hsl(var(--primary) / 0.15)' }}>
          <p className="text-[10px] font-semibold text-primary mb-2">Voice Distribution</p>
          <div className="flex h-6 rounded-lg overflow-hidden gap-px">
            {sorted.slice(0, 8).map(([name, count], i) => {
              const w = Math.round((count / sorted.reduce((s, [, c]) => s + c, 0)) * 100);
              return w > 1 ? (
                <div key={name} title={`${name}: ${count} lines`}
                  className="h-full transition-all" style={{ width: `${w}%`, background: colors[i % colors.length], opacity: 0.85 }} />
              ) : null;
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sorted.slice(0, 5).map(([name], i) => (
              <div key={name} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors[i % colors.length] }} />
                <span className="text-[9px] text-muted-foreground truncate max-w-[52px]">{name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────

function NotesPanel({ notes = '', onChange }: { notes?: string; onChange?: (s: string) => void }) {
  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Writer's Notes</p>
        <span className="text-[9px] text-muted-foreground">{wordCount}w</span>
      </div>
      <div className="flex-1 p-2">
        <textarea
          value={notes}
          onChange={e => onChange?.(e.target.value)}
          placeholder="Ideas, reminders, questions for the next draft…"
          className="w-full h-full resize-none rounded-xl border border-border bg-foreground/5 px-3 py-2 text-[11px] text-foreground outline-none focus:border-primary/70 focus:bg-primary/5 transition-colors placeholder:text-muted-foreground/50 leading-relaxed"
        />
      </div>
    </div>
  );
}

// ── Tab icons ─────────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="flex-1 py-2.5 flex items-center justify-center transition-colors relative"
      style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))'; }}>
      {children}
      {active && <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: 'hsl(var(--primary))' }} />}
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function RightToolsPanel({
  nodes,
  onClose,
  activeTab: activeTabProp,
  onTabChange,
  notes = '',
  onNotesChange,
  pageGoal = 110,
}: RightToolsPanelProps) {
  const [localTab, setLocalTab] = useState<ToolTab>('stats');
  const activeTab = activeTabProp ?? localTab;
  function setActiveTab(tab: ToolTab) { setLocalTab(tab); onTabChange?.(tab); }

  return (
    <div className="no-print flex flex-col h-full bg-card flex-shrink-0" style={{ width: '220px' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          {activeTab === 'stats' ? 'Script Stats' : activeTab === 'characters' ? 'Characters' : 'Notes'}
        </span>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <TabBtn active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} title="Script Stats">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </TabBtn>
        <TabBtn active={activeTab === 'characters'} onClick={() => setActiveTab('characters')} title="Characters">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </TabBtn>
        <TabBtn active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} title="Notes">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </TabBtn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'stats' && <StatsPanel nodes={nodes} pageGoal={pageGoal} />}
        {activeTab === 'characters' && <CharactersPanel nodes={nodes} />}
        {activeTab === 'notes' && <NotesPanel notes={notes} onChange={onNotesChange} />}
      </div>
    </div>
  );
}
