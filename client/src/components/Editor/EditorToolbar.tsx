import { useState, useRef, useEffect } from 'react';
import type { ElementType } from '../../types/screenplay';
import { motion, AnimatePresence } from 'framer-motion';

interface EditorToolbarProps {
  activeType: ElementType;
  zoom: number;
  onToggleNav: () => void;
  onTypeChange: (type: ElementType) => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onZoom: (zoom: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleComments?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

// IMPORTANT: Keep this table in lock-step with ELEMENT_SHORTCUTS in ScriptEditor.tsx.
// They are the single source of truth for keyboard bindings; divergence = user confusion.
const ELEMENT_TYPES: { type: ElementType; label: string; shortcut: string }[] = [
  { type: 'act',           label: 'Act',           shortcut: '⌘0' },
  { type: 'scene_heading', label: 'Scene Heading', shortcut: '⌘1' },
  { type: 'action',        label: 'Action',        shortcut: '⌘2' },
  { type: 'character',     label: 'Character',     shortcut: '⌘3' },
  { type: 'dialogue',      label: 'Dialogue',      shortcut: '⌘4' },
  { type: 'parenthetical', label: 'Parenthetical', shortcut: '⌘5' },
  { type: 'transition',    label: 'Transition',    shortcut: '⌘6' },
  { type: 'shot',          label: 'Shot',          shortcut: '⌘7' },
  { type: 'text',          label: 'Text',          shortcut: '⌘8' },
];

export default function EditorToolbar({
  activeType,
  zoom,
  onToggleNav,
  onTypeChange,
  onBold,
  onItalic,
  onUnderline,
  onZoom,
  onUndo,
  onRedo,
  onToggleComments,
  canUndo = true,
  canRedo = true,
  isBold = false,
  isItalic = false,
  isUnderline = false,
}: EditorToolbarProps) {
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [zoomDropdownOpen, setZoomDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const zoomDropdownRef = useRef<HTMLDivElement>(null);

  const activeTypeInfo = ELEMENT_TYPES.find((t) => t.type === activeType);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
      if (zoomDropdownRef.current && !zoomDropdownRef.current.contains(e.target as Node)) {
        setZoomDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const btnClass =
    'flex items-center justify-center w-8 h-8 rounded-xl text-muted-foreground hover:text-white hover:bg-white/10 transition-all duration-200 text-xs font-medium';
  const activeBtnClass = 'flex items-center justify-center w-8 h-8 rounded-xl bg-primary/20 text-primary shadow-[0_0_12px_rgba(139,92,246,0.25)] transition-all duration-200 text-xs font-medium border border-primary/30';

  return (
    <div data-tour="editor-toolbar" className="no-print flex items-center gap-1 h-11 px-4 bg-card/60 backdrop-blur-xl border-b border-white/5 select-none font-geist shadow-sm relative z-40">
      {/* Nav toggle */}
      <button
        onClick={onToggleNav}
        className={btnClass}
        title="Toggle Navigation"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Element type dropdown */}
      <div className="relative ml-1" ref={typeDropdownRef}>
        <button
          onClick={() => setTypeDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-xl text-foreground text-sm font-medium transition-all min-w-[140px] hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}
        >
          <span className="flex-1 text-left">{activeTypeInfo?.label ?? 'Action'}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               style={{ transform: typeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <AnimatePresence>
          {typeDropdownOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-full left-0 mt-2 w-56 bg-card/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-50 py-1.5 overflow-hidden"
            >
              {ELEMENT_TYPES.map((et) => (
                <button
                  key={et.type}
                  onClick={() => {
                    onTypeChange(et.type);
                    setTypeDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-2 text-xs transition-colors ${
                    et.type === activeType ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{et.label}</span>
                  <span className={et.type === activeType ? 'text-primary' : 'text-muted-foreground'}>{et.shortcut}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* Bold */}
      <button onClick={onBold}
        className={isBold ? activeBtnClass : btnClass}
        title="Bold (⌘B)">
        <span className="font-bold text-sm">B</span>
      </button>

      {/* Italic */}
      <button onClick={onItalic}
        className={isItalic ? activeBtnClass : btnClass}
        title="Italic (⌘I)">
        <span className="italic text-sm">I</span>
      </button>

      {/* Underline */}
      <button onClick={onUnderline}
        className={isUnderline ? activeBtnClass : btnClass}
        title="Underline (⌘U)">
        <span className="underline text-sm">U</span>
      </button>

      {/* Comments / Notes */}
      <button onClick={onToggleComments} className={btnClass} title="Script Notes — open notes panel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* Zoom dropdown */}
      <div className="relative" ref={zoomDropdownRef}>
        <button
          onClick={() => setZoomDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-xl text-foreground text-sm font-medium transition-all hover:bg-white/5"
          style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}
        >
          {zoom}%
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
               style={{ transform: zoomDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <AnimatePresence>
          {zoomDropdownOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-full left-0 mt-2 w-28 bg-card/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.5)] z-50 py-1.5 overflow-hidden"
            >
              {[75, 100, 125, 150].map((z) => (
                <button
                  key={z}
                  onClick={() => {
                    onZoom(z);
                    setZoomDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                    z === zoom ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {z}%
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* Undo */}
      <button onClick={onUndo}
        className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-medium transition-all duration-200 ${!canUndo ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'text-muted-foreground hover:text-white hover:bg-white/10'}`}
        title="Undo (⌘Z)"
        disabled={!canUndo}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-4.8L1 10" />
        </svg>
      </button>

      {/* Redo */}
      <button onClick={onRedo}
        className={`flex items-center justify-center w-8 h-8 rounded-xl text-xs font-medium transition-all duration-200 ${!canRedo ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'text-muted-foreground hover:text-white hover:bg-white/10'}`}
        title="Redo (⌘⇧Z)"
        disabled={!canRedo}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-.49-4.8L23 10" />
        </svg>
      </button>
    </div>
  );
}
