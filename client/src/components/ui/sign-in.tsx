import React, { useState, useEffect } from 'react';
import { Spotlight } from './spotlight';
import { ScriptPreview } from './script-preview';
import { Eye, EyeOff } from 'lucide-react';

// --- HELPER COMPONENTS (ICONS) ---

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

// --- TYPE DEFINITIONS ---

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onSignUp?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  /** Called with the email currently typed into the Email field (may be blank). */
  onResetPassword?: (email: string) => void | Promise<void>;
  onCreateAccount?: () => void;
  /** Called whenever the user flips between Sign In and Sign Up. Use to clear error state. */
  onModeChange?: (mode: 'signin' | 'signup') => void;
  errorMessage?: string;
  /** Neutral/status message (e.g. "Check your email for a reset link"). */
  infoMessage?: string;
}

// --- SUB-COMPONENTS ---

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-white/40 focus-within:bg-white/5">
    {children}
  </div>
);

const StarIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const TestimonialCarousel = ({ testimonials }: { testimonials: Testimonial[] }) => {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (testimonials.length < 2) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % testimonials.length);
        setVisible(true);
      }, 450);
    }, 4500);
    return () => clearInterval(timer);
  }, [testimonials.length]);

  const t = testimonials[idx];

  return (
    <div style={{
      position: 'absolute', bottom: 32, left: 0, right: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 40px', zIndex: 10,
    }}>
      {/* Card */}
      <div style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.98)',
        transition: 'opacity 0.45s cubic-bezier(0.4,0,0.2,1), transform 0.45s cubic-bezier(0.4,0,0.2,1)',
        background: 'linear-gradient(135deg, rgba(15,10,30,0.85) 0%, rgba(8,5,20,0.9) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: '20px 22px',
        width: '100%',
        maxWidth: 360,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset, 0 20px 40px rgba(0,0,0,0.5)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle violet glow top-left */}
        <div style={{
          position: 'absolute', top: -30, left: -20,
          width: 120, height: 80,
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Stars */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 12 }}>
          {[...Array(5)].map((_, i) => <StarIcon key={i} />)}
        </div>

        {/* Quote text */}
        <p style={{
          fontSize: 13.5,
          lineHeight: 1.65,
          color: 'rgba(220,215,240,0.82)',
          margin: '0 0 18px',
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}>
          &ldquo;{t.text}&rdquo;
        </p>

        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={t.avatarSrc}
            alt={t.name}
            style={{
              width: 34, height: 34, borderRadius: 10,
              objectFit: 'cover',
              border: '1.5px solid rgba(255,255,255,0.2)',
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
              {t.handle}
            </div>
          </div>
        </div>
      </div>

      {/* Dot indicators */}
      {testimonials.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {testimonials.map((_, i) => (
            <div key={i} style={{
              height: 4,
              width: i === idx ? 20 : 4,
              borderRadius: 2,
              background: i === idx ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.15)',
              transition: 'width 0.4s ease, background 0.4s ease',
            }} />
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  testimonials = [],
  onSignIn,
  onSignUp,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
  onModeChange,
  errorMessage,
  infoMessage,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const formRef = React.useRef<HTMLFormElement>(null);

  function switchMode(next: 'signin' | 'signup') {
    setMode(next);
    onModeChange?.(next);
  }

  function handleCreateAccount(e: React.MouseEvent) {
    e.preventDefault();
    switchMode('signup');
    onCreateAccount?.();
  }

  function handleResetPassword(e: React.MouseEvent) {
    e.preventDefault();
    const emailInput = formRef.current?.elements.namedItem('email') as HTMLInputElement | null;
    const email = emailInput?.value.trim() ?? '';
    onResetPassword?.(email);
  }

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row font-geist w-[100dvw]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">
              {mode === 'signup' ? <span className="text-white">Create your <span className="text-violet-400 font-bold">account</span></span> : title}
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">
              {mode === 'signup' ? 'Join DraftRoom and start writing your story.' : description}
            </p>

            <form ref={formRef} className="space-y-5" onSubmit={mode === 'signup' ? onSignUp : onSignIn}>
              {mode === 'signup' && (
                <div className="animate-element animate-delay-300">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <GlassInputWrapper>
                    <input name="username" type="text" placeholder="Choose a username" autoComplete="username" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none" />
                  </GlassInputWrapper>
                </div>
              )}
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <GlassInputWrapper>
                  <input name="email" type="email" placeholder="Enter your email address" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none" />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-none" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                      {showPassword
                        ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
                        : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {mode === 'signin' && (
                <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                    <span className="text-foreground/90">Keep me signed in</span>
                  </label>
                  <a href="#" onClick={handleResetPassword} className="hover:underline text-foreground transition-colors">
                    Reset password
                  </a>
                </div>
              )}

              {errorMessage && (
                <p role="alert" className="text-sm text-red-400 text-center -mb-1">{errorMessage}</p>
              )}
              {infoMessage && !errorMessage && (
                <p role="status" className="text-sm text-emerald-400 text-center -mb-1">{infoMessage}</p>
              )}

              <button type="submit" className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-background absolute">Or continue with</span>
            </div>

            <button type="button" onClick={(e) => { e.preventDefault(); onGoogleSignIn?.(); }} className="animate-element animate-delay-800 w-full flex items-center justify-center gap-3 border border-border rounded-2xl py-4 hover:bg-secondary transition-colors">
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
              {mode === 'signup' ? (
                <>Already have an account?{' '}
                  <a href="#" onClick={(e) => { e.preventDefault(); switchMode('signin'); }} className="text-violet-400 hover:underline transition-colors">
                    Sign In
                  </a>
                </>
              ) : (
                <>New to our platform?{' '}
                  <a href="#" onClick={handleCreateAccount} className="text-violet-400 hover:underline transition-colors">
                    Create Account
                  </a>
                </>
              )}
            </p>

          </div>
        </div>
      </section>

      {/* Right column: interactive 3D scene */}
      <section className="hidden md:flex flex-1 relative overflow-hidden rounded-r-3xl bg-black/[0.96]">
        <Spotlight
          className="-top-40 left-0 md:left-40 md:-top-20 from-white via-white/70 to-white/30"
          size={400}
        />

        {/* Animated script preview */}
        <div className="absolute inset-0">
          <ScriptPreview />
        </div>

        {/* Testimonials carousel pinned to bottom */}
        {testimonials.length > 0 && <TestimonialCarousel testimonials={testimonials} />}
      </section>
    </div>
  );
};
