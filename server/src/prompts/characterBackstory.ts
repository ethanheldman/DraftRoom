export function buildCharacterBackstoryPrompt(
  characterName: string,
  characterLines: string
): string {
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
