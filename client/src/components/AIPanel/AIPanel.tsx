import { useState, useRef, useEffect, useCallback } from 'react';
import type { ScriptNode, Beat, CastMember, BudgetLine, MediaItem } from '../../types/screenplay';
import { scriptToPlainText } from '../../utils/storage';
import { isPro, type Plan } from '../../lib/plan';
import { generateExecOverviewHTML, htmlToMediaItem, generateExecPPTX } from '../../utils/fileExport';
import { makeId as sharedMakeId } from '../../utils/ids';

interface AIPanelProps {
  nodes: ScriptNode[];
  title: string;
  onClose: () => void;
  onScriptUpdate: (nodes: ScriptNode[]) => void;
  chatHistory: ChatMessage[];
  onChatHistoryChange: (history: ChatMessage[]) => void;
  // Project data
  beats: Beat[];
  castAndCrew: CastMember[];
  budget: BudgetLine[];
  onBeatsUpdate: (beats: Beat[]) => void;
  onCastUpdate: (cast: CastMember[]) => void;
  onBudgetUpdate: (budget: BudgetLine[]) => void;
  // Navigation
  onSwitchView?: (view: string) => void;
  onRenameProject?: (title: string) => void;
  onAddFile?: (item: MediaItem) => void;
  plan: Plan;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  scriptEdit?: ScriptNode[];
  beatEdit?: Omit<Beat, 'id' | 'color'>[];
  castEdit?: Omit<CastMember, 'id'>[];
  budgetEdit?: Omit<BudgetLine, 'id'>[];
  titleSuggestions?: string[];
}

type QuickCategory = 'script' | 'beats' | 'cast' | 'budget' | 'analysis' | 'export';

const QUICK_PROMPTS: Record<QuickCategory, { label: string; prompt?: string; action?: string }[]> = {
  script: [
    { label: 'Find the dead weight', prompt: 'Read every scene. List the three slowest scenes by page number, explain WHY each one drags (lack of conflict, redundant info, no character decision), and give me a specific trim or cut for each.' },
    { label: 'Find on-the-nose dialogue', prompt: 'Flag every exchange where a character states their emotion or the theme explicitly rather than revealing it. For each, quote the line, point to the page, and rewrite it with subtext.' },
    { label: 'Map the protagonist\'s objective', prompt: 'Track the protagonist scene-by-scene. Where does their objective get muddy, reverse, or disappear? Cite specific pages.' },
    { label: 'Scene-by-scene outline', prompt: 'Give me a tight scene-by-scene outline (one sentence per scene) with page numbers so I can see the shape of the script at a glance.' },
    { label: 'Write 5 taglines', prompt: 'Write 5 taglines in different registers: punchy, mysterious, emotional, darkly comic, poster-ready.' },
    { label: 'Opening title card', prompt: 'Propose an opening title card that sets tone and world without explaining. Return it as a SCRIPT_EDIT — an action node formatted exactly as: TITLE CARD: "your text here". Place it right after the opening FADE IN transition.' },
  ],
  beats: [
    { label: 'Beat sheet from this script', prompt: 'Read the script and build a beat sheet that describes what IS there, not what a template says should be there. Do not force Save the Cat; use whatever structure the script is already using.' },
    { label: 'Where does my structure break?', prompt: 'Review my current beat sheet against the actual script. Where do pages and beats disagree? What beat is missing, late, or in the wrong act?' },
    { label: 'Find the midpoint', prompt: 'What actually flips at the midpoint of this script? Name the page, the event, and what changes about the protagonist\'s objective afterward.' },
    { label: 'Save the Cat (explicit)', prompt: 'I want Save the Cat specifically — map the 15 Blake Snyder beats to this script and flag any that don\'t fit.' },
  ],
  cast: [
    { label: 'Generate cast list', prompt: 'Analyze the script and generate a complete cast list of all speaking characters. Include suggested department, category (cast/crew), and any notes about the role.' },
    { label: 'Character arcs', prompt: 'Who are the main characters and what are their arcs?' },
    { label: 'Add key crew roles', prompt: 'Based on the script\'s requirements, suggest the key crew roles I should add (director, DP, AD, etc.) and any special departments needed.' },
    { label: 'Character relationships', prompt: 'Map out the key relationships between characters in this script.' },
  ],
  budget: [
    { label: 'Estimate budget', prompt: 'Based on the script, generate a rough budget breakdown by department. Consider locations, cast size, VFX needs, and production complexity.' },
    { label: 'Identify expensive elements', prompt: 'What are the most expensive production elements in this script? What could we simplify to reduce costs?' },
    { label: 'Low-budget version', prompt: 'How would you restructure this script to shoot on a micro-budget under $100k?' },
    { label: 'Update budget estimate', prompt: 'Review my current budget and suggest any missing line items or adjustments based on the script.' },
  ],
  analysis: [
    { label: 'Protagonist want vs need', prompt: 'What is the protagonist\'s want vs. need? Does the script deliver on both?' },
    { label: 'Bechdel test', prompt: 'Does this script pass the Bechdel test? Analyze representation.' },
    { label: 'Genre conventions', prompt: 'How well does this script follow its genre conventions? What is subverted?' },
    { label: 'Comparable titles', prompt: 'What are 5 comparable titles (comps) for this script in the current market?' },
    { label: 'Suggest film titles', prompt: 'Analyze the themes, protagonist journey, tone, and emotional core of this script. Suggest 10 potential film titles with a brief reason for each. Then wrap your top 3 strongest candidates — one per line — inside a single <TITLE_SUGGESTIONS> block like this:\n<TITLE_SUGGESTIONS>\nTitle One\nTitle Two\nTitle Three\n</TITLE_SUGGESTIONS>' },
    { label: 'Find the perfect title', prompt: 'What is the ideal title for this script? Consider the logline, central conflict, themes, tone, genre conventions, and marketability. Give your top 5 with a short explanation each. Then wrap your single #1 recommendation inside <TITLE_SUGGESTIONS>:\n<TITLE_SUGGESTIONS>\nYour Best Title\n</TITLE_SUGGESTIONS>' },
  ],
  export: [
    { label: 'Exec Overview PDF', action: 'export-pdf-overview' },
    { label: 'Pitch Deck (PowerPoint)', action: 'export-pptx' },
  ],
};

