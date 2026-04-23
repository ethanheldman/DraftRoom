import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { mapNotifRow, markNotifRead, markAllNotifsRead, type AppNotification } from '../utils/notifications';

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) { setNotifications([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      setNotifications(data.map(mapNotifRow));
    }
    setLoading(false);
  }, [userId]);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [mapNotifRow(payload.new as Record<string, unknown>), ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) => n.id === (payload.new as { id: string }).id ? mapNotifRow(payload.new as Record<string, unknown>) : n)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markRead(id: string) {
    await markNotifRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    if (!userId) return;
    await markAllNotifsRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
