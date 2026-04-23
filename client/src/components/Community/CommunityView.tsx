import { useState, useRef, useEffect, useCallback } from 'react';
import type { Project } from '../../types/screenplay';
import { supabase } from '../../lib/supabase';
import { sendNotification, addSquadMember } from '../../utils/notifications';
import DMPanel from './DMPanel';
import ProfileModal from './ProfileModal';
import SharedScriptPreview from './SharedScriptPreview';
import { loadScript } from '../../utils/storage';
import { supabase as supabaseClient } from '../../lib/supabase';

interface Friend {
  id: string;
  userId?: string;
  name: string;
  handle?: string;
  color: string;
  note: string;
  weeklyWords?: number;
  streak?: number;
  status?: 'writing' | 'reviewing' | 'break' | 'offline';
  statusUpdatedAt?: string;
  achievements?: number;
}

interface RegisteredUser {
  id: string;
  name: string;
  handle: string;
  color: string;
  role: string;
}

interface CommunityViewProps {
  friends: Friend[];
  onFriendsChange: (friends: Friend[]) => void;
  allProjects: Project[];
  totalWords: number;
  profile: { displayName: string; avatarColor: string; bio: string };
  currentUserId?: string | null;
}

const AVATAR_COLORS = ['#7c3aed', '#4ecdc4', '#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#f97316', '#ec4899'];

const STATUS_COLORS: Record<string, string> = {
  writing: '#10b981',
  reviewing: '#3b82f6',
  break: '#f59e0b',
  offline: '#6b7280',
};

function computeStreak(projects: Project[]): number {
  // Collect all days (ISO YYYY-MM-DD) with any writing activity.
  const writingDays = new Set<string>();
  for (const p of projects) {
    if (p.updatedAt) writingDays.add(p.updatedAt.slice(0, 10));
    if (p.createdAt) writingDays.add(p.createdAt.slice(0, 10));
  }
  if (writingDays.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent day (within the last year) that had writing activity.
  // Previously the streak reset to 0 as soon as today/yesterday were missed, so
  // "1/7 days this week" could coexist with "0 day streak" — confusing.
  let anchor: Date | null = null;
  for (let i = 0; i < 365; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    if (writingDays.has(day.toISOString().slice(0, 10))) {
      anchor = day;
      break;
    }
  }
  if (!anchor) return 0;

  // Count the length of the consecutive run ending at that anchor day.
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = new Date(anchor);
    day.setDate(anchor.getDate() - i);
    if (writingDays.has(day.toISOString().slice(0, 10))) streak++;
    else break;
  }
  return streak;
}

function daysThisWeek(projects: Project[]): boolean[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);
    return projects.some(
      (p) => p.updatedAt?.slice(0, 10) === dayStr || p.createdAt?.slice(0, 10) === dayStr
    );
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Honest milestone labels — they describe what the user has DRAFTED inside
// DraftRoom, nothing more. Words written ≠ industry status, so nothing here
// claims "Pro" or "Veteran." A screenwriter with one sold spec and 8,000 words
// in-app should not outrank an active writer with 60k words of early drafts.
function computeLevel(totalWords: number): string {
  if (totalWords >= 100000) return '100k+ words drafted';
  if (totalWords >= 50000)  return '50k+ words drafted';
  if (totalWords >= 15000)  return '15k+ words drafted';
  if (totalWords >= 5000)   return '5k+ words drafted';
  if (totalWords >= 1000)   return 'First thousand';
  return 'Blank page';
}

