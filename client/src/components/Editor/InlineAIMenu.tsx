import { useState, useEffect, useRef, useCallback } from 'react';
import type { ScriptNode } from '../../types/screenplay';
import { scriptToPlainText } from '../../utils/storage';

interface InlineAIMenuProps {
  nodes: ScriptNode[];
  scriptTitle: string;
  onApply: (nodeIdx: number, newContent: string) => void;
  containerRef: React.RefObject<HTMLElement | null>;
}

const ACTIONS = [
  { id: 'rewrite', label: '✦ Rewrite' },
  { id: 'funnier', label: '😄 Funnier' },
  { id: 'darker', label: '🌑 Darker' },
  { id: 'shorten', label: '✂ Shorten' },
  { id: 'expand', label: '↔ Expand' },
  { id: 'punchup', label: '⚡ Punch it up' },
];

export default function InlineAIMenu({ nodes, scriptTitle, onApply, containerRef }: InlineAIMenuProps) {
  const [visible, setVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [nodeIdx, setNodeIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setVisible(false);
      setResult(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 3) return;

    // Find data-node-idx on the anchor element
    let el: Element | null = sel.anchorNode?.parentElement ?? null;
    let foundIdx: number | null = null;
    while (el) {
      if (el instanceof HTMLElement && el.dataset.nodeIdx !== undefined) {
        foundIdx = parseInt(el.dataset.nodeIdx, 10);
        break;
      }
      el = el.parentElement;
    }
    if (foundIdx === null) return;

    // Position above selection
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = containerRef.current;
    const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0, scrollTop: 0 };

    setSelectedText(text);
    setNodeIdx(foundIdx);
    setMenuPos({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8 + (container?.scrollTop ?? 0),
    });
    setVisible(true);
    setResult(null);
    setError(null);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('mouseup', handleMouseUp);
    return () => container.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp, containerRef]);

  // Close when clicking outside
  useEffect(() => {
    if (!visible) return;
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setVisible(false);
        setResult(null);
      }
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [visible]);

  async function runAction(actionId: string) {
    if (nodeIdx === null) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const actionLabels: Record<string, string> = {
      rewrite: 'Rewrite this line/passage with fresh wording that preserves the exact meaning and tone.',
      funnier: 'Rewrite this to be funnier while keeping it appropriate to the scene.',
      darker: 'Rewrite this with a darker, more menacing tone.',
      shorten: 'Shorten this to its essential meaning. Be concise.',
      expand: 'Expand this with more vivid detail or subtext, keeping it screenplay-appropriate.',
      punchup: 'Punch up this line to make it more memorable, impactful, and cinematic.',
    };

    const scriptContext = scriptToPlainText(nodes.slice(Math.max(0, nodeIdx - 3), nodeIdx + 4));
    const prompt = `${actionLabels[actionId]}\n\nThe line to transform:\n"${selectedText}"\n\nContext (surrounding lines):\n${scriptContext}\n\nReturn ONLY the rewritten text, no quotes, no explanation, no metadata. Match the original screenplay element format (action, dialogue, etc.).`;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'script_doctor',
          scriptText: scriptToPlainText(nodes),
          title: scriptTitle,
          question: prompt,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error('AI request failed');

      // Try non-streaming first
      const text = await response.text();
      // Parse SSE if needed
      const lines = text.split('\n').filter(l => l.startsWith('data: '));
      let accumulated = '';
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            accumulated += parsed.delta.text;
          } else if (parsed.text) {
            accumulated += parsed.text;
          }
        } catch { accumulated += data; }
      }
      if (!accumulated) accumulated = text.trim();
      setResult(accumulated.trim());
    } catch {
      setError('AI unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (nodeIdx === null || !result) return;
    // Replace the node's content with the result
    const node = nodes[nodeIdx];
    if (!node) return;
    // If the selected text was only part of the node, replace just that part
    const newContent = node.content.replace(selectedText, result);
    onApply(nodeIdx, newContent !== node.content ? newContent : result);
    setVisible(false);
    setResult(null);
  }

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 no-print"
      style={{ left: menuPos.x, top: menuPos.y, transform: 'translateX(-50%) translateY(-100%)' }}
    >
      {!result && !loading && (
        <div
          className="flex items-center gap-1 rounded-full shadow-2xl px-2 py-1"
          style={{ background: '#1a1a2e', border: '1px solid #7c3aed44', backdropFilter: 'blur(12px)' }}
        >
          {ACTIONS.map(a => (
            <button
              key={a.id}
              onClick={() => runAction(a.id)}
              className="text-[10px] font-medium px-2.5 py-1 rounded-full transition-all whitespace-nowrap"
              style={{ color: '#c4b5fd' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#7c3aed33'; (e.currentTarget as HTMLElement).style.color = '#a78bfa'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#c4b5fd'; }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div
          className="rounded-2xl px-4 py-2 shadow-2xl text-xs text-violet-300"
          style={{ background: '#1a1a2e', border: '1px solid #7c3aed44' }}
        >
          <span className="animate-pulse">✦ Writing...</span>
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl px-4 py-2 shadow-2xl text-xs"
          style={{ background: '#1a1a2e', border: '1px solid #ef444444', color: '#f87171' }}
        >
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {result && !loading && (
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: '#1a1a2e', border: '1px solid #7c3aed66', maxWidth: '420px', minWidth: '280px' }}
        >
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">AI Suggestion</div>
          <div className="px-4 pb-3 text-xs text-gray-200 leading-relaxed italic">{result}</div>
          <div className="flex items-center gap-2 px-4 pb-3">
            <button
              onClick={handleApply}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              Accept
            </button>
            <button
              onClick={() => { setResult(null); }}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Discard
            </button>
            <button
              onClick={() => { setResult(null); }}
              className="ml-auto text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
