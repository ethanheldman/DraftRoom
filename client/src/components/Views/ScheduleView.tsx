import { useState } from 'react';
import type { ScriptNode } from '../../types/screenplay';
import { getSceneHeadings } from '../../utils/storage';

interface Strip {
  sceneIndex: number;
  heading: string;
  dayNight: 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';
  intExt: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  pages: number;
  shootDays: number;
  cast: string;
}

interface Props {
  nodes: ScriptNode[];
  onSceneClick?: (sceneIndex: number) => void;
}

// Try to infer time-of-day from an "HH:MM AM/PM" or "HH:MM" stamp in the
// heading. Returns null if no recognisable time string is found.
function dayNightFromClockTime(h: string): Strip['dayNight'] | null {
  // Match "2:47 AM", "14:05", "11:30 PM", "7:00am", etc.
  const m = h.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?\b/);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const mer = m[3]?.toUpperCase();
  if (mer === 'PM' && hour < 12) hour += 12;
  if (mer === 'AM' && hour === 12) hour = 0;
  if (hour >= 5 && hour < 7)  return 'DAWN';
  if (hour >= 7 && hour < 18) return 'DAY';
  if (hour >= 18 && hour < 20) return 'DUSK';
  return 'NIGHT';
}

function parseHeading(h: string): Pick<Strip, 'intExt' | 'location' | 'dayNight'> {
  const upper = h.toUpperCase();
  const intExt: Strip['intExt'] = upper.startsWith('INT/EXT') || upper.startsWith('I/E')
    ? 'INT/EXT' : upper.startsWith('EXT') ? 'EXT' : 'INT';
  // Explicit keyword wins. Then try the clock time ("- 2:47 AM" → NIGHT).
  // Only fall back to DAY if nothing else tells us otherwise.
  const keyword: Strip['dayNight'] | null =
    upper.includes('NIGHT') ? 'NIGHT' :
    upper.includes('DAWN')  ? 'DAWN'  :
    upper.includes('DUSK')  ? 'DUSK'  :
    upper.includes(' DAY')  || upper.endsWith('- DAY') ? 'DAY' : null;
  const dayNight: Strip['dayNight'] = keyword ?? dayNightFromClockTime(h) ?? 'DAY';
  const dashIdx = h.indexOf(' - ');
  const location = dashIdx >= 0 ? h.slice(h.indexOf('.') + 1, dashIdx).trim() : h;
  return { intExt, location, dayNight };
}

const DN_COLORS: Record<Strip['dayNight'], string> = {
  DAY: '#f59e0b', NIGHT: '#3b82f6', DAWN: '#ec4899', DUSK: '#f97316',
};

type FilterIE = 'ALL' | 'INT' | 'EXT' | 'INT/EXT';
type FilterDN = 'ALL' | 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK';

