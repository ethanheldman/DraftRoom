import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon, ShareIcon, LogOutIcon, UserIcon as UserLucideIcon } from 'lucide-react';
import { Button } from '../ui/joly-button';
import type { ElementType } from '../../types/screenplay';
import { isPro, type Plan } from '../../lib/plan';
import { ATMOSPHERE_THEMES } from '../../utils/themes';
import { useAuth } from '../../context/AuthContext';

interface MenuBarProps {
  title: string;
  onImport: (nodes: import('../../types/screenplay').ScriptNode[]) => void;
  onExportFountain: () => void;
  onExportTxt: () => void;
  onRename: () => void;
  onSave: () => void;
  onBold: () => void;
  onItalic: () => void;
  onUnderline: () => void;
  onToggleSceneNumbers: () => void;
  onFindReplace: () => void;
  onToggleTitlePage: () => void;
  onInsights: () => void;
  onToggleNav: () => void;
  onZoom: (zoom: number) => void;
  onNightMode: () => void;
  onScriptGoals: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAIPanel: () => void;
  plan: Plan;
  onExportFDX: () => void;
  onVersionHistory: () => void;
  onPrintOptions: () => void;
  onSetTheme: (id: string) => void;
  currentThemeId: string;
  nightMode: boolean;
  currentZoom: number;
  sceneNumbersVisible: boolean;
}

type MenuName = 'file' | 'edit' | 'view' | 'help' | null;

// Keep in lock-step with ELEMENT_SHORTCUTS in ScriptEditor.tsx.
const SHORTCUTS_HELP = [
  { keys: '⌘0', action: 'Act' },
  { keys: '⌘1', action: 'Scene Heading' },
  { keys: '⌘2', action: 'Action' },
  { keys: '⌘3', action: 'Character' },
  { keys: '⌘4', action: 'Dialogue' },
  { keys: '⌘5', action: 'Parenthetical' },
  { keys: '⌘6', action: 'Transition' },
  { keys: '⌘7', action: 'Shot' },
  { keys: '⌘8', action: 'Text' },
  { keys: '⌘B', action: 'Bold' },
  { keys: '⌘I', action: 'Italic' },
  { keys: '⌘U', action: 'Underline' },
  { keys: '⌘S', action: 'Save' },
  { keys: '⌘P', action: 'Print/PDF' },
  { keys: '⌘F', action: 'Find & Replace' },
  { keys: '⌘Z', action: 'Undo' },
  { keys: '⌘⇧Z', action: 'Redo' },
  { keys: 'Tab', action: 'Cycle element type' },
  { keys: 'Enter', action: 'Next logical element' },
  { keys: '↑/↓', action: 'Navigate lines' },
];

