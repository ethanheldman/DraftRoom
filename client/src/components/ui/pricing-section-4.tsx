"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sparkles as SparklesComp } from "@/components/ui/sparkles";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setPlan, type Plan } from "@/lib/plan";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/context/AuthContext";

const PLAN_KEYS: Record<string, Plan> = {
  Free: 'free',
  Starter: 'starter',
  Pro: 'pro',
  Studio: 'studio',
};

const plans = [
  {
    name: "Free",
    description: "Everything you need to finish a first draft. No card, no trial clock.",
    price: 0,
    yearlyPrice: 0,
    buttonText: "Start writing free",
    buttonVariant: "outline" as const,
    includes: [
      "Included:",
      "Up to 3 projects",
      "Full Fountain-style editor",
      "Scene + character navigation",
      "Basic beat sheet",
      "Export to PDF & Fountain",
      "Local autosave",
    ],
  },
  {
    name: "Starter",
    description: "Perfect for solo writers and students getting their first screenplay off the ground.",
    price: 9,
    yearlyPrice: 79,
    buttonText: "Get started",
    buttonVariant: "outline" as const,
    includes: [
      "Everything in Free, plus:",
      "Unlimited projects",
      "AI Script Doctor (50 msgs/mo)",
      "Beat Sheet generator",
      "Cast & Crew management",
      "Import .fountain / .fdx / .pdf",
      "Version history (30 days)",
      "Priority support",
    ],
  },
  {
    name: "Pro",
    description: "For working writers and teams who need full AI power and production tools.",
    price: 29,
    yearlyPrice: 239,
    buttonText: "Start free trial",
    buttonVariant: "default" as const,
    popular: true,
    includes: [
      "Everything in Starter, plus:",
      "Unlimited AI Script Doctor",
      "Production schedule optimizer",
      "Storyboard tools",
      "Budget tracker",
      "Script Insights & analytics",
      "Collaboration & sharing",
      "Full version history",
    ],
  },
  {
    name: "Studio",
    description: "Built for production companies, agencies, and large writing rooms.",
    price: 79,
    yearlyPrice: 699,
    buttonText: "Contact sales",
    buttonVariant: "outline" as const,
    includes: [
      "Everything in Pro, plus:",
      "Unlimited team seats",
      "Custom AI model fine-tuning",
      "Advanced breakdown & catalog",
      "SSO & audit logs",
      "Dedicated account manager",
      "SLA & uptime guarantee",
      "White-label export",
    ],
  },
];

