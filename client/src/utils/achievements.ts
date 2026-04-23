import type { Project } from '../types/screenplay';
import { loadScript, loadVersionTimestamps, estimatePageCount, getCharacterNames, getSceneHeadings } from './storage';

export interface AchievementDef {
  id: string;
  icon: string;
  label: string;
  desc: string;
  category: 'volume' | 'pages' | 'time' | 'craft' | 'diversity' | 'revision' | 'community' | 'special';
  check: (ctx: AchievementContext) => boolean;
}

export interface AchievementContext {
  projects: Project[];        // all non-trashed
  totalWords: number;
  totalWritingTime: number;   // seconds
  friendCount: number;
  tvShowCount: number;
  estPages: number;           // across all scripts
  currentHour: number;        // 0–23, for Night Owl / Early Bird
}

const ACHIEVEMENTS_KEY = 'sr-achievements';

export function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

export function saveUnlocked(ids: Set<string>): void {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...ids]));
}

export function markUnlocked(id: string): void {
  const set = loadUnlocked();
  set.add(id);
  saveUnlocked(set);
}

// ── Helpers used in check fns ────────────────────────────────────────────────

function scriptNodes(p: Project) {
  try { return loadScript(p.id); } catch { return []; }
}

function dialoguePct(p: Project): number {
  const nodes = scriptNodes(p);
  if (!nodes.length) return 0;
  const dial = nodes.filter(n => n.type === 'dialogue').length;
  return dial / nodes.length;
}

function uniqueLocations(p: Project): number {
  return new Set(getSceneHeadings(scriptNodes(p))).size;
}

function speakingRoles(p: Project): number {
  return getCharacterNames(scriptNodes(p)).length;
}

function maxVersionsAnyScript(projects: Project[]): number {
  let max = 0;
  for (const p of projects) {
    const ts = loadVersionTimestamps(p.id);
    if (ts.length > max) max = ts.length;
  }
  return max;
}

// ── All achievement definitions ───────────────────────────────────────────────

