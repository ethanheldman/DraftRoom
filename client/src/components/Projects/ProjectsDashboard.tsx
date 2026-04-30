import { useState, useEffect, useRef, useCallback } from 'react';
import { useTour } from '../../context/TourContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FilmIcon, FolderOpenIcon, ArchiveIcon, Trash2Icon, LayoutGridIcon,
  UserIcon, HelpCircleIcon, PlusIcon, UploadIcon, SearchIcon,
  ArrowUpDownIcon, BookOpenIcon, SparklesIcon, ZapIcon, XIcon, UsersIcon, TvIcon,
  CopyIcon, PencilIcon, DownloadIcon, ChevronUpIcon, ChevronDownIcon,
  LogOutIcon,
} from 'lucide-react';
import { exportFountain } from '../../utils/fountain';
import CommunityView from '../Community/CommunityView';
import NotificationBell from '../ui/NotificationBell';
import { useAuth } from '../../context/AuthContext';
import ProjectCard from './ProjectCard';
import { ProfileCard } from '../ui/profile-card';
import WritingGuide from '../Help/WritingGuide';
import AchievementToast from '../Achievements/AchievementToast';
import { ALL_ACHIEVEMENTS, checkNewUnlocks, loadUnlocked, type AchievementDef } from '../../utils/achievements';
import { loadProjects, createNewProject, upsertProject, deleteProject, estimatePageCount, countWords, loadScript, saveScript, loadTvShows, upsertTvShow, deleteTvShow, createNewTvShow } from '../../utils/storage';
import { getPlan, setPlan, isPro, PLAN_LABELS, type Plan } from '../../lib/plan';
import { supabase } from '../../lib/supabase';
import { EXPERIENCE_KEY, type ExperienceLevel } from '../../pages/SignInDemo';
import type { Project } from '../../types/screenplay';
import { DottedSurface } from '../ui/dotted-surface';
import { APP_THEMES, applyAppTheme, APP_THEME_KEY } from '../../utils/appThemes';

function getExperienceLevel(): ExperienceLevel {
  return (localStorage.getItem(EXPERIENCE_KEY) as ExperienceLevel) ?? 'experienced';
}

const GENRES = ['Drama', 'Comedy', 'Thriller', 'Sci-Fi', 'Horror', 'Action', 'Romance', 'Animation', 'Documentary', 'Other'];

type DashView = 'projects' | 'archived' | 'trash' | 'management' | 'profile' | 'help' | 'community';

interface Profile { displayName: string; bio: string; avatarColor: string; }
interface Friend {
  id: string;
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

function loadProfile(): Profile {
  try { return JSON.parse(localStorage.getItem('sr-profile') ?? 'null') ?? { displayName: '', bio: '', avatarColor: '#c17f24' }; }
  catch { return { displayName: '', bio: '', avatarColor: '#7c3aed' }; }
}
function saveProfile(p: Profile) { localStorage.setItem('sr-profile', JSON.stringify(p)); }
function loadFriends(): Friend[] {
  try { return JSON.parse(localStorage.getItem('sr-friends') ?? '[]'); }
  catch { return []; }
}
function saveFriends(f: Friend[]) { localStorage.setItem('sr-friends', JSON.stringify(f)); }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

const AVATAR_COLORS: { name: string; hex: string }[] = [
  { name: 'Amber',      hex: '#c17f24' },
  { name: 'Ocean',      hex: '#0e7490' },
  { name: 'Forest',     hex: '#2d6a2d' },
  { name: 'Sunset',     hex: '#c2502a' },
  { name: 'Lavender',   hex: '#7c5cbf' },
  { name: 'Nord',       hex: '#4c7fa6' },
  { name: 'Rosewood',   hex: '#9b2335' },
  { name: 'Midnight',   hex: '#1e3a8a' },
  { name: 'Matcha',     hex: '#4a7c59' },
  { name: 'Dracula',    hex: '#7b2d8b' },
  { name: 'Cyber',      hex: '#0ea5a0' },
  { name: 'Sandstone',  hex: '#a07850' },
];

const TUTORIAL_FEATURES = [
  { icon: BookOpenIcon, title: 'Smart Script Editor', body: 'Auto-formatting on every keystroke. Press Enter after a Character to jump straight to Dialogue. Tab cycles element types. ⌘B/I/U for rich text.' },
  { icon: SparklesIcon, title: 'Script Doctor AI', body: 'Open the AI panel → Doctor tab and chat with an AI that has read your entire script. Ask about pacing, structure, the Bechdel test, cuts, and more.' },
  { icon: LayoutGridIcon, title: 'Beat Sheet & Arc', body: 'Hit "✨ Generate from Script" to auto-populate all three acts from your existing scenes. The arc graph shows every beat\'s position across the story.' },
  { icon: FilmIcon, title: 'Production Schedule', body: 'Filter by INT/EXT or DAY/NIGHT, toggle Group by Location, or hit ⚡ Optimize to sort scenes for shooting efficiency — saving real production days.' },
  { icon: UploadIcon, title: 'Import Anything', body: 'Drag in a .fountain, .fdx, .txt, or .pdf screenplay and DraftRoom parses it automatically — including page headers, footers, and dual-column dialogue.' },
  { icon: HelpCircleIcon, title: 'Keyboard Shortcuts', body: '⌘1–8 set element type. ⌘Z / ⌘⇧Z undo/redo. ⌘F find & replace. Arrow keys navigate between lines. Everything a WGA member expects.' },
];

// Community tab is hidden until we have a large enough user base for it to feel
// populated. Flip to true to restore the tab — all supporting code (CommunityView,
// Supabase community_profiles upsert, DMs, community achievements) is still wired up.
const COMMUNITY_ENABLED = false;

const NAV = [
  { label: 'Profile',    view: 'profile' as DashView,    Icon: UserIcon },
  ...(COMMUNITY_ENABLED
    ? [{ label: 'Community', view: 'community' as DashView, Icon: UsersIcon }]
    : []),
  { label: 'Projects',   view: 'projects' as DashView,   Icon: FilmIcon },
  // Help Center sits right under Projects — it's the most useful surface for
  // screenwriters new to the craft or the app, so it gets prime real estate.
  { label: 'Help Center',view: 'help' as DashView,       Icon: HelpCircleIcon },
  { label: 'Archived',   view: 'archived' as DashView,   Icon: ArchiveIcon },
  { label: 'Management', view: 'management' as DashView, Icon: LayoutGridIcon },
  { label: 'Trash',      view: 'trash' as DashView,      Icon: Trash2Icon },
];

export default function ProjectsDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  // Sign the user out of Supabase, then hard-navigate to the landing page so
  // no cached protected-route state leaks across accounts. We confirm first
  // because misclicks from the Profile tab would otherwise nuke the session.
  async function handleSignOut() {
    const ok = window.confirm('Sign out of DraftRoom? Your work is saved — you can sign back in any time.');
    if (!ok) return;
    await signOut();
    // Use replace so the browser back button doesn't bounce back into a
    // suddenly-unauthenticated dashboard.
    navigate('/', { replace: true });
  }
  const importRef = useRef<HTMLInputElement>(null);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [experienceLevel] = useState<ExperienceLevel>(getExperienceLevel);
  // The beginner tutorial modal used to auto-open alongside the interactive
  // AppTour, leaving new users staring at two onboarding flows at once. Now
  // it only opens when the user explicitly clicks the "Start tutorial" button
  // below — the AppTour is the single first-run experience.
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  // For 'some' experience: a one-time soft banner offering the Help Center
  const [showHelpOffer, setShowHelpOffer] = useState(() => {
    if (localStorage.getItem('sr-help-offer-dismissed')) return false;
    return getExperienceLevel() === 'some';
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftGenre, setDraftGenre] = useState('');
  const [draftLogline, setDraftLogline] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [dashView, setDashView] = useState<DashView>('projects');
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [profileDraft, setProfileDraft] = useState<Profile>(loadProfile);
  const [plan] = useState<Plan>(() => getPlan());
  const [friends, setFriends] = useState<Friend[]>(loadFriends);
  const [friendDraft, setFriendDraft] = useState({ name: '', note: '', color: '#c17f24' });
  const [activeThemeId, setActiveThemeId] = useState(() => localStorage.getItem(APP_THEME_KEY) ?? 'amber');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<'idle' | 'success' | 'invalid' | 'cloud_error'>('idle');

  // Redeem flow: validates the code, then persists the Pro plan to BOTH localStorage
  // (for immediate UI) and Supabase (so usePlan doesn't overwrite us with the cloud
  // `free` value on the next mount / reload — that was the bug where Pro "didn't stay").
  async function handleRedeem() {
    if (redeemCode.trim().toLowerCase() !== 'bighairymanjuice') {
      setRedeemStatus('invalid');
      return;
    }
    setPlan('pro'); // optimistic local so the current session is Pro immediately

    if (user?.id) {
      const { error } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, plan: 'pro' });
      if (error) {
        console.error('[redeem] failed to persist plan to cloud:', error);
        setRedeemStatus('cloud_error');
        setRedeemCode('');
        return;
      }
    }

