import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { setPlan, getPlan, type Plan } from '../lib/plan';
import { useAuth } from '../context/AuthContext';

/**
 * Returns the user's real plan from Supabase.
 * Falls back to localStorage while loading or when not authenticated.
 * Keeps localStorage in sync so the rest of the app can use getPlan() synchronously.
 */
export function usePlan() {
  const { user } = useAuth();
  const [plan, setPlanState] = useState<Plan>(getPlan);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        const cloudPlan = (data?.plan as Plan) ?? 'free';
        setPlan(cloudPlan);      // keep localStorage in sync
        setPlanState(cloudPlan);
        setLoading(false);
      })
      .catch(() => {
        // Profile doesn't exist yet — seed it as free
        supabase.from('profiles').upsert({ user_id: user.id, plan: 'free' }).then(() => {});
        setLoading(false);
      });
  }, [user?.id]);

  return { plan, loading };
}
