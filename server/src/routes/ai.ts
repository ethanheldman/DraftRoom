import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import Anthropic from '@anthropic-ai/sdk';
import { buildBeatSheetPrompt } from '../prompts/beatSheet';
import { buildSceneOutlinePrompt } from '../prompts/sceneOutline';
import { buildTaglinesPrompt } from '../prompts/taglines';
import { buildCharacterBackstoryPrompt } from '../prompts/characterBackstory';
import { buildPersonalityChartPrompt } from '../prompts/personalityChart';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please wait a minute.' },
});

router.use(limiter);

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
  // Project data for cross-tab editing
  beats?: { title: string; description: string; act: number; page: number }[];
  castAndCrew?: { fullName: string; category: string; department: string; tags: string[]; comments: string; availability: string; rate?: number }[];
  budget?: { department: string; estimated: number; actual: number; notes: string }[];
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();
}

function extractCharacterLines(scriptText: string, characterName: string): string {
  const lines = scriptText.split('\n');
  const charLines: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toUpperCase() === characterName.toUpperCase()) {
      capturing = true;
      continue;
    }
    if (capturing) {
      if (!trimmed) {
        capturing = false;
        continue;
      }
      charLines.push(trimmed);
    }
  }

  return charLines.join('\n');
}

router.post('/', async (req: Request, res: Response) => {
  const { feature, scriptText, title = 'Untitled', characterName, question, canEdit = false, plan = 'free', stream = false, history = [], beats = [], castAndCrew = [], budget = [] } = req.body as AIRequest;
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

  // Script Doctor: multi-turn chat
  if (feature === 'script_doctor') {
    if (!question) {
      res.status(400).json({ error: 'question required for script_doctor' });
      return;
    }
    try {
      const client = new Anthropic({ apiKey });

      // Build context sections for existing project data
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

      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...history,
        { role: 'user', content: question },
      ];

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        try {
          const streamResp = client.messages.stream({
            model: 'claude-sonnet-4-6',
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
        model: 'claude-sonnet-4-6',
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
      const charLines = extractCharacterLines(scriptText, characterName);
      prompt = buildCharacterBackstoryPrompt(characterName, charLines);
      break;
    }
    case 'personality_chart': {
      if (!characterName) {
        res.status(400).json({ error: 'characterName required for personality_chart' });
        return;
      }
      const charLines = extractCharacterLines(scriptText, characterName);
      prompt = buildPersonalityChartPrompt(characterName, charLines);
      break;
    }
    default:
      res.status(400).json({ error: `Unknown feature: ${feature}` });
      return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
});

export default router;
