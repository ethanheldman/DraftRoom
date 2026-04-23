import { useState, useEffect, useRef, useCallback, useLayoutEffect, forwardRef, useImperativeHandle } from 'react';
import { flushSync } from 'react-dom';
import type { ElementType, ScriptNode } from '../../types/screenplay';
import { getCharacterNames, getSceneHeadings } from '../../utils/storage';
import { getTheme } from '../../utils/themes';
import { parseFountain } from '../../utils/fountain';
import { makeId } from '../../utils/ids';

// ─── Element formatting ─────────────────────────────────────────────────────

// Indents are percentages of the content box (inside the 1.5" L / 1" R page
// margins). Content box is 6" wide, so each % ≈ 0.06". Target positions from
// page edge: character 3.7", dialogue 2.5"L/2.5"R, parenthetical 3.1"L/2.9"R.
const ELEMENT_STYLES: Record<ElementType, React.CSSProperties> = {
  scene_heading: { paddingLeft: 0, paddingRight: 0, textAlign: 'left', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '1em', marginBottom: '0' },
  // 1em top / 0 bottom gives a full blank line between adjacent actions (and
  // between dialogue→action) via margin-collapse, matching industry format.
  action:        { paddingLeft: 0, paddingRight: 0, textAlign: 'left', marginTop: '1em', marginBottom: 0 },
  character:     { paddingLeft: '37%', paddingRight: 0, textAlign: 'left', textTransform: 'uppercase', marginTop: '1em', marginBottom: 0 },
  dialogue:      { paddingLeft: '17%', paddingRight: '25%', textAlign: 'left', marginTop: 0, marginBottom: 0 },
  parenthetical: { paddingLeft: '27%', paddingRight: '32%', textAlign: 'left', fontStyle: 'italic', marginTop: 0, marginBottom: 0 },
  transition:    { paddingLeft: 0, paddingRight: 0, textAlign: 'right', textTransform: 'uppercase', marginTop: '1em', marginBottom: '1em' },
  shot:          { paddingLeft: 0, paddingRight: 0, textAlign: 'left', textTransform: 'uppercase', marginTop: '0.5em', marginBottom: '0.5em' },
  act:           { paddingLeft: 0, paddingRight: 0, textAlign: 'center', textTransform: 'uppercase', fontWeight: 'bold', marginTop: '1.5em', marginBottom: '1em' },
  text:          { paddingLeft: 0, paddingRight: 0, textAlign: 'left', marginTop: '0.5em', marginBottom: '0.5em' },
};

const PLACEHOLDER: Record<ElementType, string> = {
  scene_heading: 'INT. LOCATION - DAY',
  action:        'Describe the scene...',
  character:     'CHARACTER NAME',
  dialogue:      'Line of dialogue...',
  parenthetical: '(beat, pause, action)',
  transition:    'CUT TO:',
  shot:          'CLOSE ON:',
  act:           'ACT ONE',
  text:          'Text...',
};

export const ELEMENT_LABELS: Record<ElementType, string> = {
  scene_heading: 'Scene Heading',
  action:        'Action',
  character:     'Character',
  dialogue:      'Dialogue',
  parenthetical: 'Parenthetical',
  transition:    'Transition',
  shot:          'Shot',
  act:           'Act',
  text:          'Text',
};

export const ELEMENT_SHORTCUTS: Record<ElementType, string> = {
  act:           '⌘0',
  scene_heading: '⌘1',
  action:        '⌘2',
  character:     '⌘3',
  dialogue:      '⌘4',
  parenthetical: '⌘5',
  transition:    '⌘6',
  shot:          '⌘7',
  text:          '⌘8',
};

// Tab cycles FORWARD through screenplay elements, matching Final Draft / Highland / WriterDuet:
// character → dialogue → parenthetical → character (loop), with sensible jumps from other types.
const TAB_NEXT: Record<ElementType, ElementType> = {
  scene_heading: 'action',
  action:        'character',
  character:     'dialogue',
  dialogue:      'parenthetical',
  parenthetical: 'character',
  transition:    'scene_heading',
  shot:          'action',
  act:           'scene_heading',
  text:          'action',
};

