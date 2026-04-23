import { useState, useMemo } from 'react';
import type { ScriptNode } from '../../types/screenplay';
import { getCharacterNames } from '../../utils/storage';

const SCENE_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#6b7280'];

interface NavigationPanelProps {
  nodes: ScriptNode[];
  onJump: (sceneIndex: number) => void;
  onClose: () => void;
  onColorChange?: (nodeIndex: number, color: string | undefined) => void;
}

interface SceneInfo {
  index: number;
  content: string;
  sceneNum: number;
  color?: string;
  lineCount: number;
  characters: string[];
}

export default function NavigationPanel({ nodes, onJump, onClose, onColorChange }: NavigationPanelProps) {
  const [charFilter, setCharFilter] = useState('');
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);

  const allCharacters = useMemo(() => getCharacterNames(nodes), [nodes]);

  const scenes = useMemo<SceneInfo[]>(() => {
    const result: SceneInfo[] = [];
    let sceneNum = 0;

    nodes.forEach((node, index) => {
      if (node.type === 'scene_heading' && node.content.trim()) {
        sceneNum++;
        let lineCount = 0;
        const chars = new Set<string>();
        for (let j = index + 1; j < nodes.length; j++) {
          if (nodes[j].type === 'scene_heading') break;
          lineCount++;
          if (nodes[j].type === 'character' && nodes[j].content.trim()) {
            const name = nodes[j].content.replace(/\(.*?\)/g, '').trim().toUpperCase();
            if (name) chars.add(name);
          }
        }
        result.push({ index, content: node.content.trim(), sceneNum, color: node.color, lineCount, characters: Array.from(chars) });
      }
    });
    return result;
  }, [nodes]);

  const filtered = charFilter
    ? scenes.filter(s => s.characters.includes(charFilter))
    : scenes;

  // Semantic colour-coding (green = healthy short, amber = medium, red = too
  // long) stays; the label now uses an approximate page count instead of a
  // cryptic "med". Writers scan page counts, not arbitrary "med" buckets.
  function lengthLabel(lines: number) {
    const approxPages = Math.max(1, Math.round(lines / 55));
    if (lines <= 8)  return { label: '⅛ pg', color: '#22c55e' };
    if (lines <= 20) return { label: `${approxPages} pg`, color: '#f59e0b' };
    return { label: `${approxPages} pg`, color: '#ef4444' };
  }

  return (
    <div className="no-print absolute left-0 top-0 bottom-0 z-30 flex flex-col border-r border-border bg-background shadow-2xl font-geist" style={{ width: '260px' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Navigation</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm transition-colors">✕</button>
      </div>

      {/* Character filter */}
      {allCharacters.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <select value={charFilter} onChange={e => setCharFilter(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary text-foreground px-2 py-1 text-[10px] outline-none focus:border-violet-400/70 transition-colors">
            <option value="">All characters</option>
            {allCharacters.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-xs">
            {charFilter ? `No scenes with ${charFilter}` : 'No scene headings found.'}
          </div>
        ) : (
          filtered.map((scene) => {
            const len = lengthLabel(scene.lineCount);
            return (
              <button key={scene.index} onClick={() => onJump(scene.index)}
                className="w-full text-left px-4 py-2 hover:bg-secondary/50 transition-colors group">
                <div className="flex items-start gap-2">
                  <div className="relative flex-shrink-0">
                    <button
                      className="w-3 h-3 rounded-full mt-1 transition-all hover:scale-125 focus:outline-none"
                      style={{ background: scene.color || 'hsl(var(--border))', display: 'block', flexShrink: 0 }}
                      title="Click to set scene color"
                      onClick={e => { e.stopPropagation(); setColorPickerIdx(colorPickerIdx === scene.index ? null : scene.index); }}
                    />
                    {colorPickerIdx === scene.index && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setColorPickerIdx(null)} />
                        <div className="absolute left-4 top-0 z-30 rounded-xl p-2 shadow-2xl grid grid-cols-4 gap-1"
                          style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}>
                          {SCENE_COLORS.map(c => (
                            <button key={c} onClick={() => { onColorChange?.(scene.index, c); setColorPickerIdx(null); }}
                              className="w-5 h-5 rounded-full transition-all hover:scale-125"
                              style={{ background: c, border: scene.color === c ? '2px solid white' : '2px solid transparent' }}
                            />
                          ))}
                          <button onClick={() => { onColorChange?.(scene.index, undefined); setColorPickerIdx(null); }}
                            className="col-span-4 text-[9px] text-muted-foreground hover:text-foreground transition-colors pt-1 text-center">
                            clear
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs font-mono text-violet-400 w-5 mt-0.5">{scene.sceneNum}</span>
                  <div className="flex-1 min-w-0">
                    {/* Full heading in title= so hovering shows the piece that
                        gets clipped by the 260px drawer width. Previously the
                        truncation silently dropped the time-of-day, making it
                        impossible to disambiguate two INT. DINER scenes. */}
                    <span
                      title={scene.content}
                      className="text-xs text-foreground/80 group-hover:text-foreground transition-colors leading-tight block truncate"
                    >
                      {scene.content}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[9px] font-medium cursor-help"
                        style={{ color: len.color }}
                        title={`${scene.lineCount} lines (~${Math.max(1, Math.round(scene.lineCount / 55))} page${Math.round(scene.lineCount / 55) !== 1 ? 's' : ''}). ${scene.lineCount > 20 ? 'Longer than the recommended 3–4 pages per scene.' : scene.lineCount > 8 ? 'Average scene length.' : 'Short scene.'}`}
                      >{len.label}</span>
                      {scene.characters.slice(0, 3).map(c => (
                        <span key={c} className="text-[9px] text-muted-foreground truncate">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filtered.length} / {scenes.length} scenes</span>
        {charFilter && (
          <button onClick={() => setCharFilter('')} className="text-[10px] text-muted-foreground hover:text-violet-400 transition-colors">clear filter</button>
        )}
      </div>
    </div>
  );
}
