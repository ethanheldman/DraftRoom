import type { Project, ScriptNode, TvShow } from '../types/screenplay';
import { getCurrentUserId } from '../lib/supabase';
import { syncProjectToCloud, syncScriptToCloud, deleteProjectFromCloud, syncTvShowToCloud, deleteTvShowFromCloud } from './cloud-storage';

export const PROJECTS_KEY = 'sr-projects';
export const SCRIPT_PREFIX = 'sr-script-';

const COLOR_PALETTE = [
  '#4ecdc4',
  '#7c3aed',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#f97316',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
];

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const projects: Project[] = JSON.parse(raw);
    return projects.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]): void {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function getProject(id: string): Project | null {
  const projects = loadProjects();
  return projects.find((p) => p.id === id) ?? null;
}

export function upsertProject(project: Project): void {
  const projects = loadProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.push(project);
  }
  saveProjects(projects);
  // Background cloud sync
  const uid = getCurrentUserId();
  if (uid) syncProjectToCloud(project, uid).catch(() => {});
}

export function deleteProject(id: string): void {
  const projects = loadProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  localStorage.removeItem(SCRIPT_PREFIX + id);
  // Background cloud sync
  deleteProjectFromCloud(id).catch(() => {});
}

export function loadScript(projectId: string): ScriptNode[] {
  try {
    const raw = localStorage.getItem(SCRIPT_PREFIX + projectId);
    if (!raw) return defaultScript();
    return JSON.parse(raw);
  } catch {
    return defaultScript();
  }
}

export function saveScript(projectId: string, nodes: ScriptNode[]): void {
  localStorage.setItem(SCRIPT_PREFIX + projectId, JSON.stringify(nodes));
  // Bump updatedAt on the project
  const project = getProject(projectId);
  if (project) {
    project.updatedAt = new Date().toISOString();
    upsertProject(project);
  }
  // Background cloud sync
  const uid = getCurrentUserId();
  if (uid) syncScriptToCloud(projectId, nodes, uid).catch(() => {});
}

export function defaultScript(): ScriptNode[] {
  return [
    { type: 'transition', content: 'FADE IN:' },
    { type: 'scene_heading', content: 'INT. LOCATION - DAY' },
    { type: 'action', content: '' },
  ];
}

export function createNewProject(
  title: string,
  genre?: string,
  logline?: string
): Project {
  const color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    type: 'film-tv',
    color,
    createdAt: now,
    updatedAt: now,
    scriptContent: defaultScript(),
    beatSheet: [],
    castAndCrew: [],
    aiCache: {},
    settings: {
      pageGoal: 120,
      tagline: '',
      writingTime: 0,
      thinkingTime: 0,
      dailyWordGoal: 500,
    },
    logline,
    genre,
    breakdownItems: [],
    shotList: [],
    budget: [],
    mediaItems: [],
  };
}

// Version history
const HISTORY_PREFIX = 'sr-history-';
const MAX_HISTORY = 10;

export function saveVersionSnapshot(projectId: string, nodes: ScriptNode[]): void {
  try {
    const key = HISTORY_PREFIX + projectId;
    const raw = localStorage.getItem(key);
    const history: { ts: string; nodes: ScriptNode[] }[] = raw ? JSON.parse(raw) : [];
    history.unshift({ ts: new Date().toISOString(), nodes });
    if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
    localStorage.setItem(key, JSON.stringify(history));
  } catch { /* quota */ }
}

export function loadVersionHistory(projectId: string): { ts: string; nodes: ScriptNode[] }[] {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + projectId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Lightweight — only reads timestamps, not the full node arrays. */
export function loadVersionTimestamps(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + projectId);
    if (!raw) return [];
    const history = JSON.parse(raw) as { ts: string }[];
    return history.map(h => h.ts);
  } catch { return []; }
}

