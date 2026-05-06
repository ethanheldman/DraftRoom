// Vercel serverless function for AI features.
//
// Why this lives here: the original Express server in /screenwriter/server/
// was never deployed alongside the Vercel-hosted client. In production,
// /api/ai requests were swallowed by the SPA's catch-all rewrite (returning
// index.html), so every AI feature failed with a JSON-parse error on the
// client side. Porting the route to a Vercel function deploys the API in
// the same project so /api/ai actually exists in production.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-5';

interface AIRequest {
  feature: string;
  scriptText: string;
  title?: string;
  characterName?: string;
  question?: string;
  canEdit?: boolean;
  plan?: string;
  stream?: boolean;
  history?: { role: 'user' | 'assistant'; content: string }[];
  beats?: { title: string; description: string; act: number; page: number }[];
  castAndCrew?: { fullName: string; category: string; department: string; tags: string[]; comments: string; availability: string; rate?: number }[];
  budget?: { department: string; estimated: number; actual: number; notes: string }[];
}

// ── Prompt builders (inlined from /server/src/prompts/*) ──────────────────────

function buildBeatSheetPrompt(title: string, scriptText: string): string {
  return `You are a professional screenplay analyst. Analyze the following screenplay "${title}" using the Save the Cat beat sheet methodology.

Identify the 15 key beats and return them as a JSON array. Each beat should have:
- "beat": the beat name (e.g., "Opening Image", "Theme Stated", "Set-Up", etc.)
- "page": the approximate page number where this beat occurs
- "description": a 1-2 sentence description of what happens at this beat in the screenplay

The 15 Save the Cat beats are:
1. Opening Image (page 1)
2. Theme Stated (page 5)
3. Set-Up (pages 1-10)
4. Catalyst (page 12)
5. Debate (pages 12-25)
6. Break into Two (page 25)
7. B Story (page 30)
8. Fun and Games (pages 30-55)
9. Midpoint (page 55)
10. Bad Guys Close In (pages 55-75)
11. All Is Lost (page 75)
12. Dark Night of the Soul (pages 75-85)
13. Break into Three (page 85)
14. Finale (pages 85-110)
15. Final Image (page 110)

Screenplay:
---
${scriptText.slice(0, 8000)}
---

Return ONLY a JSON array with no markdown formatting, no explanation, just the raw JSON array like:
[{"beat": "Opening Image", "page": 1, "description": "..."}, ...]`;
}

function buildSceneOutlinePrompt(title: string, scriptText: string): string {
  return `You are a professional screenplay analyst. Create a detailed scene-by-scene outline for the screenplay "${title}".

For each scene, return a JSON object with:
- "scene_number": the sequential scene number
- "heading": the scene heading (INT./EXT. LOCATION - TIME)
- "characters": array of character names present in the scene
- "summary": a 2-3 sentence description of what happens in the scene

Screenplay:
---
${scriptText.slice(0, 8000)}
---

Return ONLY a JSON array with no markdown formatting, no explanation, just the raw JSON array like:
[{"scene_number": 1, "heading": "INT. OFFICE - DAY", "characters": ["JOHN", "MARY"], "summary": "..."}, ...]`;
}

function buildTaglinesPrompt(title: string, scriptExcerpt: string): string {
  return `You are a professional Hollywood marketing copywriter. Create 5 compelling taglines for the screenplay "${title}".

Each tagline should:
- Be memorable and punchy (under 15 words)
- Capture the essence, tone, or central conflict of the story
- Use a different style/approach

Style options include: Dramatic, Ironic, Mysterious, Action-oriented, Emotional, Poetic, Question-based, Twist/Reveal

Based on this excerpt:
---
${scriptExcerpt}
---

Return ONLY a JSON array with no markdown formatting:
[{"tagline": "...", "style": "Dramatic"}, ...]

Provide exactly 5 taglines with different styles.`;
}