export default function ScheduleView({ nodes, onSceneClick }: Props) {
  const headings = getSceneHeadings(nodes);
  const [strips, setStrips] = useState<Strip[]>(() =>
    headings.map((h, i) => ({ sceneIndex: i, heading: h, pages: 1, shootDays: 0.125, cast: '', ...parseHeading(h) }))
  );
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [filterIE, setFilterIE] = useState<FilterIE>('ALL');
  const [filterDN, setFilterDN] = useState<FilterDN>('ALL');
  const [groupByLocation, setGroupByLocation] = useState(false);

  const totalDays = strips.reduce((s, st) => s + st.shootDays, 0);

  function updateStrip(idx: number, patch: Partial<Strip>) {
    setStrips(s => s.map((st, i) => i === idx ? { ...st, ...patch } : st));
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...strips];
    const [removed] = next.splice(dragIdx, 1);
    next.splice(idx, 0, removed);
    setStrips(next);
    setDragIdx(null); setDragOverIdx(null);
  }

  function optimizeSchedule() {
    const sorted = [...strips].sort((a, b) => {
      const locCmp = a.location.localeCompare(b.location);
      if (locCmp !== 0) return locCmp;
      const ieCmp = a.intExt.localeCompare(b.intExt);
      if (ieCmp !== 0) return ieCmp;
      return a.dayNight.localeCompare(b.dayNight);
    });
    setStrips(sorted);
    setGroupByLocation(true);
  }

  // Filter strips
  const filtered = strips.filter(s => {
    if (filterIE !== 'ALL' && s.intExt !== filterIE) return false;
    if (filterDN !== 'ALL' && s.dayNight !== filterDN) return false;
    return true;
  });

  // Optionally group by location (insert section headers)
  const grouped = groupByLocation
    ? [...filtered].sort((a, b) => a.location.localeCompare(b.location))
    : filtered;

  const filterBtnClass = (active: boolean) =>
    `px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${active ? 'bg-violet-600 text-white' : 'text-muted-foreground border border-border hover:bg-secondary'}`;

  if (headings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm font-medium text-foreground/80">No scenes to schedule</p>
          <p className="text-xs mt-1">Add scene headings to your script to build a schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background font-geist">
      {/* Header + filters */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Schedule</span>
          <span className="text-xs text-muted-foreground">{grouped.length}/{strips.length} scenes</span>
          <span className="text-xs text-muted-foreground ml-auto">
            <span className="text-foreground font-medium">{totalDays.toFixed(2)}</span> shoot days
          </span>
        </div>

        {/* Filter row. Labelled groups replace the two identical "ALL" buttons
            that used to sit next to each other with no indication of what they
            controlled. "Any" reads as neutral-default; the group label tells
            the user which axis they're filtering on. */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Scene type</span>
          {(['ALL', 'INT', 'EXT', 'INT/EXT'] as FilterIE[]).map(f => (
            <button key={f} onClick={() => setFilterIE(f)} className={filterBtnClass(filterIE === f)}>
              {f === 'ALL' ? 'Any' : f}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Time</span>
          {(['ALL', 'DAY', 'NIGHT', 'DAWN', 'DUSK'] as FilterDN[]).map(f => (
            <button key={f} onClick={() => setFilterDN(f)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${filterDN === f ? 'text-white' : 'text-muted-foreground border border-border hover:bg-secondary'}`}
              style={filterDN === f ? { background: f === 'ALL' ? 'hsl(var(--primary))' : DN_COLORS[f as Strip['dayNight']] } : {}}>
              {f === 'ALL' ? 'Any' : f}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={() => setGroupByLocation(g => !g)}
            className={filterBtnClass(groupByLocation)}
          >
            Group by Location
          </button>
          <button
            onClick={optimizeSchedule}
            className="px-2 py-1 rounded-lg text-[10px] font-medium border border-violet-500/40 text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            ⚡ Optimize
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Column headers */}
        <div className="flex items-center gap-1 px-4 py-1.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider sticky top-0 z-10 bg-background">
          <div className="w-6" />
          <div className="w-8">Scene</div>
          <div className="w-16">Type</div>
          <div className="flex-1">Location</div>
          <div className="w-20">Cast</div>
          <div className="w-16 text-center">Pages</div>
          <div className="w-20 text-center">Days</div>
        </div>

        {(() => {
          if (grouped.length === 0) {
            return (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                No scenes match the current filter.
              </div>
            );
          }
          let lastLocation = '';
          return grouped.map((strip, idx) => {
            const showLocationHeader = groupByLocation && strip.location !== lastLocation;
            if (groupByLocation) lastLocation = strip.location;
            const originalIdx = strips.indexOf(strip);
            return (
              <div key={strip.sceneIndex}>
                {showLocationHeader && (
                  <div className="px-4 py-1.5 bg-secondary/40 border-b border-border text-[10px] font-semibold text-foreground/70 uppercase tracking-wider sticky top-8 z-10">
                    📍 {strip.location}
                  </div>
                )}
                <div
                  draggable
                  onDragStart={() => handleDragStart(originalIdx)}
                  onDragOver={e => handleDragOver(e, originalIdx)}
                  onDrop={() => handleDrop(originalIdx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  className={`flex items-center gap-1 px-4 py-2 border-b border-border/50 cursor-grab active:cursor-grabbing transition-colors
                    ${dragOverIdx === originalIdx ? 'bg-violet-500/10' : 'hover:bg-secondary/30'}`}
                  style={{ borderLeft: `3px solid ${DN_COLORS[strip.dayNight]}` }}
                >
                  <div className="w-6 text-muted-foreground/40 text-center text-xs select-none">⋮⋮</div>
                  <div className="w-8 text-violet-400 text-xs font-mono">{strip.sceneIndex + 1}</div>
                  <div className="w-16">
                    <span className="text-[10px] text-muted-foreground">{strip.intExt}</span>
                    <span className="ml-1 text-[9px] px-1 rounded font-bold" style={{ background: DN_COLORS[strip.dayNight] + '33', color: DN_COLORS[strip.dayNight] }}>
                      {strip.dayNight}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {onSceneClick ? (
                      <button
                        onClick={() => onSceneClick(strip.sceneIndex)}
                        className="text-xs text-foreground/80 truncate max-w-full text-left hover:text-violet-400 transition-colors"
                        title={`Open in script: ${strip.heading}`}>
                        {strip.location}
                      </button>
                    ) : (
                      <span className="text-xs text-foreground/80 truncate">{strip.location}</span>
                    )}
                  </div>
                  <input
                    value={strip.cast}
                    onChange={e => updateStrip(originalIdx, { cast: e.target.value })}
                    placeholder="Cast…"
                    className="w-20 rounded-lg border border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground outline-none focus:border-violet-400/70 transition-colors"
                  />
                  <input
                    type="number" min="0.125" step="0.125" value={strip.pages}
                    onChange={e => updateStrip(originalIdx, { pages: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground outline-none focus:border-violet-400/70 transition-colors text-center"
                  />
                  <input
                    type="number" min="0.125" step="0.125" value={strip.shootDays}
                    onChange={e => updateStrip(originalIdx, { shootDays: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-border bg-transparent px-1.5 py-0.5 text-[10px] text-muted-foreground outline-none focus:border-violet-400/70 transition-colors text-center"
                  />
                </div>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
