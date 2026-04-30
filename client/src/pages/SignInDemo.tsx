import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SignInPage } from "@/components/ui/sign-in";
import type { Testimonial } from "@/components/ui/sign-in";
import { ScriptPreview } from "@/components/ui/script-preview";
import { useNavigate } from "react-router-dom";
import { HollywoodBackground } from "@/components/ui/hollywood-background";
import { useAuth } from "@/context/AuthContext";
import { createDemoProject } from "@/utils/demoProject";
import { upsertProject, saveScript, loadProjects } from "@/utils/storage";
import { getEnabledAuthProviders, type AuthProviderFlags } from "@/lib/supabase";

// Flag set the moment a user completes the experience-level picker. Ensures
// we only ever seed the demo project once per account, so returning users who
// clear it don't get it re-created behind their backs.
const DEMO_SEEDED_KEY = 'sr-demo-seeded';

/**
 * Seed the welcome demo project on first onboarding and return its id.
 * If the user already has projects (e.g. signed up before, cleared the
 * experience key, and came back), we skip seeding entirely and just route
 * them to the dashboard.
 *
 * Returns the project id to open, or null if we should go to /dashboard.
 */
function seedDemoProjectIfFirstRun(level: ExperienceLevel): string | null {
  if (localStorage.getItem(DEMO_SEEDED_KEY) === '1') return null;
  const existing = loadProjects();
  if (existing.length > 0) {
    // User already has work — don't clutter their dashboard. Just mark the
    // seed step done so we don't come back here next sign-in.
    localStorage.setItem(DEMO_SEEDED_KEY, '1');
    return null;
  }
  const demo = createDemoProject(level);
  upsertProject(demo);
  saveScript(demo.id, demo.scriptContent);
  localStorage.setItem(DEMO_SEEDED_KEY, '1');
  return demo.id;
}

export const EXPERIENCE_KEY = 'sr-experience-level';

export type ExperienceLevel = 'beginner' | 'some' | 'experienced' | 'pro';

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  label: string;
  sublabel: string;
  icon: string;
}[] = [
  { id: 'beginner',    label: 'Just starting out',       sublabel: "I've never written a screenplay before",  icon: '✦' },
  { id: 'some',        label: 'Some experience',          sublabel: "I've written a few scripts, still learning", icon: '◈' },
  { id: 'experienced', label: 'Experienced writer',       sublabel: 'I know screenplay format well',           icon: '◆' },
  { id: 'pro',         label: 'Industry professional',    sublabel: "Working writer, director, or producer",   icon: '★' },
];

