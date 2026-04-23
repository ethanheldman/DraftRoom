export interface AtmosphereTheme {
  id: string;
  name: string;
  icon: string;
  description: string;
  scrollBg: string;         // area behind the paper
  paperBg: string;          // paper surface
  paperText: string;        // ink color
  fontFamily: string;       // typeface for the script
  focusBg: string;          // highlighted scene row bg
  accentColor: string;      // scene heading / chrome accent
}

export const ATMOSPHERE_THEMES: AtmosphereTheme[] = [
  {
    // "Auto" is the default — it derives all paper surfaces from the active
    // App Theme's CSS vars, so the paper automatically re-tints whenever the
    // user changes their app theme (Lavender → Forest → Dracula, etc.).
    // Previously every Paper Style shipped with hardcoded hex values, which
    // meant picking a Forest app theme still gave you a bright white page
    // that didn't match anything else in the UI.
    id: 'auto',
    name: 'Match Theme',
    icon: '✨',
    description: 'Paper follows your app theme automatically',
    scrollBg: 'hsl(var(--background))',
    paperBg: 'hsl(var(--card))',
    paperText: 'hsl(var(--foreground))',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: 'hsl(var(--primary) / 0.08)',
    accentColor: 'hsl(var(--primary))',
  },
  {
    id: 'standard',
    name: 'Standard',
    icon: '📄',
    description: 'Classic white paper',
    scrollBg: '#e8e8e8',
    paperBg: '#ffffff',
    paperText: '#1a1a1a',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#e0f7fa',
    accentColor: '#1a1a1a',
  },
  {
    id: 'night',
    name: 'Night Mode',
    icon: '🌙',
    description: 'Easy on the eyes after dark',
    scrollBg: '#111827',
    paperBg: '#16213e',
    paperText: '#e8e8e8',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#003344',
    accentColor: '#e8e8e8',
  },
  {
    id: 'coffee-shop',
    name: 'Coffee Shop',
    icon: '☕',
    description: 'Warm amber tones, like writing in your favourite café',
    scrollBg: '#2d1b0e',
    paperBg: '#fdf6e3',
    paperText: '#3c2005',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#fce8b2',
    accentColor: '#7b4a1a',
  },
  {
    id: 'noir',
    name: 'Noir',
    icon: '🎩',
    description: 'High-contrast black & white — ruthless clarity',
    scrollBg: '#000000',
    paperBg: '#ffffff',
    paperText: '#000000',
    fontFamily: '"Courier New", Courier, monospace',
    focusBg: '#f0f0f0',
    accentColor: '#000000',
  },
  {
    id: 'sunset-studio',
    name: 'Sunset Studio',
    icon: '🌅',
    description: 'Warm gradient surroundings, golden hour energy',
    scrollBg: 'linear-gradient(160deg, #1a0533 0%, #4a1a2e 40%, #7a2d1a 100%)',
    paperBg: '#fff9f4',
    paperText: '#2a1a0a',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#ffe8d6',
    accentColor: '#7a2d1a',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    icon: '⌨️',
    description: 'Aged cream paper, serif warmth — the original craft',
    scrollBg: '#b8a48c',
    paperBg: '#f5f0e4',
    paperText: '#2c2215',
    fontFamily: 'Georgia, "Times New Roman", Times, serif',
    focusBg: '#e8dcc8',
    accentColor: '#2c2215',
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    icon: '🌌',
    description: 'Midnight blue cosmos — for sci-fi and epic writing',
    scrollBg: 'linear-gradient(160deg, #020b18 0%, #041c3a 60%, #0a1628 100%)',
    paperBg: '#0d1b2e',
    paperText: '#b8d4f0',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#0a2a4a',
    accentColor: '#4a9eff',
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌿',
    description: 'Muted greens, calm and grounded',
    scrollBg: '#1a2e1a',
    paperBg: '#f4f7f0',
    paperText: '#1c2e1c',
    fontFamily: '"Courier Prime", "Courier New", Courier, monospace',
    focusBg: '#dceede',
    accentColor: '#1c4a1c',
  },
];

export function getTheme(id: string): AtmosphereTheme {
  return ATMOSPHERE_THEMES.find(t => t.id === id) ?? ATMOSPHERE_THEMES[0];
}

export const THEME_STORAGE_KEY = 'sr-atmosphere-theme';
