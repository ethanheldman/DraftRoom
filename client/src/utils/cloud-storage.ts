/**
 * Cloud storage layer — Supabase-backed CRUD.
 *
 * Strategy: localStorage is the write-through cache. Every write to localStorage
 * also fires a background sync here. On app load after auth, we pull from Supabase
 * and populate localStorage so data is available on any device.
 */

import { supabase } from '../lib/supabase';
import type { Project, ScriptNode, TvShow } from '../types/screenplay';
import { PROJECTS_KEY, SCRIPT_PREFIX, TV_SHOWS_KEY } from './storage';

// ── Init: pull from cloud → populate localStorage ──────────────────────────

let syncInitialized = false;

export async function initCloudSync(userId: string) {
  if (syncInitialized) return;
  syncInitialized = true;

  try {
    const [cloudProjects, cloudShows] = await Promise.all([
      pullProjectsFromCloud(userId),
      pullTvShowsFromCloud(userId),
    ]);

    if (cloudProjects.length > 0) {
      // Merge: cloud wins for newer updatedAt, local wins otherwise
      const localRaw = localStorage.getItem(PROJECTS_KEY);
      const localProjects: Project[] = localRaw ? JSON.parse(localRaw) : [];
      const merged = mergeProjects(localProjects, cloudProjects);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(merged));

      // Pull scripts for each project
      await Promise.all(
        cloudProjects.map(async (p) => {
          const localScript = localStorage.getItem(SCRIPT_PREFIX + p.id);
          if (!localScript) {
            const nodes = await pullScriptFromCloud(p.id);
            if (nodes) {
              localStorage.setItem(SCRIPT_PREFIX + p.id, JSON.stringify(nodes));
            }
          }
        })
      );
    } else {
      // First time in cloud — push all local data up
      const localRaw = localStorage.getItem(PROJECTS_KEY);
      const localProjects: Project[] = localRaw ? JSON.parse(localRaw) : [];
      await Promise.all(localProjects.map(async (p) => {
        await syncProjectToCloud(p, userId);
        const scriptRaw = localStorage.getItem(SCRIPT_PREFIX + p.id);
        if (scriptRaw) {
          const nodes: ScriptNode[] = JSON.parse(scriptRaw);
          await syncScriptToCloud(p.id, nodes, userId);
        }
      }));
    }

    if (cloudShows.length > 0) {
      const localRaw = localStorage.getItem(TV_SHOWS_KEY);
      const localShows: TvShow[] = localRaw ? JSON.parse(localRaw) : [];
      const merged = mergeTvShows(localShows, cloudShows);
      localStorage.setItem(TV_SHOWS_KEY, JSON.stringify(merged));
    } else {
      const localRaw = localStorage.getItem(TV_SHOWS_KEY);
      const localShows: TvShow[] = localRaw ? JSON.parse(localRaw) : [];
      await Promise.all(localShows.map(s => syncTvShowToCloud(s, userId)));
    }
  } catch (err) {
    console.warn('[cloud-storage] initCloudSync failed:', err);
  }
}

// ── Projects ────────────────────────────────────────────────────────────────

export async function syncProjectToCloud(project: Project, userId: string) {
  await supabase.from('projects').upsert({
    id: project.id,
    user_id: userId,
    data: project,
    updated_at: new Date().toISOString(),
  });
}

export async function pullProjectsFromCloud(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.data as Project);
}

export async function deleteProjectFromCloud(projectId: string) {
  await supabase.from('projects').delete().eq('id', projectId);
  await supabase.from('scripts').delete().eq('project_id', projectId);
}

// ── Scripts ─────────────────────────────────────────────────────────────────

export async function syncScriptToCloud(projectId: string, nodes: ScriptNode[], userId: string) {
  await supabase.from('scripts').upsert({
    project_id: projectId,
    user_id: userId,
    nodes,
    updated_at: new Date().toISOString(),
  });
}

export async function pullScriptFromCloud(projectId: string): Promise<ScriptNode[] | null> {
  const { data, error } = await supabase
    .from('scripts')
    .select('nodes')
    .eq('project_id', projectId)
    .single();

  if (error || !data) return null;
  return data.nodes as ScriptNode[];
}

// ── TV Shows ─────────────────────────────────────────────────────────────────

export async function syncTvShowToCloud(show: TvShow, userId: string) {
  await supabase.from('tv_shows').upsert({
    id: show.id,
    user_id: userId,
    data: show,
    updated_at: new Date().toISOString(),
  });
}

export async function pullTvShowsFromCloud(userId: string): Promise<TvShow[]> {
  const { data, error } = await supabase
    .from('tv_shows')
    .select('data')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.data as TvShow);
}

export async function deleteTvShowFromCloud(showId: string) {
  await supabase.from('tv_shows').delete().eq('id', showId);
}

// ── Merge helpers ────────────────────────────────────────────────────────────

function mergeProjects(local: Project[], cloud: Project[]): Project[] {
  const map = new Map<string, Project>();
  for (const p of local) map.set(p.id, p);
  for (const p of cloud) {
    const existing = map.get(p.id);
    if (!existing || new Date(p.updatedAt) > new Date(existing.updatedAt)) {
      map.set(p.id, p);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

function mergeTvShows(local: TvShow[], cloud: TvShow[]): TvShow[] {
  const map = new Map<string, TvShow>();
  for (const s of local) map.set(s.id, s);
  for (const s of cloud) {
    const existing = map.get(s.id);
    if (!existing || new Date(s.updatedAt) > new Date(existing.updatedAt)) {
      map.set(s.id, s);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
