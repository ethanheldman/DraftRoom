import { useState, useRef } from 'react';
import type { Beat, BeatItem, ScriptNode } from '../../types/screenplay';
import { getSceneHeadings, scriptToPlainText } from '../../utils/storage';
import { makeId as sharedMakeId } from '../../utils/ids';

interface Props {
  beats: Beat[];
  onChange: (beats: Beat[]) => void;
  nodes: ScriptNode[];
  title?: string;
}

// Uniform Act styling: all three acts use the primary accent color.
// Previously the three acts used three different colors (violet/amber/blue) which
// clashed with the rest of the app's amber palette and the Script Stats act bars.
// Using `hsl(var(--primary))` makes the act bars re-tint with the user's theme.
const ACT_COLORS = ['hsl(var(--primary))', 'hsl(var(--primary))', 'hsl(var(--primary))'];
const ACT_LABELS = ['Setup', 'Confrontation', 'Resolution'];
const BEAT_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

// Compute the actual page length of the script (one node ≈ one line, 55 lines/page).
// This replaces the hardcoded 120-page assumption that stretched/compressed the
// act zones for anything other than a feature screenplay.
function computeTotalPages(nodes: ScriptNode[]): number {
  if (!nodes || nodes.length === 0) return 120;
  // Generous estimator — matches the one in fountain.ts withContinueds().
  const lines = nodes.reduce((acc, n) => acc + 1 + Math.floor((n.content?.length ?? 0) / 60), 0);
  return Math.max(20, Math.ceil(lines / 55));
}

// Given a page number and total script length, return which act (1..3) it
// sits in using the classic 25/50/25 split. Works for shorts, indies, and
// tentpoles alike because we scale by actual script length, not a fixed 120.
function pageToAct(page: number, totalPages: number): number {
  if (page <= totalPages * 0.25) return 1;
  if (page <= totalPages * 0.75) return 2;
  return 3;
}

const makeId = sharedMakeId;

interface EditState { title: string; description: string; page: string; color: string; linkedSceneIndex: string; }

const inputClass = "w-full rounded-xl border border-border bg-secondary px-2 py-1 text-[11px] text-foreground outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground";