const CATEGORY_LABELS: Record<QuickCategory, string> = {
  script:   'Script',
  beats:    'Beat Sheet',
  cast:     'Cast & Crew',
  budget:   'Budget',
  analysis: 'Analysis',
  export:   'Export',
};

const makeId = sharedMakeId;
const makeMemberId = sharedMakeId;

// Parse structured edit blocks from AI response
function parseEdits(raw: string) {
  const result: {
    displayContent: string;
    scriptEdit?: ScriptNode[];
    beatEdit?: Omit<Beat, 'id' | 'color'>[];
    castEdit?: Omit<CastMember, 'id'>[];
    budgetEdit?: Omit<BudgetLine, 'id'>[];
    titleSuggestions?: string[];
  } = { displayContent: raw };

  let content = raw;

  // Parse title suggestions
  const titleMatch = content.match(/<TITLE_SUGGESTIONS>([\s\S]*?)<\/TITLE_SUGGESTIONS>/);
  if (titleMatch) {
    const titles = titleMatch[1].split('\n').map(t => t.trim()).filter(Boolean);
    if (titles.length > 0) {
      (result as Record<string, unknown>).titleSuggestions = titles;
      content = content.replace(titleMatch[0], '').trim();
    }
  }

  const patterns: [string, string, string][] = [
    ['SCRIPT_EDIT', 'scriptEdit', 'script'],
    ['BEAT_SHEET_EDIT', 'beatEdit', 'beat'],
    ['CAST_EDIT', 'castEdit', 'cast'],
    ['BUDGET_EDIT', 'budgetEdit', 'budget'],
  ];

  for (const [tag, key] of patterns) {
    const match = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          (result as Record<string, unknown>)[key] = parsed;
          content = content.replace(match[0], '').trim();
        }
      } catch { /* skip malformed */ }
    }
  }

  // Also try bare ```json blocks for script edits
  if (!result.scriptEdit) {
    const jsonPatterns = [/```json\s*(\[[\s\S]*?\])\s*```/, /```\s*(\[[\s\S]*?\])\s*```/];
    for (const pat of jsonPatterns) {
      const match = content.match(pat);
      if (match) {
        try {
          const parsed = JSON.parse(match[1].trim());
          if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0] as Record<string, unknown>).type) {
            result.scriptEdit = parsed as ScriptNode[];
            content = content.replace(match[0], '').trim();
            break;
          }
        } catch { /* skip */ }
      }
    }
  }

  result.displayContent = content;
  return result;
}


