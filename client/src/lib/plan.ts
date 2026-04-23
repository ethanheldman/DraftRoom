export type Plan = 'free' | 'starter' | 'pro' | 'studio';

const PLAN_KEY = 'sr-plan';

export function getPlan(): Plan {
  return (localStorage.getItem(PLAN_KEY) as Plan) ?? 'free';
}

export function setPlan(plan: Plan): void {
  localStorage.setItem(PLAN_KEY, plan);
}

export function isPro(plan: Plan): boolean {
  return plan === 'pro' || plan === 'studio';
}

export const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  studio: 'Studio',
};