const sampleTestimonials: Testimonial[] = [
  { avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg", name: "Sarah Chen",     handle: "TV Writer · Netflix", text: "DraftRoom completely changed how I outline. I finished my pilot in half the time — and it was actually good." },
  { avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",   name: "Marcus Johnson", handle: "Feature Screenwriter", text: "The beat sheet tools are insane. It's like having a script consultant on call at 2am when the ideas hit." },
  { avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",   name: "David Martinez", handle: "Writer-Director", text: "Finally, software that actually understands screenplay format. Clean, fast, and it gets out of the way." },
];

// ── Cinematic intro ─────────────────────────────────────────────────────────

const TITLE_CHARS = 'DRAFTROOM'.split('');

function CinematicIntro({ onDone }: { onDone: () => void }) {
  const [exiting, setExiting] = useState(false);
  const [auraVisible, setAuraVisible] = useState(false);
  const [charsVisible, setCharsVisible] = useState(0);
  const [taglineVisible, setTaglineVisible] = useState(false);

  useEffect(() => {
    const auraTimer = setTimeout(() => setAuraVisible(true), 1200);
    const charTimers: ReturnType<typeof setTimeout>[] = [];
    TITLE_CHARS.forEach((_, i) => {
      charTimers.push(setTimeout(() => setCharsVisible(i + 1), 2000 + i * 70));
    });
    const tagTimer = setTimeout(() => setTaglineVisible(true), 2000 + TITLE_CHARS.length * 70 + 300);
    const exitTimer = setTimeout(() => setExiting(true), 5200);
    const doneTimer = setTimeout(onDone, 5900);
    return () => {
      [auraTimer, tagTimer, exitTimer, doneTimer, ...charTimers].forEach(clearTimeout);
    };
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      opacity: exiting ? 0 : 1,
      transform: exiting ? 'scale(1.04)' : 'scale(1)',
      transition: exiting ? 'opacity 0.8s ease-in, transform 0.8s ease-in' : 'none',
    }}>

      {/* Grain texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`,
        opacity: 0.5, mixBlendMode: 'overlay',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 80% at 50% 46%, transparent 40%, rgba(0,0,0,0.7) 100%)',
      }} />

      {/* Paper + amber aura */}
      <div style={{
        position: 'relative', marginTop: -44, zIndex: 1,
        animation: 'ciScriptFlyIn 1.7s cubic-bezier(0.22,1,0.36,1) 0.45s both, ciScriptDrift 10s ease-in-out 2.35s infinite',
      }}>
        {/* Outer amber bloom */}
        <div style={{
          position: 'absolute', inset: -240,
          background: 'radial-gradient(ellipse at 50% 52%, rgba(193,127,36,0.35) 0%, transparent 55%)',
          filter: 'blur(80px)',
          opacity: auraVisible ? 0.9 : 0,
          transition: 'opacity 2s ease 0.7s',
          pointerEvents: 'none',
        }} />
        {/* Mid warm glow */}
        <div style={{
          position: 'absolute', inset: -120,
          background: 'radial-gradient(ellipse at 50% 52%, rgba(193,127,36,0.5) 0%, rgba(153,97,24,0.2) 42%, transparent 65%)',
          filter: 'blur(48px)',
          opacity: auraVisible ? 1 : 0,
          transition: 'opacity 1.4s ease 0.4s',
          pointerEvents: 'none',
        }} />
        {/* Tight halo */}
        <div style={{
          position: 'absolute', inset: -32,
          background: 'radial-gradient(ellipse at 50% 48%, rgba(242,200,100,0.4) 0%, rgba(193,127,36,0.15) 40%, transparent 60%)',
          filter: 'blur(16px)',
          opacity: auraVisible ? 1 : 0,
          transition: 'opacity 0.7s ease',
          pointerEvents: 'none',
        }} />

        {/* Paper */}
        <div style={{ transform: 'scale(1.38)', transformOrigin: 'center' }}>
          <div style={{
            width: 340, height: 480, borderRadius: 2, overflow: 'hidden',
            position: 'relative', zIndex: 1,
            boxShadow: auraVisible
              ? '0 0 0 1px rgba(193,127,36,0.5), 0 0 50px rgba(193,127,36,0.6), 0 0 100px rgba(153,97,24,0.25), 0 70px 180px rgba(0,0,0,1)'
              : '0 70px 180px rgba(0,0,0,1)',
            transition: 'box-shadow 0.9s ease',
          }}>
            <ScriptPreview />
          </div>
        </div>
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={() => { setExiting(true); setTimeout(onDone, 700); }}
        style={{
          position: 'absolute',
          top: 24,
          right: 24,
          zIndex: 20,
          padding: '8px 14px',
          border: '1px solid rgba(242,237,228,0.18)',
          borderRadius: 999,
          background: 'rgba(242,237,228,0.04)',
          color: 'rgba(242,237,228,0.75)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          transition: 'background 0.2s ease, color 0.2s ease, border-color 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(242,237,228,0.1)'; (e.currentTarget as HTMLElement).style.color = '#f2ede4'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(242,237,228,0.04)'; (e.currentTarget as HTMLElement).style.color = 'rgba(242,237,228,0.75)'; }}
      >
        Skip →
      </button>

      {/* Title & tagline */}
      <div style={{
        position: 'absolute', bottom: '8%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', gap: 1 }}>
          {TITLE_CHARS.map((ch, i) => (
            <span key={i} style={{
              fontSize: 46,
              fontWeight: 700,
              letterSpacing: '0.16em',
              fontFamily: "'DM Serif Display', Georgia, serif",
              display: 'inline-block',
              color: '#f2ede4',
              opacity: i < charsVisible ? 1 : 0,
              filter: i < charsVisible ? 'blur(0px)' : 'blur(10px)',
              transform: i < charsVisible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.85)',
              transition: 'opacity 0.45s ease, transform 0.6s cubic-bezier(0.34,1.5,0.64,1), filter 0.45s ease',
              textShadow: i < charsVisible ? '0 0 30px rgba(193,127,36,0.6), 0 0 80px rgba(193,127,36,0.25)' : 'none',
            }}>{ch}</span>
          ))}
        </div>
        <div style={{
          opacity: taglineVisible ? 1 : 0,
          transform: taglineVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.9s ease, transform 0.9s ease',
          fontSize: 10,
          letterSpacing: '0.38em',
          textTransform: 'uppercase',
          color: 'rgba(193,127,36,0.55)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Write the damn script
        </div>
      </div>

      <style>{`
        @keyframes ciScriptFlyIn {
          0% { opacity:0; transform:perspective(900px) translateZ(-3500px) rotateX(45deg) rotateY(-24deg) scale(0.04); }
          8% { opacity:1; }
          62% { transform:perspective(900px) translateZ(90px) rotateX(-6deg) rotateY(10deg) scale(1.07); }
          80% { transform:perspective(900px) translateZ(-18px) rotateX(2.5deg) rotateY(-3.5deg) scale(0.972); }
          100% { opacity:1; transform:perspective(900px) rotateX(4deg) rotateY(-6deg) scale(1); }
        }
        @keyframes ciScriptDrift {
          0%,100% { transform:perspective(900px) rotateX(4deg) rotateY(-6deg) translateY(0px); }
          28% { transform:perspective(900px) rotateX(-3deg) rotateY(7deg) translateY(-14px); }
          55% { transform:perspective(900px) rotateX(6deg) rotateY(4deg) translateY(-6px); }
          78% { transform:perspective(900px) rotateX(-1deg) rotateY(-8deg) translateY(10px); }
        }
      `}</style>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const INTRO_SEEN_KEY = 'sr-intro-seen';

export default function SignInDemo() {
  const navigate = useNavigate();
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, sendPasswordResetEmail } = useAuth();
  // Intro animation has been seen permanently once a user reaches the sign-in
  // page even once. We persist in localStorage so we don't re-play it on every
  // new tab / incognito session.
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem(INTRO_SEEN_KEY));
  const [signInVisible, setSignInVisible] = useState(() => !!localStorage.getItem(INTRO_SEEN_KEY));
  const [showExperience, setShowExperience] = useState(false);
  const [selected, setSelected] = useState<ExperienceLevel | null>(null);
  const [hovered, setHovered] = useState<ExperienceLevel | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  // Hide Google sign-in until it's actually enabled on the Supabase project.
  // Without this gate the button looks dead — Supabase silently no-ops on
  // `signInWithOAuth` calls for unconfigured providers.
  const [providerFlags, setProviderFlags] = useState<AuthProviderFlags | null>(null);
  useEffect(() => {
    let cancelled = false;
    getEnabledAuthProviders().then(flags => { if (!cancelled) setProviderFlags(flags); });
    return () => { cancelled = true; };
  }, []);

  // If already authenticated, go straight to dashboard
  useEffect(() => {
    if (!loading && user) {
      const hasExperience = localStorage.getItem(EXPERIENCE_KEY);
      if (hasExperience) {
        navigate('/dashboard', { replace: true });
      } else {
        setShowExperience(true);
      }
    }
  }, [user, loading, navigate]);

  function handleIntroDone() {
    localStorage.setItem(INTRO_SEEN_KEY, '1');
    setShowIntro(false);
    setTimeout(() => setSignInVisible(true), 80);
  }

  async function handleResetPassword(email: string) {
    setAuthError(null);
    setAuthInfo(null);
    if (!email) {
      setAuthError('Enter your email address above, then click Reset password.');
      return;
    }
    const { error } = await sendPasswordResetEmail(email);
    if (error) {
      setAuthError(error);
    } else {
      setAuthInfo(`Check ${email} for a password reset link.`);
    }
  }

  function proceedAfterAuth() {
    const hasExperience = localStorage.getItem(EXPERIENCE_KEY);
    if (hasExperience) {
      navigate('/dashboard', { replace: true });
    } else {
      setShowExperience(true);
    }
  }

  async function handleSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const { error } = await signInWithEmail(email, password);
    if (error) {
      setAuthError(error);
    } else {
      proceedAfterAuth();
    }
  }

  async function handleGoogleSignIn() {
    setAuthError(null);
    if (providerFlags && !providerFlags.google) {
      // Defensive: if the button somehow shows up while Google is disabled,
      // tell the user instead of silently no-opping.
      setAuthError("Google sign-in isn't set up yet. Use email and password for now.");
      return;
    }
    const { error } = await signInWithGoogle();
    if (error) setAuthError(error);
    // Google OAuth redirects, so no further action needed
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError(null);
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const username = (formData.get("username") as string).trim();
    if (!username) { setAuthError("Username is required."); return; }
    const { error } = await signUpWithEmail(email, password, username);
    if (error) {
      setAuthError(error);
    }
    // Don't call proceedAfterAuth here — let the useEffect on `user` fire
    // once Supabase's auth state change propagates, avoiding a race condition.
  }

  function handleChoose(level: ExperienceLevel) {
    setSelected(level);
    localStorage.setItem(EXPERIENCE_KEY, level);
    localStorage.removeItem('sr-tutorial-seen');
    localStorage.removeItem('sr-tour-seen');
    // Seed a starter screenplay so the tour has a real script to drop the
    // user into when it reaches the editor steps. Land on the dashboard
    // first so the tour starts with the project-cards / nav steps before
    // navigating into the demo screenplay itself.
    seedDemoProjectIfFirstRun(level);
    setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 350);
  }

  if (showExperience) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden text-foreground">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg px-6 relative z-10"
        >
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'hsl(var(--primary))', marginBottom: '1rem' }}
            >
              Account Setup
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
              style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.05, marginBottom: '0.75rem', color: 'hsl(var(--foreground))' }}
            >
              What's your experience?
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.8 }}
              className="text-sm text-muted-foreground"
            >
              We'll open a short demo screenplay so you can feel the editor before starting your own.
            </motion.p>
          </div>
          <motion.div
            initial="hidden" animate="show"
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.5 } } }}
            className="flex flex-col gap-2 mb-8"
          >
            {EXPERIENCE_OPTIONS.map((opt) => {
              const isSelected = selected === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleChoose(opt.id)}
                  disabled={selected !== null}
                  className="group relative w-full text-left p-4 flex items-center gap-4 transition-all duration-200"
                  style={{
                    background: isSelected ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                    border: `1px solid ${isSelected ? 'hsl(var(--primary) / 0.5)' : 'hsl(var(--border))'}`,
                    borderLeft: `2px solid ${isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.3)'; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; }}
                >
                  <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0, color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', transition: 'color 0.2s' }}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'hsl(var(--foreground))', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{opt.sublabel}</div>
                  </div>
                  {isSelected && (
                    <svg style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}
            className="text-center"
          >
            <button
              onClick={() => {
                localStorage.setItem(EXPERIENCE_KEY, 'experienced');
                localStorage.removeItem('sr-tutorial-seen');
                localStorage.removeItem('sr-tour-seen');
                // Even skippers get the demo seeded so the tour can land in a
                // real script when it reaches the editor steps. Always start
                // on the dashboard so the tour walks the full flow.
                seedDemoProjectIfFirstRun('experienced');
                navigate('/dashboard', { replace: true });
              }}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.1em', color: 'hsl(var(--muted-foreground))', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'hsl(var(--foreground))')}
              onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
            >
              Open your demo project →
            </button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {showIntro && <CinematicIntro onDone={handleIntroDone} />}

      <div
        className="bg-background text-foreground"
        style={{
          opacity: signInVisible ? 1 : 0,
          transform: signInVisible ? 'scale(1)' : 'scale(0.98)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <SignInPage
          title={
            <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", color: 'hsl(var(--foreground))' }}>
              Welcome to{' '}
              {/*
                The italic wordmark uses --primary so it re-tints with the user's
                chosen theme (was hardcoded amber #c17f24 — looked broken on
                Forest/Ocean/Dracula). inline-block + padding-right prevents the
                italic 'm' descender from clipping into whatever follows.
              */}
              <span style={{
                color: 'hsl(var(--primary))',
                fontStyle: 'italic',
                display: 'inline-block',
                paddingRight: '0.06em',
              }}>DraftRoom</span>
            </span>
          }
          description="Sign in to access your screenwriting projects, AI tools, and beat sheets."
          heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
          testimonials={sampleTestimonials}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          // Pass undefined when Google isn't enabled — the SignInPage hides
          // the button when this prop is missing.
          onGoogleSignIn={providerFlags?.google ? handleGoogleSignIn : undefined}
          onResetPassword={handleResetPassword}
          onModeChange={() => { setAuthError(null); setAuthInfo(null); }}
          errorMessage={authError ?? undefined}
          infoMessage={authInfo ?? undefined}
        />
      </div>
    </>
  );
}