const ENTER_NEXT: Record<ElementType, ElementType> = {
  scene_heading: 'action',
  action:        'action',
  character:     'dialogue',
  dialogue:      'character',
  parenthetical: 'dialogue',
  transition:    'action',
  shot:          'action',
  act:           'scene_heading',
  text:          'text',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getHtmlFromEl(el: HTMLDivElement): string {
  const h = el.innerHTML;
  return h === '<br>' ? '' : h;
}

function getTextFromEl(el: HTMLDivElement): string {
  return (el.textContent ?? '').replace(/\n/g, '');
}

function focusAtEnd(el: HTMLDivElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function focusAtStart(el: HTMLDivElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function isCaretAtStart(el: HTMLDivElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length === 0;
}

function isCaretAtEnd(el: HTMLDivElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  const post = range.cloneRange();
  post.selectNodeContents(el);
  post.setStart(range.endContainer, range.endOffset);
  return post.toString().length === 0;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineState {
  id: string;
  type: ElementType;
  content: string;          // plain text — kept in sync for word/page count
  initialHtml: string;      // HTML written to DOM; version-gated
  marks: Set<'bold' | 'italic' | 'underline'>;
  version: number;          // increment to force DOM innerHTML update
}

interface ScriptEditorProps {
  nodes: ScriptNode[];
  onChange: (nodes: ScriptNode[]) => void;
  onActiveTypeChange?: (type: ElementType) => void;
  activeElementType?: ElementType;
  showSceneNumbers?: boolean;
  zoom?: number;
  nightMode?: boolean;
  themeId?: string;
  appliedAt?: number;
}

export interface ScriptEditorHandle {
  scrollToScene: (sceneIndex: number) => void;
  scrollToNode: (nodeIndex: number) => void;
  applyMark: (mark: 'bold' | 'italic' | 'underline') => void;
  undo: () => void;
  redo: () => void;
  resetNodes: (nodes: ScriptNode[]) => void;
  replaceContent(nodeIdx: number, content: string): void;
}

function nodesToLines(nodes: ScriptNode[]): LineState[] {
  if (!nodes.length) {
    return [
      { id: makeId(), type: 'scene_heading', content: 'INT. LOCATION - DAY', initialHtml: escHtml('INT. LOCATION - DAY'), marks: new Set(), version: 0 },
      { id: makeId(), type: 'action', content: '', initialHtml: '', marks: new Set(), version: 0 },
    ];
  }
  return nodes.map(n => ({
    id: makeId(),
    type: n.type,
    content: n.content,
    initialHtml: n.html ?? escHtml(n.content),
    marks: new Set((n.marks ?? []) as ('bold' | 'italic' | 'underline')[]),
    version: 0,
  }));
}

// ─── Page break estimation ───────────────────────────────────────────────────

// Page dimensions: 1056px tall (11"), 96px padding top + bottom (1" each) = 864px content area.
// Font: 12pt = 16px at 96dpi, lineHeight 1.0 = 16px per text line, matching industry single-spaced Courier.
// 864 / 16 = 54 lines per page, which aligns with the industry "~55 lines per page" standard and the
// "1 page ≈ 1 minute of screen time" convention used by professional readers.
const PAGE_CONTENT_PX = 864;
const LINE_H = 16;   // 12pt × 1.0 line-height
const EM     = 16;   // 1em = font-size

function linesForNode(type: ElementType, content: string): number {
  const textLines = Math.ceil((content.length || 1) / 60);
  const textH     = textLines * LINE_H;
  switch (type) {
    case 'scene_heading': return EM       + textH;           // marginTop: 1em
    case 'action':        return EM       + textH;           // 0.5em top + 0.5em bottom
    case 'character':     return EM       + LINE_H;          // marginTop: 1em + 1 line
    case 'dialogue':      return textH;                      // no block margins
    case 'parenthetical': return LINE_H;                     // no block margins
    case 'transition':    return 2 * EM   + LINE_H;          // 1em top + 1em bottom
    case 'act':           return 2.5 * EM + LINE_H;          // 1.5em top + 1em bottom
    default:              return EM       + textH;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

const ScriptEditor = forwardRef<ScriptEditorHandle, ScriptEditorProps>(function ScriptEditor(
  { nodes, onChange, onActiveTypeChange, activeElementType, showSceneNumbers = false, zoom = 100, nightMode = false, themeId, appliedAt },
  ref
) {
  const [lines, setLines] = useState<LineState[]>(() => nodesToLines(nodes));
  const [focusedId, setFocusedId] = useState<string | null>(null);
  // typeLabelId / typeMenuId used to power the per-line hover dropdown
  // (action → parenthetical etc.). That UI was removed because it popped up
  // on every mouse graze and duplicated the toolbar's element-type selector.
  // The toolbar dropdown + ⌘0–⌘8 + Tab are the supported paths now.
  const [acId, setAcId] = useState<string | null>(null);
  const [acSuggestions, setAcSuggestions] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [flashKey, setFlashKey] = useState(0);

  const divRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const sceneRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const undoStack = useRef<LineState[][]>([]);
  const redoStack = useRef<LineState[][]>([]);
  const isComposing = useRef(false);
  const nodesInitialized = useRef(false);
  // Tracks which version of initialHtml has been applied to each div
  const appliedVersions = useRef<Record<string, number>>({});

  // Initialize from nodes once
  useEffect(() => {
    if (!nodesInitialized.current) {
      nodesInitialized.current = true;
      setLines(nodesToLines(nodes));
    }
  }, []); // eslint-disable-line

  // After every render, sync divs whose version has changed
  useLayoutEffect(() => {
    lines.forEach(line => {
      const el = divRefs.current[line.id];
      if (!el) return;
      const applied = appliedVersions.current[line.id] ?? -1;
      if (line.version !== applied) {
        const wasFocused = document.activeElement === el;
        el.innerHTML = line.initialHtml;
        appliedVersions.current[line.id] = line.version;
        if (wasFocused) focusAtEnd(el);
      }
    });
  });

  // Notify parent of active type
  useEffect(() => {
    if (!focusedId) return;
    const line = lines.find(l => l.id === focusedId);
    if (line) onActiveTypeChange?.(line.type);
  }, [focusedId, lines]); // eslint-disable-line

  // Flash animation when script changes are applied from AI
  useEffect(() => {
    if (!appliedAt) return;
    setFlashKey(k => k + 1);
  }, [appliedAt]); // eslint-disable-line

  // Apply external type change from toolbar
  useEffect(() => {
    if (!activeElementType || !focusedId) return;
    updateLines(prev => prev.map(l =>
      l.id === focusedId ? { ...l, type: activeElementType } : l
    ));
  }, [activeElementType]); // eslint-disable-line

  // linesToNodes reads HTML from live divs to capture inline formatting
  function linesToNodes(ls: LineState[]): ScriptNode[] {
    return ls.map(l => {
      const el = divRefs.current[l.id];
      const html = el ? getHtmlFromEl(el) : l.initialHtml;
      const content = el ? getTextFromEl(el) : l.content;
      const hasFormatting = /<[biu][\s/>]|<strong|<em/i.test(html);
      return {
        type: l.type,
        content,
        html: hasFormatting ? html : undefined,
      };
    });
  }

  // Remember which line had focus when we snapshot so undo/redo can restore
  // the caret there instead of dropping it to the top of the document.
  const pushUndo = useCallback((prev: LineState[]) => {
    const snapshot = prev.map(l => ({
      ...l,
      initialHtml: divRefs.current[l.id] ? getHtmlFromEl(divRefs.current[l.id]!) : l.initialHtml,
      marks: new Set(l.marks),
      version: l.version + 1,
    }));
    // Attach a non-enumerable focusId sibling so we don't pollute LineState.
    (snapshot as unknown as { focusId?: string }).focusId = focusedId ?? undefined;
    undoStack.current.push(snapshot);
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }, [focusedId]);

  function updateLines(updater: (prev: LineState[]) => LineState[], saveUndo = true) {
    setLines(prev => {
      if (saveUndo) pushUndo(prev);
      const next = updater(prev);
      onChange(linesToNodes(next));
      return next;
    });
  }

  function handleDivInput(id: string, el: HTMLDivElement) {
    if (el.innerHTML === '<br>') el.innerHTML = '';
    const content = getTextFromEl(el);
    setLines(prev => {
      const next = prev.map(l => l.id === id ? { ...l, content } : l);
      onChange(linesToNodes(next));
      const line = prev.find(l => l.id === id);
      if (line && (line.type === 'character' || line.type === 'scene_heading') && content.trim()) {
        const pool = line.type === 'character' ? getCharacterNames(linesToNodes(next)) : getSceneHeadings(linesToNodes(next));
        const q = content.trim().toUpperCase();
        const matches = pool.filter(s => s.toUpperCase().startsWith(q) && s.toUpperCase() !== q);
        if (matches.length > 0) { setAcId(id); setAcSuggestions(matches); setAcIndex(0); }
        else { setAcId(null); setAcSuggestions([]); }
      } else { setAcId(null); setAcSuggestions([]); }
      return next;
    });
  }

  // Intercepts paste so text copied from another script / PDF / Word / browser
  // gets auto-classified into scene headings, action, character, dialogue,
  // parentheticals, and transitions — reusing the same parser we use for .fountain
  // imports. Single-line pastes drop through as plain text (no structure change,
  // but still strips rich styling). Whitespace-only pastes are ignored.
  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>, lineId: string) {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !text.trim()) return;

    e.preventDefault();

    if (!/\r?\n/.test(text)) {
      // Single line — insert plain text at caret, stripping any rich formatting.
      document.execCommand('insertText', false, text);
      return;
    }

    const parsed = parseFountain(text);
    if (parsed.length === 0) {
      document.execCommand('insertText', false, text);
      return;
    }

    const newLineStates: LineState[] = parsed.map(n => ({
      id: makeId(),
      type: n.type,
      content: n.content,
      initialHtml: n.html ?? escHtml(n.content),
      marks: new Set<'bold' | 'italic' | 'underline'>(),
      version: 0,
    }));
    const lastId = newLineStates[newLineStates.length - 1].id;

    updateLines(prev => {
      const curIdx = prev.findIndex(l => l.id === lineId);
      if (curIdx < 0) return prev;
      const curEl = divRefs.current[prev[curIdx].id];
      const curContent = curEl ? getTextFromEl(curEl) : prev[curIdx].content;
      if (!curContent.trim()) {
        // Replace the empty current line with the parsed nodes.
        return [...prev.slice(0, curIdx), ...newLineStates, ...prev.slice(curIdx + 1)];
      }
      // Current line has content — insert parsed nodes after it.
      return [...prev.slice(0, curIdx + 1), ...newLineStates, ...prev.slice(curIdx + 1)];
    });

    requestAnimationFrame(() => {
      const el = divRefs.current[lastId];
      if (el) focusAtEnd(el);
    });
  }

  function changeType(id: string, type: ElementType) {
    updateLines(prev => prev.map(l => l.id === id ? { ...l, type } : l));
  }

  function insertAfter(afterId: string, type: ElementType) {
    const newId = makeId();
    // Immediately blur the current contenteditable so any key events that
    // land before React commits the new line go nowhere instead of concat
    // onto the old line. This is the fix for the "MAYA + Enter + Thanks"
    // race that glued character + dialogue into one node.
    const active = document.activeElement as HTMLElement | null;
    if (active && active.isContentEditable) active.blur();

    // flushSync makes React commit synchronously so the new contenteditable
    // div is in the DOM by the time we try to focus it — no RAF needed, no
    // window where keystrokes are eaten.
    flushSync(() => {
      updateLines(prev => {
        const idx = prev.findIndex(l => l.id === afterId);
        const newLine: LineState = { id: newId, type, content: '', initialHtml: '', marks: new Set(), version: 0 };
        return [...prev.slice(0, idx + 1), newLine, ...prev.slice(idx + 1)];
      });
    });
    const newEl = divRefs.current[newId];
    if (newEl) focusAtEnd(newEl);
  }

  function deleteLine(id: string) {
    updateLines(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(l => l.id === id);
      const focusIdx = Math.max(0, idx - 1);
      const next = prev.filter(l => l.id !== id);
      requestAnimationFrame(() => {
        const target = next[focusIdx];
        if (target) {
          const el = divRefs.current[target.id];
          if (el) focusAtEnd(el);
        }
      });
      return next;
    });
  }

  function applyAutocomplete(suggestion: string, id: string) {
    const newHtml = escHtml(suggestion);
    setLines(prev => {
      const next = prev.map(l => l.id === id ? { ...l, content: suggestion, initialHtml: newHtml, version: l.version + 1 } : l);
      onChange(linesToNodes(next));
      return next;
    });
    setAcId(null); setAcSuggestions([]);
    requestAnimationFrame(() => {
      const el = divRefs.current[id];
      if (el) focusAtEnd(el);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>, line: LineState, idx: number) {
    // Autocomplete navigation
    if (acId === line.id && acSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAcIndex(i => (i + 1) % acSuggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAcIndex(i => (i - 1 + acSuggestions.length) % acSuggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyAutocomplete(acSuggestions[acIndex], line.id); return; }
      if (e.key === 'Escape') { setAcId(null); setAcSuggestions([]); return; }
    }

    const isMeta = e.metaKey || e.ctrlKey;

    if (isMeta) {
      const typeMap: Record<string, ElementType> = {
        '0': 'act', '1': 'scene_heading', '2': 'action', '3': 'character',
        '4': 'dialogue', '5': 'parenthetical', '6': 'transition', '7': 'shot', '8': 'text',
      };
      if (typeMap[e.key]) { e.preventDefault(); changeType(line.id, typeMap[e.key]); return; }
      if (e.key === 'b') { e.preventDefault(); applyMark('bold'); return; }
      if (e.key === 'i') { e.preventDefault(); applyMark('italic'); return; }
      if (e.key === 'u') { e.preventDefault(); applyMark('underline'); return; }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      changeType(line.id, TAB_NEXT[line.type]);
      return;
    }

    if (e.key === 'Enter' && !isComposing.current) {
      e.preventDefault();
      const nextType = e.shiftKey ? line.type : ENTER_NEXT[line.type];
      insertAfter(line.id, nextType);
      return;
    }

    if (e.key === 'Backspace') {
      const el = divRefs.current[line.id];
      const isEmpty = !el || getTextFromEl(el) === '';
      if (isEmpty) { e.preventDefault(); deleteLine(line.id); return; }
    }

    if (e.key === 'ArrowUp' && idx > 0) {
      const el = divRefs.current[line.id];
      if (el && isCaretAtStart(el)) {
        const prevEl = divRefs.current[lines[idx - 1]?.id];
        if (prevEl) { e.preventDefault(); focusAtEnd(prevEl); }
      }
    }
    if (e.key === 'ArrowDown' && idx < lines.length - 1) {
      const el = divRefs.current[line.id];
      if (el && isCaretAtEnd(el)) {
        const nextEl = divRefs.current[lines[idx + 1]?.id];
        if (nextEl) { e.preventDefault(); focusAtStart(nextEl); }
      }
    }
  }

  function applyMark(mark: 'bold' | 'italic' | 'underline') {
    // execCommand applies the mark only to the current selection
    document.execCommand(mark);
    // Sync plain-text content for word/page count
    if (focusedId) {
      const el = divRefs.current[focusedId];
      if (el) {
        const content = getTextFromEl(el);
        setLines(prev => prev.map(l => l.id === focusedId ? { ...l, content } : l));
      }
    }
  }

  // Restore caret to the line that had focus before we undid / redid. Without
  // this the cursor disappears mid-edit, a classic "did the app just eat my
  // work?" moment during a long writing session.
  function restoreCaretTo(lineId: string | undefined) {
    if (!lineId) return;
    // Defer a tick so React has committed the DOM before we hunt for the node.
    requestAnimationFrame(() => {
      const el = divRefs.current[lineId];
      if (el) focusAtEnd(el);
    });
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    const currentSnapshot = lines.map(l => ({
      ...l,
      initialHtml: divRefs.current[l.id] ? getHtmlFromEl(divRefs.current[l.id]!) : l.initialHtml,
      marks: new Set(l.marks),
      version: l.version + 1,
    }));
    (currentSnapshot as unknown as { focusId?: string }).focusId = focusedId ?? undefined;
    redoStack.current.push(currentSnapshot);
    setLines(prev);
    onChange(linesToNodes(prev));
    restoreCaretTo((prev as unknown as { focusId?: string }).focusId);
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    const currentSnapshot = lines.map(l => ({
      ...l,
      initialHtml: divRefs.current[l.id] ? getHtmlFromEl(divRefs.current[l.id]!) : l.initialHtml,
      marks: new Set(l.marks),
      version: l.version + 1,
    }));
    (currentSnapshot as unknown as { focusId?: string }).focusId = focusedId ?? undefined;
    undoStack.current.push(currentSnapshot);
    setLines(next);
    onChange(linesToNodes(next));
    restoreCaretTo((next as unknown as { focusId?: string }).focusId);
  }

  useImperativeHandle(ref, () => ({
    scrollToScene(sceneIndex: number) {
      const el = sceneRefs.current[sceneIndex];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    scrollToNode(nodeIndex: number) {
      const el = lineRefs.current[nodeIndex];
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    applyMark,
    undo,
    redo,
    resetNodes(nodes: ScriptNode[]) {
      const newLines = nodesToLines(nodes);
      setLines(newLines);
      onChange(linesToNodes(newLines));
    },
    replaceContent(nodeIdx: number, content: string) {
      setLines(prev => {
        const next = [...prev];
        if (next[nodeIdx]) {
          const newHtml = escHtml(content);
          next[nodeIdx] = { ...next[nodeIdx], content, initialHtml: newHtml, version: next[nodeIdx].version + 1 };
        }
        onChange(linesToNodes(next));
        return next;
      });
    },
  }));

  // Pre-compute page layout
  const theme = themeId ? getTheme(themeId) : null;
  const bgColor = theme ? theme.paperBg : (nightMode ? '#16213e' : '#ffffff');
  const textColor = theme ? theme.paperText : (nightMode ? '#e8e8e8' : '#1a1a1a');
  const focusBg = theme ? theme.focusBg : (nightMode ? '#003344' : '#e0f7fa');

  type LineMeta = { line: LineState; idx: number; isScene: boolean; sceneNum: number; pageIdx: number };
  const lineMetaList: LineMeta[] = [];
  {
    let cumLines = 0;
    let nextBreakAt = PAGE_CONTENT_PX;
    let currentPage = 0;
    let sceneCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nl = linesForNode(line.type, line.content);
      if (i > 0 && cumLines < nextBreakAt && cumLines + nl >= nextBreakAt) {
        currentPage++;
        nextBreakAt = (currentPage + 1) * PAGE_CONTENT_PX;
      }
      cumLines += nl;
      const isScene = line.type === 'scene_heading';
      if (isScene) sceneCount++;
      lineMetaList.push({ line, idx: i, isScene, sceneNum: sceneCount, pageIdx: currentPage });
    }
  }

  const totalPages = lineMetaList.length > 0 ? lineMetaList[lineMetaList.length - 1].pageIdx + 1 : 1;
  const pageGroups: LineMeta[][] = Array.from({ length: totalPages }, (_, pi) =>
    lineMetaList.filter(m => m.pageIdx === pi)
  );

  const sharedPageStyle: React.CSSProperties = {
    fontFamily: theme ? theme.fontFamily : '"Courier Prime", "Courier New", Courier, monospace',
    fontSize: '12pt',
    lineHeight: '1.0',   // industry-standard single-spaced Courier (≈55 lines / page)
    color: textColor,
    backgroundColor: bgColor,
    width: '816px',      // 8.5"
    minWidth: '816px',
    maxWidth: '816px',
    height: '1056px',    // 11"
    overflow: 'hidden',
    // Industry margins: 1.5" left (for hole-punch binding), 1" right/top/bottom.
    padding: '96px 96px 96px 144px',
    boxSizing: 'border-box',
    boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
    position: 'relative',
    flexShrink: 0,
  };

  return (
    <>
      {pageGroups.map((pageMeta, pageIdx) => (
        <div
          key={pageIdx}
          className={`script-page-screen${flashKey > 0 ? ' script-apply-flash' : ''}`}
          style={{ ...sharedPageStyle, marginBottom: pageIdx < totalPages - 1 ? '24px' : 0 }}
        >
          {pageIdx > 0 && (
            <div
              className="absolute select-none pointer-events-none"
              style={{ top: '48px', right: '96px', fontSize: '10pt', color: textColor, opacity: 0.25, fontFamily: 'inherit' }}
            >
              {pageIdx + 1}.
            </div>
          )}

          {pageMeta.map(({ line, idx, isScene, sceneNum }) => {
            const isFocused = focusedId === line.id;
            const showTealBar = isScene && isFocused;
            const textStyle: React.CSSProperties = {
              ...ELEMENT_STYLES[line.type],
            };

            return (
              <div
                key={line.id}
                ref={el => {
                  lineRefs.current[idx] = el;
                  if (isScene) sceneRefs.current[sceneNum] = el;
                }}
                className="relative group"
                style={{
                  backgroundColor: showTealBar ? focusBg : 'transparent',
                  marginLeft: showTealBar ? '-120px' : undefined,
                  marginRight: showTealBar ? '-96px' : undefined,
                  paddingLeft: showTealBar ? '120px' : undefined,
                  paddingRight: showTealBar ? '96px' : undefined,
                } as React.CSSProperties}
                // Per-line hover used to spawn a floating "Action ▾" pill
                // that let you retype the element. It popped up every time
                // the mouse grazed a line and was redundant with the
                // toolbar's dropdown (top-left, shows the same thing).
                // Removed. The toolbar dropdown + ⌘0–⌘8 shortcuts + Tab
                // cycling remain the only ways to change element type.
              >
                {showSceneNumbers && isScene && (
                  <>
                    <span className="absolute text-xs text-gray-400 select-none" style={{ left: '-60px', top: '0.1em' }}>{sceneNum}.</span>
                    <span className="absolute text-xs text-gray-400 select-none" style={{ right: '-60px', top: '0.1em' }}>{sceneNum}.</span>
                  </>
                )}

                {/* Per-line element-type dropdown removed — was popping up on
                    every hover and duplicating the toolbar's dropdown. */}

                {/* Contenteditable line — inline formatting via execCommand */}
                <div
                  ref={el => { divRefs.current[line.id] = el; }}
                  contentEditable
                  suppressContentEditableWarning
                  data-node-idx={idx}
                  data-placeholder={isFocused ? PLACEHOLDER[line.type] : ''}
                  onInput={e => handleDivInput(line.id, e.currentTarget)}
                  onKeyDown={e => handleKeyDown(e, line, idx)}
                  onPaste={e => handlePaste(e, line.id)}
                  onFocus={() => setFocusedId(line.id)}
                  onBlur={() => { setTimeout(() => setAcId(null), 150); }}
                  onCompositionStart={() => { isComposing.current = true; }}
                  onCompositionEnd={() => { isComposing.current = false; }}
                  style={{
                    ...textStyle,
                    display: 'block',
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    lineHeight: 'inherit',
                    color: textColor,
                    caretColor: textColor,
                    minHeight: '1.2em',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box',
                  }}
                />

                {acId === line.id && acSuggestions.length > 0 && (
                  <div
                    className="absolute z-30 bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-xl py-1 text-xs overflow-hidden"
                    style={{ top: '100%', left: typeof ELEMENT_STYLES[line.type].paddingLeft === 'string' ? ELEMENT_STYLES[line.type].paddingLeft : '0', minWidth: '200px', maxWidth: '400px' }}
                  >
                    {acSuggestions.slice(0, 6).map((s, si) => (
                      <button key={s} onMouseDown={() => applyAutocomplete(s, line.id)}
                        className={`w-full text-left px-3 py-1.5 transition-colors ${si === acIndex ? 'bg-teal-900/40 text-teal-300' : 'text-gray-300 hover:bg-gray-800'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Print-only static render — flat flow, browser handles pagination via @page margins */}
      <div className="script-print-only" style={{ display: 'none' }}>
        {lines.map((line) => {
          const el = divRefs.current[line.id];
          const html = el ? getHtmlFromEl(el) : line.initialHtml;
          return (
            <div
              key={line.id}
              data-type={line.type}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: html || '\u00A0' }}
              style={{
                ...ELEMENT_STYLES[line.type],
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#000',
                background: 'transparent',
              }}
            />
          );
        })}
      </div>
    </>
  );
});

export default ScriptEditor;
