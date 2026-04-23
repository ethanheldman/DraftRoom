// First-run demo project.
//
// We don't drop new users onto an empty dashboard — they see zero magic and
// bounce. Instead we hand them a real, editable short scene plus a starter
// beat sheet so their first minute is spent *inside* the tool, feeling how
// it handles scene headings, character cues, parentheticals, and dialogue.
//
// The content is deliberately short (one scene, ~1 page), written clean so
// the editor's indentation and uppercase rules are visible at a glance. Pages
// count / beat sheet / cast entries are all populated so every tab has
// something real to show during the tour.
//
// Keyed to onboarding experience level so beginners get a pedagogical
// "try editing this line" note on top, and pros skip the hand-holding.

import type { Project, ScriptNode, Beat, CastMember } from '../types/screenplay';
import type { ExperienceLevel } from '../pages/SignInDemo';
import { makeId } from './ids';

const DEMO_COLOR = '#c17f24';

function demoScript(level: ExperienceLevel): ScriptNode[] {
  const intro: ScriptNode[] =
    level === 'beginner' || level === 'some'
      ? [
          { type: 'action', content: "↓ This is your demo screenplay. Click any line and start typing. Tab cycles element types; press ⌘1–⌘8 to jump to a specific one." },
        ]
      : [];

  return [
    ...intro,
    { type: 'transition', content: 'FADE IN:' },

    { type: 'scene_heading', content: 'INT. 24-HOUR DINER - 2:47 AM' },
    { type: 'action', content: 'Rain hammers the window. A red-eyed WRITER (30s) hunches over a laptop in a vinyl booth. An empty coffee cup. A second empty coffee cup. The cursor blinks at her.' },

    { type: 'character', content: 'WAITRESS' },
    { type: 'parenthetical', content: '(refilling without asking)' },
    { type: 'dialogue', content: "Third night in a row. You either writing a masterpiece or running from something." },

    { type: 'character', content: 'WRITER' },
    { type: 'dialogue', content: "Why not both?" },

    { type: 'action', content: 'The WAITRESS — 50s, sharp eyes that have seen every kind of person sit in that exact booth — tops off the coffee anyway.' },

    { type: 'character', content: 'WAITRESS' },
    { type: 'dialogue', content: "What\u2019s it about?" },

    { type: 'character', content: 'WRITER' },
    { type: 'parenthetical', content: '(finally looks up)' },
    { type: 'dialogue', content: "A woman in a diner at 2:47 AM." },

    { type: 'action', content: 'The WAITRESS considers this. Slides into the opposite seat. Unheard of.' },

    { type: 'character', content: 'WAITRESS' },
    { type: 'dialogue', content: "Then let me tell you how it ends." },

    { type: 'action', content: "The WRITER's hands hover over the keys. Outside, the rain lets up for the first time all night." },

    { type: 'transition', content: 'CUT TO BLACK.' },

    { type: 'action', content: '' },
  ];
}

function demoBeatSheet(): Beat[] {
  return [
    { id: makeId(), title: 'Opening Image',       description: "Writer alone in diner, two empty cups — the image of being stuck.",              act: 1, page: 1, color: '' },
    { id: makeId(), title: 'Inciting Incident',   description: "Waitress sits down uninvited. Writer's isolation cracks.",                       act: 1, page: 1, color: '' },
    { id: makeId(), title: 'Promise of the Premise', description: "Waitress offers to tell her how the story ends — unlock the block.",         act: 2, page: 1, color: '' },
  ];
}

function demoCast(): CastMember[] {
  return [
    {
      id: makeId(),
      category: 'cast',
      fullName: 'WRITER',
      tags: ['protagonist'],
      comments: 'Blocked, exhausted, looking for permission to finish.',
      department: 'Acting',
      availability: '',
    },
    {
      id: makeId(),
      category: 'cast',
      fullName: 'WAITRESS',
      tags: ['supporting'],
      comments: 'Seen everything. Reads the room in 4 seconds.',
      department: 'Acting',
      availability: '',
    },
  ];
}

export function createDemoProject(level: ExperienceLevel): Project {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    title: 'Welcome — Your First Scene',
    type: 'film-tv',
    color: DEMO_COLOR,
    createdAt: now,
    updatedAt: now,
    scriptContent: demoScript(level),
    beatSheet: demoBeatSheet(),
    castAndCrew: demoCast(),
    aiCache: {},
    settings: {
      pageGoal: 120,
      tagline: 'A writer. A waitress. A blank page at 2:47 AM.',
      writingTime: 0,
      thinkingTime: 0,
      dailyWordGoal: 500,
    },
    logline: "At 2:47 AM in a 24-hour diner, a blocked screenwriter gets an uninvited collaborator — and the ending she's been running from.",
    genre: 'Drama',
    status: 'draft',
    breakdownItems: [],
    shotList: [],
    budget: [],
    mediaItems: [],
  };
}
