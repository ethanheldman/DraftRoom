import { useState } from 'react';
import { DollarSignIcon } from 'lucide-react';
import type { BudgetLine } from '../../types/screenplay';
import { makeId } from '../../utils/ids';

interface Props {
  budget: BudgetLine[];
  onChange: (lines: BudgetLine[]) => void;
}

const DEFAULT_DEPARTMENTS = [
  'Above the Line', 'Camera', 'Art Direction', 'Costume', 'Makeup & Hair',
  'Sound', 'Lighting', 'Editing', 'VFX', 'Music', 'Post Production', 'Insurance', 'Other',
];

const DEPT_ICONS: Record<string, string> = {
  'Above the Line': '🎬', 'Camera': '📷', 'Art Direction': '🎨', 'Costume': '👗',
  'Makeup & Hair': '💄', 'Sound': '🎙️', 'Lighting': '💡', 'Editing': '✂️',
  'VFX': '✨', 'Music': '🎵', 'Post Production': '🖥️', 'Insurance': '🛡️', 'Other': '📋',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function pct(actual: number, estimated: number) {
  if (!estimated) return 0;
  return Math.min((actual / estimated) * 100, 100);
}

function varianceColor(v: number) {
  if (v > 0) return { text: 'text-red-400', bg: 'bg-red-500/10', bar: '#ef4444' };
  if (v < 0) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', bar: '#22c55e' };
  return { text: 'text-muted-foreground', bg: 'bg-secondary', bar: '#6b7280' };
}

function barColor(actual: number, estimated: number) {
  const ratio = estimated ? actual / estimated : 0;
  if (ratio > 1) return '#ef4444';
  if (ratio > 0.9) return '#f59e0b';
  return '#7c3aed';
}

const inputClass = "w-full rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-400/70 transition-colors";
const selectClass = "w-full rounded-xl border border-border bg-secondary text-foreground px-3 py-1.5 text-xs outline-none focus:border-violet-400/70 transition-colors";

export default function BudgetView({ budget, onChange }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<BudgetLine>>({});

  const totalEstimated = budget.reduce((s, l) => s + (l.estimated || 0), 0);
  const totalActual = budget.reduce((s, l) => s + (l.actual || 0), 0);
  const variance = totalActual - totalEstimated;
  const overallPct = pct(totalActual, totalEstimated);
  const vc = varianceColor(variance);

  function add() {
    const id = makeId();
    const line: BudgetLine = { id, department: 'Other', estimated: 0, actual: 0, notes: '' };
    onChange([...budget, line]);
    setEditId(id);
    setDraft(line);
  }

  function save(id: string) {
    onChange(budget.map(l => l.id === id ? { ...l, ...draft } as BudgetLine : l));
    setEditId(null); setDraft({});
  }

  function del(id: string) {
    onChange(budget.filter(l => l.id !== id));
    if (editId === id) setEditId(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background font-geist">

      {/* ── Hero summary bar ──────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-border" style={{ background: 'hsl(var(--card))' }}>
        <div className="flex items-end justify-between gap-6 mb-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Total Budget</p>
            <p className="text-3xl font-bold text-foreground tracking-tight">{fmt(totalEstimated)}</p>
          </div>
          <div className="flex gap-6">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Spent</p>
              <p className="text-xl font-semibold text-foreground">{fmt(totalActual)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Variance</p>
              <p className={`text-xl font-bold ${vc.text}`}>{variance > 0 ? '+' : ''}{fmt(variance)}</p>
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Budget utilization</span>
            <span>{overallPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%`, background: barColor(totalActual, totalEstimated) }}
            />
          </div>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <p className="text-xs text-muted-foreground">{budget.length} department{budget.length !== 1 ? 's' : ''}</p>
        <button
          onClick={add}
          className="rounded-2xl px-4 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
        >
          + Add Department
        </button>
      </div>

      {/* ── Department cards ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {budget.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}>
              <DollarSignIcon size={26} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">No budget lines yet</p>
              <p className="text-xs text-muted-foreground">Add departments to track your production budget</p>
            </div>
            <button onClick={add}
              className="rounded-2xl px-5 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
              + Add First Department
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {budget.map(line => {
              const v = line.actual - line.estimated;
              const vc2 = varianceColor(v);
              const usedPct = pct(line.actual, line.estimated);
              const icon = DEPT_ICONS[line.department] ?? '📋';
              const bc = barColor(line.actual, line.estimated);

              if (editId === line.id) {
                return (
                  <div key={line.id}
                    className="rounded-2xl border border-violet-400/40 p-4 space-y-3"
                    style={{ background: 'hsl(var(--card))' }}>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Edit Department</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground block mb-1">Department</label>
                        <select value={draft.department ?? ''} onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
                          className={selectClass}>
                          {DEFAULT_DEPARTMENTS.map(dep => <option key={dep}>{dep}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Estimated ($)</label>
                        <input type="number" value={draft.estimated ?? 0}
                          onChange={e => setDraft(d => ({ ...d, estimated: Number(e.target.value) }))}
                          className={inputClass} />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-1">Actual ($)</label>
                        <input type="number" value={draft.actual ?? 0}
                          onChange={e => setDraft(d => ({ ...d, actual: Number(e.target.value) }))}
                          className={inputClass} />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-muted-foreground block mb-1">Notes</label>
                        <input value={draft.notes ?? ''}
                          onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                          placeholder="Additional context…"
                          className={inputClass} />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => save(line.id)}
                        className="flex-1 rounded-xl py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
                        Save
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="px-3 rounded-xl py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border">
                        Cancel
                      </button>
                      <button onClick={() => del(line.id)}
                        className="px-3 rounded-xl py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors border border-red-500/20">
                        Delete
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={line.id}
                  onClick={() => { setEditId(line.id); setDraft(line); }}
                  className="group rounded-2xl border border-border p-4 cursor-pointer hover:border-violet-400/40 transition-all duration-200"
                  style={{ background: 'hsl(var(--card))' }}>

                  {/* Card header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: 'hsl(var(--secondary))' }}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-snug">{line.department}</p>
                      {line.notes && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{line.notes}</p>}
                    </div>
                    {v !== 0 && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${vc2.bg} ${vc2.text}`}>
                        {v > 0 ? '+' : ''}{fmt(v)}
                      </span>
                    )}
                  </div>

                  {/* Budget bar */}
                  <div className="mb-3">
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${usedPct}%`, background: bc }}
                      />
                    </div>
                  </div>

                  {/* Numbers */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Estimated</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(line.estimated)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Actual</p>
                      <p className="text-sm font-semibold text-foreground">{fmt(line.actual)}</p>
                    </div>
                  </div>

                  {/* Edit hint */}
                  <div className="mt-2 pt-2 border-t border-border/50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground">Click to edit</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Totals footer ─────────────────────────────────────────────── */}
      {budget.length > 0 && (
        <div className="border-t border-border px-6 py-4 flex items-center justify-between"
          style={{ background: 'hsl(var(--card))' }}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Grand Total</span>
          <div className="flex gap-8">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">Estimated</p>
              <p className="text-sm font-bold text-foreground">{fmt(totalEstimated)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">Actual</p>
              <p className="text-sm font-bold text-foreground">{fmt(totalActual)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">Variance</p>
              <p className={`text-sm font-bold ${vc.text}`}>{variance > 0 ? '+' : ''}{fmt(variance)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