export function getCharacterNames(nodes: ScriptNode[]): string[] {
  const names = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'character' && node.content.trim()) {
      // Strip parentheticals like (V.O.) (O.S.)
      const name = node.content.replace(/\(.*?\)/g, '').trim().toUpperCase();
      if (name) names.add(name);
    }
  }
  return Array.from(names);
}

export function getSceneHeadings(nodes: ScriptNode[]): string[] {
  return nodes
    .filter((n) => n.type === 'scene_heading' && n.content.trim())
    .map((n) => n.content.trim());
}

// Pagination constants MUST match ScriptEditor.tsx exactly — otherwise the Stats
// "Pages" count diverges from the page numbers rendered in the editor itself.
// Page dimensions: 1056px tall (11"), 96px top+bottom padding (1" each) = 864px content area.
// Font: 12pt = 16px at 96dpi, lineHeight 1.0 = 16px per line → ~54 lines/page, matching the
// industry "~55 lines per page" standard and the "1 page ≈ 1 minute" convention.
const PAGE_CONTENT_PX = 864;
const LINE_H = 16;   // 12pt × 1.0 line-height
const EM     = 16;   // 1em = font-size

function linesForNode(type: string, content: string): number {
  const textLines = Math.ceil((content.length || 1) / 60);
  const textH     = textLines * LINE_H;
  switch (type) {
    case 'scene_heading': return EM       + textH;   // marginTop: 1em
    case 'action':        return EM       + textH;   // 0.5em top + 0.5em bottom
    case 'character':     return EM       + LINE_H;  // marginTop: 1em + 1 line
    case 'dialogue':      return textH;              // no block margins
    case 'parenthetical': return LINE_H;             // no block margins
    case 'transition':    return 2 * EM   + LINE_H;  // 1em top + 1em bottom
    case 'act':           return 2.5 * EM + LINE_H;  // 1.5em top + 1em bottom
    default:              return EM       + textH;
  }
}

export function estimatePageCount(nodes: ScriptNode[]): number {
  // Mirrors the boundary-crossing loop in ScriptEditor.tsx so counts match exactly.
  let cumLines = 0;
  let nextBreakAt = PAGE_CONTENT_PX;
  let currentPage = 0;
  for (let i = 0; i < nodes.length; i++) {
    const nl = linesForNode(nodes[i].type, nodes[i].content);
    if (i > 0 && cumLines < nextBreakAt && cumLines + nl >= nextBreakAt) {
      currentPage++;
      nextBreakAt = (currentPage + 1) * PAGE_CONTENT_PX;
    }
    cumLines += nl;
  }
  return Math.max(1, currentPage + 1);
}

export function countWords(nodes: ScriptNode[]): number {
  return nodes.reduce((total, node) => {
    const words = node.content.trim().split(/\s+/).filter(Boolean).length;
    return total + words;
  }, 0);
}

export function scriptToPlainText(nodes: ScriptNode[]): string {
  return nodes.map((n) => n.content).join('\n\n');
}

export const TV_SHOWS_KEY = 'sr-tv-shows';

export function loadTvShows(): TvShow[] {
  try {
    const raw = localStorage.getItem(TV_SHOWS_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as TvShow[]).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch { return []; }
}

export function upsertTvShow(show: TvShow): void {
  const shows = loadTvShows();
  const idx = shows.findIndex(s => s.id === show.id);
  if (idx >= 0) shows[idx] = show; else shows.push(show);
  localStorage.setItem(TV_SHOWS_KEY, JSON.stringify(shows));
  // Background cloud sync
  const uid = getCurrentUserId();
  if (uid) syncTvShowToCloud(show, uid).catch(() => {});
}

export function deleteTvShow(id: string): void {
  const shows = loadTvShows().filter(s => s.id !== id);
  localStorage.setItem(TV_SHOWS_KEY, JSON.stringify(shows));
  // Background cloud sync
  deleteTvShowFromCloud(id).catch(() => {});
}

export function createNewTvShow(title: string, genre?: string, logline?: string, network?: string): TvShow {
  const color = COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title, genre, logline, network, color, seasons: 1, createdAt: now, updatedAt: now };
}
