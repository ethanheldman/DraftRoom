import { useState, useEffect } from 'react';
import { XIcon, MessageSquareIcon, ZapIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProfileModalProps {
  userId: string;
  onClose: () => void;
  onMessage: () => void;
  onNudge: () => void;
}

interface CommunityProfile {
  display_name: string;
  handle: string | null;
  avatar_color: string;
  bio: string;
  role: string;
  created_at: string;
}

function initials(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ProfileModal({ userId, onClose, onMessage, onNudge }: ProfileModalProps) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('community_profiles')
      .select('display_name, handle, avatar_color, bio, role, created_at')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setProfile(data as CommunityProfile | null);
        setLoading(false);
      });
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-80 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        {/* Banner */}
        <div
          className="h-24 relative"
          style={{
            background: profile
              ? `linear-gradient(135deg, ${profile.avatar_color}55 0%, #7c3aed44 100%)`
              : 'hsl(var(--secondary))',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
            style={{ background: 'rgba(0,0,0,0.3)' }}
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar (overlaps banner) */}
        <div className="px-5 pb-5">
          <div className="flex items-end justify-between -mt-8 mb-3">
            {loading ? (
              <div className="w-16 h-16 rounded-2xl animate-pulse" style={{ background: 'hsl(var(--secondary))' }} />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg border-4"
                style={{
                  background: profile?.avatar_color ?? '#7c3aed',
                  borderColor: 'hsl(var(--card))',
                }}
              >
                {initials(profile?.display_name ?? '?')}
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              <div className="h-4 rounded animate-pulse w-32" style={{ background: 'hsl(var(--secondary))' }} />
              <div className="h-3 rounded animate-pulse w-24" style={{ background: 'hsl(var(--secondary))' }} />
              <div className="h-3 rounded animate-pulse w-40 mt-3" style={{ background: 'hsl(var(--secondary))' }} />
            </div>
          ) : profile ? (
            <>
              <h2 className="text-base font-bold text-foreground leading-tight">{profile.display_name}</h2>
              {profile.handle && (
                <p className="text-xs text-muted-foreground mb-1">{profile.handle}</p>
              )}
              <span
                className="inline-block text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full mb-3"
                style={{
                  background: `${profile.avatar_color}22`,
                  color: profile.avatar_color,
                  border: `1px solid ${profile.avatar_color}44`,
                }}
              >
                {profile.role}
              </span>

              {profile.bio && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{profile.bio}</p>
              )}

              <p className="text-[10px] text-muted-foreground/60 mb-4">
                Member since {memberSince(profile.created_at)}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground py-3">Profile not found</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onMessage}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: 'hsl(var(--primary))', color: '#fff' }}
            >
              <MessageSquareIcon className="w-3.5 h-3.5" />
              Message
            </button>
            <button
              onClick={onNudge}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: 'hsl(var(--secondary))',
                color: 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <ZapIcon className="w-3.5 h-3.5" />
              Nudge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