function buildCharacterBackstoryPrompt(characterName: string, characterLines: string): string {
  return `You are a professional screenplay analyst and character development expert.

Analyze the character "${characterName}" based on their dialogue and actions in the screenplay, then create a rich, detailed backstory.

Character's dialogue and actions from the screenplay:
---
${characterLines || '(No direct dialogue found - analyze based on the character name and context)'}
---

Create a comprehensive character backstory that includes:
1. Early life and formative experiences
2. Key relationships and how they shaped the character
3. Major life events that led them to where they are in the story
4. Internal conflicts and desires
5. What they want vs. what they need
6. Their greatest fear and greatest strength

Return a JSON object:
{"backstory": "Full backstory text here as multiple paragraphs separated by \\n\\n"}

Return ONLY the JSON object, no markdown, no extra text.`;
}

function buildPersonalityChartPrompt(characterName: string, characterLines: string): string {
  return `You are a professional psychologist and screenplay analyst.

Analyze the character "${characterName}" based on their dialogue and behavior in the screenplay, then score them on 8 personality dimensions from 0 to 100.

Character's dialogue and actions:
---
${characterLines || '(No direct dialogue found - analyze based on context)'}
---

Score the character on these 8 dimensions (0 = extremely low, 50 = average, 100 = extremely high):
1. openness - Openness to experience, creativity, curiosity
2. conscientiousness - Organization, dependability, self-discipline
3. extraversion - Sociability, assertiveness, positive emotions
4. agreeableness - Cooperation, trust, empathy
5. neuroticism - Emotional instability, anxiety, moodiness
6. courage - Bravery, willingness to face danger/conflict
7. honesty - Truthfulness, integrity, authenticity
8. intelligence - Problem-solving, wisdom, strategic thinking

For each dimension, provide a brief justification (1 sentence) explaining why you gave that score.

Return ONLY a JSON object:
{
  "scores": { "openness": 75, "conscientiousness": 60, "extraversion": 80, "agreeableness": 45, "neuroticism": 55, "courage": 90, "honesty": 65, "intelligence": 70 },
  "justifications": { "openness": "...", "conscientiousness": "...", "extraversion": "...", "agreeableness": "...", "neuroticism": "...", "courage": "...", "honesty": "...", "intelligence": "..." }
}

Return ONLY the JSON object, no markdown, no extra text.`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
}