const PricingSwitch = ({ onSwitch }: { onSwitch: (value: string) => void }) => {
  const [selected, setSelected] = useState("0");

  const handleSwitch = (value: string) => {
    setSelected(value);
    onSwitch(value);
  };

  return (
    <div className="flex justify-center">
      <div className="relative z-10 mx-auto flex w-fit rounded-full bg-neutral-900 border border-gray-700 p-1">
        <button
          onClick={() => handleSwitch("0")}
          className={cn(
            "relative z-10 w-fit h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "0" ? "text-white" : "text-gray-400"
          )}
        >
          {selected === "0" && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-10 w-full rounded-full border-4 shadow-sm shadow-violet-600 border-violet-600 bg-gradient-to-t from-violet-500 to-violet-600"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => handleSwitch("1")}
          className={cn(
            "relative z-10 w-fit h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
            selected === "1" ? "text-white" : "text-gray-400"
          )}
        >
          {selected === "1" && (
            <motion.span
              layoutId="pricing-switch"
              className="absolute top-0 left-0 h-10 w-full rounded-full border-4 shadow-sm shadow-violet-600 border-violet-600 bg-gradient-to-t from-violet-500 to-violet-600"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly
            <span className="hidden sm:inline text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-teal-500/20 text-teal-400 border border-teal-500/30">
              SAVE 30%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function PricingSection4() {
  const [isYearly, setIsYearly] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const { plan: currentPlan } = usePlan();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pricingRef = useRef<HTMLDivElement>(null);

  async function handleSelectPlan(planName: string) {
    const planKey = PLAN_KEYS[planName] as Plan;
    if (!planKey) return;

    // Already on this plan
    if (currentPlan === planKey) return;

    // Free — no checkout needed; just set plan and go to dashboard (or login).
    if (planKey === 'free') {
      if (!user) { navigate('/login'); return; }
      setPlan('free');
      navigate('/dashboard');
      return;
    }

    // Studio — contact sales
    if (planKey === 'studio') {
      window.location.href = 'mailto:sales@draftroom.app?subject=DraftRoom Studio Inquiry';
      return;
    }

    // Not logged in — go to login first
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

  // Lower delay + no blur so first paint is readable; prevents FOUC.
  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: i * 0.04, duration: 0.35 },
    }),
    hidden: { y: 8, opacity: 0 },
  };

  const togglePricingPeriod = (value: string) =>
    setIsYearly(Number.parseInt(value) === 1);

  return (
    <div
      className="min-h-screen mx-auto relative bg-black overflow-x-hidden"
      ref={pricingRef}
    >
      {/* Sparkle background */}
      <TimelineContent
        animationNum={4}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute top-0 h-96 w-screen overflow-hidden [mask-image:radial-gradient(50%_50%,white,transparent)]"
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#ffffff2c_1px,transparent_1px),linear-gradient(to_bottom,#3a3a3a01_1px,transparent_1px)] bg-[size:70px_80px]" />
        <SparklesComp
          density={1800}
          direction="bottom"
          speed={1}
          color="#FFFFFF"
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(50%_50%,white,transparent_85%)]"
        />
      </TimelineContent>

      {/* Glow ellipses */}
      <TimelineContent
        animationNum={5}
        timelineRef={pricingRef}
        customVariants={revealVariants}
        className="absolute left-0 top-[-114px] w-full h-[113.625vh] flex flex-col items-start justify-start flex-none overflow-hidden p-0 z-0"
      >
        <div className="relative w-full h-full">
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{ border: "200px solid #6d28d9", filter: "blur(92px)" }}
          />
          <div
            className="absolute left-[-568px] right-[-568px] top-0 h-[2053px] flex-none rounded-full"
            style={{ border: "200px solid #6d28d9", filter: "blur(92px)" }}
          />
        </div>
      </TimelineContent>

      {/* Header */}
      <article className="text-center mb-6 pt-32 max-w-3xl mx-auto space-y-4 relative z-50 px-4">
        <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-300 mb-2">
          ✦ Simple, transparent pricing
        </div>

        {/*
          Render headline statically (no entrance animation) so the hero frame
          is readable the moment React mounts. The word-cut reveal made the
          page look broken for ~2s on slow paints.
        */}
        <h2 className="text-4xl font-bold text-white leading-tight">
          Plans that grow with your story
        </h2>

        <TimelineContent
          as="p"
          animationNum={0}
          timelineRef={pricingRef}
          customVariants={revealVariants}
          className="text-gray-400 text-base max-w-xl mx-auto"
        >
          From solo writers to full production studios — DraftRoom has the tools your screenplay needs.
        </TimelineContent>

        <TimelineContent
          as="div"
          animationNum={1}
          timelineRef={pricingRef}
          customVariants={revealVariants}
        >
          <PricingSwitch onSwitch={togglePricingPeriod} />
        </TimelineContent>
      </article>

      {/* Radial overlay */}
      <div
        className="absolute top-0 left-[10%] right-[10%] w-[80%] h-full z-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at center, #4c1d95 0%, transparent 70%)",
          opacity: 0.4,
          mixBlendMode: "multiply",
        }}
      />

      {/* Plan cards — 4-column grid includes Free tier */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 max-w-6xl gap-4 py-6 mx-auto px-4 relative z-10">
        {plans.map((plan, index) => (
          <TimelineContent
            key={plan.name}
            as="div"
            animationNum={2 + index}
            timelineRef={pricingRef}
            customVariants={revealVariants}
          >
            <Card
              className={cn(
                "relative text-white border-neutral-800 h-full",
                plan.popular
                  ? "bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 shadow-[0px_-13px_300px_0px_#6d28d9] z-20"
                  : "bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 z-10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
                  <span className="rounded-full px-3 py-1 text-[10px] font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 border border-violet-500/50">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <CardHeader className="text-left pb-2">
                <h3 className="text-2xl font-bold mb-2 text-white">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">
                    $<NumberFlow
                      format={{ currency: "USD" }}
                      value={isYearly ? plan.yearlyPrice : plan.price}
                      className="text-4xl font-black"
                    />
                  </span>
                  <span className="text-gray-400 text-sm">/{isYearly ? "year" : "month"}</span>
                </div>
                {isYearly && (
                  <p className="text-xs text-teal-400 font-medium">
                    ~${Math.round(plan.yearlyPrice / 12)}/mo billed annually
                  </p>
                )}
                <p className="text-sm text-gray-400 leading-relaxed pt-1">{plan.description}</p>
              </CardHeader>

              <CardContent className="pt-2">
                <button
                  onClick={() => handleSelectPlan(plan.name)}
                  disabled={currentPlan === PLAN_KEYS[plan.name] || checkoutLoading !== null}
                  className={cn(
                    "w-full mb-5 p-3.5 text-sm font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
                    currentPlan === PLAN_KEYS[plan.name]
                      ? "bg-gradient-to-b from-teal-500 to-teal-700 shadow-lg shadow-teal-800/50 border border-teal-500/60 text-white cursor-default"
                      : plan.popular
                        ? "bg-gradient-to-b from-violet-500 to-violet-700 shadow-lg shadow-violet-800/50 border border-violet-500/60 text-white hover:shadow-violet-500/60"
                        : "bg-gradient-to-b from-neutral-800 to-neutral-900 shadow-lg shadow-neutral-900 border border-neutral-700 text-white hover:border-neutral-600"
                  )}
                >
                  {checkoutLoading === PLAN_KEYS[plan.name]
                    ? <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Redirecting…
                      </span>
                    : currentPlan === PLAN_KEYS[plan.name]
                      ? '✓ Current Plan'
                      : plan.name === 'Studio' ? 'Contact sales' : plan.buttonText}
                </button>

                <div className="space-y-2.5 pt-4 border-t border-neutral-800">
                  <h4 className="font-semibold text-sm text-gray-300 mb-3">{plan.includes[0]}</h4>
                  <ul className="space-y-2">
                    {plan.includes.slice(1).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span
                          className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                          style={{
                            background: plan.popular
                              ? "linear-gradient(135deg, #8b5cf6, #c084fc)"
                              : "#525252",
                          }}
                        />
                        <span className="text-sm text-gray-300 leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TimelineContent>
        ))}
      </div>

      {/* Error toast */}
      {checkoutError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg">
          {checkoutError}
        </div>
      )}

      {/* Footer note */}
      <div className="text-center pb-16 relative z-10 space-y-3">
        <p className="text-xs text-gray-600">
          Secure payments via Stripe. Cancel anytime.
        </p>
        {currentPlan !== 'free' && user ? (
          <button
            onClick={async () => {
              const res = await fetch('/api/stripe/create-portal-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
              });
              if (res.ok) {
                const { url } = await res.json();
                window.location.href = url;
              }
            }}
            className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-4 decoration-violet-800"
          >
            Manage billing & subscription →
          </button>
        ) : null /* Free tier is now a first-class card; no need for a secondary opt-out link */}
      </div>
    </div>
  );
}
