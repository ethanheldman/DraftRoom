import { useState } from 'react';
import type { Project } from '../../types/screenplay';

export type EditorView = 'script' | 'beat-sheet' | 'cast-crew' | 'storyboard' | 'budget' | 'schedule' | 'files';

interface SidebarProps {
  project: Project;
  currentView: EditorView;
  onNavigate: (view: EditorView) => void;
  onClose?: () => void;
}

// ── Icons (inline SVG to avoid extra imports) ─────────────────────────────────

function IconScript() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconBeatSheet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconStoryboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  );
}
function IconCast() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconBudget() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconSchedule() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconFiles() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IconCollaborators() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/>
      <line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  );
}

// ── Nav definition ─────────────────────────────────────────────────────────────

type NavId = EditorView | 'collaborators';

interface NavItem {
  id: NavId;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'script',        label: 'Script',        icon: <IconScript /> },
  { id: 'beat-sheet',    label: 'Beat Sheet',     icon: <IconBeatSheet /> },
  { id: 'storyboard',    label: 'Storyboard',     icon: <IconStoryboard /> },
  { id: 'cast-crew',     label: 'Cast & Crew',    icon: <IconCast /> },
  { id: 'budget',        label: 'Budget',         icon: <IconBudget /> },
  { id: 'schedule',      label: 'Schedule',       icon: <IconSchedule /> },
  { id: 'files',         label: 'Files & Media',  icon: <IconFiles />, dividerBefore: true },
  { id: 'collaborators', label: 'Collaborators',  icon: <IconCollaborators />, badge: '0', dividerBefore: true },
];

// ── Tooltip wrapper ────────────────────────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative flex items-center justify-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div
          className="absolute left-full ml-3 z-50 whitespace-nowrap pointer-events-none"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 500,
            color: 'hsl(var(--foreground))',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Sidebar({ project, currentView, onNavigate, onClose }: SidebarProps) {
  const [showCollabModal, setShowCollabModal] = useState(false);

  return (
    <>
      {/* Icon rail */}
      <div className="no-print flex flex-col items-center py-4 gap-2 flex-shrink-0 relative z-40"
        style={{
          width: 56,
          background: 'hsl(var(--card))',
          borderRight: '1px solid hsl(var(--border))',
          height: '100%',
        }}>

        {/* Project avatar */}
        <Tooltip label={project.title}>
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold text-white mb-2 flex-shrink-0 cursor-default"
            style={{ background: project.color }}>
            {project.title.charAt(0).toUpperCase()}
          </div>
        </Tooltip>

        {/* Close button */}
        {onClose && (
          <Tooltip label="Close sidebar">
            <button
              onClick={onClose}
              aria-label="Close sidebar"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mb-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </Tooltip>
        )}

        {/* Divider */}
        <div style={{ width: 28, height: 1, background: 'hsl(var(--border))', margin: '4px 0' }} />

        {/* Nav items */}
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === currentView;
          const isCollab = item.id === 'collaborators';

          return (
            <div key={item.id} className="flex flex-col items-center w-full">
              {item.dividerBefore && (
                <div style={{ width: 28, height: 1, background: 'hsl(var(--border))', margin: '4px 0' }} />
              )}
              <Tooltip label={item.label}>
                <button
                  onClick={() => {
                    if (isCollab) { setShowCollabModal(true); return; }
                    onNavigate(item.id as EditorView);
                  }}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="relative w-11 h-11 flex items-center justify-center transition-all duration-200"
                  style={isActive ? {
                    color: 'hsl(var(--primary))',
                    borderLeft: '2px solid hsl(var(--primary))',
                    background: 'hsl(var(--primary) / 0.1)',
                  } : {
                    color: 'hsl(var(--muted-foreground))',
                    borderLeft: '2px solid transparent',
                  }}
                >
                  {item.icon}
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>

      {/* Collaborators modal */}
      {showCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowCollabModal(false)}>
          <div className="w-80 rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-1">Collaborators</h3>
            <p className="text-xs text-muted-foreground mb-4">Real-time collaboration requires a server subscription. To share manually, send your collaborator this project ID:</p>
            <div className="rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-mono text-primary mb-4 select-all break-all">{project.id}</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center text-xs font-bold" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                {project.title.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs text-foreground font-medium">You</p>
                <p className="text-[10px] text-muted-foreground">Owner</p>
              </div>
            </div>
            <button onClick={() => setShowCollabModal(false)} className="w-full py-2.5 text-xs font-medium transition-colors" style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
