import { supabase } from '../lib/supabase';

export type NotificationType = 'squad_add' | 'nudge' | 'message' | 'share';

export interface AppNotification {
  id: string;
  userId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: NotificationType;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export const NOTIF_ICONS: Record<NotificationType, string> = {
  squad_add: '👥',
  nudge:     '⚡',
  message:   '💬',
  share:     '📝',
};

export function mapNotifRow(row: Record<string, unknown>): AppNotification {
  return {
    id:          row.id as string,
    userId:      row.user_id as string,
    senderId:    row.sender_id as string,
    senderName:  row.sender_name as string,
    senderColor: row.sender_color as string,
    type:        row.type as NotificationType,
    message:     row.message as string,
    metadata:    (row.metadata as Record<string, unknown>) ?? {},
    read:        row.read as boolean,
    createdAt:   row.created_at as string,
  };
}

export async function sendNotification(params: {
  toUserId: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  type: NotificationType;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from('notifications').insert({
    user_id:      params.toUserId,
    sender_id:    params.senderId,
    sender_name:  params.senderName,
    sender_color: params.senderColor,
    type:         params.type,
    message:      params.message,
    metadata:     params.metadata ?? {},
    read:         false,
  });
  if (error) console.error('[notifications] send error:', error);
}

export async function markNotifRead(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotifsRead(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

export async function addSquadMember(params: {
  userId: string;
  memberUserId: string;
  memberData: Record<string, unknown>;
}) {
  await supabase.from('squad_members').upsert({
    user_id:        params.userId,
    member_user_id: params.memberUserId,
    member_data:    params.memberData,
  });
}
