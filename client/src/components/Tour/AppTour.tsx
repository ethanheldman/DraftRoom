import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTour } from '../../context/TourContext';
import { PROJECTS_KEY } from '../../utils/storage';

// ─── Step definitions ────────────────────────────────────────────────────────

// Keep in sync with COMMUNITY_ENABLED in ProjectsDashboard.tsx. When the tab is
// hidden, skip its tour step so users aren't told about a feature they can't see.
const COMMUNITY_ENABLED = false;

interface TourStep {
  id: string;
  title: string;
  body: string;
  icon: string;
  target: string | null;       // data-tour attribute value
  route: 'dashboard' | 'editor' | 'any';
  dashView?: string;           // dispatches tour:dash-view event
  editorView?: string;         // dispatches tour:editor-view event
  cardPlacement: 'center' | 'bottom-right';
}

const ALL_STEPS: TourStep[] = [
  {
    id: 'welcome',
    icon: '🎬',
    title: 'Welcome to DraftRoom',
    body: 'Let\'s take a 60-second tour of the app so you know exactly where everything is. Skip anytime.',
    target: null,
    route: 'any',
    cardPlacement: 'center',
  },
  {
    id: 'project-cards',
    icon: '📁',
    title: 'Your Scripts',
    body: 'Every screenplay you create lives here as a card. Each one tracks word count, page count, and your daily writing momentum.',
    target: 'project-cards',
    route: 'dashboard',
    dashView: 'projects',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'create-project',
    icon: '✨',
    title: 'Start a New Script',
    body: 'Hit this button to create a new screenplay or TV series. Choose your genre, add a logline, and you\'re writing in seconds.',
    target: 'create-project-btn',
    route: 'dashboard',
    dashView: 'projects',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'dash-nav',
    icon: '🗂️',
    title: 'Dashboard Navigation',
    body: 'Switch between your active scripts, archived work, project management, and the full writing guide from here.',
    target: 'dash-sidebar',
    route: 'dashboard',
    dashView: 'projects',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'editor',
    icon: '✍️',
    title: 'The Script Editor',
    body: 'Write your screenplay here. The editor auto-formats everything — just type and DraftRoom handles scene headings, action lines, dialogue, and more.',
    target: 'script-editor-area',
    route: 'editor',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'toolbar',
    icon: '⌨️',
    title: 'Element Toolbar',
    body: 'Switch element types in one click — or use keyboard shortcuts: ⌘1 Scene Heading, ⌘2 Action, ⌘3 Character, ⌘4 Dialogue.',
    target: 'editor-toolbar',
    route: 'editor',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'beat-sheet',
    icon: '📋',
    title: 'Beat Sheet',
    body: 'Plan your story structure before you write. Use AI to generate a beat sheet from your logline, or build one card by card.',
    target: 'beat-sheet-view',
    route: 'editor',
    editorView: 'beat-sheet',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'ai-tools',
    icon: '🤖',
    title: 'AI Script Doctor',
    body: 'Your AI writing partner lives in the right panel. Ask for scene analysis, character backstory, alternate dialogue, or a full script critique.',
    target: 'ai-script-doctor',
    route: 'editor',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'community',
    icon: '👥',
    title: 'Writing Squad',
    body: 'Connect with other screenwriters. Add friends, share scripts for feedback, send direct messages, and build your squad.',
    target: 'community-view',
    route: 'dashboard',
    dashView: 'community',
    cardPlacement: 'bottom-right',
  },
  {
    id: 'done',
    icon: '🚀',
    title: 'You\'re Ready to Write!',
    body: 'That\'s everything. The Help Center has detailed guides whenever you need them. Now go write something great.',
    target: null,
    route: 'any',
    cardPlacement: 'center',
  },
];

const STEPS: TourStep[] = ALL_STEPS.filter(
  (s) => COMMUNITY_ENABLED || s.id !== 'community'
);

// ─── Spotlight ────────────────────────────────────────────────────────────────

interface Rect { top: number; left: number; width: number; height: number; }

function Spotlight({ rect }: { rect: Rect }) {
  const pad = 10;
  const t = rect.top - pad;
  const l = rect.left - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;

  const overlay = 'rgba(0,0,0,0.72)';
  return (
    <>
      {/* top */}
      <div style={{ position: 'fixed', inset: 0, top: 0, left: 0, right: 0, height: t, background: overlay, zIndex: 9990, pointerEvents: 'none' }} />
      {/* bottom */}
      <div style={{ position: 'fixed', top: t + h, left: 0, right: 0, bottom: 0, background: overlay, zIndex: 9990, pointerEvents: 'none' }} />
      {/* left */}
      <div style={{ position: 'fixed', top: t, left: 0, width: l, height: h, background: overlay, zIndex: 9990, pointerEvents: 'none' }} />
      {/* right */}
      <div style={{ position: 'fixed', top: t, left: l + w, right: 0, height: h, background: overlay, zIndex: 9990, pointerEvents: 'none' }} />
      {/* highlight ring */}
      <div style={{
        position: 'fixed', top: t, left: l, width: w, height: h,
        borderRadius: 12,
        border: '2px solid hsl(var(--primary))',
        boxShadow: '0 0 0 3px hsl(var(--primary) / 0.25), 0 0 32px hsl(var(--primary) / 0.3)',
        zIndex: 9991, pointerEvents: 'none',
        animation: 'tour-pulse 2s ease-in-out infinite',
      }} />
    </>
  );
}

// ─── Tour Card ────────────────────────────────────────────────────────────────

