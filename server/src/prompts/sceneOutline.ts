export function buildSceneOutlinePrompt(title: string, scriptText: string): string {
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