export default function CommunityView({
  friends,
  onFriendsChange,
  allProjects,
  totalWords,
  profile,
  currentUserId,
}: CommunityViewProps) {
  const streak = computeStreak(allProjects);
  const weekDays = daysThisWeek(allProjects);
  const daysCount = weekDays.filter(Boolean).length;
  const level = computeLevel(totalWords);

  // Writing Room state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionWords, setSessionWords] = useState(0);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Squad management state
  const [addingFriend, setAddingFriend] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegisteredUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchError, setSearchError] = useState<string | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    setSearchLoading(true);
    setSearchError(null);
    let query = supabase
      .from('community_profiles')
      .select('user_id, display_name, handle, avatar_color, bio, role')
      .eq('is_public', true)
      .limit(20);

    if (q.trim()) {
      query = query.or(`display_name.ilike.%${q.trim()}%,handle.ilike.%${q.trim()}%`);
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('[community] search error:', error);
      setSearchError(error.message);
      setSearchResults([]);
    } else {
      setSearchResults((data ?? []).map(r => ({
        id: r.user_id,
        name: r.display_name,
        handle: r.handle ?? '@unknown',
        color: r.avatar_color ?? '#7c3aed',
        role: r.role ?? 'Screenwriter',
      })));
    }
    setSearchLoading(false);
  }, []);

  // Load all users when panel opens, then re-query on search input
  useEffect(() => {
    if (addingFriend) searchUsers('');
  }, [addingFriend, searchUsers]);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, searchUsers]);
  const [actionFriendId, setActionFriendId] = useState<string | null>(null);
  const [dmFriend, setDmFriend] = useState<Friend | null>(null);
  const [profileFriend, setProfileFriend] = useState<Friend | null>(null);
  const [nudgeSent, setNudgeSent] = useState<string | null>(null);
  const [sharedScriptId, setSharedScriptId] = useState<string | null>(null);

  function startSession() {
    setSessionActive(true);
    setSessionSeconds(0);
    setIsBreak(false);
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setSessionSeconds((s) => {
        const total = pomodoroMinutes * 60;
        if (s + 1 >= total) {
          setIsBreak((b) => !b);
          return 0;
        }
        return s + 1;
      });
    }, 1000);
  }

  function stopSession() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionActive(false);
    setSessionSeconds(0);
    setIsBreak(false);
    setIsPaused(false);
    setSessionWords(0);
  }

  function pauseSession() {
    if (isPaused) {
      // Resume
      timerRef.current = setInterval(() => {
        setSessionSeconds((s) => {
          const total = pomodoroMinutes * 60;
          if (s + 1 >= total) {
            setIsBreak((b) => !b);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
      setIsPaused(false);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPaused(true);
    }
  }

  function resetTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionSeconds(0);
    setIsBreak(false);
    setIsPaused(true);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ESC closes fullscreen
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowFullScreen(false);
    }
    if (showFullScreen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showFullScreen]);


  function addFriend(user: RegisteredUser) {
    if (friends.some(f => f.handle === user.handle)) return;
    const newFriend: Friend = {
      id: Date.now().toString(),
      userId: user.id,
      name: user.name,
      handle: user.handle,
      color: user.color,
      note: user.role,
    };
    onFriendsChange([...friends, newFriend]);
    setSearchQuery('');
    setAddingFriend(false);

    // Send squad_add notification to the added user
    if (currentUserId && user.id && user.id !== currentUserId) {
      sendNotification({
        toUserId: user.id,
        senderId: currentUserId,
        senderName: profile.displayName || 'A writer',
        senderColor: profile.avatarColor,
        type: 'squad_add',
        message: `${profile.displayName || 'A writer'} added you to their Writing Squad!`,
        metadata: { addedBy: currentUserId },
      }).catch(() => {});

      addSquadMember({
        userId: currentUserId,
        memberUserId: user.id,
        memberData: { name: user.name, handle: user.handle, color: user.color },
      }).catch(() => {});
    }
  }

  function removeFriend(id: string) {
    onFriendsChange(friends.filter((f) => f.id !== id));
    if (actionFriendId === id) setActionFriendId(null);
  }

  async function nudgeFriend(f: Friend) {
    if (!currentUserId || !f.userId) {
      // fallback: copy to clipboard
      navigator.clipboard.writeText(`Hey ${f.name}, how's the writing going? 🎬`).catch(() => {});
      setNudgeSent(f.id);
      setTimeout(() => setNudgeSent(null), 2000);
      return;
    }
    await sendNotification({
      toUserId: f.userId,
      senderId: currentUserId,
      senderName: profile.displayName || 'A writer',
      senderColor: profile.avatarColor,
      type: 'nudge',
      message: `${profile.displayName || 'A writer'} nudged you — time to write! ⚡`,
      metadata: {},
    }).catch(() => {});
    setNudgeSent(f.id);
    setTimeout(() => setNudgeSent(null), 2000);
  }

  async function shareScript(f: Friend, scriptTitle: string, projectId: string) {
    if (!currentUserId || !f.userId) return;

    // Upload script content to shared_scripts table
    const nodes = loadScript(projectId);
    const { data: inserted, error } = await supabaseClient
      .from('shared_scripts')
      .insert({
        sender_id: currentUserId,
        recipient_id: f.userId,
        title: scriptTitle,
        sender_name: profile.displayName || 'A writer',
        script_nodes: nodes,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[share] failed to upload script:', error);
      return;
    }

    await sendNotification({
      toUserId: f.userId,
      senderId: currentUserId,
      senderName: profile.displayName || 'A writer',
      senderColor: profile.avatarColor,
      type: 'share',
      message: `${profile.displayName || 'A writer'} shared their script "${scriptTitle}" with you 📝`,
      metadata: { scriptTitle, sharedScriptId: inserted.id },
    }).catch(() => {});

    setSharedScriptId(projectId);
    setTimeout(() => setSharedScriptId(null), 2500);
  }

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Build last-7-days labels starting from 6 days ago
  const todayDow = new Date().getDay();
  const weekLabels = Array.from({ length: 7 }, (_, i) => {
    const dow = (todayDow - 6 + i + 7) % 7;
    return DAY_LABELS[dow];
  });

  const totalPomodoro = pomodoroMinutes * 60;
  const progressPct = Math.round((sessionSeconds / totalPomodoro) * 100);

  const myInitials = initials(profile.displayName || 'Me');

  return (
    <div className="space-y-5">
      {/* ── HERO CARD ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${profile.avatarColor}33 0%, hsl(var(--card)) 60%)`,
          border: '1px solid hsl(var(--border))',
        }}
      >
        <div className="p-6">
          <div className="flex items-start gap-5 mb-5">
            {/* Avatar */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0 shadow-lg"
              style={{ background: profile.avatarColor }}
            >
              {myInitials}
            </div>

            {/* Name + bio + stats */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-lg font-bold text-foreground leading-none">
                  {profile.displayName || 'Anonymous Writer'}
                </h2>
                <span
                  className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                  style={{ background: `${profile.avatarColor}22`, color: profile.avatarColor, border: `1px solid ${profile.avatarColor}44` }}
                >
                  {level}
                </span>
              </div>
              {profile.bio && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{profile.bio}</p>
              )}

              {/* Stats chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                >
                  <span>🔥</span>
                  <span className="text-foreground">{streak}</span>
                  <span className="text-muted-foreground">day streak</span>
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                >
                  <span>✍️</span>
                  <span className="text-foreground">{totalWords.toLocaleString()}</span>
                  <span className="text-muted-foreground">words</span>
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                >
                  <span>📅</span>
                  <span className="text-foreground">{daysCount}/7</span>
                  <span className="text-muted-foreground">days this week</span>
                </span>
              </div>
            </div>
          </div>

          {/* 7-day activity dots */}
          <div className="flex items-end gap-3">
            {weekDays.map((active, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full transition-all duration-300"
                  style={{
                    background: active ? profile.avatarColor : 'hsl(var(--border))',
                    boxShadow: active ? `0 0 8px ${profile.avatarColor}66` : 'none',
                  }}
                />
                <span className="text-[9px] font-medium text-muted-foreground">{weekLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex gap-5 items-start">
        {/* ── LEFT: WRITING SQUAD ── */}
        <div className="flex-1 min-w-0">
          <div
            className="rounded-2xl"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-foreground">Writing Squad</span>
                {friends.length > 0 && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
                  >
                    {friends.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setAddingFriend((v) => !v); setSearchQuery(''); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all hover:opacity-90"
                style={
                  addingFriend
                    ? { background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }
                    : { background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.2)' }
                }
              >
                {addingFriend ? 'Cancel' : '+ Add Member'}
              </button>
            </div>

            {/* Add member — user search */}
            {addingFriend && (() => {
              const q = searchQuery.toLowerCase().trim();
              const alreadyAdded = new Set(friends.map(f => f.handle));
              const results = searchResults;
              return (
                <div
                  className="px-5 py-4"
                  style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary) / 0.4)' }}
                >
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Search DraftRoom users
                  </label>
                  <div className="relative">
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Name or @handle…"
                      className="w-full rounded-xl px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                      onBlur={(e) => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                    />
                    {/* Search icon */}
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </div>

                  {/* Results dropdown — always shown once panel is open */}
                  <div
                    className="mt-2 rounded-xl overflow-hidden"
                    style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  >
                    {searchLoading ? (
                      <div className="px-4 py-5 text-center">
                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Loading writers…</p>
                      </div>
                    ) : searchError ? (
                      <div className="px-4 py-5 text-center">
                        <div className="text-xl mb-1">⚠️</div>
                        <p className="text-xs text-muted-foreground">Couldn't load users</p>
                        <p className="text-[10px] text-red-400/80 mt-1 font-mono">{searchError}</p>
                      </div>
                    ) : (results.length === 0 && false) ? null : results.length === 0 ? (
                        <div className="px-4 py-5 text-center">
                          <div className="text-xl mb-1">{q ? '🔍' : '✍️'}</div>
                          <p className="text-xs text-muted-foreground">{q ? `No writers found for "${q}"` : 'No writers have joined yet'}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">{q ? 'Try a different name or handle' : 'Invite your writing friends to DraftRoom!'}</p>
                        </div>
                      ) : (
                        results.map((u, i) => {
                          const added = alreadyAdded.has(u.handle);
                          return (
                            <button
                              key={u.id}
                              onClick={() => !added && addFriend(u)}
                              disabled={added}
                              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                              style={{
                                borderTop: i > 0 ? '1px solid hsl(var(--border))' : undefined,
                                background: added ? 'transparent' : undefined,
                                cursor: added ? 'default' : 'pointer',
                              }}
                              onMouseEnter={(e) => { if (!added) e.currentTarget.style.background = 'hsl(var(--secondary))'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              {/* Avatar */}
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ background: u.color, opacity: added ? 0.5 : 1 }}
                              >
                                {initials(u.name)}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-foreground truncate" style={{ opacity: added ? 0.5 : 1 }}>
                                  {u.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">{u.handle} · {u.role}</div>
                              </div>
                              {/* State badge */}
                              {added ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                                  In squad
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-muted-foreground flex-shrink-0">+ Add</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>

                  {!q && !searchLoading && results.length > 0 && (
                    <p className="mt-2 text-[10px] text-muted-foreground/60">
                      Showing recent writers · type to search by name or handle
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Friend cards */}
            <div className="p-5 space-y-3">
              {friends.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-sm font-medium text-foreground/70 mb-1">No writing buddies yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add the people you write with to track progress together.
                  </p>
                </div>
              ) : (
                friends.map((f) => {
                  const fi = initials(f.name);
                  const statusColor = STATUS_COLORS[f.status ?? 'offline'] ?? '#6b7280';

                  return (
                    <div
                      key={f.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid hsl(var(--border))' }}
                    >
                      {/* Main row */}
                      <div className="flex items-start gap-3 p-4">
                        {/* Avatar with optional pulse */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                            style={{ background: f.color }}
                          >
                            {fi}
                          </div>
                          {f.status === 'writing' && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5">
                              <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.4 }} />
                              <div className="relative w-3.5 h-3.5 rounded-full" style={{ background: '#10b981', border: '2px solid hsl(var(--card))' }} />
                            </div>
                          )}
                          {f.status && f.status !== 'writing' && (
                            <div
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full"
                              style={{ background: statusColor, border: '2px solid hsl(var(--card))' }}
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-foreground truncate">{f.name}</span>
                            {f.status && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                                style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}
                              >
                                {f.status}
                              </span>
                            )}
                          </div>
                          {(f.handle || f.note) && (
                            <p className="text-[10px] text-muted-foreground truncate mb-1">
                              {f.handle && <span className="opacity-60">{f.handle}</span>}
                              {f.handle && f.note && <span className="opacity-40"> · </span>}
                              {f.note}
                            </p>
                          )}
                          {/* Stats row */}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{f.streak !== undefined ? `${f.streak}` : '0'} day streak</span>
                            <span>{f.weeklyWords !== undefined ? f.weeklyWords.toLocaleString() : '0'} words this week</span>
                            <span>{f.achievements ?? 0} milestones</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => nudgeFriend(f)}
                            title={`Nudge ${f.name}`}
                            className="text-[10px] font-medium px-2 py-1 rounded-lg transition-all"
                            style={
                              nudgeSent === f.id
                                ? { background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)' }
                                : { border: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }
                            }
                          >
                            {nudgeSent === f.id ? '⚡ Sent!' : '⚡ Nudge'}
                          </button>
                          <button
                            onClick={() => {
                              setActionFriendId(actionFriendId === f.id ? null : f.id);
                            }}
                            className="text-[10px] font-medium px-2 py-1 rounded-lg transition-colors"
                            style={
                              actionFriendId === f.id
                                ? { background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.25)' }
                                : { border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--secondary))' }
                            }
                          >
                            {actionFriendId === f.id ? 'Close' : '···'}
                          </button>
                          <button
                            onClick={() => removeFriend(f.id)}
                            className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors px-1.5 py-1 rounded-lg"
                            title="Remove from squad"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Action panel */}
                      {actionFriendId === f.id && (
                        <div
                          className="px-4 py-3 flex items-center gap-2 flex-wrap"
                          style={{ background: 'hsl(var(--secondary) / 0.5)', borderTop: '1px solid hsl(var(--border))' }}
                        >
                          <button
                            onClick={() => { setDmFriend(f); setActionFriendId(null); }}
                            className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
                            style={{ background: 'hsl(var(--primary))', color: '#fff' }}
                          >
                            💬 Open Chat
                          </button>
                          {f.userId && (
                            <button
                              onClick={() => { setProfileFriend(f); setActionFriendId(null); }}
                              className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                              style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                            >
                              👤 View Profile
                            </button>
                          )}
                          {allProjects.filter(p => !p.trashedAt && !p.archived).length === 0 ? (
                            <span className="text-[10px] text-muted-foreground/50 italic">No scripts to share yet</span>
                          ) : (
                            <div className="w-full">
                              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Share a script</p>
                              <div className="flex flex-wrap gap-1.5">
                                {allProjects.filter(p => !p.trashedAt && !p.archived).slice(0, 4).map(p => (
                                  <button
                                    key={p.id}
                                    onClick={async () => { await shareScript(f, p.title || 'Untitled', p.id); }}
                                    className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-lg transition-all max-w-[140px]"
                                    style={
                                      sharedScriptId === p.id
                                        ? { background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)' }
                                        : { background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }
                                    }
                                  >
                                    {sharedScriptId === p.id ? '✓ Shared!' : `📤 ${(p.title || 'Untitled').slice(0, 16)}`}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: WRITING ROOM ── */}
        <div
          className="w-72 flex-shrink-0 rounded-2xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        >
          {/* Header */}
          <div
            className="px-5 py-4"
            style={{ borderBottom: '1px solid hsl(var(--border))' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Writing Room</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Focus together. No distractions, no content shared — just presence.
            </p>
          </div>

          {/* Squad presence */}
          {friends.length > 0 && (
            <div
              className="px-5 py-3"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}
            >
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
                Squad Presence
              </p>
              <div className="space-y-2">
                {friends.map((f) => {
                  const fi = initials(f.name);
                  const statusColor = STATUS_COLORS[f.status ?? 'offline'] ?? '#6b7280';
                  const isWriting = f.status === 'writing';
                  return (
                    <div key={f.id} className="flex items-center gap-2">
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                          style={{
                            background: f.color,
                            opacity: isWriting ? 1 : 0.55,
                            boxShadow: isWriting ? `0 0 8px ${f.color}66` : 'none',
                          }}
                        >
                          {fi}
                        </div>
                        {isWriting && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3">
                            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.4 }} />
                            <div className="relative w-3 h-3 rounded-full" style={{ background: '#10b981', border: '2px solid hsl(var(--card))' }} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-foreground truncate">{f.name}</p>
                        {isWriting ? (
                          <div className="flex items-center gap-0.5">
                            <span className="text-[9px] animate-pulse" style={{ color: '#10b981' }}>●</span>
                            <span className="text-[9px] animate-pulse" style={{ color: '#10b981', animationDelay: '0.2s' }}>●</span>
                            <span className="text-[9px] animate-pulse" style={{ color: '#10b981', animationDelay: '0.4s' }}>●</span>
                          </div>
                        ) : (
                          <p className="text-[9px] text-muted-foreground capitalize">{f.status ?? 'offline'}</p>
                        )}
                      </div>
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: statusColor }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timer area */}
          <div className="p-5">
            {!sessionActive ? (
              <>
                {/* Pomodoro duration picker */}
                <div className="mb-4">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Session Duration
                  </p>
                  <div className="flex gap-2">
                    {[25, 45, 90].map((m) => (
                      <button
                        key={m}
                        onClick={() => setPomodoroMinutes(m)}
                        className="flex-1 rounded-xl py-1.5 text-xs font-semibold transition-all"
                        style={
                          pomodoroMinutes === m
                            ? { background: 'hsl(var(--primary))', color: '#fff', border: '1px solid hsl(var(--primary))' }
                            : { background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }
                        }
                      >
                        {m}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timer preview */}
                <div className="text-center mb-5">
                  <div className="font-mono text-4xl font-black text-foreground/30 mb-1">
                    {formatTime(pomodoroMinutes * 60)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ready to focus</p>
                </div>

                <button
                  onClick={startSession}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02]"
                  style={{ background: 'hsl(var(--primary))' }}
                >
                  Start Session
                </button>
              </>
            ) : (
              <>
                {/* Active timer */}
                <div className="text-center mb-4">
                  <div className="text-[9px] font-semibold uppercase tracking-widest mb-2" style={{ color: isBreak ? '#f59e0b' : '#10b981' }}>
                    {isBreak ? 'Break' : 'Focus'}
                  </div>
                  <div
                    className="font-mono text-5xl font-black mb-1 transition-colors duration-500"
                    style={{ color: isBreak ? '#f59e0b' : '#10b981' }}
                  >
                    {isPaused ? (
                      <span style={{ opacity: 0.6 }}>{formatTime(sessionSeconds)}</span>
                    ) : (
                      formatTime(sessionSeconds)
                    )}
                  </div>
                  {isPaused && (
                    <p className="text-[10px] text-muted-foreground">Paused</p>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden mb-4" style={{ background: 'hsl(var(--border))' }}>
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${progressPct}%`,
                      background: isBreak ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>

                {/* Session words */}
                <div className="mb-4">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1.5">
                    Words Written This Session
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={sessionWords || ''}
                    onChange={(e) => setSessionWords(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full rounded-xl px-3 py-2 text-sm font-bold text-foreground outline-none text-center"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>

                {/* Controls */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={pauseSession}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                    style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}
                  >
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition-all"
                    style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                  >
                    Reset
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFullScreen(true)}
                    className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                    style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.25)' }}
                  >
                    Go Full Screen
                  </button>
                  <button
                    onClick={stopSession}
                    className="rounded-xl px-3 py-2 text-xs font-semibold transition-all text-red-400 hover:text-red-300"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  >
                    End
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── FULL SCREEN WRITING ROOM OVERLAY ── */}
      {showFullScreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: 'radial-gradient(ellipse at center, #1a0533 0%, #0a0015 60%, #000 100%)',
          }}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${isBreak ? '#f59e0b' : '#7c3aed'}22 0%, transparent 70%)`,
            }}
          />

          {/* Close button */}
          <button
            onClick={() => setShowFullScreen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-white/10 text-white/60 hover:text-white"
          >
            ✕
          </button>

          {/* Content */}
          <div className="relative text-center z-10">
            {/* Label */}
            <div
              className="text-xs font-bold uppercase tracking-widest mb-6 px-4 py-1.5 rounded-full inline-block"
              style={{
                background: isBreak ? '#f59e0b22' : '#10b98122',
                color: isBreak ? '#f59e0b' : '#10b981',
                border: `1px solid ${isBreak ? '#f59e0b44' : '#10b98144'}`,
              }}
            >
              {sessionActive ? (isBreak ? 'Break Time' : 'Focus Time') : 'Ready'}
            </div>

            {/* Big timer */}
            <div
              className="font-mono font-black mb-8 leading-none"
              style={{
                fontSize: 'clamp(5rem, 15vw, 10rem)',
                color: isBreak ? '#f59e0b' : '#10b981',
                textShadow: `0 0 60px ${isBreak ? '#f59e0b' : '#10b981'}66`,
              }}
            >
              {formatTime(sessionSeconds)}
            </div>

            {/* Session words counter */}
            {sessionWords > 0 && (
              <div className="mb-8">
                <span className="text-white/40 text-sm font-medium">
                  {sessionWords.toLocaleString()} words this session
                </span>
              </div>
            )}

            {/* Squad presence row */}
            {friends.length > 0 && (
              <div className="flex items-center justify-center gap-4 mb-8">
                {friends.map((f) => {
                  const fi = initials(f.name);
                  const isWriting = f.status === 'writing';
                  return (
                    <div key={f.id} className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{
                            background: f.color,
                            opacity: isWriting ? 1 : 0.4,
                            boxShadow: isWriting ? `0 0 16px ${f.color}88` : 'none',
                          }}
                        >
                          {fi}
                        </div>
                        {isWriting && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3">
                            <div className="absolute inset-0 rounded-full animate-ping" style={{ background: '#10b981', opacity: 0.5 }} />
                            <div className="relative w-3 h-3 rounded-full" style={{ background: '#10b981', border: '2px solid #1a0533' }} />
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-medium" style={{ color: isWriting ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)' }}>
                        {f.name.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              {sessionActive && (
                <button
                  onClick={pauseSession}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                onClick={() => setShowFullScreen(false)}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Exit Full Screen
              </button>
            </div>

            {/* ESC hint */}
            <p className="mt-5 text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Press ESC to exit
            </p>
          </div>
        </div>
      )}

      {/* DM Panel — slides in below the squad list when open */}
      {dmFriend && (
        <div className="mt-5">
          <DMPanel
            currentUserId={currentUserId ?? ''}
            currentUserName={profile.displayName || 'You'}
            currentUserColor={profile.avatarColor}
            friend={{
              userId: dmFriend.userId ?? '',
              name: dmFriend.name,
              color: dmFriend.color,
              handle: dmFriend.handle,
            }}
            onClose={() => setDmFriend(null)}
          />
        </div>
      )}

      {/* Profile modal */}
      {profileFriend?.userId && (
        <ProfileModal
          userId={profileFriend.userId}
          onClose={() => setProfileFriend(null)}
          onMessage={() => { setDmFriend(profileFriend); setProfileFriend(null); }}
          onNudge={() => { nudgeFriend(profileFriend); setProfileFriend(null); }}
        />
      )}
    </div>
  );
}
