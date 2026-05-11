import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPlan, type Plan } from '@/lib/plan';
import { usePlan } from '@/hooks/usePlan';
import { useAuth } from '@/context/AuthContext';
import './LandingPage.css';
import './PricingPage.css';

const FILMSTRIP_FRAMES = Array.from({ length: 80 });

function Filmstrip() {
  return (
    <div className="lp-filmstrip" aria-hidden="true">
      <div className="lp-filmstrip-inner">
        {FILMSTRIP_FRAMES.map((_, i) => (
          <div key={i} className="lp-filmstrip-frame" />
        ))}
      </div>
    </div>
  );
}

const PLAN_KEYS: Record<string, Plan> = {
  Free: 'free',
  Starter: 'starter',
  Pro: 'pro',
  Studio: 'studio',
};

type PlanCard = {
  name: string;
  scene: string;
  num: string;
  tagline: string;
  price: number;
  yearlyPrice: number;
  buttonText: string;
  popular?: boolean;
  features: string[];
};

const plans: PlanCard[] = [
  {
    name: 'Free',
    scene: 'EXT. THE FIRST DRAFT',
    num: '01',
    tagline: 'Everything you need to finish a first draft. No card, no trial clock.',
    price: 0,
    yearlyPrice: 0,
    buttonText: 'Start writing free',
    features: [
      'Up to 3 projects',
      'Full Fountain-style editor',
      'Scene + character navigation',
      'Basic beat sheet',
      'Export to PDF & Fountain',
      'Local autosave',
    ],
  },
  {
    name: 'Starter',
    scene: 'INT. THE WRITERS DESK',
    num: '02',
    tagline: 'For solo writers and students getting their first screenplay off the ground.',
    price: 9,
    yearlyPrice: 79,
    buttonText: 'Get started',
    features: [
      'Everything in Free, plus:',
      'Unlimited projects',
      'AI Script Doctor (50 msgs/mo)',
      'Beat Sheet generator',
      'Cast & Crew management',
      'Import .fountain / .fdx / .pdf',
      'Version history (30 days)',
      'Priority support',
    ],
  },
  {
    name: 'Pro',
    scene: 'INT. THE WRITERS ROOM',
    num: '03',
    tagline: 'For working writers and teams who need full AI power and production tools.',
    price: 29,
    yearlyPrice: 239,
    buttonText: 'Start free trial',
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'Unlimited AI Script Doctor',
      'Production schedule optimizer',
      'Storyboard tools',
      'Budget tracker',
      'Script Insights & analytics',
      'Collaboration & sharing',
      'Full version history',
    ],
  },
  {
    name: 'Studio',
    scene: 'EXT. THE SOUNDSTAGE',
    num: '04',
    tagline: 'For production companies, agencies, and large writing rooms.',
    price: 79,
    yearlyPrice: 699,
    buttonText: 'Contact sales',
    features: [
      'Everything in Pro, plus:',
      'Unlimited team seats',
      'Custom AI model fine-tuning',
      'Advanced breakdown & catalog',
      'SSO & audit logs',
      'Dedicated account manager',
      'SLA & uptime guarantee',
      'White-label export',
    ],
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const [isYearly, setIsYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const { plan: currentPlan } = usePlan();
  const { user } = useAuth();

  // Scroll-triggered reveals (reuse landing-page mechanism)
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-lp-scroll]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('lp-visible');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Nav shadow on scroll
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      nav.style.borderBottomColor =
        window.scrollY > 40 ? 'rgba(242,237,228,0.1)' : 'rgba(242,237,228,0.07)';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goToApp = () => navigate('/login');

  async function handleSelectPlan(planName: string) {
    const planKey = PLAN_KEYS[planName] as Plan;
    if (!planKey) return;
    if (currentPlan === planKey) return;

    if (planKey === 'free') {
      if (!user) { navigate('/login'); return; }
      setPlan('free');
      navigate('/dashboard');
      return;
    }

    if (planKey === 'studio') {
      window.location.href = 'mailto:sales@draftroom.app?subject=DraftRoom Studio Inquiry';
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    setCheckoutError(null);
    setCheckoutLoading(planKey);

    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey,
          interval: isYearly ? 'yearly' : 'monthly',
          userId: user.id,
          userEmail: user.email,
        }),
      });

      if (!res.ok) throw new Error('Failed to create checkout session');
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setCheckoutError('Something went wrong. Please try again.');
      setCheckoutLoading(null);
    }
  }

  async function openBillingPortal() {
    if (!user) return;
    const res = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  return (
    <div className="lp">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav className="lp-nav" ref={navRef}>
        <button
          className="lp-nav-logo lp-pr-logo-btn"
          onClick={() => navigate('/')}
          aria-label="Back to home"
        >
          Draft<em style={{ fontStyle: 'italic', color: '#c17f24' }}>Room</em>
        </button>
        <ul className="lp-nav-links">
          <li><a href="/#features">Features</a></li>
          <li><a href="/pricing" aria-current="page">Pricing</a></li>
          <li><button className="lp-pr-linkbtn" onClick={() => navigate('/login')}>Sign In</button></li>
          <li>
            <button className="lp-btn-primary" onClick={goToApp}>
              <span>Start Writing Free</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="lp-pr-hero">
        <div className="lp-pr-hero-inner">
          <p className="lp-hero-eyebrow">Terms of the deal</p>
          <h1 className="lp-pr-headline">
            Pick your <em>draft.</em>
          </h1>
          <p className="lp-pr-sub">
            Free while you're drafting. Professional when you're ready to share.
            Every plan ships with the editor that gets out of your way.
          </p>

          <div className="lp-pr-toggle" role="tablist" aria-label="Billing interval">
            <button
              role="tab"
              aria-selected={!isYearly}
              className={`lp-pr-toggle-btn ${!isYearly ? 'is-active' : ''}`}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </button>
            <button
              role="tab"
              aria-selected={isYearly}
              className={`lp-pr-toggle-btn ${isYearly ? 'is-active' : ''}`}
              onClick={() => setIsYearly(true)}
            >
              Yearly
              <span className="lp-pr-toggle-badge">Save 30%</span>
            </button>
          </div>
        </div>
      </section>

      <Filmstrip />

      {/* ── PLANS ───────────────────────────────────────────────────────── */}
      <section className="lp-pr-plans">
        <div className="lp-pr-plans-wrap">
          <div className="lp-scene-header" data-lp-scroll>
            INT. THE PLANS<span className="lp-scene-dash">—</span>FOUR TAKES
          </div>

          <div className="lp-pr-grid">
            {plans.map((plan) => {
              const planKey = PLAN_KEYS[plan.name];
              const isCurrent = currentPlan === planKey;
              const isLoading = checkoutLoading === planKey;
              const displayPrice = isYearly ? plan.yearlyPrice : plan.price;
              return (
                <article
                  key={plan.name}
                  className={`lp-pr-card lp-scrollfade ${plan.popular ? 'is-popular' : ''}`}
                  data-lp-scroll
                >
                  {plan.popular && (
                    <div className="lp-pr-card-flag">
                      <span>★ Most chosen</span>
                    </div>
                  )}

                  <div className="lp-pr-card-head">
                    <div className="lp-feat-label">{plan.scene}</div>
                    <div className="lp-pr-card-num">{plan.num}</div>
                  </div>

                  <h2 className="lp-pr-card-name">
                    {plan.name === 'Pro' ? <em>Pro</em> : plan.name}
                  </h2>

                  <div className="lp-pr-card-price">
                    <span className="lp-pr-price-currency">$</span>
                    <span className="lp-pr-price-num">{displayPrice}</span>
                    <span className="lp-pr-price-period">/{isYearly ? 'year' : 'month'}</span>
                  </div>
                  {isYearly && plan.yearlyPrice > 0 && (
                    <div className="lp-pr-price-annual">
                      ~${Math.round(plan.yearlyPrice / 12)}/mo billed annually
                    </div>
                  )}
                  {!isYearly && plan.price === 0 && (
                    <div className="lp-pr-price-annual">Free forever — no card required</div>
                  )}

                  <p className="lp-pr-card-tagline">{plan.tagline}</p>

                  <button
                    onClick={() => handleSelectPlan(plan.name)}
                    disabled={isCurrent || checkoutLoading !== null}
                    className={`lp-pr-card-cta ${plan.popular ? 'is-primary' : ''} ${isCurrent ? 'is-current' : ''}`}
                  >
                    <span>
                      {isLoading
                        ? 'Redirecting…'
                        : isCurrent
                          ? '✓ Current plan'
                          : plan.buttonText}
                    </span>
                  </button>

                  <div className="lp-pr-card-divider" />

                  <ul className="lp-pr-card-features">
                    {plan.features.map((f, i) => {
                      const isHeader = f.endsWith(':');
                      return (
                        <li key={i} className={isHeader ? 'is-header' : ''}>
                          {!isHeader && <span className="lp-pr-bullet" aria-hidden="true" />}
                          <span>{f}</span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <Filmstrip />

      {/* ── FAQ / FINE PRINT ────────────────────────────────────────────── */}
      <section className="lp-pr-fine">
        <div className="lp-pr-fine-wrap lp-scrollfade" data-lp-scroll>
          <div className="lp-scene-header">
            INT. THE FINE PRINT<span className="lp-scene-dash">—</span>CONTINUED
          </div>
          <div className="lp-pr-fine-grid">
            <div>
              <h3 className="lp-pr-fine-q">Can I switch plans later?</h3>
              <p className="lp-pr-fine-a">
                Anytime. Upgrades are prorated; downgrades take effect at the end of the
                billing cycle. Nothing locks you in but the work itself.
              </p>
            </div>
            <div>
              <h3 className="lp-pr-fine-q">What happens to my scripts if I cancel?</h3>
              <p className="lp-pr-fine-a">
                They stay yours. Export to PDF, FDX, or Fountain at any time — on every plan,
                including Free. No hostage scripts.
              </p>
            </div>
            <div>
              <h3 className="lp-pr-fine-q">Is there a student discount?</h3>
              <p className="lp-pr-fine-a">
                Yes. Write us from a .edu address and we'll sort it. Students get
                Starter free while enrolled.
              </p>
            </div>
            <div>
              <h3 className="lp-pr-fine-q">Refunds?</h3>
              <p className="lp-pr-fine-a">
                Within 14 days of your first charge, no questions asked. Stripe handles
                the rest.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section className="lp-cta">
        <div className="lp-scrollfade" data-lp-scroll>
          <span className="lp-cta-fade">FADE TO:</span>
          <h2 className="lp-cta-headline">
            Stop pricing.<br />
            Start writing.
          </h2>
          <p className="lp-cta-sub">
            The Free tier is genuinely free. You can decide on the rest after page ten.
          </p>
          <button className="lp-btn-cta" onClick={goToApp}>
            <span>Start Writing Free</span>
          </button>
          {currentPlan !== 'free' && user && (
            <div style={{ marginTop: '2.5rem' }}>
              <button className="lp-btn-ghost" onClick={openBillingPortal}>
                Manage billing &nbsp;→
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">DraftRoom</div>
        <ul className="lp-footer-links">
          <li><a href="/#features">Features</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="#">Privacy</a></li>
          <li><a href="#">Terms</a></li>
        </ul>
        <div>&copy; 2026 DraftRoom — Written in California.</div>
      </footer>

      {/* Error toast */}
      {checkoutError && (
        <div className="lp-pr-toast" role="status">
          {checkoutError}
        </div>
      )}
    </div>
  );
}
