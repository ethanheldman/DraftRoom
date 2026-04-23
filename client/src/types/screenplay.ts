export type ElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'shot'
  | 'act'
  | 'text';

export interface ScriptNode {
  type: ElementType;
  content: string;
  html?: string; // inner HTML when the node contains inline formatting
  marks?: ('bold' | 'italic' | 'underline')[];
  sceneNumber?: number;
  color?: string;
  /** Character extension e.g. "V.O.", "O.S.", "CONT'D" — preserved round-trip. */
  extension?: string;
}

export interface Beat {
  id: string;
  title: string;
  description: string;
  act: number;
  page: number;
  color?: string;
  linkedSceneIndex?: number;
}

export interface CastMember {
  id: string;
  category: 'cast' | 'crew' | 'vendor';
  fullName: string;
  tags: string[];
  comments: string;
  department: string;
  availability: string;
  rate?: number;
}

export interface CharacterProfile {
  backstory: string;
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
    courage: number;
    honesty: number;
    intelligence: number;
  };
  justifications: Record<string, string>;
}

export interface BeatItem {
  beat: string;
  page: number;
  description: string;
}

export interface SceneOutlineItem {
  scene_number: number;
  heading: string;
  characters: string[];
  summary: string;
}

export interface TaglineItem {
  tagline: string;
  style: string;
}

export interface BreakdownItem {
  id: string;
  text: string;
  category: string;
  sceneIndex: number;
}

export interface Shot {
  id: string;
  sceneIndex: number;
  shotNumber: number;
  shotType: 'WS' | 'MS' | 'CU' | 'ECU' | 'OTS' | 'POV' | 'INSERT';
  cameraMove: 'static' | 'pan' | 'tilt' | 'dolly' | 'handheld';
  description: string;
  lens: string;
  notes: string;
}

export interface BudgetLine {
  id: string;
  department: string;
  estimated: number;
  actual: number;
  notes: string;
}

export interface MediaItem {
  id: string;
  sceneIndex: number;
  url: string;
  caption: string;
  name: string;
  type: string;
  size?: number;
  addedAt: string;
}

export interface Project {
  id: string;
  title: string;
  type: 'film-tv';
  color: string;
  createdAt: string;
  updatedAt: string;
  scriptContent: ScriptNode[];
  beatSheet: Beat[];
  castAndCrew: CastMember[];
  aiCache: {
    beatSheet?: BeatItem[];
    sceneOutline?: SceneOutlineItem[];
    taglines?: TaglineItem[];
    characters?: Record<string, CharacterProfile>;
  };
  settings: {
    pageGoal: number;
    tagline: string;
    writingTime: number;
    thinkingTime: number;
    dailyWordGoal?: number;
    deadline?: string;
    revisionColor?: string;
    revisionMode?: boolean;
  };
  logline?: string;
  genre?: string;
  status?: 'draft' | 'in-progress' | 'final-draft' | 'complete';
  archived?: boolean;
  trashedAt?: string;
  showId?: string;           // if set, this is an episode of a TvShow
  season?: number;
  episode?: number;
  breakdownItems?: BreakdownItem[];
  shotList?: Shot[];
  budget?: BudgetLine[];
  mediaItems?: MediaItem[];
}

export interface TvShow {
  id: string;
  title: string;
  genre?: string;
  logline?: string;
  network?: string;
  color: string;
  seasons: number;           // highest season number used
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  trashedAt?: string;
}