interface CardProps {
  step: TourStep;
  stepIdx: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onEnd: () => void;
  onJump: (i: number) => void;
  placement: 'center' | 'bottom-right';
}

function TourCard({ step, stepIdx, total, onNext, onPrev, onEnd, onJump, placement }: CardProps) {
  const isFirst = stepIdx === 0;
  const isLast = stepIdx === total - 1;

  const cardStyle: React.CSSProperties = placement === 'center'
    ? {
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxWidth: 'calc(100vw - 40px)',
        zIndex: 9999,
      }
    : {
        position: 'fixed', bottom: 28, right: 28,
        width: 340, maxWidth: 'calc(100vw - 40px)',
        zIndex: 9999,
      };

  return (
    <>
      {placement === 'center' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 9989 }} />
      )}
      <div
        style={{
          ...cardStyle,
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--primary) / 0.35)',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px hsl(var(--primary) / 0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.3))' }} />

        <div style={{ padding: '20px 24px 16px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28, lineHeight: 1 }}>{step.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                  Step {stepIdx + 1} of {total}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'hsl(var(--foreground))', lineHeight: 1.2 }}>
                  {step.title}
                </div>
              </div>
            </div>
            <button
              onClick={onEnd}
              style={{ color: 'hsl(var(--muted-foreground))', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 8px', lineHeight: 1, opacity: 0.6, flexShrink: 0 }}
              title="End tour"
            >×</button>
          </div>

          {/* Body */}
          <p style={{ fontSize: 14, color: 'hsl(var(--muted-foreground))', lineHeight: 1.6, margin: 0, marginBottom: 18 }}>
            {step.body}
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => onJump(i)}
                style={{
                  width: i === stepIdx ? 20 : 6, height: 6,
                  borderRadius: 3,
                  background: i === stepIdx ? 'hsl(var(--primary))' : i < stepIdx ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))',
                  border: 'none', cursor: 'pointer', padding: 0,
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {!isFirst && (
              <button
                onClick={onPrev}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 500,
                  background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))', cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={isLast ? onEnd : onNext}
              style={{
                flex: 2, padding: '9px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'hsl(var(--primary))', color: '#fff',
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 12px hsl(var(--primary) / 0.4)',
              }}
            >
              {isLast ? '🎉 Start Writing' : isFirst ? 'Start Tour →' : 'Next →'}
            </button>
          </div>

          {isFirst && (
            <button
              onClick={onEnd}
              style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 10, fontSize: 12, color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppTour() {
  const { tourActive, tourStep, setTourStep, endTour } = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);

  const step = STEPS[tourStep];

  // Find first non-trashed project for editor navigation
  function getFirstProjectId(): string | null {
    try {
      const projects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      return projects.find((p: { trashedAt?: string }) => !p.trashedAt)?.id ?? null;
    } catch { return null; }
  }

  // Handle navigation and view-switching when step changes
  const applyStepNavigation = useCallback((s: TourStep) => {
    const onDashboard = location.pathname === '/dashboard';
    const onEditor = location.pathname.startsWith('/projects/');

    if (s.route === 'dashboard' && !onDashboard) {
      navigate('/dashboard');
    } else if (s.route === 'editor' && !onEditor) {
      const pid = getFirstProjectId();
      if (pid) navigate(`/projects/${pid}`);
      else navigate('/dashboard'); // no projects yet — stay on dashboard
    }

    // Dispatch view-switch events after a tick so navigation settles
    setTimeout(() => {
      if (s.dashView) {
        window.dispatchEvent(new CustomEvent('tour:dash-view', { detail: s.dashView }));
      }
      if (s.editorView) {
        window.dispatchEvent(new CustomEvent('tour:editor-view', { detail: s.editorView }));
      }
    }, 80);
  }, [location.pathname, navigate]);

  // When step or route changes, find the target element
  useEffect(() => {
    if (!tourActive) { setTargetRect(null); setReady(false); return; }

    setReady(false);
    setTargetRect(null);

    applyStepNavigation(step);

    // Wait for DOM to settle, then find the target
    const timeout = setTimeout(() => {
      if (step.target) {
        const el = document.querySelector(`[data-tour="${step.target}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      setReady(true);
    }, 350);

    return () => clearTimeout(timeout);
  }, [tourActive, tourStep, location.pathname]);

  function next() {
    if (tourStep < STEPS.length - 1) setTourStep(tourStep + 1);
    else endTour();
  }
  function prev() { if (tourStep > 0) setTourStep(tourStep - 1); }
  function jump(i: number) { setTourStep(i); }

  if (!tourActive || !ready) return null;

  const hasTarget = !!step.target && !!targetRect;
  const placement = hasTarget ? 'bottom-right' : 'center';

  return (
    <>
      <style>{`
        @keyframes tour-pulse {
          0%, 100% { box-shadow: 0 0 0 3px hsl(var(--primary) / 0.25), 0 0 20px hsl(var(--primary) / 0.2); }
          50% { box-shadow: 0 0 0 6px hsl(var(--primary) / 0.15), 0 0 40px hsl(var(--primary) / 0.3); }
        }
      `}</style>
      {hasTarget && <Spotlight rect={targetRect!} />}
      <TourCard
        step={step}
        stepIdx={tourStep}
        total={STEPS.length}
        onNext={next}
        onPrev={prev}
        onEnd={endTour}
        onJump={jump}
        placement={placement}
      />
    </>
  );
}

// Export STEPS length so consumers can show "X-step tour"
export { STEPS };
