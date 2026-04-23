import { useState, useEffect } from 'react';
import { XIcon, DownloadIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ScriptNode } from '../../types/screenplay';

interface Props {
  sharedScriptId: string;
  senderName: string;
  onClose: () => void;
}

interface SharedScript {
  title: string;
  sender_name: string;
  script_nodes: ScriptNode[];
  created_at: string;
}

const ELEMENT_STYLES: Record<string, { label?: string; className: string; style?: React.CSSProperties }> = {
  scene_heading: {
    label: 'INT/EXT',
    className: 'font-bold uppercase tracking-wide text-xs mt-5 mb-1',
    style: { color: 'hsl(var(--foreground))' },
  },
  action: {
    className: 'text-xs leading-relaxed mb-2',
    style: { color: 'hsl(var(--foreground))' },
  },
  character: {
    className: 'font-bold text-xs text-center uppercase mt-4 mb-0',
    style: { marginLeft: '35%', color: 'hsl(var(--foreground))' },
  },
  dialogue: {
    className: 'text-xs leading-relaxed mb-1',
    style: { marginLeft: '20%', marginRight: '20%', color: 'hsl(var(--foreground))' },
  },
  parenthetical: {
    className: 'text-xs italic mb-0',
    style: { marginLeft: '28%', color: 'hsl(var(--muted-foreground))' },
  },
  transition: {
    className: 'text-xs text-right uppercase font-semibold my-3',
    style: { color: 'hsl(var(--muted-foreground))' },
  },
  shot: {
    className: 'text-xs uppercase font-semibold my-2',
    style: { color: 'hsl(var(--muted-foreground))' },
  },
  act: {
    className: 'text-xs font-black uppercase tracking-widest text-center my-4 py-1',
    style: { color: 'hsl(var(--primary))' },
  },
  text: {
    className: 'text-xs leading-relaxed mb-1',
    style: { color: 'hsl(var(--foreground))' },
  },
};

export default function SharedScriptPreview({ sharedScriptId, senderName, onClose }: Props) {
  const [script, setScript] = useState<SharedScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('shared_scripts')
      .select('title, sender_name, script_nodes, created_at')
      .eq('id', sharedScriptId)
      .single()
      .then(({ data, error: e }) => {
        if (e) setError('Could not load script.');
        else setScript(data as SharedScript);
        setLoading(false);
      });
  }, [sharedScriptId]);

  function exportAsFountain() {
    if (!script) return;
    const lines: string[] = [];
    for (const node of script.script_nodes) {
      switch (node.type) {
        case 'scene_heading': lines.push('\n' + node.content.toUpperCase() + '\n'); break;
        case 'action': lines.push(node.content + '\n'); break;
        case 'character': lines.push('\n' + node.content.toUpperCase()); break;
        case 'dialogue': lines.push(node.content + '\n'); break;
        case 'parenthetical': lines.push('(' + node.content + ')'); break;
        case 'transition': lines.push('\n' + node.content.toUpperCase() + '\n'); break;
        default: lines.push(node.content); break;
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (script.title || 'script') + '.fountain';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {loading ? 'Loading…' : (script?.title || 'Untitled Script')}
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Shared by {senderName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {script && (
              <button
                onClick={exportAsFountain}
                className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
              >
                <DownloadIcon className="w-3 h-3" />
                Export .fountain
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              style={{ border: '1px solid hsl(var(--border))' }}
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Script body */}
        <div className="flex-1 overflow-y-auto px-8 py-6" style={{ fontFamily: 'Courier New, monospace' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-3xl mb-3">⚠️</div>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : !script || script.script_nodes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-sm text-muted-foreground">This script appears to be empty.</p>
            </div>
          ) : (
            script.script_nodes.map((node, i) => {
              const s = ELEMENT_STYLES[node.type] ?? ELEMENT_STYLES.text;
              return (
                <div key={i} className={s.className} style={s.style}>
                  {node.html
                    ? <span dangerouslySetInnerHTML={{ __html: node.html }} />
                    : node.content}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