export default function MenuBar({
  title,
  onImport,
  onExportFountain,
  onExportTxt,
  onRename,
  onSave,
  onBold,
  onItalic,
  onUnderline,
  onToggleSceneNumbers,
  onFindReplace,
  onToggleTitlePage,
  onInsights,
  onToggleNav,
  onZoom,
  onNightMode,
  onScriptGoals,
  onUndo,
  onRedo,
  onAIPanel,
  plan,
  onExportFDX,
  onVersionHistory,
  onPrintOptions,
  onSetTheme,
  currentThemeId,
  nightMode,
  currentZoom,
  sceneNumbersVisible,
}: MenuBarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [openMenu, setOpenMenu] = useState<MenuName>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Initial from the email for the avatar circle — falls back to "U" so the
  // avatar never disappears. Supabase email is authoritative; we don't read
  // localStorage profile here to avoid a cross-module dep.
  const avatarInitial = (user?.email?.[0] ?? 'U').toUpperCase();

  async function handleSignOut() {
    const ok = window.confirm('Sign out of DraftRoom? Your work is saved — you can sign back in any time.');
    if (!ok) return;
    setShowAccountMenu(false);
    await signOut();
    navigate('/', { replace: true });
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close any modal on Escape. Previously Version History / Find & Replace /
  // Atmosphere picker only closed via their × buttons, breaking the standard
  // "Esc dismisses an overlay" muscle memory.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (showHelp)         { e.preventDefault(); setShowHelp(false); }
      if (showShare)        { e.preventDefault(); setShowShare(false); }
      if (showThemePicker)  { e.preventDefault(); setShowThemePicker(false); }
      if (showAccountMenu)  { e.preventDefault(); setShowAccountMenu(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHelp, showShare, showThemePicker, showAccountMenu]);

  async function handleCopyShareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1600);
    } catch {
      // Clipboard API blocked (permissions, insecure context). Silently fail;
      // the URL text input is still selectable so the user can copy manually.
    }
  }

  function toggleMenu(name: MenuName) {
    setOpenMenu((prev) => (prev === name ? null : name));
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const lname = file.name.toLowerCase();
    const { parseFountain, parseFDX, parsePDF } = await import('../../utils/fountain');
    let nodes;
    if (lname.endsWith('.pdf')) {
      nodes = await parsePDF(await file.arrayBuffer());
    } else if (lname.endsWith('.fdx')) {
      nodes = parseFDX(await file.text());
    } else {
      nodes = parseFountain(await file.text());
    }
    onImport(nodes);
    closeMenu();
    e.target.value = '';
  }

  const menuItemClass =
    'flex items-center justify-between gap-4 px-3 py-2 text-xs cursor-pointer whitespace-nowrap transition-colors duration-150 mx-1 my-0.5';
  const separatorClass = 'my-1 mx-2 h-px';
  const dropdownStyle: React.CSSProperties = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  };

  return (
    <div
      className="no-print flex items-center h-10 px-4 gap-1 text-xs select-none font-geist relative z-50"
      style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))' }}
      ref={menuRef}
    >
      {/* Back button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1 px-2 py-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        title="Back to projects"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Script title */}
      <span className="text-foreground/80 font-medium text-xs mr-2 truncate max-w-48">{title}</span>

      <div className="flex-1" />

      {/* Menu items */}
      <div className="flex items-center gap-0.5">
        {/* File */}
        <div className="relative">
          <button
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
              openMenu === 'file' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            onClick={() => toggleMenu('file')}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="absolute top-full left-0 mt-1 min-w-[17rem] z-50 py-1.5 overflow-hidden" style={dropdownStyle}>
              <div className={menuItemClass} onClick={() => { fileInputRef.current?.click(); }}>
                Import (.fountain, .fdx, .txt)
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".fountain,.txt,.fdx,.pdf"
                className="hidden"
                onChange={handleImport}
              />
              <div className={menuItemClass} onClick={() => { onExportFountain(); closeMenu(); }}>
                Export to Fountain
              </div>
              <div className={menuItemClass} onClick={() => { onExportTxt(); closeMenu(); }}>
                Export to Text
              </div>
              <div className={menuItemClass} onClick={() => { onExportFDX(); closeMenu(); }}>
                Export to Final Draft (.fdx)
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onRename(); closeMenu(); }}>
                Rename Script
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onVersionHistory(); closeMenu(); }}>
                Version History
              </div>
              <div className={menuItemClass} onClick={() => { onPrintOptions(); closeMenu(); }}>
                Print / Download PDF <span className="text-muted-foreground text-xs ml-auto">⌘P</span>
              </div>
              <div className={menuItemClass} onClick={() => { onSave(); closeMenu(); }}>
                Save <span className="text-muted-foreground text-xs ml-auto">⌘S</span>
              </div>
            </div>
          )}
        </div>

        {/* Edit */}
        <div className="relative">
          <button
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
              openMenu === 'edit' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            onClick={() => toggleMenu('edit')}
          >
            Edit
          </button>
          {openMenu === 'edit' && (
            <div className="absolute top-full left-0 mt-1 min-w-[17rem] z-50 py-1.5 overflow-hidden" style={dropdownStyle}>
              <div className={menuItemClass} onClick={() => { onUndo(); closeMenu(); }}>
                Undo <span className="text-muted-foreground text-xs ml-auto">⌘Z</span>
              </div>
              <div className={menuItemClass} onClick={() => { onRedo(); closeMenu(); }}>
                Redo <span className="text-muted-foreground text-xs ml-auto">⌘⇧Z</span>
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onBold(); closeMenu(); }}>
                Bold <span className="text-muted-foreground text-xs ml-auto">⌘B</span>
              </div>
              <div className={menuItemClass} onClick={() => { onItalic(); closeMenu(); }}>
                Italic <span className="text-muted-foreground text-xs ml-auto">⌘I</span>
              </div>
              <div className={menuItemClass} onClick={() => { onUnderline(); closeMenu(); }}>
                Underline <span className="text-muted-foreground text-xs ml-auto">⌘U</span>
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onToggleSceneNumbers(); closeMenu(); }}>
                {sceneNumbersVisible ? 'Remove Scene Numbers' : 'Add Scene Numbers'}
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onFindReplace(); closeMenu(); }}>
                Find & Replace <span className="text-muted-foreground text-xs ml-auto">⌘F</span>
              </div>
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { onToggleTitlePage(); closeMenu(); }}>
                Show/Edit Title Page
              </div>
            </div>
          )}
        </div>

        {/* View */}
        <div className="relative">
          <button
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
              openMenu === 'view' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            onClick={() => toggleMenu('view')}
          >
            View
          </button>
          {openMenu === 'view' && (
            <div className="absolute top-full left-0 mt-1 min-w-[17rem] z-50 py-1.5 overflow-hidden" style={dropdownStyle}>
              <div className={menuItemClass} onClick={() => { onInsights(); closeMenu(); }}>
                Script Insights
              </div>
              <div className={menuItemClass} onClick={() => { onToggleNav(); closeMenu(); }}>
                Navigation
              </div>
              <div className={separatorClass} />
              {[75, 100, 125, 150].map((z) => (
                <div
                  key={z}
                  className={`${menuItemClass} ${currentZoom === z ? 'text-primary' : ''}`}
                  onClick={() => { onZoom(z); closeMenu(); }}
                >
                  Zoom {z}% {currentZoom === z && '✓'}
                </div>
              ))}
              <div className={separatorClass} />
              <div className={menuItemClass} onClick={() => { setShowThemePicker(v => !v); closeMenu(); }}>
                <span>Paper Style</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {ATMOSPHERE_THEMES.find(t => t.id === currentThemeId)?.name ?? 'Standard'}
                </span>
              </div>
              <div className={menuItemClass} onClick={() => { onScriptGoals(); closeMenu(); }}>
                Script Goals
              </div>
            </div>
          )}

          {/* Floating atmosphere theme picker */}
          {showThemePicker && (
            <div
              className="absolute top-full left-0 mt-0.5 z-50 rounded-2xl shadow-2xl p-4"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', width: 460 }}
            >
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <p className="text-xs font-bold text-foreground">Paper Style</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    Only changes the script page itself — canvas, page colour, ink tone.
                    For full app colour scheme, use Profile → Theme.
                  </p>
                </div>
                <button onClick={() => setShowThemePicker(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground text-xs flex-shrink-0">✕</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {ATMOSPHERE_THEMES.map(t => {
                  const active = t.id === currentThemeId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => { onSetTheme(t.id); setShowThemePicker(false); }}
                      className="flex flex-col gap-1.5 rounded-xl p-1.5 transition-all hover:scale-105 text-left"
                      style={{
                        border: `2px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                        background: active ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                      }}
                    >
                      {/* Mini paper preview */}
                      <div
                        className="w-full rounded-lg overflow-hidden relative"
                        style={{ height: 52, background: t.scrollBg }}
                      >
                        <div
                          className="absolute inset-x-2 inset-y-1.5 rounded"
                          style={{ background: t.paperBg }}
                        >
                          {/* Fake script lines */}
                          {[0.22, 0.45, 0.58, 0.72, 0.85].map((top, i) => (
                            <div key={i} className="absolute rounded-full"
                              style={{
                                top: `${top * 100}%`,
                                left: i === 0 ? '10%' : i === 2 ? '20%' : '8%',
                                width: i === 0 ? '60%' : i === 2 ? '40%' : ['55%', '48%', '38%', '52%', '44%'][i],
                                height: 1.5,
                                background: t.paperText,
                                opacity: i === 0 ? 0.7 : 0.3,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="px-0.5">
                        <p className="text-[10px] font-semibold text-foreground leading-tight">{t.icon} {t.name}</p>
                        <p className="text-[8.5px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{t.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative">
          <button
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
              openMenu === 'help' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
            onClick={() => toggleMenu('help')}
          >
            Help
          </button>
          {openMenu === 'help' && (
            <div className="absolute top-full left-0 mt-1 min-w-[17rem] z-50 py-1.5 overflow-hidden" style={dropdownStyle}>
              <div className={menuItemClass} onClick={() => { setShowHelp(true); closeMenu(); }}>
                Keyboard Shortcuts
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {/* Right side buttons */}
      <div className="flex items-center gap-2">
        {isPro(plan) && (
          <Button
            data-tour="ai-script-doctor"
            variant="glow"
            size="sm"
            onClick={onAIPanel}
          >
            <SparklesIcon size={13} />
            AI
          </Button>
        )}

        <Button
          variant="shimmer"
          size="sm"
          onClick={() => setShowShare(true)}
        >
          <ShareIcon size={13} />
          Share
        </Button>

        {/*
          Account avatar dropdown. Replaces the static "U" div, which looked
          clickable but did nothing. Opens a small popover with the user's
          email, a Profile link, and — critically — Sign Out. Prior to this
          the ONLY way to log out was to clear localStorage manually.
        */}
        <div className="relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu(v => !v)}
            aria-label="Account menu"
            className="w-7 h-7 flex items-center justify-center text-xs font-bold transition-opacity hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            {avatarInitial}
          </button>
          {showAccountMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-60 rounded-lg shadow-xl z-50 py-1"
              style={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }}
            >
              <div className="px-3 py-2 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <p className="text-[11px] text-muted-foreground">Signed in as</p>
                <p className="text-xs text-foreground font-medium truncate">{user?.email ?? 'Anonymous'}</p>
              </div>
              <button
                onClick={() => { setShowAccountMenu(false); navigate('/dashboard'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                style={{ color: 'hsl(var(--foreground))' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <UserLucideIcon size={13} /> Profile & projects
              </button>
              <div className="my-1 mx-2 h-px" style={{ background: 'hsl(var(--border))' }} />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors"
                style={{ color: 'hsl(var(--destructive))' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--destructive) / 0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOutIcon size={13} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard shortcuts modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowHelp(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-80 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-foreground font-semibold text-sm">Keyboard Shortcuts</h2>
              <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <div className="space-y-1">
              {SHORTCUTS_HELP.map((s) => (
                <div key={s.keys} className="flex justify-between text-xs py-1 border-b border-border">
                  <span className="text-foreground/80">{s.action}</span>
                  <span className="text-primary font-mono">{s.keys}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*
        Share modal. Previously the Share button in the top bar was a no-op —
        clicking did nothing at all. This shows a minimal share-this-project
        flow: copy the URL, open the Collaborators drawer (Sidebar), or
        invoke the system share sheet when available.
      */}
      {showShare && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowShare(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-96 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-foreground font-semibold text-sm">Share this script</h2>
              <button onClick={() => setShowShare(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Anyone with this link and access to your workspace can open the script.
              True real-time collaboration is coming soon — for now, send a read-only PDF
              via <span className="font-semibold">File → Print / Download PDF</span>.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={window.location.href}
                onFocus={e => e.currentTarget.select()}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-mono outline-none"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              />
              <button
                onClick={handleCopyShareUrl}
                className="px-3 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                {shareCopied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowShare(false); if (typeof navigator.share === 'function') navigator.share({ title, url: window.location.href }).catch(() => {}); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
              >
                {typeof navigator.share === 'function' ? 'System share…' : 'Email link'}
              </button>
              <button
                onClick={() => { setShowShare(false); onPrintOptions(); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
              >
                Export PDF…
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
