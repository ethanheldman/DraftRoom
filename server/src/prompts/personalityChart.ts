export function buildPersonalityChartPrompt(
  characterName: string,
  characterLines: string
): string {
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
  "scores": {
    "openness": 75,
    "conscientiousness": 60,
    "extraversion": 80,
    "agreeableness": 45,
    "neuroticism": 55,
    "courage": 90,
    "honesty": 65,
    "intelligence": 70
  },
  "justifications": {
    "openness": "Shows curiosity by...",
    "conscientiousness": "Demonstrates discipline through...",
    "extraversion": "Often leads conversations and...",
    "agreeableness": "Sometimes conflicts with others when...",
    "neuroticism": "Displays occasional anxiety when...",
    "courage": "Repeatedly faces danger without hesitation...",
    "honesty": "Generally truthful but withholds information when...",
    "intelligence": "Solves complex problems by..."
  }
}

Return ONLY the JSON object, no markdown, no extra text.`;
}
