import { useEffect, useRef, useState } from 'react';
import type { AchievementDef } from '../../utils/achievements';

interface Props {
  achievement: AchievementDef;
  onDone: () => void;
}

// Achievement toast is now "adult mode" by default — no sound, no confetti.
// Users who actively want the arcade-style celebration can opt in via
// localStorage.sr-achievements-festive = '1'. This keeps the app usable for
// working writers who don't want fanfare on a quiet weekend rewrite.
function festiveEnabled(): boolean {
  try { return localStorage.getItem('sr-achievements-festive') === '1'; } catch { return false; }
}

function playUnlockSound() {
  if (!festiveEnabled()) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    // A single soft tone — never an arpeggio. Pros have their own music.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.start(now);
    osc.stop(now + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio not supported */ }
}

// Confetti particle
interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
}

const CONFETTI_COLORS = ['#7c3aed', '#4ecdc4', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#f97316', '#ec4899'];

function makeParticles(n: number): Particle[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 5 + Math.random() * 6,
    delay: Math.random() * 0.3,
    duration: 0.8 + Math.random() * 0.6,
    rotation: Math.random() * 360,
  }));
}

export default function AchievementToast({ achievement, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  // Confetti is now opt-in — the toast alone is enough signal.
  const showConfetti = festiveEnabled();
  const [particles] = useState<Particle[]>(() => showConfetti ? makeParticles(18) : []);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    playUnlockSound();

    // Slide in
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 4 s
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 4000);

    return () => clearTimeout(timerRef.current);
  }, [onDone]);

  function dismiss() {
    clearTimeout(timerRef.current);
    setVisible(false);
    setTimeout(onDone, 400);
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 9999,
        pointerEvents: 'auto',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(100px) scale(0.9)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease',
      }}
    >
      {/* Confetti burst — absolutely positioned above the toast */}
      <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, height: 80, pointerEvents: 'none', overflow: 'visible' }}>
        {particles.map(p => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              bottom: 0,
              width: p.size,
              height: p.size,
              background: p.color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              transform: `rotate(${p.rotation}deg)`,
              animation: `confetti-fly ${p.duration}s ${p.delay}s ease-out both`,
            }}
          />
        ))}
      </div>

      {/* Toast card */}
      <button
        onClick={dismiss}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'linear-gradient(135deg, hsl(var(--card)), hsl(var(--card)))',
          border: '1px solid hsl(262 80% 55% / 0.5)',
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.28), 0 0 0 1px hsl(262 80% 55% / 0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
          cursor: 'pointer',
          textAlign: 'left',
          minWidth: 280,
          maxWidth: 340,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)',
          animation: 'shimmer 2s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Icon bubble */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: 'linear-gradient(135deg, hsl(262 80% 55% / 0.2), hsl(262 80% 55% / 0.08))',
          border: '1px solid hsl(262 80% 55% / 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
          animation: 'icon-pop 0.5s 0.1s cubic-bezier(0.34,1.56,0.64,1) both',
        }}>
          {achievement.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'hsl(262 80% 70%)',
            marginBottom: 2,
          }}>
            Milestone reached
          </div>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'hsl(var(--foreground))',
            lineHeight: 1.2,
            marginBottom: 3,
          }}>
            {achievement.label}
          </div>
          <div style={{
            fontSize: 11,
            color: 'hsl(var(--muted-foreground))',
            lineHeight: 1.4,
          }}>
            {achievement.desc}
          </div>
        </div>

        {/* Dismiss X */}
        <div style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 12,
          color: 'hsl(var(--muted-foreground))',
          opacity: 0.5,
        }}>✕</div>
      </button>

      <style>{`
        @keyframes confetti-fly {
          0%   { transform: rotate(0deg) translateY(0); opacity: 1; }
          100% { transform: rotate(360deg) translateY(-80px); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes icon-pop {
          0%   { transform: scale(0.5) rotate(-15deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
