import { useState, useCallback, useMemo } from 'react';
import type { ScriptNode } from '../../types/screenplay';

interface FindReplaceProps {
  nodes: ScriptNode[];
  onReplace: (nodes: ScriptNode[]) => void;
  onClose: () => void;
  onScrollTo?: (nodeIndex: number) => void;
}

export default function FindReplace({ nodes, onReplace, onClose, onScrollTo }: FindReplaceProps) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [currentMatch, setCurrentMatch] = useState(0);

  function buildRegex(flags = '') {
    if (!findText) return null;
    try {
      const pattern = useRegex ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(pattern, (caseSensitive ? '' : 'i') + flags);
    } catch { return null; }
  }

  const matches = useMemo(() => {
    const result: { nodeIndex: number }[] = [];
    const re = buildRegex('g');
    if (!re) return result;
    nodes.forEach((node, i) => {
      let m: RegExpExecArray | null;
      const regex = new RegExp(re.source, re.flags);
      while ((m = regex.exec(node.content)) !== null) {
        result.push({ nodeIndex: i });
        if (m[0].length === 0) break;
      }
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, nodes, caseSensitive, useRegex]);

  function navigate(dir: 1 | -1) {
    if (matches.length === 0) return;
    const next = (currentMatch + dir + matches.length) % matches.length;
    setCurrentMatch(next);
    const nodeIdx = matches[next]?.nodeIndex;
    if (nodeIdx !== undefined && onScrollTo) onScrollTo(nodeIdx);
  }

  function handleReplaceAll() {
    if (!findText) return;
    const re = buildRegex('g');
    if (!re) return;
    let replacements = 0;
    const updated = nodes.map((node) => {
      const regex = new RegExp(re.source, re.flags);
      const ms = node.content.match(regex);
      if (ms) replacements += ms.length;
      return { ...node, content: node.content.replace(regex, replaceText) };
    });
    onReplace(updated);
    setResult(`Replaced ${replacements} occurrence${replacements !== 1 ? 's' : ''}`);
    setCurrentMatch(0);
  }

  function handleReplaceOne() {
    if (!findText || matches.length === 0) return;
    const re = buildRegex('g');
    if (!re) return;
    const targetNodeIdx = matches[currentMatch]?.nodeIndex;
    if (targetNodeIdx === undefined) return;
    let replaced = false;
    const updated = nodes.map((node, i) => {
      if (i !== targetNodeIdx || replaced) return node;
      const regex = new RegExp(re.source, re.flags);
      const newContent = node.content.replace(regex, () => { if (!replaced) { replaced = true; return replaceText; } return findText; });
      return { ...node, content: newContent };
    });
    onReplace(updated);
    setResult(`Replaced 1 occurrence`);
  }

  const matchCount = matches.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 font-geist" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[440px]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Find & Replace</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Find input */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Find</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type="text" value={findText}
                  onChange={(e) => { setFindText(e.target.value); setResult(null); setCurrentMatch(0); }}
                  placeholder="Search text…"
                  className="w-full rounded-2xl border border-border bg-foreground/5 text-foreground text-sm px-4 py-2.5 focus:border-violet-400/70 focus:bg-violet-500/10 focus:outline-none transition-colors placeholder:text-muted-foreground"
                  autoFocus />
                {findText && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : '0'}
                  </span>
                )}
              </div>
              <button onClick={() => navigate(-1)} disabled={matchCount === 0}
                className="px-2.5 py-1.5 rounded-xl border border-border text-foreground/80 hover:border-border/80 disabled:opacity-30 text-xs transition-colors" title="Previous match">↑</button>
              <button onClick={() => navigate(1)} disabled={matchCount === 0}
                className="px-2.5 py-1.5 rounded-xl border border-border text-foreground/80 hover:border-border/80 disabled:opacity-30 text-xs transition-colors" title="Next match">↓</button>
            </div>
          </div>

          {/* Replace input */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Replace with</label>
            <input type="text" value={replaceText}
              onChange={(e) => { setReplaceText(e.target.value); setResult(null); }}
              placeholder="Replacement text…"
              className="w-full rounded-2xl border border-border bg-foreground/5 text-foreground text-sm px-4 py-2.5 focus:border-violet-400/70 focus:bg-violet-500/10 focus:outline-none transition-colors placeholder:text-muted-foreground" />
          </div>

          {/* Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} className="accent-violet-500" />
              Case sensitive
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} className="accent-violet-500" />
              Regex
            </label>
          </div>

          {result && (
            <div className="text-xs text-violet-400 bg-violet-500/10 px-3 py-2 rounded-xl">{result}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={handleReplaceOne} disabled={!findText || matchCount === 0}
            className="px-4 py-2 text-xs font-medium border border-border text-foreground/80 hover:border-border/60 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Replace
          </button>
          <button onClick={handleReplaceAll} disabled={!findText}
            className="px-4 py-2 text-xs font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Replace All
          </button>
        </div>
      </div>
    </div>
  );
}
