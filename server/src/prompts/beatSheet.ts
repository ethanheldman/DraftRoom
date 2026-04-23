export function buildBeatSheetPrompt(title: string, scriptText: string): string {
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
