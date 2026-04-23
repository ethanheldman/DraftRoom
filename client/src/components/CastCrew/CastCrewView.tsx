import { useState, useMemo } from 'react';
import type { CastMember, CharacterProfile } from '../../types/screenplay';
import type { ScriptNode } from '../../types/screenplay';
import { getCharacterNames } from '../../utils/storage';
import { makeId } from '../../utils/ids';

const DEPARTMENTS = ['Acting', 'Direction', 'Writing', 'Cinematography', 'Production Design', 'Costume', 'Makeup & Hair', 'Sound', 'Editing', 'VFX', 'Music', 'Production'];
const CATEGORIES: { id: CastMember['category']; label: string; color: string }[] = [
  { id: 'cast', label: 'Cast', color: '#7c3aed' },
  { id: 'crew', label: 'Crew', color: '#3b82f6' },
  { id: 'vendor', label: 'Vendors', color: '#f59e0b' },
];

interface Props {
  members: CastMember[];
  onChange: (m: CastMember[]) => void;
  nodes?: ScriptNode[];
  aiCharacters?: Record<string, CharacterProfile>;
}

const inputClass = "w-full rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground";
const selectClass = "w-full rounded-xl border border-border bg-secondary text-foreground px-3 py-1.5 text-xs outline-none focus:border-violet-400/70 transition-colors";