function ArcGraph({ beats, totalPages }: { beats: Beat[]; totalPages: number }) {
  if (beats.length === 0) return null;
  const W = 500, H = 64;
  const PAD = 8;
  // Use the actual script length so the act zones correspond to real pages.
  // If a beat sits beyond the current script (e.g. placeholder), fall through
  // to Math.max so the dot still renders.
  const maxPage = Math.max(totalPages, ...beats.map(b => b.page));
  const toX = (page: number) => PAD + (page / maxPage) * (W - 2 * PAD);

  return (
    <div className="px-6 py-4 border-b border-border" style={{ background: 'hsl(var(--card))' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Story Arc</p>
        <p className="text-[10px] text-muted-foreground">{beats.length} beat{beats.length !== 1 ? 's' : ''}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56, display: 'block' }}>
        {/*
          Act zones render via CSS vars so they recolor with the user's theme.
          Previously we concatenated `'#c17f24' + '15'` to fake 8-char hex alpha,
          which stopped working once we moved the color to `hsl(var(--primary))`.
          Now we use the `/ 0.09` fractional-alpha syntax that modern browsers
          accept inside `hsl()`.
        */}
        <rect x={PAD} y={4} width={(W - 2 * PAD) * 0.25} height={H - 18} fill="hsl(var(--primary) / 0.09)" rx="4" />
        <rect x={PAD + (W - 2 * PAD) * 0.25} y={4} width={(W - 2 * PAD) * 0.5} height={H - 18} fill="hsl(var(--primary) / 0.09)" rx="4" />
        <rect x={PAD + (W - 2 * PAD) * 0.75} y={4} width={(W - 2 * PAD) * 0.25} height={H - 18} fill="hsl(var(--primary) / 0.09)" rx="4" />

        {/* Act dividers */}
        <line x1={PAD + (W - 2 * PAD) * 0.25} y1={4} x2={PAD + (W - 2 * PAD) * 0.25} y2={H - 14} stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1={PAD + (W - 2 * PAD) * 0.75} y1={4} x2={PAD + (W - 2 * PAD) * 0.75} y2={H - 14} stroke="hsl(var(--border))" strokeWidth="1" />

        {/* Act labels */}
        <text x={PAD + 6} y={H - 5} fill="hsl(var(--primary))" fontSize="7" fontWeight="700" opacity="0.7">ACT I</text>
        <text x={PAD + (W - 2 * PAD) * 0.45} y={H - 5} fill="hsl(var(--primary))" fontSize="7" fontWeight="700" opacity="0.7" textAnchor="middle">ACT II</text>
        <text x={PAD + (W - 2 * PAD) * 0.88} y={H - 5} fill="hsl(var(--primary))" fontSize="7" fontWeight="700" opacity="0.7" textAnchor="middle">ACT III</text>

        {/* Timeline baseline */}
        <line x1={PAD} y1={H / 2 - 4} x2={W - PAD} y2={H / 2 - 4} stroke="hsl(var(--border))" strokeWidth="1" />

        {/*
          Beat dots — when two beats sit on the same page (e.g. a template
          that puts Opening Image and Inciting Incident both near p.1) the
          old code drew them on top of each other, making it look like only
          one beat existed. We bucket beats by integer page and render a
          single dot per bucket with a small count badge.
        */}
        {Object.entries(
          beats.reduce<Record<number, Beat[]>>((acc, b) => {
            (acc[b.page] ||= []).push(b);
            return acc;
          }, {})
        ).map(([pageStr, group]) => {
          const page = Number(pageStr);
          const cx = toX(page);
          const cy = H / 2 - 4;
          const count = group.length;
          const primary = group[0];
          return (
            <g key={page}>
              <circle cx={cx} cy={cy} r={5}
                fill={primary.color || 'hsl(var(--primary))'}
                opacity="0.92" />
              {count > 1 && (
                <>
                  <circle cx={cx + 5} cy={cy - 5} r={4.5} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth="1" />
                  <text x={cx + 5} y={cy - 3} fontSize="6" fontWeight="700" fill="hsl(var(--primary))" textAnchor="middle">{count}</text>
                </>
              )}
              <title>{group.map(b => `${b.title} · p.${b.page}`).join('\n')}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function BeatSheetView({ beats, onChange, nodes, title }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditState>({ title: '', description: '', page: '1', color: '', linkedSceneIndex: '' });
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);
  const dragOverItem = useRef<string | null>(null);
  const sceneHeadings = getSceneHeadings(nodes);

  function addBeat(act: number) {
    const lastPage = Math.max(...beats.filter(b => b.act === act).map(b => b.page), act === 1 ? 0 : act === 2 ? 30 : 80);
    const id = makeId();
    const newBeat: Beat = { id, title: 'New Beat', description: '', act, page: lastPage + 5, color: '' };
    onChange([...beats, newBeat]);
    setEditId(id);
    setDraft({ title: 'New Beat', description: '', page: String(lastPage + 5), color: '', linkedSceneIndex: '' });
  }

  function startEdit(b: Beat) {
    setEditId(b.id);
    setDraft({ title: b.title, description: b.description, page: String(b.page), color: b.color ?? '', linkedSceneIndex: b.linkedSceneIndex !== undefined ? String(b.linkedSceneIndex) : '' });
  }

  function saveEdit(id: string) {
    const updated = { ...beats.find(b => b.id === id)!, title: draft.title || 'Untitled', description: draft.description, page: parseInt(draft.page) || 1, color: draft.color, linkedSceneIndex: draft.linkedSceneIndex !== '' ? parseInt(draft.linkedSceneIndex) : undefined };
    onChange(beats.map(b => b.id === id ? updated : b));
    setEditId(null);
    if (selectedBeat?.id === id) setSelectedBeat(updated);
  }

  function deleteBeat(id: string) {
    onChange(beats.filter(b => b.id !== id));
    if (editId === id) setEditId(null);
    if (selectedBeat?.id === id) setSelectedBeat(null);
  }

  function handleDragStart(id: string) { dragItem.current = id; }
  function handleDragEnter(id: string) { dragOverItem.current = id; }
  function handleDragEnd(act: number) {
    if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) {
      dragItem.current = null; dragOverItem.current = null; return;
    }
    const actBeats = beats.filter(b => b.act === act);
    const otherBeats = beats.filter(b => b.act !== act);
    const fromIdx = actBeats.findIndex(b => b.id === dragItem.current);
    const toIdx = actBeats.findIndex(b => b.id === dragOverItem.current);
    if (fromIdx < 0 || toIdx < 0) { dragItem.current = null; dragOverItem.current = null; return; }
    const reordered = [...actBeats];
    const [removed] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, removed);
    onChange([...otherBeats, ...reordered]);
    dragItem.current = null; dragOverItem.current = null;
  }

  async function generateFromScript() {
    setGenerating(true);
    setGenError(null);
    try {
      const scriptText = scriptToPlainText(nodes);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'beat_sheet', scriptText, title: title ?? '' }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? 'AI request failed');
      const items: BeatItem[] = data.result;
      // Anchor act boundaries to the actual script length, not a fake 120.
      const totalPages = computeTotalPages(nodes);
      const generated: Beat[] = items.map(item => ({
        id: makeId(),
        title: item.beat,
        description: item.description,
        page: item.page,
        act: pageToAct(item.page, totalPages),
        color: '',
      }));
      onChange(generated);
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background font-geist">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <span className="font-semibold text-foreground">Beat Sheet</span>
        <span className="text-xs text-muted-foreground">{beats.length} beats</span>
        <div className="ml-auto flex items-center gap-2">
          {genError && <span className="text-[10px] text-destructive max-w-[160px] truncate">{genError}</span>}
          <button
            onClick={generateFromScript}
            disabled={generating || nodes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-[11px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors disabled:opacity-50">
            {generating ? (
              <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Generating…</>
            ) : 'Generate from Script'}
          </button>
        </div>
      </div>

      {/* ── Arc visualization ─────────────────────────────────────────── */}
      <ArcGraph beats={beats} totalPages={computeTotalPages(nodes)} />

      {/* ── Acts ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {[1, 2, 3].map((act, actIdx) => {
          // Surface mismatch between beat.act and computed act (via page) so
          // a page-1 beat hard-coded as act 2 gets flagged instead of silently
          // hiding in the "wrong" column. We compute totalPages once per render.
          const totalPagesForAct = computeTotalPages(nodes);
          const actBeats = beats.filter(b => b.act === act).sort((a, b) => a.page - b.page);
          const color = ACT_COLORS[actIdx];
          const label = ACT_LABELS[actIdx];

          return (
            <div key={act} className="border-b border-border last:border-b-0">
              {/* Act header */}
              <div className="flex items-center gap-3 px-6 py-3 sticky top-0 z-10 backdrop-blur-sm"
                style={{ background: 'hsl(var(--background) / 0.92)', borderLeft: `3px solid ${color}` }}>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>Act {act}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{actBeats.length} beat{actBeats.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => addBeat(act)}
                  className="ml-auto text-[11px] px-3 py-1.5 rounded-2xl font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                  + Add Beat
                </button>
              </div>

              {/* Beat cards */}
              <div className="flex gap-3 overflow-x-auto px-6 pb-5 pt-3 min-h-[160px]">
                {actBeats.length === 0 ? (
                  <div className="flex items-center justify-center w-full text-[11px] text-muted-foreground italic">
                    No beats yet — click "Add Beat" or use "Generate from Script".
                  </div>
                ) : actBeats.map(beat => (
                  <div key={beat.id}
                    draggable
                    onDragStart={() => handleDragStart(beat.id)}
                    onDragEnter={() => handleDragEnter(beat.id)}
                    onDragEnd={() => handleDragEnd(act)}
                    onDragOver={e => e.preventDefault()}
                    onClick={() => { if (editId !== beat.id) setSelectedBeat(beat); }}
                    className="group flex-shrink-0 w-52 rounded-2xl border border-border bg-card shadow-sm cursor-pointer hover:border-violet-400/40 hover:shadow-md transition-all duration-200 overflow-hidden"
                    style={{ borderTop: beat.color ? `3px solid ${beat.color}` : `3px solid ${color}40` }}>

                    {editId === beat.id ? (
                      <div className="p-3 space-y-1.5">
                        <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                          placeholder="Beat title" className={inputClass} />
                        <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                          rows={3} placeholder="Description…"
                          className="w-full resize-none rounded-xl border border-border bg-secondary px-2 py-1 text-[10px] text-foreground/80 outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground" />
                        <input value={draft.page} onChange={e => setDraft(d => ({ ...d, page: e.target.value }))}
                          type="number" min="1" max="999" placeholder="Page"
                          className={inputClass} />
                        {sceneHeadings.length > 0 && (
                          <select value={draft.linkedSceneIndex} onChange={e => setDraft(d => ({ ...d, linkedSceneIndex: e.target.value }))}
                            className="w-full rounded-xl border border-border bg-secondary text-foreground px-2 py-1 text-[10px] outline-none focus:border-violet-400/70 transition-colors">
                            <option value="">Link to scene…</option>
                            {sceneHeadings.map((h, i) => <option key={i} value={i}>{i + 1}: {h.slice(0, 24)}</option>)}
                          </select>
                        )}
                        <div className="flex gap-1 flex-wrap">
                          {BEAT_COLORS.map(c => (
                            <button key={c} onClick={() => setDraft(d => ({ ...d, color: c }))}
                              className={`w-4 h-4 rounded-full border-2 transition-all ${draft.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                              style={{ background: c || 'hsl(var(--border))' }} />
                          ))}
                        </div>
                        <div className="flex gap-1 pt-1">
                          <button onClick={() => saveEdit(beat.id)} className="flex-1 rounded-xl py-1 text-[10px] font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">Save</button>
                          <button onClick={() => setEditId(null)} className="text-[10px] text-muted-foreground hover:text-foreground px-2 transition-colors">✕</button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 flex flex-col h-full">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className="text-[12px] font-bold text-foreground leading-snug flex-1">{beat.title}</span>
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); startEdit(beat); }}
                              className="text-muted-foreground hover:text-violet-400 text-[10px] transition-colors p-0.5">✎</button>
                            <button onClick={e => { e.stopPropagation(); deleteBeat(beat.id); }}
                              className="text-muted-foreground hover:text-destructive text-[10px] transition-colors p-0.5">×</button>
                          </div>
                        </div>

                        {/* Description */}
                        {beat.description && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-4 flex-1 mb-2">
                            {beat.description}
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-auto pt-1.5 border-t border-border/40">
                          <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                            p.{beat.page}
                            {pageToAct(beat.page, totalPagesForAct) !== beat.act && (
                              <span
                                title={`Page ${beat.page} falls in Act ${pageToAct(beat.page, totalPagesForAct)} of a ${totalPagesForAct}-page script, but this beat is assigned to Act ${beat.act}.`}
                                className="text-[9px] font-semibold px-1 rounded cursor-help"
                                style={{ background: 'hsl(38 92% 50% / 0.18)', color: 'hsl(38 92% 45%)' }}
                              >
                                ⚠︎
                              </span>
                            )}
                          </span>
                          {beat.linkedSceneIndex !== undefined && (
                            <span className="text-[9px] font-medium truncate max-w-[80px]" style={{ color }}>
                              ↗ Sc.{beat.linkedSceneIndex + 1}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Beat detail modal ──────────────────────────────────────────── */}
      {selectedBeat && (() => {
        const b = selectedBeat;
        const actColor = ACT_COLORS[Math.max(0, b.act - 1)];
        const actLabel = ACT_LABELS[Math.max(0, b.act - 1)];
        const linkedScene = b.linkedSceneIndex !== undefined ? sceneHeadings[b.linkedSceneIndex] : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setSelectedBeat(null)}>
            <div
              className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
              onClick={e => e.stopPropagation()}>

              {/* Color strip */}
              <div className="h-1" style={{ background: b.color || actColor }} />

              <div className="p-6">
                {/* Top meta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                      style={{ background: actColor + '20', color: actColor }}>
                      Act {b.act} · {actLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">Page {b.page}</span>
                  </div>
                  <button onClick={() => setSelectedBeat(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary text-lg leading-none">
                    ×
                  </button>
                </div>

                {/* Beat title */}
                <h2 className="text-xl font-bold text-foreground mb-3 leading-snug">{b.title}</h2>

                {/* Description */}
                {b.description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {b.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">No description written yet.</p>
                )}

                {/* Linked scene */}
                {linkedScene && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px]"
                    style={{ background: 'hsl(var(--secondary))', color: actColor }}>
                    <span>↗</span>
                    <span className="font-medium truncate">Sc.{b.linkedSceneIndex! + 1}: {linkedScene}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-6">
                  <button onClick={() => { setSelectedBeat(null); startEdit(b); }}
                    className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                    Edit Beat
                  </button>
                  <button onClick={() => setSelectedBeat(null)}
                    className="px-5 rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-border/60">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