function extractCharacterLines(scriptText: string, characterName: string): string {
  const lines = scriptText.split('\n');
  const charLines: string[] = [];
  let capturing = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === characterName.toUpperCase()) { capturing = true; continue; }
    if (capturing) {
      if (!trimmed) { capturing = false; continue; }
      charLines.push(trimmed);
    }
  }
  return charLines.join('\n');
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    feature, scriptText, title = 'Untitled', characterName, question,
    canEdit = false, plan = 'free', stream = false, history = [],
    beats = [], castAndCrew = [], budget = [],
  } = (req.body ?? {}) as AIRequest;
  const isProPlan = plan === 'pro' || plan === 'studio';

  if (!feature || !scriptText) {
    res.status(400).json({ error: 'Missing required fields: feature, scriptText' });
    return;
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' });
    return;
  }

  // Script Doctor: multi-turn chat with optional streaming
  if (feature === 'script_doctor') {
    if (!question) {
      res.status(400).json({ error: 'question required for script_doctor' });
      return;
    }
    try {
      const client = new Anthropic({ apiKey });

      const beatsContext = beats.length > 0
        ? `\n\nCURRENT BEAT SHEET (${beats.length} beats):\n${beats.map((b, i) => `${i + 1}. [Act ${b.act}, p.${b.page}] ${b.title}: ${b.description}`).join('\n')}`
        : '\n\nCURRENT BEAT SHEET: Empty';

      const castContext = castAndCrew.length > 0
        ? `\n\nCURRENT CAST & CREW (${castAndCrew.length} entries):\n${castAndCrew.map(m => `- ${m.fullName} (${m.category}, ${m.department || 'no dept'}${m.rate ? `, $${m.rate}/day` : ''})`).join('\n')}`
        : '\n\nCURRENT CAST & CREW: Empty';

      const budgetContext = budget.length > 0
        ? `\n\nCURRENT BUDGET (${budget.length} lines):\n${budget.map(l => `- ${l.department}: est $${l.estimated}, actual $${l.actual}`).join('\n')}`
        : '\n\nCURRENT BUDGET: Empty';

      const scriptEditInstructions = canEdit ? `

You have permission to edit the script. When the user asks for script changes, output the full revised script using EXACTLY this format:
<SCRIPT_EDIT>
[{"type":"scene_heading","content":"INT. LOCATION - DAY"},{"type":"action","content":"Description here."}]
</SCRIPT_EDIT>
Valid types: scene_heading, action, character, dialogue, parenthetical, transition, shot, act, text
Output the COMPLETE script with ALL nodes. Only include when user explicitly asks for script changes.` : '';

      const proEditInstructions = canEdit && isProPlan ? `

You also have permission to update beat sheets, cast & crew, and budget. Use EXACTLY these XML formats:

BEAT SHEET edits:
<BEAT_SHEET_EDIT>
[{"title":"Opening Image","description":"What we see as the story begins.","act":1,"page":1}]
</BEAT_SHEET_EDIT>
act must be 1, 2, or 3. page is estimated script page. Output the COMPLETE beat list.

CAST & CREW edits:
<CAST_EDIT>
[{"fullName":"CHARACTER NAME","category":"cast","department":"Acting","tags":["lead"],"comments":"","availability":"","rate":0}]
</CAST_EDIT>
category must be "cast", "crew", or "vendor". Output the COMPLETE cast list.

BUDGET edits:
<BUDGET_EDIT>
[{"department":"Above the Line","estimated":50000,"actual":0,"notes":""}]
</BUDGET_EDIT>
Output the COMPLETE budget. Only include when user explicitly asks for budget changes.

Rules: Only include ONE structured edit block per response. Only include when explicitly asked.` : '';

      const editInstructions = scriptEditInstructions + proEditInstructions;

      const systemPrompt = `You are an expert screenplay consultant, script doctor, and production assistant with deep knowledge of story structure, character development, dialogue, film budgeting, and the business of film and TV.

You have full access to the project "${title}":

SCREENPLAY:
${scriptText}
${beatsContext}
${castContext}
${budgetContext}

Answer the user's questions with specific, actionable feedback grounded in the actual project data. Be concise and direct. You can help with: script analysis, beat sheets, cast & crew lists, budget estimates, character profiles, scene outlines, taglines, pacing, and production planning.${editInstructions}`;

      const messages = [...history, { role: 'user' as const, content: question }];

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        try {
          const streamResp = client.messages.stream({
            model: MODEL,
            max_tokens: canEdit ? 8192 : 1024,
            system: systemPrompt,
            messages,
          });
          for await (const event of streamResp) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
            }
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
          res.end();
        }
        return;
      }

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: canEdit ? 8192 : 1024,
        system: systemPrompt,
        messages,
      });
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      res.json({ result: text });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('AI error:', message);
      res.status(500).json({ error: message });
    }
    return;
  }

  // Single-shot JSON-returning features
  let prompt = '';
  switch (feature) {
    case 'beat_sheet':
      prompt = buildBeatSheetPrompt(title, scriptText);
      break;
    case 'scene_outline':
      prompt = buildSceneOutlinePrompt(title, scriptText);
      break;
    case 'taglines':
      prompt = buildTaglinesPrompt(title, scriptText.slice(0, 3000));
      break;
    case 'character_backstory': {
      if (!characterName) {
        res.status(400).json({ error: 'characterName required for character_backstory' });
        return;
      }
      prompt = buildCharacterBackstoryPrompt(characterName, extractCharacterLines(scriptText, characterName));
      break;
    }
    case 'personality_chart': {
      if (!characterName) {
        res.status(400).json({ error: 'characterName required for personality_chart' });
        return;
      }
      prompt = buildPersonalityChartPrompt(characterName, extractCharacterLines(scriptText, characterName));
      break;
    }
    default:
      res.status(400).json({ error: `Unknown feature: ${feature}` });
      return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });
    const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = stripCodeFences(rawText);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response as JSON', raw: cleaned });
      return;
    }
    res.json({ result: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('AI error:', message);
    res.status(500).json({ error: message });
  }
}