function avatarColor(name: string) {
  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// For single-word names (common in screenplays — characters like WAITRESS,
// WRITER, MAYA are all one word), fall back to the first TWO letters so
// characters with the same initial don't all render identical avatars.
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function categoryMeta(cat: CastMember['category']) {
  return CATEGORIES.find(c => c.id === cat) ?? CATEGORIES[0];
}

// ── Character stats computed from script ──────────────────────────────────────

interface CharStat {
  dialogueLines: number;
  scenes: Set<string>;
  firstScene: string;
  pct: number;
}

function computeCharStats(nodes: ScriptNode[]): Record<string, CharStat> {
  const stats: Record<string, CharStat> = {};
  let currentScene = '';
  let currentChar = '';
  let totalDialogue = 0;

  for (const n of nodes) {
    if (n.type === 'scene_heading') currentScene = n.content.trim();
    if (n.type === 'character') {
      currentChar = n.content.replace(/\(.*?\)/g, '').trim().toUpperCase();
      if (currentChar && !stats[currentChar]) {
        stats[currentChar] = { dialogueLines: 0, scenes: new Set(), firstScene: currentScene, pct: 0 };
      }
      if (currentChar && currentScene) stats[currentChar]?.scenes.add(currentScene);
    }
    if (n.type === 'dialogue' && currentChar && stats[currentChar]) {
      stats[currentChar].dialogueLines++;
      totalDialogue++;
    }
  }
  if (totalDialogue > 0) {
    for (const s of Object.values(stats)) s.pct = Math.round((s.dialogueLines / totalDialogue) * 100);
  }
  return stats;
}

// ── Archetype + actor suggestions ────────────────────────────────────────────

function getArchetype(pct: number, profile?: CharacterProfile): string {
  if (profile) {
    const p = profile.personality;
    if (p.neuroticism > 7 || p.honesty < 4) return 'antagonist';
    if (p.openness > 7 && p.courage > 7) return 'lead';
    if (p.conscientiousness > 7 && p.agreeableness > 6) return 'mentor';
  }
  if (pct >= 25) return 'lead';
  if (pct >= 10) return 'supporting';
  if (pct >= 3) return 'minor';
  return 'minor';
}


// ── Personality bar ───────────────────────────────────────────────────────────

function PersonalityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${(value / 10) * 100}%`, background: color }} />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground w-4 text-right">{value}</span>
    </div>
  );
}

// ── Character detail modal ────────────────────────────────────────────────────

function CharacterModal({
  member, stat, profile, onClose, onEdit, onSaveComments,
}: {
  member: CastMember;
  stat?: CharStat;
  profile?: CharacterProfile;
  onClose: () => void;
  onEdit: () => void;
  onSaveComments: (s: string) => void;
}) {
  const color = avatarColor(member.fullName);
  const archetype = getArchetype(stat?.pct ?? 0, profile);
  const [comments, setComments] = useState(member.comments ?? '');
  const [saved, setSaved] = useState(false);

  const archetypeColors: Record<string, string> = {
    lead: '#a78bfa', supporting: '#60a5fa', antagonist: '#f87171', mentor: '#34d399', minor: '#94a3b8',
  };
  const archetypeColor = archetypeColors[archetype] ?? '#94a3b8';

  function handleSave() {
    onSaveComments(comments);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const personalityTraits = profile ? [
    { label: 'Openness',          value: profile.personality.openness,          color: '#a78bfa' },
    { label: 'Conscientiousness', value: profile.personality.conscientiousness,  color: '#60a5fa' },
    { label: 'Extraversion',      value: profile.personality.extraversion,       color: '#34d399' },
    { label: 'Agreeableness',     value: profile.personality.agreeableness,      color: '#fbbf24' },
    { label: 'Neuroticism',       value: profile.personality.neuroticism,        color: '#f87171' },
    { label: 'Courage',           value: profile.personality.courage,            color: '#fb923c' },
    { label: 'Honesty',           value: profile.personality.honesty,            color: '#4ade80' },
    { label: 'Intelligence',      value: profile.personality.intelligence,       color: '#818cf8' },
  ] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl font-geist"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        onClick={e => e.stopPropagation()}>

        {/* Hero */}
        <div className="relative p-6 pb-5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0"
              style={{ background: color }}>
              {initials(member.fullName || '?')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-xl font-bold text-foreground">{member.fullName || 'Unnamed'}</h2>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: archetypeColor + '20', color: archetypeColor }}>
                  {archetype}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  style={{ background: '#7c3aed20', color: '#a78bfa' }}>
                  {categoryMeta(member.category).label}
                </span>
              </div>
              {member.department && <p className="text-sm text-muted-foreground">{member.department}</p>}
              {(member.tags ?? []).length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {(member.tags ?? []).map(t => (
                    <span key={t} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa' }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={onEdit}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-violet-400/40 transition-colors">
                Edit
              </button>
              <button onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Script stats */}
          {stat && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Script Stats</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: stat.dialogueLines, label: 'Lines',    color: '#a78bfa' },
                  { value: stat.scenes.size,   label: 'Scenes',   color: '#34d399' },
                  { value: `${stat.pct}%`,     label: 'Dialogue', color: '#60a5fa' },
                  { value: archetype,          label: 'Role',     color: archetypeColor },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-3 text-center"
                    style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                    <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Dialogue share bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">Share of total dialogue</span>
                  <span className="text-[10px] font-semibold" style={{ color: archetypeColor }}>{stat.pct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(stat.pct, 100)}%`, background: `linear-gradient(90deg, ${archetypeColor}, ${archetypeColor}99)` }} />
                </div>
              </div>

              {/* First appearance */}
              {stat.firstScene && (
                <div className="mt-3 rounded-xl px-3 py-2 flex items-center gap-2"
                  style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                  <span className="text-[10px] text-muted-foreground">First appears in</span>
                  <span className="text-[10px] font-semibold text-foreground truncate">{stat.firstScene}</span>
                </div>
              )}

              {/* Scenes list */}
              {stat.scenes.size > 0 && (
                <details className="mt-2">
                  <summary className="text-[10px] text-violet-400 cursor-pointer select-none hover:text-violet-300 transition-colors">
                    View all {stat.scenes.size} scenes ›
                  </summary>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {Array.from(stat.scenes).map(s => (
                      <div key={s} className="text-[10px] text-muted-foreground px-2 py-1 rounded-lg"
                        style={{ background: 'hsl(var(--background))' }}>
                        {s}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Personality profile */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Personality Profile</p>
            {personalityTraits ? (
              <div className="rounded-2xl p-4 space-y-2.5"
                style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                {personalityTraits.map(t => (
                  <PersonalityBar key={t.label} label={t.label} value={t.value} color={t.color} />
                ))}
                {profile?.backstory && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Backstory</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{profile.backstory}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
                    <path d="M12 16v-4m0-4h.01"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">No AI profile yet</p>
                  <p className="text-[11px] text-muted-foreground">Use the AI Characters analysis to generate personality data for this character.</p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Notes</p>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Character notes, agent info, casting ideas…"
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-xs text-foreground outline-none focus:border-violet-400/60 transition-colors placeholder:text-muted-foreground leading-relaxed"
            />
            <button onClick={handleSave}
              className="mt-2 rounded-xl px-4 py-1.5 text-xs font-medium transition-all"
              style={{ background: saved ? 'rgba(52,211,153,0.15)' : 'rgba(124,58,237,0.12)', color: saved ? '#34d399' : '#a78bfa', border: `1px solid ${saved ? 'rgba(52,211,153,0.3)' : 'rgba(124,58,237,0.25)'}` }}>
              {saved ? '✓ Saved' : 'Save notes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Rich character card ───────────────────────────────────────────────────────

function CharacterCard({
  member, stat, profile, onClick, onEdit,
}: {
  member: CastMember;
  stat?: CharStat;
  profile?: CharacterProfile;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
}) {
  const color = avatarColor(member.fullName || '?');
  const archetype = getArchetype(stat?.pct ?? 0, profile);
  const archetypeColors: Record<string, string> = {
    lead: '#a78bfa', supporting: '#60a5fa', antagonist: '#f87171', mentor: '#34d399', minor: '#94a3b8',
  };
  const archetypeColor = archetypeColors[archetype] ?? '#94a3b8';

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl border border-border p-4 cursor-pointer transition-all duration-200 overflow-hidden"
      style={{ background: 'hsl(var(--card))' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.transform = ''; }}>

      {/* Subtle color accent stripe at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${archetypeColor}, transparent)` }} />

      {/* Edit button */}
      <button
        onClick={onEdit}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10"
        title="Edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: color }}>
          {initials(member.fullName || '?')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground text-sm truncate pr-6">
            {member.fullName || <span className="text-muted-foreground italic">Unnamed</span>}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
              style={{ background: archetypeColor + '18', color: archetypeColor }}>
              {archetype}
            </span>
            {member.department && (
              <span className="text-[10px] text-muted-foreground">{member.department}</span>
            )}
          </div>
        </div>
      </div>

      {/* Script stats (only for cast with script data) */}
      {stat ? (
        <>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { value: stat.dialogueLines, label: 'lines',  color: archetypeColor },
              { value: stat.scenes.size,   label: 'scenes', color: '#60a5fa' },
              { value: `${stat.pct}%`,     label: 'voice',  color: '#34d399' },
            ].map(s => (
              <div key={s.label} className="rounded-xl py-2 text-center"
                style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Dialogue bar */}
          <div className="h-1 rounded-full overflow-hidden mb-2" style={{ background: 'hsl(var(--border))' }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(stat.pct, 100)}%`, background: archetypeColor }} />
          </div>
        </>
      ) : (
        <div className="mb-3">
          {member.rate != null && member.rate > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground) / 0.8)' }}>
              ${member.rate.toLocaleString()}/day
            </span>
          )}
          {member.availability && (
            <span className="text-[10px] px-2 py-0.5 rounded-full ml-1"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}>
              {member.availability}
            </span>
          )}
        </div>
      )}

      {/* Personality mini preview */}
      {profile && (
        <div className="flex gap-1 mb-2">
          {[
            { label: 'O', value: profile.personality.openness, color: '#a78bfa' },
            { label: 'E', value: profile.personality.extraversion, color: '#34d399' },
            { label: 'C', value: profile.personality.courage, color: '#fb923c' },
            { label: 'H', value: profile.personality.honesty, color: '#4ade80' },
          ].map(t => (
            <div key={t.label} className="flex-1">
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                <div className="h-full rounded-full" style={{ width: `${(t.value / 10) * 100}%`, background: t.color }} />
              </div>
              <p className="text-[8px] text-muted-foreground text-center mt-0.5">{t.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tags */}
      {(member.tags ?? []).length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {(member.tags ?? []).slice(0, 3).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.10)', color: '#a78bfa' }}>{t}</span>
          ))}
          {(member.tags ?? []).length > 3 && (
            <span className="text-[9px] text-muted-foreground">+{(member.tags ?? []).length - 3}</span>
          )}
        </div>
      )}

      {/* Click hint */}
      <p className="text-[9px] text-muted-foreground/40 mt-2 text-right">Click for profile ›</p>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function CastCrewView({ members, onChange, nodes, aiCharacters }: Props) {
  const [filter, setFilter] = useState<'all' | CastMember['category']>('all');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CastMember>>({});
  const [tagInput, setTagInput] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const charStats = useMemo(() => nodes ? computeCharStats(nodes) : {}, [nodes]);

  const filtered = members
    .filter(m => {
      if (filter !== 'all' && m.category !== filter) return false;
      if (search && !m.fullName.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const aLines = charStats[a.fullName.toUpperCase().trim()]?.dialogueLines ?? -1;
      const bLines = charStats[b.fullName.toUpperCase().trim()]?.dialogueLines ?? -1;
      return bLines - aLines;
    });

  const castCount = members.filter(m => m.category === 'cast').length;
  const crewCount = members.filter(m => m.category === 'crew').length;
  const vendorCount = members.filter(m => m.category === 'vendor').length;

  function add() {
    const id = makeId();
    const m: CastMember = { id, category: filter === 'all' ? 'cast' : filter, fullName: '', tags: [], comments: '', department: '', availability: '' };
    onChange([...members, m]);
    setEditId(id); setDraft(m); setTagInput('');
  }

  function autoPopulate() {
    if (!nodes) return;
    const names = getCharacterNames(nodes);
    const existing = new Set(members.map(m => m.fullName.toUpperCase().trim()));
    const toAdd: CastMember[] = names
      .filter(n => !existing.has(n.toUpperCase()))
      .map(n => ({ id: makeId(), category: 'cast' as const, fullName: n, tags: [], comments: '', department: 'Acting', availability: '' }));
    if (toAdd.length === 0) { alert('All characters are already in the cast list.'); return; }
    onChange([...members, ...toAdd]);
  }

  function save(id: string) {
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const merged = { ...draft, tags: tags.length ? tags : (draft.tags ?? []) };
    onChange(members.map(m => m.id === id ? { ...m, ...merged } as CastMember : m));
    setEditId(null); setDraft({}); setTagInput('');
  }

  function del(id: string) {
    onChange(members.filter(m => m.id !== id));
    setEditId(null); setDetailId(null);
  }

  function saveComments(id: string, comments: string) {
    onChange(members.map(m => m.id === id ? { ...m, comments } : m));
  }

  function exportCSV() {
    const header = 'Name,Category,Department,Availability,Rate ($/day),Tags,Comments';
    const rows = members.map(m =>
      `"${m.fullName}","${m.category}","${m.department}","${m.availability}","${m.rate ?? ''}","${(m.tags ?? []).join('; ')}","${m.comments}"`
    ).join('\n');
    const blob = new Blob([header + '\n' + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cast-crew.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const detailMember = detailId ? members.find(m => m.id === detailId) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background font-geist">

      {/* Summary stats */}
      <div className="flex gap-4 px-6 py-4 border-b border-border" style={{ background: 'hsl(var(--card))' }}>
        {[
          { label: 'Cast', count: castCount, color: '#7c3aed' },
          { label: 'Crew', count: crewCount, color: '#3b82f6' },
          { label: 'Vendors', count: vendorCount, color: '#f59e0b' },
          { label: 'Total', count: members.length, color: 'hsl(var(--foreground))' },
        ].map(s => (
          <div key={s.label} className="flex-1 text-center">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter + search + actions */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-wrap">
        <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'hsl(var(--secondary))' }}>
          <button onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'text-foreground bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            All
          </button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === c.id ? 'text-foreground bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              {c.label}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="flex-1 min-w-0 rounded-xl border border-border bg-foreground/5 px-3 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-400/70 transition-colors" />
        {members.length > 0 && (
          <button onClick={exportCSV}
            className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors shrink-0">
            CSV
          </button>
        )}
        {nodes && nodes.some(n => n.type === 'character') && (
          <button onClick={autoPopulate}
            className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all shrink-0"
            style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.2)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--primary) / 0.2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--primary) / 0.1)'; }}>
            ✦ Auto-populate
          </button>
        )}
        <button onClick={add}
          className="rounded-xl px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shrink-0">
          + Add
        </button>
      </div>

      {/* Cards grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'hsl(var(--secondary))' }}>🎬</div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">No members yet</p>
              <p className="text-xs text-muted-foreground">Add cast and crew, or auto-populate from your script</p>
            </div>
            <button onClick={add}
              className="rounded-2xl px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
              + Add Entry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(m => {
              if (editId === m.id) {
                return (
                  <div key={m.id}
                    className="rounded-2xl border border-violet-400/40 p-4 space-y-3 sm:col-span-2 lg:col-span-3"
                    style={{ background: 'hsl(var(--card))' }}>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {m.fullName ? `Editing: ${m.fullName}` : 'New Member'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="text-[10px] text-muted-foreground block mb-1">Full Name</label>
                        <input autoFocus value={draft.fullName ?? ''}
                          onChange={e => setDraft(d => ({ ...d, fullName: e.target.value }))}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Category</label>
                        <select value={draft.category ?? 'cast'}
                          onChange={e => setDraft(d => ({ ...d, category: e.target.value as CastMember['category'] }))}
                          className={selectClass}>
                          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Department</label>
                        <select value={draft.department ?? ''}
                          onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
                          className={selectClass}>
                          <option value="">—</option>
                          {DEPARTMENTS.map(dep => <option key={dep}>{dep}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Availability</label>
                        <input value={draft.availability ?? ''}
                          onChange={e => setDraft(d => ({ ...d, availability: e.target.value }))}
                          placeholder="e.g. Mar–Jun 2025" className={inputClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Rate ($/day)</label>
                        <input type="number" min="0" value={draft.rate ?? ''}
                          onChange={e => setDraft(d => ({ ...d, rate: e.target.value ? Number(e.target.value) : undefined }))}
                          placeholder="0" className={inputClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Tags (comma-separated)</label>
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                          placeholder="lead, union, available…" className={inputClass} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground block mb-1">Bio / Comments</label>
                        <textarea value={draft.comments ?? ''}
                          onChange={e => setDraft(d => ({ ...d, comments: e.target.value }))}
                          rows={2}
                          className="w-full resize-none rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground"
                          placeholder="Role description, notes, agent info…" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => save(m.id)}
                        className="flex-1 rounded-xl py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                        Save
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="px-3 rounded-xl py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border transition-colors">
                        Cancel
                      </button>
                      <button onClick={() => del(m.id)}
                        className="px-3 rounded-xl py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }

              const stat = charStats[m.fullName.toUpperCase().trim()];
              const profile = aiCharacters?.[m.fullName] ?? aiCharacters?.[m.fullName.toUpperCase()];

              return (
                <CharacterCard
                  key={m.id}
                  member={m}
                  stat={stat}
                  profile={profile}
                  onClick={() => setDetailId(m.id)}
                  onEdit={e => { e.stopPropagation(); setEditId(m.id); setDraft(m); setTagInput((m.tags ?? []).join(', ')); }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailMember && (
        <CharacterModal
          member={detailMember}
          stat={charStats[detailMember.fullName.toUpperCase().trim()]}
          profile={aiCharacters?.[detailMember.fullName] ?? aiCharacters?.[detailMember.fullName.toUpperCase()]}
          onClose={() => setDetailId(null)}
          onEdit={() => { setDetailId(null); setEditId(detailMember.id); setDraft(detailMember); setTagInput((detailMember.tags ?? []).join(', ')); }}
          onSaveComments={comments => saveComments(detailMember.id, comments)}
        />
      )}
    </div>
  );
}