export default function AIPanel({
  nodes, title, onClose, onScriptUpdate, chatHistory, onChatHistoryChange,
  beats, castAndCrew, budget, onBeatsUpdate, onCastUpdate, onBudgetUpdate,
  onSwitchView, onRenameProject, onAddFile, plan,
}: AIPanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [appliedMsgIds, setAppliedMsgIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<QuickCategory>('script');
  const [showBeatUpsell, setShowBeatUpsell] = useState(false);
  const proUser = isPro(plan);

  const handleQuickPrompt = useCallback((category: QuickCategory, prompt?: string, action?: string) => {
    if (category === 'beats' && !proUser) {
      setShowBeatUpsell(true);
      return;
    }
    if (action) runAction(action);
    else if (prompt) sendChat(prompt);
  }, [proUser]); // eslint-disable-line react-hooks/exhaustive-deps
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Build a project-like object from current state for file export
  function currentProjectSnapshot() {
    return { title, beatSheet: beats, castAndCrew, budget } as Parameters<typeof generateExecOverviewHTML>[0];
  }

  async function runAction(action: string) {
    if (exportLoading) return;
    setExportLoading(action);
    try {
      if (action === 'export-pdf-overview') {
        const html = generateExecOverviewHTML(currentProjectSnapshot(), nodes);
        const item = htmlToMediaItem(html, `${title} — Exec Overview.html`);
        onAddFile?.(item);
        onSwitchView?.('files');
        const msg: ChatMessage = { id: makeId(), role: 'assistant', content: `✓ Exec Overview exported to Files — open the Files tab to download or print it as PDF.` };
        onChatHistoryChange([...chatHistory, msg]);
      } else if (action === 'export-pptx') {
        const item = await generateExecPPTX(currentProjectSnapshot());
        onAddFile?.(item);
        onSwitchView?.('files');
        const msg: ChatMessage = { id: makeId(), role: 'assistant', content: `✓ Pitch Deck (PowerPoint) exported to Files — open the Files tab to download it.` };
        onChatHistoryChange([...chatHistory, msg]);
      }
    } catch (e) {
      const msg: ChatMessage = { id: makeId(), role: 'assistant', content: `⚠️ Export failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
      onChatHistoryChange([...chatHistory, msg]);
    } finally {
      setExportLoading(null);
    }
  }

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [chatHistory]);

  async function sendChat(question?: string) {
    const text = (question ?? chatInput).trim();
    if (!text || chatLoading) return;
    const userMsg: ChatMessage = { id: makeId(), role: 'user', content: text };
    const baseHistory = [...chatHistory, userMsg];
    onChatHistoryChange(baseHistory);
    setChatInput('');
    setChatLoading(true);

    const streamMsgId = makeId();
    let accumulated = '';

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'script_doctor',
          scriptText: scriptToPlainText(nodes),
          title,
          question: text,
          canEdit: true,
          plan,
          stream: true,
          history: chatHistory.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'AI request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) accumulated += parsed.text;
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected token') throw parseErr;
          }
        }
      }

      // Parse structured edits from completed response
      const { displayContent, scriptEdit, beatEdit, castEdit, budgetEdit, titleSuggestions } = parseEdits(accumulated);

      // Auto-apply tab data immediately; collect confirmation lines
      const confirmLines: string[] = [];

      if (beatEdit?.length) {
        if (proUser) {
          applyBeats(beatEdit);
          confirmLines.push(`✓ Beat sheet regenerated from current script (${beatEdit.length} beat${beatEdit.length !== 1 ? 's' : ''}) — open the Beat Sheet tab to edit them.`);
        } else {
          confirmLines.push(`🔒 Beat sheet generated (${beatEdit.length} beats) — upgrade to Pro to apply it.`);
        }
      }
      if (castEdit?.length) {
        if (proUser) {
          applyCast(castEdit);
          confirmLines.push(`✓ Cast & crew regenerated from current script (${castEdit.length} entr${castEdit.length !== 1 ? 'ies' : 'y'}) — open the Cast & Crew tab to edit them.`);
        } else {
          confirmLines.push(`🔒 Cast & crew generated (${castEdit.length} entries) — upgrade to Pro to apply it.`);
        }
      }
      if (budgetEdit?.length) {
        if (proUser) {
          applyBudget(budgetEdit);
          confirmLines.push(`✓ Budget regenerated from current script (${budgetEdit.length} line item${budgetEdit.length !== 1 ? 's' : ''}) — open the Budget tab to edit them.`);
        } else {
          confirmLines.push(`🔒 Budget generated (${budgetEdit.length} lines) — upgrade to Pro to apply it.`);
        }
      }

      // Script edits are NOT auto-applied anymore — the user must click "Apply
      // these changes" on the assistant message. Auto-apply was overwriting
      // in-flight edits and breaking undo. See diff/accept UI below.
      if (scriptEdit?.length) {
        confirmLines.push(`Proposed ${scriptEdit.length} script change${scriptEdit.length !== 1 ? 's' : ''} — review the preview below, then click Apply.`);
      }

      // For tab updates: show confirmation only (not the raw JSON response).
      // For script edits or plain analysis: show the display content as before.
      const finalContent = confirmLines.length > 0 ? confirmLines.join('\n') : displayContent;

      const finalMsg: ChatMessage = {
        id: streamMsgId,
        role: 'assistant',
        content: finalContent,
        scriptEdit,
        titleSuggestions: titleSuggestions?.length ? titleSuggestions : undefined,
      };
      onChatHistoryChange([...baseHistory, finalMsg]);
    } catch (e: unknown) {
      const errMsg: ChatMessage = { id: streamMsgId || makeId(), role: 'assistant', content: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong') };
      onChatHistoryChange([...baseHistory, errMsg]);
    } finally {
      setChatLoading(false);
    }
  }

  function applyBeats(rawBeats: Omit<Beat, 'id' | 'color'>[]) {
    const newBeats: Beat[] = rawBeats.map(b => ({ ...b, id: makeId(), color: '' }));
    onBeatsUpdate(newBeats);
    onSwitchView?.('beat-sheet');
  }

  function applyCast(rawCast: Omit<CastMember, 'id'>[]) {
    const newCast: CastMember[] = rawCast.map(m => ({ ...m, id: makeMemberId(), tags: m.tags ?? [], comments: m.comments ?? '', availability: m.availability ?? '' }));
    onCastUpdate(newCast);
    onSwitchView?.('cast-crew');
  }

  function applyBudget(rawBudget: Omit<BudgetLine, 'id'>[]) {
    const newBudget: BudgetLine[] = rawBudget.map(l => ({ ...l, id: makeMemberId() }));
    onBudgetUpdate(newBudget);
    onSwitchView?.('budget');
  }

  return (
    <div className="flex flex-col h-full text-xs relative z-40" style={{ background: 'hsl(var(--card))', borderLeft: '1px solid hsl(var(--border))' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
            {/* Monogram mark — deliberately sober, not a sparkle */}
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.02em' }}>SD</span>
          </div>
          <span className="font-semibold text-foreground text-sm">Script Doctor</span>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: 'hsl(var(--secondary))' }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {chatHistory.length === 0 && (
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            Ask anything about your script, or pick a shortcut below.
          </p>
        )}

        {chatHistory.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className="max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap"
              style={msg.role === 'user' ? {
                background: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                borderBottomRightRadius: 4,
              } : {
                background: 'hsl(var(--muted))',
                color: 'hsl(var(--foreground))',
                borderBottomLeftRadius: 4,
                border: '1px solid hsl(var(--border))',
              }}
            >
              {msg.content}
            </div>

            {/* Title suggestions */}
            {msg.titleSuggestions && msg.titleSuggestions.length > 0 && (
              <div className="mt-2 max-w-[85%] w-full">
                <p className="text-[9px] text-muted-foreground mb-1.5 uppercase tracking-wider">Apply as project title</p>
                <div className="flex flex-col gap-1">
                  {msg.titleSuggestions.map(t => (
                    <button
                      key={t}
                      onClick={() => onRenameProject?.(t)}
                      className="text-left px-3 py-1.5 rounded-lg text-[11px] transition-colors hover:opacity-80"
                      style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.25)', color: 'hsl(var(--primary))' }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Script edit preview + apply */}
            {msg.scriptEdit && (
              <div className="mt-1.5 max-w-[90%] w-full">
                {appliedMsgIds.has(msg.id) ? (
                  <div className="py-1.5 px-3 rounded-lg text-[10px] font-semibold flex items-center gap-1.5"
                    style={{ background: 'hsl(142 42% 30% / 0.1)', border: '1px solid hsl(142 42% 30% / 0.25)', color: 'hsl(142 42% 40%)' }}>
                    ✓ Applied — use ⌘Z in the editor to undo
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
                    {/* Diff preview — shows the first ~6 nodes the AI is proposing */}
                    <div className="px-3 py-2 max-h-44 overflow-y-auto text-[11px] font-mono" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                      {msg.scriptEdit.slice(0, 6).map((n, idx) => (
                        <div key={idx} className="flex gap-1.5 py-0.5">
                          <span className="text-[9px] uppercase tracking-wider px-1 rounded" style={{ color: 'hsl(var(--primary))', background: 'hsl(var(--primary)/0.1)' }}>
                            {n.type.replace('_', ' ')}
                          </span>
                          <span className="text-muted-foreground truncate">{n.content || '—'}</span>
                        </div>
                      ))}
                      {msg.scriptEdit.length > 6 && (
                        <div className="text-[10px] text-muted-foreground pt-1">…and {msg.scriptEdit.length - 6} more node{msg.scriptEdit.length - 6 !== 1 ? 's' : ''}</div>
                      )}
                    </div>
                    <div className="flex gap-1 p-1.5" style={{ background: 'hsl(var(--card))' }}>
                      <button
                        onClick={() => { onScriptUpdate(msg.scriptEdit!); setAppliedMsgIds(prev => new Set([...prev, msg.id])); }}
                        className="flex-1 py-1.5 px-3 rounded-md text-[10px] font-semibold transition-all hover:opacity-90"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                      >
                        Apply to script
                      </button>
                      <button
                        onClick={() => setAppliedMsgIds(prev => { const next = new Set(prev); next.add(msg.id + ':dismissed'); return next; })}
                        className="py-1.5 px-3 rounded-md text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2.5" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', borderBottomLeftRadius: 4 }}>
              <div className="flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'hsl(var(--primary))', animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'hsl(var(--primary))', animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'hsl(var(--primary))', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        {/* Suggestions — always visible */}
        {!chatLoading && (
          <div className="space-y-2 pt-1">
            {chatHistory.length > 0 && (
              <p className="text-[10px] text-muted-foreground px-1">Suggestions</p>
            )}
            {/* Category tabs */}
            <div className="flex gap-1 flex-wrap">
              {(Object.keys(QUICK_PROMPTS) as QuickCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className="text-[10px] px-2.5 py-1 rounded-lg transition-colors font-medium"
                  style={activeCategory === cat ? {
                    background: 'hsl(var(--primary) / 0.12)',
                    color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.3)',
                  } : {
                    background: 'hsl(var(--secondary))',
                    color: 'hsl(var(--muted-foreground))',
                    border: '1px solid hsl(var(--border))',
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Quick prompts */}
            <div className="space-y-1.5">
              {activeCategory === 'beats' && !proUser && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'hsl(var(--primary) / 0.06)', border: '1px solid hsl(var(--primary) / 0.2)' }}>
                  {showBeatUpsell ? (
                    <div className="text-center">
                      <p className="text-[11px] font-semibold text-foreground mb-1">Beat sheet AI is Pro only</p>
                      <p className="text-[10px] text-muted-foreground mb-2">Upgrade to generate and edit beat sheets with AI.</p>
                      <a href="/pricing" className="inline-block text-[11px] font-semibold px-3 py-1.5 rounded-lg text-primary-foreground transition-colors" style={{ background: 'hsl(var(--primary))' }}>
                        View plans →
                      </a>
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span>🔒</span> Beat sheet AI requires a paid plan
                    </p>
                  )}
                </div>
              )}
              {QUICK_PROMPTS[activeCategory].map(({ label, prompt, action }) => {
                const locked = activeCategory === 'beats' && !proUser;
                return (
                  <button
                    key={label}
                    onClick={() => handleQuickPrompt(activeCategory, prompt, action)}
                    disabled={!!exportLoading}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-[11px] transition-all leading-snug disabled:opacity-50 hover:scale-[1.01]"
                    style={locked ? {
                      background: 'hsl(var(--secondary))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--muted-foreground))',
                    } : {
                      background: 'hsl(var(--secondary))',
                      border: '1px solid hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                    }}
                    onMouseEnter={e => { if (!locked) { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.5)'; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--primary) / 0.06)'; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
                  >
                    {exportLoading === action ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-3 h-3 inline" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        Generating…
                      </span>
                    ) : locked ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground"><span>🔒</span>{label}</span>
                    ) : label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
        <div className="flex gap-2 items-end">
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            placeholder="Ask anything about your script…"
            rows={2}
            className="flex-1 resize-none rounded-xl text-foreground px-3 py-2 text-[11px] outline-none transition-all placeholder:text-muted-foreground"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
          />
          <button
            onClick={() => sendChat()}
            disabled={!chatInput.trim() || chatLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all disabled:opacity-40 flex-shrink-0 hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            ↑
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