    setRedeemStatus('success');
    setRedeemCode('');
  }
  const [tvShows, setTvShows] = useState<import('../../types/screenplay').TvShow[]>(loadTvShows);
  const [activeShow, setActiveShow] = useState<import('../../types/screenplay').TvShow | null>(null);
  const [createType, setCreateType] = useState<'film' | 'tv'>('film');
  const [draftNetwork, setDraftNetwork] = useState('');
  const [addEpDraft, setAddEpDraft] = useState({ title: '', season: 1, episode: 1 });

  const [toastQueue, setToastQueue] = useState<AchievementDef[]>([]);
  const [achExpanded, setAchExpanded] = useState(false);
  const [selectedAch, setSelectedAch] = useState<(AchievementDef & { unlocked: boolean }) | null>(null);

  type MgmtSortCol = 'title' | 'genre' | 'status' | 'created' | 'modified' | 'words' | 'pages';
  const [mgmtSort, setMgmtSort] = useState<{ col: MgmtSortCol; dir: 'asc' | 'desc' }>({ col: 'modified', dir: 'desc' });
  const [editingGenre, setEditingGenre] = useState<string | null>(null);

  const { startTour } = useTour();

  // Listen for tour navigation events
  useEffect(() => {
    function onTourDashView(e: Event) {
      setDashView((e as CustomEvent).detail as DashView);
    }
    window.addEventListener('tour:dash-view', onTourDashView);
    return () => window.removeEventListener('tour:dash-view', onTourDashView);
  }, []);

  // Auto-start the tour for brand-new users. The previous `projects.length === 0`
  // gate stopped firing once we started seeding a demo screenplay during
  // onboarding — the storage flags are the real source of truth for "has this
  // user been onboarded yet".
  useEffect(() => {
    if (!localStorage.getItem('sr-tour-seen') && !localStorage.getItem('sr-tutorial-seen')) {
      const t = setTimeout(() => startTour(), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => { setAllProjects(loadProjects()); }, []);
  function refresh() { setAllProjects(loadProjects()); }

  // Check for newly unlocked achievements whenever key data changes
  useEffect(() => {
    if (allProjects.length === 0) return;
    const nonTrashed = allProjects.filter(p => !p.trashedAt);
    const tw = allProjects.reduce((s, p) => s + (p.settings?.writingTime ?? 0), 0);
    const words = allProjects.reduce((s, p) => {
      try { return s + countWords(loadScript(p.id)); } catch { return s; }
    }, 0);
    const pages = nonTrashed.reduce((s, p) => {
      try { return s + estimatePageCount(loadScript(p.id)); } catch { return s; }
    }, 0);
    const ctx = {
      projects: nonTrashed,
      totalWords: words,
      totalWritingTime: tw,
      friendCount: friends.length,
      tvShowCount: tvShows.filter(s => !s.archived && !s.trashedAt).length,
      estPages: pages,
      currentHour: new Date().getHours(),
    };
    const newIds = checkNewUnlocks(ctx);
    if (newIds.length > 0) {
      const defs = newIds.map(id => ALL_ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean) as AchievementDef[];
      setToastQueue(q => [...q, ...defs]);
    }
  }, [allProjects, friends.length, tvShows.length]);

  function handleCreate() {
    const p = createNewProject(draftTitle.trim() || 'Untitled Script', draftGenre || undefined, draftLogline.trim() || undefined);
    upsertProject(p);
    refresh();
    setIsCreateOpen(false);
    setDraftTitle(''); setDraftGenre(''); setDraftLogline('');
    navigate(`/projects/${p.id}`);
  }

  function handleOpen(p: Project) { navigate(`/projects/${p.id}`); }

  function handleDelete(id: string) {
    const p = allProjects.find(x => x.id === id);
    if (p) { upsertProject({ ...p, trashedAt: new Date().toISOString() }); refresh(); }
    setDeleteConfirm(null);
  }

  function handlePermanentDelete(id: string) { deleteProject(id); refresh(); }
  function handleRestore(id: string) {
    const p = allProjects.find(x => x.id === id);
    if (p) { upsertProject({ ...p, trashedAt: undefined }); refresh(); }
  }
  function handleArchive(id: string) {
    const p = allProjects.find(x => x.id === id);
    if (p) { upsertProject({ ...p, archived: !p.archived }); refresh(); }
  }
  function handleDuplicate(id: string) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;
    const dup = createNewProject(`${p.title} (copy)`, p.genre, p.logline);
    const script = loadScript(id);
    upsertProject({ ...dup, beatSheet: [...p.beatSheet], castAndCrew: [...p.castAndCrew] });
    import('../../utils/storage').then(({ saveScript }) => saveScript(dup.id, script));
    refresh();
  }
  function handleRename(id: string) {
    const p = allProjects.find(x => x.id === id);
    if (!p) return;
    const name = prompt('Rename:', p.title);
    if (name?.trim()) { upsertProject({ ...p, title: name.trim() }); refresh(); }
  }

  function refreshShows() { setTvShows(loadTvShows()); }

  function handleCreateTvShow() {
    if (!draftTitle.trim()) return;
    const show = createNewTvShow(draftTitle.trim(), draftGenre || undefined, draftLogline.trim() || undefined, draftNetwork.trim() || undefined);
    upsertTvShow(show);
    refreshShows();
    setIsCreateOpen(false);
    setDraftTitle(''); setDraftGenre(''); setDraftLogline(''); setDraftNetwork('');
    setActiveShow(show);
  }

  function handleAddEpisode(show: import('../../types/screenplay').TvShow) {
    const ep = createNewProject(
      addEpDraft.title.trim() || `Episode ${addEpDraft.episode}`,
      show.genre,
    );
    ep.showId = show.id;
    ep.season = addEpDraft.season;
    ep.episode = addEpDraft.episode;
    ep.settings.pageGoal = 60;
    upsertProject(ep);
    // bump seasons count on show
    if (addEpDraft.season > show.seasons) {
      const updated = { ...show, seasons: addEpDraft.season, updatedAt: new Date().toISOString() };
      upsertTvShow(updated);
      refreshShows();
      setActiveShow(updated);
    }
    refresh();
    setAddEpDraft(d => ({ title: '', season: d.season, episode: d.episode + 1 }));
  }

  function handleDeleteTvShow(showId: string) {
    // also delete all episodes
    allProjects.filter(p => p.showId === showId).forEach(p => deleteProject(p.id));
    deleteTvShow(showId);
    refreshShows();
    refresh();
    setActiveShow(null);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const lname = file.name.toLowerCase();
    const { parseFountain, parseFDX, parsePDF } = await import('../../utils/fountain');
    let nodes;
    if (lname.endsWith('.pdf')) nodes = await parsePDF(await file.arrayBuffer());
    else if (lname.endsWith('.fdx')) nodes = parseFDX(await file.text());
    else nodes = parseFountain(await file.text());
    const title = file.name.replace(/\.(fountain|fdx|txt|pdf)$/i, '').trim() || 'Imported Script';
    const p = createNewProject(title);
    upsertProject(p);
    saveScript(p.id, nodes);
    refresh();
    navigate(`/projects/${p.id}`);
    e.target.value = '';
  }

  useEffect(() => {
    const now = Date.now();
    const stale = allProjects.filter(p => p.trashedAt && now - new Date(p.trashedAt).getTime() > 30 * 86400000);
    stale.forEach(p => deleteProject(p.id));
    if (stale.length) refresh();
  }, [allProjects]);

  const active = allProjects.filter(p => !p.archived && !p.trashedAt && !p.showId);
  const archived = allProjects.filter(p => p.archived && !p.trashedAt && !p.showId);
  const trashed = allProjects.filter(p => !!p.trashedAt && !p.showId);

  function filterAndSort(list: Project[]) {
    let result = list.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()));
    if (sortBy === 'alpha') result = [...result].sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }

  const displayed = filterAndSort(active);

  function saveProfileChanges() { setProfile(profileDraft); saveProfile(profileDraft); }

  const totalWords = allProjects.reduce((s, p) => {
    try { return s + countWords(loadScript(p.id)); } catch { return s; }
  }, 0);
  const totalWritingTime = allProjects.reduce((s, p) => s + (p.settings?.writingTime ?? 0), 0);

  const activeTvShows = tvShows.filter(s => !s.archived && !s.trashedAt);
  const BADGE_COUNTS: Record<DashView, number | null> = {
    projects: active.length + activeTvShows.length,
    archived: archived.length, trash: trashed.length, management: null, profile: null, help: null,
    community: friends.length,
  };

  return (
    <div className="flex h-screen font-sans overflow-hidden text-foreground relative">
      <DottedSurface />

      {/* ── LEFT SIDEBAR ── hidden on mobile (<md); user can re-enable via the hamburger */}
      <div className="hidden md:flex w-[240px] flex-shrink-0 flex-col relative z-20" style={{ background: 'hsl(var(--card))', borderRight: '1px solid hsl(var(--border))' }}>
        {/* Logo */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: 'hsl(var(--foreground))', letterSpacing: '0.04em' }}>
                {/*
                  inline-block + padding-right keeps the italic 'm' in Room from
                  clipping into the sidebar NotificationBell or wrapping awkwardly
                  when serif metrics lean further than sans-serif expects. --primary
                  keeps the brand accent in sync with the user's chosen theme.
                */}
                Draft<span style={{ color: 'hsl(var(--primary))', fontStyle: 'italic', display: 'inline-block', paddingRight: '0.08em' }}>Room</span>
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>My Studio</div>
            </div>
            <NotificationBell userId={user?.id ?? null} />
          </div>
        </div>

        {/* CREATE + IMPORT */}
        <div className="px-3 py-3 space-y-1.5" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
          <button
            data-tour="create-project-btn"
            onClick={() => setIsCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all hover:opacity-90"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}
          >
            <PlusIcon size={15} />
            Create
          </button>
          <button
            onClick={() => importRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground transition-all hover:text-foreground"
            style={{ border: '1px solid hsl(var(--border))', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <UploadIcon size={13} />
            Import Script
          </button>
          <input ref={importRef} type="file" accept=".fountain,.fdx,.txt,.pdf" className="hidden" aria-label="Import script file" onChange={handleImportFile} />
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-1 overflow-y-auto space-y-0.5" data-tour="dash-sidebar">
          {NAV.map(({ label, view, Icon }) => {
            const isActive = dashView === view;
            const count = view ? BADGE_COUNTS[view] : null;
            return (
              <button
                key={label}
                onClick={() => { if (view) setDashView(view); }}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-[12px] font-medium transition-all text-left"
                style={{
                  width: 'calc(100% - 16px)',
                  marginLeft: '8px',
                  marginRight: '8px',
                  ...(isActive
                    ? { background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.2)' }
                    : { color: 'hsl(var(--muted-foreground))', background: 'transparent', border: '1px solid transparent' }),
                }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary))'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))'; } }}
              >
                <div className="flex items-center gap-2.5">
                  <Icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span>{label}</span>
                </div>
                {count !== null && count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                    style={
                      isActive
                        ? { background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }
                        : { background: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <button
            onClick={() => navigate('/pricing')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:scale-[1.02]"
            style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}
          >
            <ZapIcon size={12} style={{ color: 'hsl(var(--primary))' }} />
            <span className="text-[10px] font-bold flex-1 text-left" style={{ color: 'hsl(var(--primary))' }}>
              {PLAN_LABELS[plan]}
            </span>
            {!isPro(plan) && (
              <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5"
                style={{ background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }}>
                Upgrade ↗
              </span>
            )}
            {isPro(plan) && (
              <span className="text-[9px] font-semibold rounded-full px-1.5 py-0.5"
                style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                ✓ Active
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Top bar — wraps on narrow widths so the title and search/sort stack cleanly */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-8 py-4 sticky top-0 z-30" style={{ background: 'hsl(var(--background))', borderBottom: '1px solid hsl(var(--border))' }}>
          <span className="text-sm text-foreground capitalize" style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 18, letterSpacing: '0.03em' }}>
            {dashView === 'projects' ? 'Projects' : dashView === 'archived' ? 'Archived' : dashView === 'trash' ? 'Trash' : dashView === 'management' ? 'Management' : dashView === 'help' ? 'Help Center' : dashView === 'community' ? 'Community' : 'Profile'}
          </span>

          {(dashView === 'projects' || dashView === 'archived' || dashView === 'management') && (
            <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-0 justify-end">
              <div className="relative flex-1 sm:flex-initial min-w-0">
                <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  role="searchbox"
                  aria-label="Search projects"
                  className="w-full sm:w-44 sm:focus:w-64 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                />
              </div>
              <button
                onClick={() => setSortBy(s => s === 'recent' ? 'alpha' : 'recent')}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0"
                aria-label="Sort projects"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
              >
                <ArrowUpDownIcon size={12} />
                <span className="hidden sm:inline">Sort:</span> {sortBy === 'recent' ? 'Recent' : 'A–Z'} ▾
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Help offer banner for 'some experience' users */}
          {showHelpOffer && dashView === 'projects' && (
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5"
              style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.25)' }}
            >
              <HelpCircleIcon size={16} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
              <span className="text-sm flex-1" style={{ color: 'hsl(var(--foreground))' }}>
                You mentioned you're still learning — the{' '}
                <button
                  onClick={() => { setShowHelpOffer(false); localStorage.setItem('sr-help-offer-dismissed', '1'); setDashView('help'); }}
                  className="font-semibold underline underline-offset-2"
                  style={{ color: 'hsl(var(--primary))' }}
                >
                  Help Center
                </button>
                {' '}has interactive exercises and format guides built for you.
              </span>
              <button
                onClick={() => { setShowHelpOffer(false); localStorage.setItem('sr-help-offer-dismissed', '1'); }}
                className="rounded-lg p-1 transition-colors"
                style={{ color: 'hsl(var(--muted-foreground))' }}
                aria-label="Dismiss"
              >
                <XIcon size={14} />
              </button>
            </div>
          )}

          {/* PROJECTS */}
          {dashView === 'projects' && (
            displayed.length === 0 && activeTvShows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-8 text-center">
                <div>
                  <div style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.05, color: 'hsl(var(--foreground))', marginBottom: '0.75rem' }}>
                    The page is blank.<br />
                    <span style={{ fontStyle: 'italic', color: 'hsl(var(--primary))', display: 'inline-block', paddingRight: '0.06em' }}>Make it not.</span>
                  </div>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'hsl(var(--muted-foreground))', lineHeight: 1.8 }}>
                    Create a new project or import an existing script.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold transition-all hover:opacity-90"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.14em', textTransform: 'uppercase' }}
                  >
                    <PlusIcon size={13} /> Create Project
                  </button>
                  <button
                    onClick={() => importRef.current?.click()}
                    className="flex items-center gap-2 px-6 py-2.5 text-xs transition-colors"
                    style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', background: 'transparent' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.45)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'hsl(var(--muted-foreground))'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; }}
                  >
                    <UploadIcon size={13} /> Import Script
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-tour="project-cards">
                {/* TV show folder cards */}
                {activeTvShows.map(show => {
                  const epCount = allProjects.filter(p => p.showId === show.id && !p.trashedAt).length;
                  const seasonCount = new Set(allProjects.filter(p => p.showId === show.id && !p.trashedAt).map(p => p.season ?? 1)).size;
                  return (
                    <button key={show.id} onClick={() => { setActiveShow(show); setAddEpDraft({ title: '', season: 1, episode: epCount + 1 }); }}
                      className="group relative rounded-2xl overflow-hidden flex flex-col text-left transition-all duration-200 hover:scale-[1.02]"
                      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 2px 16px rgba(0,0,0,0.3)', minHeight: 160 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${show.color}66`; (e.currentTarget as HTMLElement).style.borderColor = show.color + '66'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: show.color }} />
                      <div className="flex-1 p-5 pt-6">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: show.color + '22', border: `1px solid ${show.color}44` }}>
                            <TvIcon size={18} style={{ color: show.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground leading-tight truncate">{show.title}</p>
                            {show.network && <p className="text-[10px] text-muted-foreground mt-0.5">{show.network}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {show.genre && <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ background: show.color + '22', color: show.color }}>{show.genre}</span>}
                          <span className="text-[9px] text-muted-foreground">{epCount} episode{epCount !== 1 ? 's' : ''}</span>
                          {seasonCount > 0 && <span className="text-[9px] text-muted-foreground">· {seasonCount} season{seasonCount !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                        <span className="text-[10px] text-muted-foreground">TV Series</span>
                        <span className="text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: show.color }}>Open →</span>
                      </div>
                    </button>
                  );
                })}
                {/* Film/script cards */}
                {displayed.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => handleOpen(p)}
                    onDelete={() => setDeleteConfirm(p.id)}
                    onArchive={() => handleArchive(p.id)}
                    onDuplicate={() => handleDuplicate(p.id)}
                    onRename={() => handleRename(p.id)}
                    onSetGenre={genre => { upsertProject({ ...p, genre }); refresh(); }}
                    onSetLogline={logline => { upsertProject({ ...p, logline }); refresh(); }}
                  />
                ))}
                {/* Add new card */}
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="group flex flex-col items-center justify-center gap-3 transition-all duration-200 min-h-[160px]"
                  style={{ border: '1px dashed hsl(var(--border))', background: 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.45)'; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--primary) / 0.04)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="w-10 h-10 flex items-center justify-center transition-colors duration-200" style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                    <PlusIcon size={18} strokeWidth={1.5} />
                  </div>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>New Script</p>
                </button>
              </div>
            )
          )}


          {/* ARCHIVED */}
          {dashView === 'archived' && (
            filterAndSort(archived).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <ArchiveIcon size={40} className="opacity-20" />
                <p className="text-sm font-medium">No archived projects</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filterAndSort(archived).map(p => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer"
                    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.3)'; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--secondary) / 0.5)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.background = 'hsl(var(--card))'; }}
                    onClick={() => handleOpen(p)}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 text-sm opacity-60" style={{ background: p.color }}>
                      {p.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-muted-foreground text-sm">{p.title}</span>
                      {p.logline && <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{p.logline}</p>}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{formatDate(p.updatedAt)}</span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleArchive(p.id)} className="px-3 py-1.5 rounded-xl text-[11px] text-foreground/80 transition-colors hover:bg-secondary" style={{ border: '1px solid hsl(var(--border))' }}>Unarchive</button>
                      <button onClick={() => setDeleteConfirm(p.id)} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* TRASH */}
          {dashView === 'trash' && (
            trashed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                <Trash2Icon size={40} className="opacity-20" />
                <p className="text-sm font-medium">Trash is empty</p>
                <p className="text-xs opacity-60">Projects are auto-purged after 30 days.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Projects in trash are permanently deleted after 30 days.</p>
                {trashed.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 opacity-40 text-xs" style={{ background: p.color }}>
                      {p.title.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-muted-foreground text-sm">{p.title}</span>
                      <p className="text-[10px] text-muted-foreground/60">Deleted {p.trashedAt ? formatDateTime(p.trashedAt) : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleRestore(p.id)} className="px-3 py-1.5 rounded-xl text-[11px] text-foreground/80 transition-colors hover:bg-secondary" style={{ border: '1px solid hsl(var(--border))' }}>Restore</button>
                      <button onClick={() => handlePermanentDelete(p.id)} className="px-3 py-1.5 rounded-xl text-[11px] text-white bg-destructive hover:opacity-90 transition-opacity">Delete Forever</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* MANAGEMENT */}
          {dashView === 'management' && (() => {
            const STATUS_CYCLE: Array<Project['status']> = ['draft', 'in-progress', 'final-draft', 'complete'];
            const STATUS_LABELS: Record<NonNullable<Project['status']>, string> = { 'draft': 'Draft', 'in-progress': 'In Progress', 'final-draft': 'Final Draft', 'complete': 'Complete' };
            const STATUS_COLORS: Record<NonNullable<Project['status']>, string> = { 'draft': 'hsl(var(--muted-foreground))', 'in-progress': '#3b82f6', 'final-draft': '#f59e0b', 'complete': '#10b981' };

            function cycleStatus(p: Project) {
              const idx = STATUS_CYCLE.indexOf(p.status ?? 'draft');
              const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
              upsertProject({ ...p, status: next });
              refresh();
            }

            function handleExport(p: Project) {
              const script = (() => { try { return loadScript(p.id); } catch { return []; } })();
              const text = exportFountain(script, p.title);
              const blob = new Blob([text], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${p.title}.fountain`; a.click();
              URL.revokeObjectURL(url);
            }

            function toggleSort(col: MgmtSortCol) {
              setMgmtSort(prev => prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' });
            }

            const rows = filterAndSort(allProjects.filter(p => !p.trashedAt)).map(p => {
              const script = (() => { try { return loadScript(p.id); } catch { return []; } })();
              return { p, wc: countWords(script), pg: estimatePageCount(script), script };
            }).sort((a, b) => {
              const dir = mgmtSort.dir === 'asc' ? 1 : -1;
              switch (mgmtSort.col) {
                case 'title': return dir * a.p.title.localeCompare(b.p.title);
                case 'genre': return dir * (a.p.genre ?? '').localeCompare(b.p.genre ?? '');
                case 'status': return dir * (a.p.status ?? 'draft').localeCompare(b.p.status ?? 'draft');
                case 'created': return dir * (a.p.createdAt > b.p.createdAt ? 1 : -1);
                case 'modified': return dir * (a.p.updatedAt > b.p.updatedAt ? 1 : -1);
                case 'words': return dir * (a.wc - b.wc);
                case 'pages': return dir * (a.pg - b.pg);
                default: return 0;
              }
            });

            function SortHeader({ col, label, right }: { col: MgmtSortCol; label: string; right?: boolean }) {
              const active = mgmtSort.col === col;
              return (
                <th className={`py-2.5 px-3 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground select-none ${right ? 'text-right' : 'text-left'}`}>
                  <button onClick={() => toggleSort(col)} className={`flex items-center gap-1 transition-colors hover:text-foreground ${right ? 'ml-auto' : ''} ${active ? 'text-foreground' : ''}`}>
                    {label}
                    {active ? (mgmtSort.dir === 'asc' ? <ChevronUpIcon size={10} /> : <ChevronDownIcon size={10} />) : <ArrowUpDownIcon size={9} className="opacity-30" />}
                  </button>
                </th>
              );
            }

            return (
              <div>
                <p className="text-xs text-muted-foreground mb-4">{rows.length} project{rows.length !== 1 ? 's' : ''}</p>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--secondary))' }}>
                        <SortHeader col="title" label="Title" />
                        <SortHeader col="status" label="Status" />
                        <SortHeader col="genre" label="Genre" />
                        <SortHeader col="modified" label="Modified" />
                        <SortHeader col="words" label="Words" right />
                        <SortHeader col="pages" label="Pages" right />
                        <th className="py-2.5 px-3 text-right text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ p, wc, pg }, i) => (
                        <tr
                          key={p.id}
                          className="transition-colors"
                          style={{ borderBottom: i < rows.length - 1 ? '1px solid hsl(var(--border) / 0.4)' : 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--secondary) / 0.3)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          {/* Title */}
                          <td className="py-3 px-3 max-w-[180px]">
                            <button onClick={() => handleOpen(p)} className="text-foreground hover:text-primary font-medium text-left transition-colors truncate block w-full">{p.title}</button>
                            {p.archived && <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">archived</span>}
                          </td>
                          {/* Status — click to cycle */}
                          <td className="py-3 px-3">
                            <button
                              onClick={() => cycleStatus(p)}
                              title="Click to change status"
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-opacity hover:opacity-70 whitespace-nowrap"
                              style={{ background: `${STATUS_COLORS[p.status ?? 'draft']}22`, color: STATUS_COLORS[p.status ?? 'draft'], border: `1px solid ${STATUS_COLORS[p.status ?? 'draft']}44` }}
                            >
                              {STATUS_LABELS[p.status ?? 'draft']}
                            </button>
                          </td>
                          {/* Genre — click to edit inline */}
                          <td className="py-3 px-3">
                            {editingGenre === p.id ? (
                              <select
                                autoFocus
                                value={p.genre ?? ''}
                                onBlur={() => setEditingGenre(null)}
                                onChange={e => { upsertProject({ ...p, genre: e.target.value || undefined }); refresh(); setEditingGenre(null); }}
                                className="bg-secondary text-foreground text-xs rounded px-1 py-0.5 border border-border"
                              >
                                <option value="">—</option>
                                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                              </select>
                            ) : (
                              <button onClick={() => setEditingGenre(p.id)} className="text-muted-foreground hover:text-foreground transition-colors text-left" title="Click to change genre">
                                {p.genre || <span className="opacity-40">—</span>}
                              </button>
                            )}
                          </td>
                          {/* Modified */}
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{formatDate(p.updatedAt)}</td>
                          {/* Words */}
                          <td className="py-3 px-3 text-right text-muted-foreground">{wc.toLocaleString()}</td>
                          {/* Pages */}
                          <td className="py-3 px-3 text-right text-muted-foreground">{pg}</td>
                          {/* Actions */}
                          <td className="py-3 px-3">
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => handleRename(p.id)} title="Rename" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><PencilIcon size={12} /></button>
                              <button onClick={() => handleDuplicate(p.id)} title="Duplicate" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><CopyIcon size={12} /></button>
                              <button onClick={() => handleExport(p)} title="Export .fountain" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><DownloadIcon size={12} /></button>
                              <button onClick={() => handleArchive(p.id)} title={p.archived ? 'Unarchive' : 'Archive'} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"><ArchiveIcon size={12} /></button>
                              <button onClick={() => setDeleteConfirm(p.id)} title="Move to trash" className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"><Trash2Icon size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-muted-foreground text-xs">No projects yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* PROFILE */}
          {/* HELP CENTER */}
          {dashView === 'help' && (
            <>
              <div
                className="mb-5 rounded-2xl p-5 flex items-center justify-between"
                style={{ background: 'hsl(var(--primary) / 0.08)', border: '1px solid hsl(var(--primary) / 0.2)' }}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground mb-0.5">🎬 App Tour</p>
                  <p className="text-xs text-muted-foreground">Take a guided walkthrough of all the key features in DraftRoom.</p>
                </div>
                <button
                  onClick={() => startTour()}
                  className="flex-shrink-0 ml-4 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: 'hsl(var(--primary))' }}
                >
                  Start Tour →
                </button>
              </div>
              <WritingGuide />
            </>
          )}

          {/* COMMUNITY */}
          {COMMUNITY_ENABLED && dashView === 'community' && (
            <div data-tour="community-view">
            <CommunityView
              friends={friends}
              onFriendsChange={(f) => { setFriends(f); saveFriends(f); }}
              allProjects={allProjects}
              totalWords={totalWords}
              profile={profile}
              currentUserId={user?.id ?? null}
            />
            </div>
          )}

          {/* PROFILE */}
          {dashView === 'profile' && (() => {
            const estPages = Math.round(totalWords / 250);
            const hoursWritten = Math.round(totalWritingTime / 3600 * 10) / 10;

            const LEVELS = [
              { min: 0,     label: 'Blank Page',          color: '#6b7280', next: 1000 },
              { min: 1000,  label: 'Emerging Voice',      color: '#3b82f6', next: 5000 },
              { min: 5000,  label: 'Working Writer',       color: '#10b981', next: 15000 },
              { min: 15000, label: 'Seasoned Screenwriter',color: '#f59e0b', next: 50000 },
              { min: 50000, label: 'Veteran Writer',       color: '#f97316', next: 100000 },
              { min: 100000,label: 'Industry Pro',         color: '#7c3aed', next: null },
            ];
            const lvl = [...LEVELS].reverse().find(l => totalWords >= l.min) ?? LEVELS[0];
            const lvlPct = lvl.next ? Math.min(100, Math.round(((totalWords - lvl.min) / (lvl.next - lvl.min)) * 100)) : 100;

            const genreCounts: Record<string, number> = {};
            allProjects.filter(p => !p.trashedAt && p.genre).forEach(p => {
              genreCounts[p.genre!] = (genreCounts[p.genre!] ?? 0) + 1;
            });
            const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            const maxGenreCount = topGenres[0]?.[1] ?? 1;

            const unlockedSet = loadUnlocked();
            const ACHIEVEMENTS = ALL_ACHIEVEMENTS.map(a => ({ ...a, unlocked: unlockedSet.has(a.id) }));

            const initials = (profileDraft.displayName || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

            function addFriend() {
              if (!friendDraft.name.trim()) return;
              const next = [...friends, { id: Date.now().toString(), name: friendDraft.name.trim(), color: friendDraft.color, note: friendDraft.note.trim() }];
              setFriends(next); saveFriends(next);
              setFriendDraft({ name: '', note: '', color: '#7c3aed' });
            }
            function removeFriend(id: string) {
              const next = friends.filter(f => f.id !== id);
              setFriends(next); saveFriends(next);
            }

            return (
              <div className="flex gap-5 items-start">
              {/* ── LEFT: main profile ──────────────────────────── */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* ── Hero card ─────────────────────────────────────── */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
                  {/* Gradient banner */}
                  <div className="h-28 relative" style={{
                    background: `linear-gradient(135deg, ${profileDraft.avatarColor}55 0%, #7c3aed44 50%, #06b6d430 100%)`,
                  }}>
                    {isPro(plan) && (
                      <span className="absolute top-3 right-3 text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
                        style={{ background: 'linear-gradient(135deg,#7c3aed,#4ecdc4)', color: '#fff' }}>
                        Pro
                      </span>
                    )}
                  </div>

                  {/* Avatar + name */}
                  <div className="px-6 pb-5" style={{ background: 'hsl(var(--card))' }}>
                    <div className="flex items-end gap-4 -mt-10 mb-4">
                      <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 shadow-lg"
                        style={{ background: profileDraft.avatarColor, border: '3px solid hsl(var(--card))' }}>
                        {initials}
                      </div>
                      <div className="pb-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-foreground leading-none">
                            {profile.displayName || 'Anonymous Writer'}
                          </h2>
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                            style={{ background: lvl.color + '22', color: lvl.color, border: `1px solid ${lvl.color}44` }}>
                            {lvl.label}
                          </span>
                        </div>
                        {profile.bio && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{profile.bio}</p>
                        )}
                      </div>
                    </div>

                    {/* Level progress bar */}
                    {lvl.next && (
                      <div className="mb-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{lvl.label} · {lvlPct}%</span>
                          <span>{(lvl.next - totalWords).toLocaleString()} words to next level</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${lvlPct}%`, background: `linear-gradient(90deg, ${lvl.color}, ${lvl.color}aa)` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Stats row ─────────────────────────────────────── */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: active.length, label: 'Scripts', icon: '🎬' },
                    { value: totalWords.toLocaleString(), label: 'Words Written', icon: '✍️' },
                    { value: estPages, label: 'Est. Pages', icon: '📄' },
                    { value: hoursWritten, label: 'Hours Writing', icon: '⏱️' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>{s.value}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* ── Achievements + Genre ──────────────────────────── */}
                <div className="space-y-4">
                  {/* Achievements */}
                  <div className="rounded-xl overflow-hidden" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                    {/* Header — always visible, click to expand */}
                    <button
                      onClick={() => setAchExpanded(x => !x)}
                      className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-secondary/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Achievements</span>
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                          style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                          {ACHIEVEMENTS.filter(a => a.unlocked).length}/{ACHIEVEMENTS.length}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-xs transition-transform duration-200"
                        style={{ display: 'inline-block', transform: achExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        ▾
                      </span>
                    </button>

                    {/* Expanded grid */}
                    {achExpanded && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: 'hsl(var(--border))' }}>

                        {/* Detail card — shown at top when an achievement is selected */}
                        {selectedAch && (
                          <div className="mt-3 mb-1 rounded-xl p-3 flex items-start gap-3"
                            style={{ background: selectedAch.unlocked ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--secondary))', border: `1px solid ${selectedAch.unlocked ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--border))'}` }}>
                            <span className="text-2xl flex-shrink-0" style={{ filter: selectedAch.unlocked ? 'none' : 'grayscale(1)' }}>{selectedAch.icon}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                <span className="text-sm font-bold text-foreground">{selectedAch.label}</span>
                                {selectedAch.unlocked ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                                    ✓ Unlocked
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                                    Locked
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{selectedAch.desc}</p>
                            </div>
                            <button onClick={() => setSelectedAch(null)}
                              className="text-muted-foreground/40 hover:text-muted-foreground text-xs flex-shrink-0 w-5 h-5 flex items-center justify-center rounded transition-colors">
                              ✕
                            </button>
                          </div>
                        )}

                        {(['volume','pages','time','craft','diversity','revision','community','special'] as const).map(cat => {
                          const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
                          const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
                          return (
                            <div key={cat} className="mt-3">
                              <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-1.5">{catLabel}</p>
                              <div className="grid grid-cols-5 gap-1.5">
                                {catAchievements.map(a => {
                                  const isSelected = selectedAch?.id === a.id;
                                  return (
                                    <button
                                      key={a.id}
                                      onClick={() => setSelectedAch(isSelected ? null : a)}
                                      className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all"
                                      style={{
                                        cursor: 'pointer',
                                        background: isSelected ? 'hsl(var(--primary) / 0.18)' : a.unlocked ? 'hsl(var(--primary) / 0.06)' : 'hsl(var(--secondary))',
                                        border: `1px solid ${isSelected ? 'hsl(var(--primary) / 0.6)' : a.unlocked ? 'hsl(var(--primary) / 0.25)' : 'hsl(var(--border))'}`,
                                        boxShadow: isSelected ? '0 0 0 2px hsl(var(--primary) / 0.15)' : 'none',
                                      }}
                                    >
                                      <span className="text-base leading-none" style={{ filter: a.unlocked ? 'none' : 'grayscale(1)', opacity: a.unlocked ? 1 : 0.45 }}>{a.icon}</span>
                                      <span className="text-[7px] text-center font-medium leading-tight w-full mt-0.5"
                                        style={{ color: a.unlocked ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))', opacity: a.unlocked ? 1 : 0.6 }}>
                                        {a.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Genre DNA */}
                  <div className="rounded-xl p-4" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Genre DNA</p>
                    {topGenres.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No genre data yet. Set genres on your scripts.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {topGenres.map(([genre, count]) => (
                          <div key={genre}>
                            <div className="flex justify-between text-[10px] mb-1">
                              <span className="text-foreground font-medium">{genre}</span>
                              <span className="text-muted-foreground">{count} script{count !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--border))' }}>
                              <div className="absolute inset-0 rounded-full bg-white/5" />
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${(count / maxGenreCount) * 100}%`, background: 'linear-gradient(90deg,#7c3aed,#4ecdc4)' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Appearance ────────────────────────────────────── */}
                <div className="rounded-xl p-5" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Appearance</p>
                  <p className="text-[11px] text-muted-foreground mb-4">Choose your preferred theme.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {APP_THEMES.map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => { applyAppTheme(theme.id); setActiveThemeId(theme.id); }}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all hover:scale-[1.02]"
                        style={{
                          background: activeThemeId === theme.id ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--secondary))',
                          border: activeThemeId === theme.id ? '2px solid hsl(var(--primary) / 0.6)' : '1px solid hsl(var(--border))',
                        }}
                      >
                        <div className="flex gap-1 flex-shrink-0">
                          {theme.swatch.map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                          ))}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground leading-tight">{theme.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{theme.description}</p>
                        </div>
                        {activeThemeId === theme.id && (
                          <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Redeem code */}
                  <div className="mt-4 pt-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                    <p className="text-[11px] text-muted-foreground mb-2">Have a code?</p>
                    <div className="flex gap-2">
                      <input
                        value={redeemCode}
                        onChange={e => { setRedeemCode(e.target.value); setRedeemStatus('idle'); }}
                        onKeyDown={e => { if (e.key === 'Enter') handleRedeem(); }}
                        placeholder="Enter code..."
                        className="flex-1 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                        style={{ background: 'hsl(var(--secondary))', border: `1px solid ${redeemStatus === 'invalid' || redeemStatus === 'cloud_error' ? 'hsl(var(--destructive))' : 'hsl(var(--border))'}` }}
                      />
                      <button
                        onClick={handleRedeem}
                        className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                      >
                        Redeem
                      </button>
                    </div>
                    {redeemStatus === 'success' && (
                      <p className="text-[11px] mt-2" style={{ color: '#22c55e' }}>✓ Pro unlocked and saved to your account.</p>
                    )}
                    {redeemStatus === 'invalid' && (
                      <p className="text-[11px] mt-2 text-destructive">Invalid code. Try again.</p>
                    )}
                    {redeemStatus === 'cloud_error' && (
                      <p className="text-[11px] mt-2" style={{ color: '#f59e0b' }}>
                        ✓ Pro unlocked for this session, but we couldn't save it to your account. Check the browser console and verify the <code>profiles</code> table exists in Supabase.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Edit form ─────────────────────────────────────── */}
                <div className="rounded-xl p-5" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Edit Profile</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Display Name</label>
                      <input value={profileDraft.displayName} onChange={e => setProfileDraft(d => ({ ...d, displayName: e.target.value }))}
                        placeholder="Your name"
                        className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                        style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Avatar Color</label>
                      <div className="flex gap-2 flex-wrap pt-1">
                        {AVATAR_COLORS.map(({ name, hex }) => (
                          <button key={hex} onClick={() => setProfileDraft(d => ({ ...d, avatarColor: hex }))}
                            title={name}
                            className="w-7 h-7 rounded-full transition-all hover:scale-110 relative"
                            style={{
                              background: hex,
                              outline: profileDraft.avatarColor === hex ? `2px solid ${hex}` : '2px solid transparent',
                              outlineOffset: '2px',
                              boxShadow: profileDraft.avatarColor === hex ? `0 0 8px ${hex}80` : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Bio</label>
                    <textarea value={profileDraft.bio} onChange={e => setProfileDraft(d => ({ ...d, bio: e.target.value }))}
                      rows={2} placeholder="A bit about you…"
                      className="w-full resize-none rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                      style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={saveProfileChanges} className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{ background: 'hsl(var(--primary))' }}>
                      Save Profile
                    </button>
                    <button onClick={() => { setTutorialStep(0); setShowTutorial(true); localStorage.removeItem('sr-tutorial-seen'); }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Show welcome guide
                    </button>
                  </div>
                </div>

                {/*
                  Account section. Users previously had no way to sign out
                  without clearing browser storage manually — signOut was
                  defined on the auth context but never surfaced in any UI.
                */}
                <div className="rounded-xl p-5 space-y-3" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Account</p>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground font-medium truncate">{user?.email ?? 'Signed in'}</p>
                      <p className="text-[11px] text-muted-foreground">Signed in via Supabase</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
                      style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'hsl(var(--destructive) / 0.1)'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--destructive))'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--destructive) / 0.4)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; }}
                    >
                      <LogOutIcon size={13} />
                      Sign out
                    </button>
                  </div>
                </div>

              </div>

              {/* ── RIGHT: writing squad ────────────────────────── */}
              <div className="w-64 flex-shrink-0 space-y-4">

                {/* Add friend */}
                <div className="rounded-xl p-4" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Writing Squad</p>
                  <div className="space-y-2 mb-3">
                    <input
                      value={friendDraft.name}
                      onChange={e => setFriendDraft(d => ({ ...d, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFriend()}
                      placeholder="Name or handle"
                      className="w-full rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                      style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                    />
                    <input
                      value={friendDraft.note}
                      onChange={e => setFriendDraft(d => ({ ...d, note: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFriend()}
                      placeholder="Note (e.g. co-writer)"
                      className="w-full rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-all"
                      style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                      onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                      onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {AVATAR_COLORS.map(({ name, hex }) => (
                        <button key={hex} onClick={() => setFriendDraft(d => ({ ...d, color: hex }))}
                          title={name}
                          className="w-5 h-5 rounded-full transition-all hover:scale-110"
                          style={{
                            background: hex,
                            outline: friendDraft.color === hex ? `2px solid ${hex}` : '2px solid transparent',
                            outlineOffset: '2px',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <button onClick={addFriend}
                    className="w-full rounded-lg py-2 text-xs font-semibold text-white transition-all hover:opacity-90"
                    style={{ background: 'hsl(var(--primary))' }}>
                    + Add to Squad
                  </button>
                </div>

                {/* Friends list */}
                {friends.length === 0 ? (
                  <div className="rounded-xl p-5 text-center" style={{ background: 'hsl(var(--card))', border: '1px dashed hsl(var(--border))' }}>
                    <div className="text-3xl mb-2">👥</div>
                    <p className="text-xs font-medium text-foreground/70">No writing buddies yet</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">Add the people you write with or want to collaborate with.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {friends.map(f => {
                      const fi = f.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                      return (
                        <div key={f.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 group"
                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: f.color }}>
                            {fi}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                            {f.note && <p className="text-[10px] text-muted-foreground truncate">{f.note}</p>}
                          </div>
                          <button onClick={() => removeFriend(f.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-[10px]">
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tip of the day */}
                {(() => {
                  const TIPS = [
                    "Write the scene you're afraid to write.",
                    "Every character wants something, even if it's just a glass of water.",
                    "A screenplay is not literature — it's a blueprint.",
                    "The best dialogue sounds natural but is completely artificial.",
                    "Act 1 ends when life changes. Act 2 ends when the character changes.",
                    "Show the decision, not the deliberation.",
                    "Cut the first page. Your story probably starts on page two.",
                  ];
                  const tip = TIPS[new Date().getDate() % TIPS.length];
                  return (
                    <div className="rounded-xl p-4" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tip of the Day</p>
                      <p className="text-xs text-foreground/80 leading-relaxed italic">"{tip}"</p>
                    </div>
                  );
                })()}

              </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── CREATE MODAL ── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setIsCreateOpen(false)}>
          <div className="w-full max-w-md p-6 shadow-2xl relative overflow-hidden"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="absolute top-0 inset-x-0 h-[2px]"
              style={{ background: 'hsl(var(--primary))' }} />

            <h2 className="mb-4" style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 20, color: 'hsl(var(--foreground))' }}>New Project</h2>

            {/* Type picker */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {([
                { type: 'film' as const, Icon: FilmIcon, label: 'Film / Short', desc: 'Feature or short screenplay' },
                { type: 'tv' as const, Icon: TvIcon, label: 'TV Show', desc: 'Series folder with episodes' },
              ]).map(opt => (
                <button key={opt.type} onClick={() => setCreateType(opt.type)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all"
                  style={{
                    border: `2px solid ${createType === opt.type ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
                    background: createType === opt.type ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--secondary))',
                  }}>
                  <opt.Icon size={20} style={{ color: createType === opt.type ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                  <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  {createType === 'tv' ? 'Show Title *' : 'Title *'}
                </label>
                <input autoFocus value={draftTitle} onChange={e => setDraftTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (createType === 'tv' ? handleCreateTvShow() : handleCreate())}
                  placeholder={createType === 'tv' ? 'My TV Series' : 'Untitled Script'}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Genre</label>
                <select value={draftGenre} onChange={e => setDraftGenre(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground outline-none transition-all"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: draftGenre ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                  <option value="">Select genre…</option>
                  {GENRES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              {createType === 'tv' && (
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Network / Platform</label>
                  <input value={draftNetwork} onChange={e => setDraftNetwork(e.target.value)}
                    placeholder="e.g. HBO, Netflix, FX…"
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Logline</label>
                <textarea value={draftLogline} onChange={e => setDraftLogline(e.target.value)}
                  rows={2} placeholder="A one-sentence hook for your story."
                  className="w-full resize-none rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                  style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setIsCreateOpen(false); setCreateType('film'); }} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors" style={{ border: '1px solid hsl(var(--border))', background: 'transparent', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>Cancel</button>
              <button
                onClick={createType === 'tv' ? handleCreateTvShow : handleCreate}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold transition-all hover:opacity-90"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {createType === 'tv' ? <><TvIcon size={14} className="inline mr-1" />Create Show →</> : 'Create & Open →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TV SHOW MODAL ── */}
      {activeShow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setActiveShow(null)}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl relative overflow-hidden flex flex-col"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', maxHeight: '85vh' }}>
            {/* Color strip */}
            <div className="h-1 flex-shrink-0" style={{ background: activeShow.color }} />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: activeShow.color }}>
                    <TvIcon size={18} color="#fff" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">{activeShow.title}</h2>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {activeShow.genre && <span className="text-[10px] text-muted-foreground">{activeShow.genre}</span>}
                      {activeShow.network && <><span className="text-muted-foreground/40 text-[10px]">·</span><span className="text-[10px] text-muted-foreground">{activeShow.network}</span></>}
                      <span className="text-muted-foreground/40 text-[10px]">·</span>
                      <span className="text-[10px] text-muted-foreground">
                        {allProjects.filter(p => p.showId === activeShow.id && !p.trashedAt).length} episodes
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (confirm(`Delete "${activeShow.title}" and all its episodes?`)) handleDeleteTvShow(activeShow.id); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1">
                    Delete Show
                  </button>
                  <button onClick={() => setActiveShow(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm">
                    ✕
                  </button>
                </div>
              </div>
            </div>

            {/* Season tabs + episodes */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const episodes = allProjects.filter(p => p.showId === activeShow.id && !p.trashedAt)
                  .sort((a, b) => (a.season ?? 1) - (b.season ?? 1) || (a.episode ?? 1) - (b.episode ?? 1));
                const seasons = Array.from(new Set(episodes.map(e => e.season ?? 1))).sort((a, b) => a - b);
                if (seasons.length === 0) seasons.push(1);

                return (
                  <div className="space-y-5">
                    {seasons.map(sn => {
                      const eps = episodes.filter(e => (e.season ?? 1) === sn);
                      return (
                        <div key={sn}>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Season {sn}</p>
                          <div className="space-y-1.5">
                            {eps.map(ep => (
                              <div key={ep.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-all"
                                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: activeShow.color + '33', color: activeShow.color }}>
                                  E{String(ep.episode ?? 1).padStart(2, '0')}
                                </span>
                                <span className="flex-1 text-sm text-foreground font-medium truncate">{ep.title}</span>
                                <span className="text-[10px] text-muted-foreground">{formatDate(ep.updatedAt)}</span>
                                <button onClick={() => { setActiveShow(null); navigate(`/projects/${ep.id}`); }}
                                  className="opacity-0 group-hover:opacity-100 text-xs font-medium transition-all px-3 py-1 rounded-lg"
                                  style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                                  Open
                                </button>
                                <button onClick={() => { if (confirm('Delete this episode?')) { deleteProject(ep.id); refresh(); } }}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all text-[10px] ml-1">
                                  ✕
                                </button>
                              </div>
                            ))}
                            {eps.length === 0 && (
                              <p className="text-xs text-muted-foreground px-1">No episodes yet in Season {sn}.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Add episode form */}
            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--background))' }}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Add Episode</p>
              <div className="flex gap-2 items-end">
                <div className="w-20">
                  <label className="text-[10px] text-muted-foreground block mb-1">Season</label>
                  <input type="number" min={1} value={addEpDraft.season}
                    onChange={e => setAddEpDraft(d => ({ ...d, season: Math.max(1, Number(e.target.value)) }))}
                    className="w-full rounded-lg px-2 py-2 text-sm text-foreground outline-none text-center"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>
                <div className="w-20">
                  <label className="text-[10px] text-muted-foreground block mb-1">Episode</label>
                  <input type="number" min={1} value={addEpDraft.episode}
                    onChange={e => setAddEpDraft(d => ({ ...d, episode: Math.max(1, Number(e.target.value)) }))}
                    className="w-full rounded-lg px-2 py-2 text-sm text-foreground outline-none text-center"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-muted-foreground block mb-1">Episode Title</label>
                  <input value={addEpDraft.title}
                    onChange={e => setAddEpDraft(d => ({ ...d, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddEpisode(activeShow)}
                    placeholder={`Episode ${addEpDraft.episode}`}
                    className="w-full rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>
                <button onClick={() => handleAddEpisode(activeShow)}
                  className="px-4 py-2 text-sm font-bold text-white rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'hsl(var(--primary))' }}>
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TUTORIAL ── */}
      {showTutorial && (() => {
        const dismiss = () => { setShowTutorial(false); setTutorialStep(0); localStorage.setItem('sr-tutorial-seen', '1'); };
        const STEPS = [
          {
            emoji: '👋',
            title: 'Welcome to DraftRoom',
            subtitle: 'Your AI-powered screenwriting studio',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Whether you've never written a script before or you're a seasoned pro,
                  DraftRoom has everything you need to write, develop, and produce your story.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: '✍️', label: 'Write your screenplay', desc: 'Auto-formatting, smart shortcuts' },
                    { icon: '✨', label: 'AI Script Doctor', desc: 'Feedback, rewrites, analysis' },
                    { icon: '🎯', label: 'Beat Sheet', desc: 'Structure and story arcs' },
                    { icon: '📖', label: 'Script Writing Guide', desc: 'Learn formatting from scratch' },
                  ].map(f => (
                    <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                      <span className="text-xl">{f.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">New to screenwriting? Check our <strong className="text-primary">Script Writing Guide</strong> — it teaches formatting, structure, and professional techniques step by step.</p>
              </div>
            ),
          },
          {
            emoji: '📝',
            title: 'How Scripts Are Formatted',
            subtitle: 'The basics every writer needs to know',
            content: (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed">Scripts use 6 element types. DraftRoom formats each one automatically — just pick the type and write.</p>
                <div className="space-y-2">
                  {[
                    { key: '⌘1', name: 'Scene Heading', ex: 'INT. COFFEE SHOP - DAY', color: '#7c3aed', desc: 'Where and when we are' },
                    { key: '⌘2', name: 'Action', ex: 'Maya stares at a blank page.', color: '#3b82f6', desc: 'What we see on screen' },
                    { key: '⌘3', name: 'Character', ex: 'MAYA', color: '#10b981', desc: 'Who is speaking' },
                    { key: '⌘4', name: 'Dialogue', ex: '"Today I write the script."', color: '#f59e0b', desc: 'What they say' },
                    { key: '⌘5', name: 'Parenthetical', ex: '(to herself)', color: '#ec4899', desc: 'Brief direction' },
                    { key: '⌘6', name: 'Transition', ex: 'CUT TO:', color: '#6b7280', desc: 'How scenes connect' },
                  ].map(el => (
                    <div key={el.name} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
                      <kbd className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${el.color}20`, color: el.color, border: `1px solid ${el.color}40` }}>{el.key}</kbd>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-foreground">{el.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{el.desc}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/60 truncate">{el.ex}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">Press <strong>Tab</strong> to cycle types · <strong>Enter</strong> for new line · The app handles all indentation and caps automatically.</p>
              </div>
            ),
          },
          {
            emoji: '🤖',
            title: 'Your AI Writing Partner',
            subtitle: 'Always open, always reading your script',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The AI panel lives on the right side of the script editor. It has read your entire script and is ready to help with anything.
                </p>
                <div className="space-y-2">
                  {[
                    { cat: '📝 Script', prompts: ['Fix pacing issues', 'Improve dialogue', 'Add opening title card'] },
                    { cat: '🎯 Beat Sheet', prompts: ['Generate full beat sheet', 'Blake Snyder beats'] },
                    { cat: '💰 Budget', prompts: ['Estimate budget', 'Identify expensive elements'] },
                    { cat: '📂 Export', prompts: ['Exec Overview PDF', 'Pitch Deck (PowerPoint)'] },
                  ].map(c => (
                    <div key={c.cat} className="p-3 rounded-xl" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}>
                      <p className="text-[10px] font-bold text-muted-foreground mb-1.5">{c.cat}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {c.prompts.map(p => (
                          <span key={p} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>{p}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">When AI updates your Beat Sheet, Cast, or Budget — it happens <strong className="text-foreground">automatically</strong> without any Apply button. Script edits still need manual approval.</p>
              </div>
            ),
          },
          {
            emoji: '🚀',
            title: "You're ready to write",
            subtitle: 'One last thing before you go',
            content: (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">Here's the fastest way to get started:</p>
                <div className="space-y-2">
                  {[
                    { n: '1', title: 'Create a new script', body: 'Click the + New Script card on the Projects page. Give it a title and genre.' },
                    { n: '2', title: 'Write your first scene', body: 'Press ⌘1 to add a scene heading like "INT. MY ROOM - DAY", then ⌘2 for action.' },
                    { n: '3', title: 'Use the AI when stuck', body: 'Open the AI panel with the ✨ button in the top bar. Ask anything.' },
                    { n: '4', title: 'Learn as you go', body: 'Visit Help Center → Script Writing Guide for formatting lessons and pro tips.' },
                  ].map(s => (
                    <div key={s.n} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'hsl(var(--primary))' }}>{s.n}</div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">{s.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ),
          },
        ];

        const step = STEPS[tutorialStep];
        const isLast = tutorialStep === STEPS.length - 1;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
            <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              {/* Progress dots */}
              <div className="flex items-center justify-between px-6 pt-5 pb-0">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <button key={i} onClick={() => setTutorialStep(i)}
                      className="rounded-full transition-all"
                      style={{ width: i === tutorialStep ? 20 : 6, height: 6, background: i === tutorialStep ? 'hsl(var(--primary))' : 'hsl(var(--border))' }} />
                  ))}
                </div>
                <button onClick={dismiss} className="text-muted-foreground hover:text-foreground text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors">×</button>
              </div>

              {/* Step content */}
              <div className="px-6 py-5">
                <div className="text-4xl mb-3">{step.emoji}</div>
                <h2 className="text-xl font-bold text-foreground mb-1">{step.title}</h2>
                <p className="text-xs text-muted-foreground mb-5">{step.subtitle}</p>
                {step.content}
              </div>

              {/* Footer nav */}
              <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                <button
                  onClick={() => tutorialStep > 0 ? setTutorialStep(s => s - 1) : dismiss()}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary">
                  {tutorialStep > 0 ? '← Back' : 'Skip'}
                </button>
                <div className="flex items-center gap-2">
                  {isLast && (
                    <button onClick={() => { dismiss(); setDashView('help'); }}
                      className="text-xs text-primary hover:text-primary/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary/10">
                      Open Writing Guide
                    </button>
                  )}
                  <button
                    onClick={() => isLast ? dismiss() : setTutorialStep(s => s + 1)}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                    style={{ background: 'hsl(var(--primary))' }}>
                    {isLast ? 'Start Writing →' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── ACHIEVEMENT TOAST ── */}
      {toastQueue.length > 0 && (
        <AchievementToast
          achievement={toastQueue[0]}
          onDone={() => setToastQueue(q => q.slice(1))}
        />
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'hsl(var(--destructive) / 0.12)', border: '1px solid hsl(var(--destructive) / 0.2)' }}>
              <Trash2Icon size={16} style={{ color: 'hsl(var(--destructive))' }} />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-2">Move to Trash?</h3>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">The project will be moved to trash and auto-deleted after 30 days.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-xl">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-xs font-medium text-white rounded-xl bg-destructive hover:opacity-90 transition-opacity">Move to Trash</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
