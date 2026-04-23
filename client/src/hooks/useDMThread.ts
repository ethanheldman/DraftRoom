import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface DMMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  createdAt: string;
}

function rowToMessage(row: Record<string, unknown>): DMMessage {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    senderName: row.sender_name as string,
    senderColor: row.sender_color as string,
    text: ((row.metadata as Record<string, unknown>)?.text as string) ?? (row.message as string),
    createdAt: row.created_at as string,
  };
}

function cacheKey(a: string, b: string) {
  return `sr-dm:${[a, b].sort().join(':')}`;
}

function loadSentCache(currentUserId: string, friendUserId: string): DMMessage[] {
  try {
    return JSON.parse(localStorage.getItem(cacheKey(currentUserId, friendUserId)) ?? '[]');
  } catch { return []; }
}

function saveSentCache(currentUserId: string, friendUserId: string, msgs: DMMessage[]) {
  // only cache messages sent by currentUser, keep last 100
  const mine = msgs.filter(m => m.senderId === currentUserId).slice(-100);
  localStorage.setItem(cacheKey(currentUserId, friendUserId), JSON.stringify(mine));
}

function mergeMessages(existing: DMMessage[], incoming: DMMessage[]): DMMessage[] {
  const seen = new Set(existing.map(m => m.id));
  const merged = [...existing];
  for (const m of incoming) {
    if (!seen.has(m.id)) { merged.push(m); seen.add(m.id); }
  }
  return merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function useDMThread(currentUserId: string | null, friendUserId: string | null) {
  const [messages, setMessages] = useState<DMMessage[]>(() => {
    if (!currentUserId || !friendUserId) return [];
    return loadSentCache(currentUserId, friendUserId);
  });
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const fetchMessages = useCallback(async () => {
    if (!currentUserId || !friendUserId) return;
    setLoading(true);

    // Messages received FROM friend
    const { data: received } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('sender_id', friendUserId)
      .eq('type', 'message')
      .order('created_at', { ascending: true });

    // Messages WE sent — works if "Senders can read sent messages" policy is applied
    const { data: sent } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', friendUserId)
      .eq('sender_id', currentUserId)
      .eq('type', 'message')
      .order('created_at', { ascending: true });

    const fromDb = [
      ...(received ?? []).map(rowToMessage),
      ...(sent ?? []).map(rowToMessage),
    ];

    setMessages(prev => mergeMessages(prev, fromDb));
    setLoading(false);
  }, [currentUserId, friendUserId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Persist cache whenever messages change
  useEffect(() => {
    if (currentUserId && friendUserId) {
      saveSentCache(currentUserId, friendUserId, messages);
    }
  }, [messages, currentUserId, friendUserId]);

  // Real-time: incoming messages from friend
  useEffect(() => {
    if (!currentUserId || !friendUserId) return;
    const channel = supabase
      .channel(`dm:${[currentUserId, friendUserId].sort().join(':')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.sender_id === friendUserId && row.type === 'message') {
            setMessages(prev => mergeMessages(prev, [rowToMessage(row)]));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, friendUserId]);

  function appendSent(msg: DMMessage) {
    setMessages(prev => mergeMessages(prev, [msg]));
  }

  return { messages, loading, appendSent };
}