export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  // ── Volume: scripts ─────────────────────────────────────────────────────────
  {
    id: 'first_draft',
    icon: '✍️',
    label: 'First Draft',
    desc: 'Created your first script',
    category: 'volume',
    check: ctx => ctx.projects.length >= 1,
  },
  {
    id: 'anthology',
    icon: '📚',
    label: 'Anthology',
    desc: 'Have 5 scripts in your library',
    category: 'volume',
    check: ctx => ctx.projects.length >= 5,
  },
  {
    id: 'film_school',
    icon: '🏛️',
    label: 'Film School',
    desc: 'Have 10 scripts in your library',
    category: 'volume',
    check: ctx => ctx.projects.length >= 10,
  },
  {
    id: 'studio_lot',
    icon: '🎭',
    label: 'Studio Lot',
    desc: 'Have 25 scripts in your library',
    category: 'volume',
    check: ctx => ctx.projects.length >= 25,
  },
  {
    id: 'auteur',
    icon: '👑',
    label: 'Auteur',
    desc: 'Have 50 scripts in your library',
    category: 'volume',
    check: ctx => ctx.projects.length >= 50,
  },
  // ── Volume: words ────────────────────────────────────────────────────────────
  {
    id: 'words_1k',
    icon: '💬',
    label: '1K Words',
    desc: '1,000 words written across all scripts',
    category: 'volume',
    check: ctx => ctx.totalWords >= 1000,
  },
  {
    id: 'words_10k',
    icon: '📖',
    label: '10K Words',
    desc: '10,000 words written across all scripts',
    category: 'volume',
    check: ctx => ctx.totalWords >= 10000,
  },
  {
    id: 'words_50k',
    icon: '🔥',
    label: '50K Words',
    desc: '50,000 words — you\'re on fire',
    category: 'volume',
    check: ctx => ctx.totalWords >= 50000,
  },
  {
    id: 'words_100k',
    icon: '💎',
    label: '100K Words',
    desc: '100,000 words written',
    category: 'volume',
    check: ctx => ctx.totalWords >= 100000,
  },
  {
    id: 'words_250k',
    icon: '🌊',
    label: 'Quarter Million',
    desc: '250,000 words — a true wordsmith',
    category: 'volume',
    check: ctx => ctx.totalWords >= 250000,
  },
  // ── Pages ───────────────────────────────────────────────────────────────────
  {
    id: 'short_film',
    icon: '🎬',
    label: 'Short Film',
    desc: 'Reached 15 pages in a single script',
    category: 'pages',
    check: ctx => ctx.projects.some(p => {
      try { return estimatePageCount(loadScript(p.id)) >= 15; } catch { return false; }
    }),
  },
  {
    id: 'half_hour',
    icon: '📺',
    label: 'Half Hour',
    desc: 'A 30-page script — TV pilot territory',
    category: 'pages',
    check: ctx => ctx.projects.some(p => {
      try { return estimatePageCount(loadScript(p.id)) >= 30; } catch { return false; }
    }),
  },
  {
    id: 'feature_length',
    icon: '🏆',
    label: 'Feature Length',
    desc: 'Reached 90 pages — a full feature',
    category: 'pages',
    check: ctx => ctx.estPages >= 90,
  },
  {
    id: 'epic',
    icon: '🎪',
    label: 'Epic',
    desc: 'A 120-page script — the full story',
    category: 'pages',
    check: ctx => ctx.estPages >= 120,
  },
  // ── Time ────────────────────────────────────────────────────────────────────
  {
    id: 'clock_puncher',
    icon: '⏱️',
    label: 'Clock Puncher',
    desc: 'Logged 5 hours of writing time',
    category: 'time',
    check: ctx => ctx.totalWritingTime >= 5 * 3600,
  },
  {
    id: 'dedicated',
    icon: '📅',
    label: 'Dedicated',
    desc: 'Logged 20 hours of writing time',
    category: 'time',
    check: ctx => ctx.totalWritingTime >= 20 * 3600,
  },
  {
    id: 'professional',
    icon: '🎯',
    label: 'Professional',
    desc: 'Logged 50 hours of writing time',
    category: 'time',
    check: ctx => ctx.totalWritingTime >= 50 * 3600,
  },
  {
    id: 'night_owl',
    icon: '🌙',
    label: 'Night Owl',
    desc: 'Writing session after midnight',
    category: 'time',
    // Unlocked opportunistically when the app is open past midnight
    // Stored permanently once triggered
    check: ctx => ctx.currentHour >= 0 && ctx.currentHour < 4,
  },
  {
    id: 'early_bird',
    icon: '🌅',
    label: 'Early Bird',
    desc: 'Writing session before 6 AM',
    category: 'time',
    check: ctx => ctx.currentHour >= 4 && ctx.currentHour < 6,
  },
  // ── Craft ───────────────────────────────────────────────────────────────────
  {
    id: 'dialogue_heavy',
    icon: '💭',
    label: 'Dialogue Heavy',
    desc: 'A script where 70%+ of elements are dialogue',
    category: 'craft',
    check: ctx => ctx.projects.some(p => dialoguePct(p) >= 0.70),
  },
  {
    id: 'world_builder',
    icon: '🗺️',
    label: 'World Builder',
    desc: '10+ unique locations in one script',
    category: 'craft',
    check: ctx => ctx.projects.some(p => uniqueLocations(p) >= 10),
  },
  {
    id: 'ensemble_cast',
    icon: '👥',
    label: 'Ensemble Cast',
    desc: '15+ speaking roles in one script',
    category: 'craft',
    check: ctx => ctx.projects.some(p => speakingRoles(p) >= 15),
  },
  {
    id: 'scene_setter',
    icon: '🎭',
    label: 'Scene Setter',
    desc: '50+ scenes in one script',
    category: 'craft',
    check: ctx => ctx.projects.some(p => getSceneHeadings(scriptNodes(p)).length >= 50),
  },
  {
    id: 'economy',
    icon: '✂️',
    label: 'Economy of Words',
    desc: 'A script with more action than dialogue',
    category: 'craft',
    check: ctx => ctx.projects.some(p => {
      const nodes = scriptNodes(p);
      if (!nodes.length) return false;
      const action = nodes.filter(n => n.type === 'action').length;
      const dialogue = nodes.filter(n => n.type === 'dialogue').length;
      return action > dialogue && action > 5;
    }),
  },
  {
    id: 'location_scout',
    icon: '📍',
    label: 'Location Scout',
    desc: '5+ exterior locations in one script',
    category: 'craft',
    check: ctx => ctx.projects.some(p => {
      const headings = getSceneHeadings(scriptNodes(p));
      return new Set(headings.filter(h => h.startsWith('EXT.'))).size >= 5;
    }),
  },
  // ── Diversity ───────────────────────────────────────────────────────────────
  {
    id: 'genre_hopper',
    icon: '🎨',
    label: 'Genre Hopper',
    desc: 'Scripts in 3+ different genres',
    category: 'diversity',
    check: ctx => {
      const genres = new Set(ctx.projects.filter(p => p.genre).map(p => p.genre!));
      return genres.size >= 3;
    },
  },
  {
    id: 'genre_master',
    icon: '🎪',
    label: 'Genre Master',
    desc: '5+ scripts in the same genre',
    category: 'diversity',
    check: ctx => {
      const counts: Record<string, number> = {};
      ctx.projects.filter(p => p.genre).forEach(p => {
        counts[p.genre!] = (counts[p.genre!] ?? 0) + 1;
      });
      return Object.values(counts).some(v => v >= 5);
    },
  },
  {
    id: 'tv_pioneer',
    icon: '📺',
    label: 'TV Pioneer',
    desc: 'Created your first TV show',
    category: 'diversity',
    check: ctx => ctx.tvShowCount >= 1,
  },
  {
    id: 'showrunner',
    icon: '🎬',
    label: 'Showrunner',
    desc: '3+ TV shows in your library',
    category: 'diversity',
    check: ctx => ctx.tvShowCount >= 3,
  },
  // ── Revision ────────────────────────────────────────────────────────────────
  {
    id: 'revision_king',
    icon: '🔄',
    label: 'Revision King',
    desc: '5+ saved versions of a single script',
    category: 'revision',
    check: ctx => maxVersionsAnyScript(ctx.projects) >= 5,
  },
  {
    id: 'perfectionist',
    icon: '📝',
    label: 'Perfectionist',
    desc: '10+ saved versions of a single script',
    category: 'revision',
    check: ctx => maxVersionsAnyScript(ctx.projects) >= 10,
  },
  {
    id: 'obsessive',
    icon: '🔬',
    label: 'Obsessive',
    desc: '20+ saved versions — no page left unturned',
    category: 'revision',
    check: ctx => maxVersionsAnyScript(ctx.projects) >= 20,
  },
  // ── Community ───────────────────────────────────────────────────────────────
  {
    id: 'first_friend',
    icon: '👫',
    label: 'First Friend',
    desc: 'Added someone to your Writing Squad',
    category: 'community',
    check: ctx => ctx.friendCount >= 1,
  },
  {
    id: 'squad_goals',
    icon: '🫂',
    label: 'Squad Goals',
    desc: '5 writers in your Writing Squad',
    category: 'community',
    check: ctx => ctx.friendCount >= 5,
  },
  // ── Special ─────────────────────────────────────────────────────────────────
  {
    id: 'marathon',
    icon: '🏃',
    label: 'Marathon',
    desc: 'A single session lasting 4+ hours',
    category: 'special',
    // This one is set externally by the editor when writingTime on a session exceeds 4h
    // For now check if any project has >= 4h total (approximate)
    check: ctx => ctx.projects.some(p => (p.settings?.writingTime ?? 0) >= 4 * 3600),
  },
  {
    id: 'century_pages',
    icon: '💯',
    label: 'Century',
    desc: 'Wrote 100+ pages across all your scripts',
    category: 'special',
    check: ctx => ctx.estPages >= 100,
  },
  {
    id: 'prolific',
    icon: '⚡',
    label: 'Prolific',
    desc: 'Have scripts in 5+ different genres AND 10+ scripts total',
    category: 'special',
    check: ctx => {
      const genres = new Set(ctx.projects.filter(p => p.genre).map(p => p.genre!));
      return genres.size >= 5 && ctx.projects.length >= 10;
    },
  },
  {
    id: 'completionist',
    icon: '🌟',
    label: 'Completionist',
    desc: 'Unlock 20 other achievements',
    category: 'special',
    // Checked after others are evaluated — set externally
    check: () => false, // handled specially in checkNewUnlocks
  },
];

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate all achievements against the current context.
 * Returns the IDs of achievements newly unlocked this call (not previously stored).
 */
export function checkNewUnlocks(ctx: AchievementContext): string[] {
  const already = loadUnlocked();
  const newlyUnlocked: string[] = [];

  for (const def of ALL_ACHIEVEMENTS) {
    if (def.id === 'completionist') continue; // handled after
    if (already.has(def.id)) continue;
    try {
      if (def.check(ctx)) newlyUnlocked.push(def.id);
    } catch { /* ignore check errors */ }
  }

  // Completionist: unlock if total (already + newly) >= 20
  const totalAfter = already.size + newlyUnlocked.length;
  if (!already.has('completionist') && totalAfter >= 20) {
    newlyUnlocked.push('completionist');
  }

  // Persist all newly unlocked
  for (const id of newlyUnlocked) already.add(id);
  if (newlyUnlocked.length > 0) saveUnlocked(already);

  return newlyUnlocked;
}

export function getAchievementById(id: string): AchievementDef | undefined {
  return ALL_ACHIEVEMENTS.find(a => a.id === id);
}
