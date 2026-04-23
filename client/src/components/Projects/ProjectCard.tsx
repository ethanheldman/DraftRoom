import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreHorizontalIcon, FolderOpenIcon, CopyIcon, ArchiveIcon, Trash2Icon,
  PencilIcon, TagIcon, AlignLeftIcon, ChevronLeftIcon, CheckIcon,
} from 'lucide-react';
import type { Project, ScriptNode } from '../../types/screenplay';
import { loadScript, estimatePageCount, countWords, loadVersionTimestamps } from '../../utils/storage';

const GENRES = ['Drama', 'Comedy', 'Thriller', 'Sci-Fi', 'Horror', 'Action', 'Romance', 'Animation', 'Documentary', 'Other'];

interface Props {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onArchive?: () => void;
  onDuplicate?: () => void;
  onRename?: () => void;
  onSetGenre?: (genre: string | undefined) => void;
  onSetLogline?: (logline: string) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Project cards re-tint with the user's chosen app theme instead of living in
// a fixed amber palette. Previously genre distinction was encoded as subtle
// shifts of `#c17f24`, which meant the Welcome card on a Forest/Ocean/Dracula
// theme still read as amber — breaking the visual consistency of everything
// else in the dashboard (Create button, sidebar active state, wordmark).
// Genre name is still shown in the pill text; genre colour is intentionally
// removed so the card always matches the active theme.
function getAccent(_genre?: string): string {
  return 'hsl(var(--primary))';
}

/** SVG donut progress ring */
function ProgressRing({
  pct, color, size = 48, stroke = 4, label, sublabel,
}: {
  pct: number; color: string; size?: number; stroke?: number; label: string; sublabel: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--border))" strokeWidth={stroke} />
        {/* Progress */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      {/* Centre label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[9px] font-bold" style={{ color }}>{label}</span>
        <span className="text-[7px] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{sublabel}</span>
      </div>
    </div>
  );
}

/** Tiny 7-bar sparkline */
function Sparkline({ counts, color }: { counts: number[]; color: string }) {
  const max = Math.max(...counts, 1);
  const today = new Date();
  const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 32 }}>
      {counts.map((c, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const dayLabel = DAY[d.getDay()];
        // Zero-count days used to render as a 2px nub that looked like a
        // broken divider. Give them a consistent ~5px muted bar so the axis
        // reads as a real chart, not a stray row of dashes.
        const barH = c === 0 ? 5 : Math.max(7, Math.round((c / max) * 24));
        return (
          <div key={i} className="flex flex-col items-center gap-[2px]" title={c === 0 ? `No saves on ${dayLabel}` : `${c} save${c !== 1 ? 's' : ''}`}>
            <div
              style={{
                width: 7,
                height: barH,
                borderRadius: 2,
                background: c > 0 ? color : 'hsl(var(--border))',
                opacity: c > 0 ? 0.55 + (c / max) * 0.45 : 0.5,
                transition: 'height 0.4s ease',
              }}
            />
            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground) / 0.6)', lineHeight: 1 }}>{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Get the last interesting line from the script to show as a teaser */
function getLastLine(nodes: ScriptNode[]): string {
  const interesting = ['action', 'dialogue', 'scene_heading'];
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (interesting.includes(n.type) && n.content.trim().length > 3) {
      return n.content.trim().slice(0, 90);
    }
  }
  return '';
}

/** Build 7-day save counts from version timestamps + updatedAt */
function buildSparkline(timestamps: string[], updatedAt: string): number[] {
  const counts = new Array(7).fill(0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const allTs = [...timestamps, updatedAt];
  allTs.forEach(ts => {
    const d = new Date(ts);
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86400000);
    const idx = 6 - daysAgo;
    if (idx >= 0 && idx < 7) counts[idx]++;
  });
  return counts;
}

/** Ring color based on progress */
function ringColor(pct: number): string {
  if (pct >= 100) return '#f59e0b'; // gold — done
  if (pct >= 75)  return '#10b981'; // green
  if (pct >= 40)  return '#3b82f6'; // blue
  if (pct >= 15)  return '#f97316'; // orange
  return '#6b7280';                  // gray — just started
}

type MenuPage = 'main' | 'genre' | 'logline';

export default function ProjectCard({ project, onOpen, onDelete, onArchive, onDuplicate, onRename, onSetGenre, onSetLogline }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPage, setMenuPage] = useState<MenuPage>('main');
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [loglineDraft, setLoglineDraft] = useState(project.logline ?? '');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const loglineRef = useRef<HTMLTextAreaElement>(null);

  const [cardData] = useState(() => {
    try {
      const script = loadScript(project.id);
      const words = countWords(script);
      const pages = estimatePageCount(script);
      const lastLine = getLastLine(script);
      const timestamps = loadVersionTimestamps(project.id);
      const sparkCounts = buildSparkline(timestamps, project.updatedAt);
      const goal = project.settings?.pageGoal ?? 120;
      const pct = goal > 0 ? Math.min(100, Math.round((pages / goal) * 100)) : 0;
      return { words, pages, lastLine, sparkCounts, pct, goal };
    } catch {
      return { words: 0, pages: 0, lastLine: '', sparkCounts: new Array(7).fill(0), pct: 0, goal: 120 };
    }
  });

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) { setShowMenu(false); setMenuPage('main'); }
    }
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = () => { setShowMenu(false); setMenuPage('main'); };
    window.addEventListener('scroll', handler, true);
    return () => window.removeEventListener('scroll', handler, true);
  }, [showMenu]);

  useEffect(() => {
    if (menuPage === 'logline') {
      setLoglineDraft(project.logline ?? '');
      setTimeout(() => loglineRef.current?.focus(), 30);
    }
  }, [menuPage, project.logline]);

  function openMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (showMenu) { setShowMenu(false); setMenuPage('main'); return; }
    const rect = triggerRef.current!.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuPage('main');
    setShowMenu(true);
  }

  function closeMenu() { setShowMenu(false); setMenuPage('main'); }

  const accent = getAccent(project.genre);
  const menuWidth = menuPage === 'logline' ? 220 : menuPage === 'genre' ? 200 : 180;

  const dropdown = showMenu ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -8 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="fixed z-[9999] rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 backdrop-blur-2xl bg-popover/80"
        style={{ top: menuPos.top, right: menuPos.right, width: menuWidth }}
      >
        {menuPage === 'main' && (
        <div className="py-1">
          {[
            { icon: FolderOpenIcon, label: 'Open', action: () => { onOpen(); closeMenu(); } },
            ...(onRename   ? [{ icon: PencilIcon,  label: 'Rename',    action: () => { onRename!();   closeMenu(); } }] : []),
            ...(onDuplicate ? [{ icon: CopyIcon,   label: 'Duplicate', action: () => { onDuplicate!(); closeMenu(); } }] : []),
            ...(onArchive   ? [{ icon: ArchiveIcon, label: project.archived ? 'Unarchive' : 'Archive', action: () => { onArchive!(); closeMenu(); } }] : []),
          ].map(({ icon: Icon, label, action }) => (
            <MenuRow key={label} Icon={Icon} label={label} onClick={action} />
          ))}
          <div className="my-1 mx-2 h-px" style={{ background: 'hsl(var(--border))' }} />
          {onSetGenre && <MenuRow Icon={TagIcon} label={project.genre ? `Genre: ${project.genre}` : 'Set Genre'} onClick={() => setMenuPage('genre')} chevron />}
          {onSetLogline && <MenuRow Icon={AlignLeftIcon} label={project.logline ? 'Edit Logline' : 'Add Logline'} onClick={() => setMenuPage('logline')} chevron />}
          <div className="my-1 mx-2 h-px" style={{ background: 'hsl(var(--border))' }} />
          <button onClick={() => { onDelete(); closeMenu(); }}
            className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs transition-colors"
            style={{ color: 'hsl(var(--destructive))' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--destructive) / 0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
            <Trash2Icon size={13} /> Move to Trash
          </button>
        </div>
      )}

      {menuPage === 'genre' && (
        <div className="p-2">
          <button onClick={() => setMenuPage('main')} className="flex items-center gap-1 text-[11px] mb-2 px-1 transition-colors" style={{ color: 'hsl(var(--muted-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--foreground))')}
            onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}>
            <ChevronLeftIcon size={12} /> Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Select Genre</p>
          <div className="flex flex-wrap gap-1">
            {GENRES.map(g => {
              const isActive = project.genre === g;
              return (
                <button key={g} onClick={() => { onSetGenre?.(isActive ? undefined : g); closeMenu(); }}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: isActive ? 'hsl(var(--primary) / 0.18)' : 'hsl(var(--secondary))',
                    color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.7)',
                    border: `1px solid ${isActive ? 'hsl(var(--primary) / 0.4)' : 'transparent'}`,
                  }}>
                  {isActive && <CheckIcon size={9} className="inline mr-1" />}{g}
                </button>
              );
            })}
          </div>
          {project.genre && (
            <button onClick={() => { onSetGenre?.(undefined); closeMenu(); }}
              className="w-full mt-2 text-[11px] text-center py-1 rounded-lg transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--foreground))')}
              onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}>
              Clear genre
            </button>
          )}
        </div>
      )}

      {menuPage === 'logline' && (
        <div className="p-3">
          <button onClick={() => setMenuPage('main')} className="flex items-center gap-1 text-[11px] mb-2 transition-colors" style={{ color: 'hsl(var(--muted-foreground))' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--foreground))')}
            onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}>
            <ChevronLeftIcon size={12} /> Back
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Logline</p>
          <textarea ref={loglineRef} value={loglineDraft} onChange={e => setLoglineDraft(e.target.value)}
            placeholder="When a [protagonist] must [goal], they discover [conflict]…"
            rows={3} className="w-full rounded-lg px-2.5 py-2 text-[11px] resize-none outline-none"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { onSetLogline?.(loglineDraft.trim()); closeMenu(); } }}
          />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { onSetLogline?.(loglineDraft.trim()); closeMenu(); }}
              className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'hsl(var(--primary))' }}>Save</button>
            <button onClick={() => setMenuPage('main')}
              className="px-3 py-1.5 rounded-lg text-[11px] transition-colors"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>Cancel</button>
          </div>
        </div>
      )}
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <>
      <motion.div
        layoutId={`project-card-${project.id}`}
        whileHover={{ y: -6, scale: 1.015 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="group relative overflow-hidden cursor-pointer flex flex-col"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        onClick={onOpen}
      >
        {/*
          Accent strip. Gradient is expressed in `hsl()` + fractional alpha so
          it plays nicely with the themed primary colour (the old `${accent}44`
          hex-alpha concatenation trick only worked when accent was a hex literal).
        */}
        <div
          className="h-[3px] w-full flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.25), transparent)' }}
        />

        {/* Main body */}
        <div className="relative z-10 px-5 pb-5 pt-4 flex flex-col flex-1">

          {/* Header row: title + menu */}
          <div className="flex items-start gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-foreground text-base leading-tight truncate pr-1" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }} title={project.title}>
                {project.title}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}
                >
                  {project.genre || 'Film & TV'}
                </span>
              </div>
            </div>

            <button
              ref={triggerRef}
              onClick={openMenu}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all shrink-0 -mr-1"
              aria-label={`More actions for ${project.title}`}
              style={{ color: 'hsl(var(--muted-foreground))' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))'; }}
            >
              <MoreHorizontalIcon size={15} />
            </button>
          </div>

          {/* Last-line teaser */}
          {cardData.lastLine && (
            <div className="mb-3 px-2.5 py-2 rounded-lg" style={{ background: 'hsl(var(--background) / 0.6)', borderLeft: '2px solid hsl(var(--primary) / 0.35)' }}>
              <p className="text-[10.5px] italic leading-relaxed line-clamp-2"
                style={{ color: 'hsl(var(--muted-foreground) / 0.85)' }}>
                "{cardData.lastLine}{cardData.lastLine.length >= 90 ? '…' : ''}"
              </p>
            </div>
          )}

          {/* Logline fallback if no last line */}
          {!cardData.lastLine && project.logline && (
            <p className="text-[11px] leading-relaxed mb-3 line-clamp-2 italic"
              style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
              {project.logline}
            </p>
          )}

          {/* Sparkline */}
          <div className="mt-auto">
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-[9px] font-medium" style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>
                7-day activity
              </span>
              <span className="text-[9px]" style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>
                {cardData.words.toLocaleString()} words
              </span>
            </div>
            <Sparkline counts={cardData.sparkCounts} color={accent} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
            <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground) / 0.6)' }}>
              {formatDate(project.updatedAt)}
            </span>
          </div>
        </div>

        {/* Archived badge */}
        {project.archived && (
          <div className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase"
            style={{ background: 'hsl(var(--secondary)/0.8)', color: 'hsl(var(--muted-foreground))', backdropFilter: 'blur(8px)' }}>
            archived
          </div>
        )}
      </motion.div>

      {dropdown}
    </>
  );
}

function MenuRow({ Icon, label, onClick, chevron }: { Icon: React.ElementType; label: string; onClick: () => void; chevron?: boolean }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs transition-colors"
      style={{ color: 'hsl(var(--foreground) / 0.8)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground) / 0.8)'; }}>
      <Icon size={13} />
      <span className="flex-1">{label}</span>
      {chevron && <span style={{ color: 'hsl(var(--muted-foreground)', fontSize: 10 }}>›</span>}
    </button>
  );
}
