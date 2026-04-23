export function buildTaglinesPrompt(title: string, scriptExcerpt: string): string {
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
