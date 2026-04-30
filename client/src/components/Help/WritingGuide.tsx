import { useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpenIcon, FileTextIcon, MessageSquareIcon, UserIcon, ArrowRightIcon,
  ZapIcon, StarIcon, AlertCircleIcon, CheckCircleIcon, ChevronRightIcon,
  SearchIcon, SparklesIcon, SendIcon, XIcon, CheckIcon, RotateCcwIcon,
  PenIcon, TrophyIcon, LockIcon,
} from 'lucide-react';
import { getPlan, isPro } from '../../lib/plan';

// ── Types ─────────────────────────────────────────────────────────────────────

type SectionId =
  | 'intro' | 'elements' | 'scene-headings' | 'action'
  | 'character' | 'dialogue' | 'parenthetical' | 'transitions'
  | 'structure' | 'beat-sheet' | 'tips'
  | 'storyboard' | 'budget'
  | 'cheatsheet' | 'ai-tutor' | 'exercises';

interface NavSection {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  group?: string;
  proOnly?: boolean;
}

interface LessonMeta {
  id: SectionId;
  title: string;
  tagline: string;
  readTime: string;
  proOnly?: boolean;
}

interface ModuleDef {
  id: string;
  num: number;
  title: string;
  subtitle: string;
  color: string;
  icon: string;
  lessons: LessonMeta[];
}

// ── Progress helpers ──────────────────────────────────────────────────────────

const PROGRESS_KEY = 'sr-guide-progress';
function loadProgress(): Set<SectionId> {
  try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function saveProgress(s: Set<SectionId>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...s]));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl my-4" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
      <CheckCircleIcon className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl my-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <AlertCircleIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-foreground/80 leading-relaxed">{children}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-2xl font-bold text-foreground mb-2 mt-8 first:mt-0">{children}</h2>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>;
}
function Body({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground leading-relaxed mb-3">{children}</p>;
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
      style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
      {children}
    </kbd>
  );
}

function ScriptExample({ lines }: { lines: { type: string; text: string }[] }) {
  const typeStyles: Record<string, React.CSSProperties> = {
    scene:         { fontWeight: 700, textTransform: 'uppercase', marginTop: 16, marginBottom: 4 },
    action:        { marginBottom: 8 },
    character:     { marginLeft: '38%', textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
    parenthetical: { marginLeft: '30%', marginRight: '38%', fontStyle: 'italic', color: '#888', marginBottom: 2 },
    dialogue:      { marginLeft: '22%', marginRight: '22%', marginBottom: 8 },
    transition:    { textAlign: 'right', textTransform: 'uppercase', marginTop: 12, marginBottom: 4, color: '#888' },
    note:          { color: '#7c3aed', fontSize: 11, marginBottom: 4, fontStyle: 'italic' },
  };
  return (
    <div className="rounded-2xl overflow-hidden my-5 shadow-xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>
      <div className="px-2 py-1 flex items-center gap-1.5" style={{ background: '#f5f5f5', borderBottom: '1px solid #e5e5e5' }}>
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <span className="text-[10px] text-gray-400 ml-2 font-mono">screenplay.fountain</span>
      </div>
      <div className="px-10 py-6" style={{ fontFamily: "'Courier Prime','Courier New',monospace", fontSize: 13, lineHeight: 1.6, color: '#111' }}>
        {lines.map((l, i) => (
          <div key={i} style={typeStyles[l.type] ?? {}}>
            {l.type === 'note' ? <span style={{ color: '#7c3aed', fontSize: 11 }}>← {l.text}</span> : l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function DoDont({ dos, donts }: { dos: string[]; donts: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 my-5">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <CheckCircleIcon className="w-3 h-3" /> Do
        </p>
        <ul className="space-y-2">
          {dos.map(d => <li key={d} className="text-xs text-foreground/80 flex gap-2"><span className="text-emerald-400 mt-0.5">✓</span>{d}</li>)}
        </ul>
      </div>
      <div className="rounded-2xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
          <AlertCircleIcon className="w-3 h-3" /> Don't
        </p>
        <ul className="space-y-2">
          {donts.map(d => <li key={d} className="text-xs text-foreground/80 flex gap-2"><span className="text-red-400 mt-0.5">✗</span>{d}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ── Interactive: Try It sandbox (Pro) ─────────────────────────────────────────

function TryItBox({ prompt, placeholder, evaluate }: {
  prompt: string;
  placeholder: string;
  evaluate: (text: string) => string; // local instant feedback (non-AI)
}) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  function checkLocal() {
    if (!text.trim()) return;
    setFeedback(evaluate(text));
    setAiFeedback(null);
  }

  async function getAIFeedback() {
    if (!text.trim()) return;
    setAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'script_doctor',
          scriptText: text,
          title: 'Practice Exercise',
          question: `As a professional screenwriting instructor, evaluate this student's attempt at the following exercise: "${prompt}"\n\nTheir answer:\n"${text}"\n\nGive 2-3 sentences of constructive, encouraging feedback. Point out what's correct, what could be improved, and give one specific rewrite suggestion. Keep it friendly and practical.`,
          stream: false,
        }),
      });
      const raw = await res.text();
      const lines = raw.split('\n').filter(l => l.startsWith('data: '));
      let out = '';
      for (const l of lines) {
        const d = l.slice(6);
        if (d === '[DONE]') break;
        try { const p = JSON.parse(d); if (p.delta?.text) out += p.delta.text; else if (p.text) out += p.text; } catch { out += d; }
      }
      setAiFeedback(out.trim() || raw.trim());
    } catch { setAiFeedback('AI feedback unavailable right now.'); }
    finally { setAiLoading(false); }
  }

  return (
    <div className="my-6 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.04)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(124,58,237,0.15)', background: 'rgba(124,58,237,0.08)' }}>
        <PenIcon className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Try It</span>
        <span className="ml-2 text-xs text-muted-foreground">{prompt}</span>
      </div>
      <div className="p-4">
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setFeedback(null); setAiFeedback(null); }}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none transition-all"
          style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', fontFamily: "'Courier Prime','Courier New',monospace" }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
        />
        <div className="flex gap-2 mt-2">
          <button onClick={checkLocal} disabled={!text.trim()}
            className="rounded-xl px-4 py-1.5 text-xs font-semibold transition-all disabled:opacity-40"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
            Check Format
          </button>
          <button onClick={getAIFeedback} disabled={!text.trim() || aiLoading}
            className="rounded-xl px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}>
            <SparklesIcon className="w-3 h-3" />
            {aiLoading ? 'Analyzing…' : 'AI Feedback'}
          </button>
          {text && <button onClick={() => { setText(''); setFeedback(null); setAiFeedback(null); }}
            className="rounded-xl px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            Clear
          </button>}
        </div>
        {feedback && (
          <div className={`mt-3 rounded-xl p-3 text-xs leading-relaxed ${feedback.startsWith('✓') ? 'text-emerald-300' : 'text-amber-300'}`}
            style={{ background: feedback.startsWith('✓') ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)', border: `1px solid ${feedback.startsWith('✓') ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
            {feedback}
          </div>
        )}
        {aiFeedback && (
          <div className="mt-3 rounded-xl p-3 text-xs leading-relaxed text-violet-200"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <span className="text-violet-400 font-semibold">✦ AI Coach: </span>{aiFeedback}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Interactive: Quiz card (Pro) ──────────────────────────────────────────────

interface QuizQ { q: string; options: string[]; correct: number; explanation: string; }

function QuizCard({ questions }: { questions: QuizQ[] }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  function pick(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[idx].correct) setScore(s => s + 1);
  }

  function next() {
    if (idx + 1 >= questions.length) { setDone(true); return; }
    setIdx(i => i + 1);
    setSelected(null);
  }

  function reset() { setIdx(0); setSelected(null); setScore(0); setDone(false); }

  const q = questions[idx];

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="my-6 rounded-2xl p-6 text-center" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <TrophyIcon className="w-8 h-8 text-violet-400 mx-auto mb-3" />
        <p className="text-lg font-bold text-foreground mb-1">{pct >= 80 ? 'Great job!' : pct >= 50 ? 'Good start!' : 'Keep studying!'}</p>
        <p className="text-sm text-muted-foreground mb-4">You scored <strong>{score}/{questions.length}</strong> ({pct}%)</p>
        <button onClick={reset} className="flex items-center gap-2 mx-auto rounded-xl px-4 py-2 text-xs font-semibold transition-all"
          style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
          <RotateCcwIcon className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="my-6 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.04)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(124,58,237,0.15)', background: 'rgba(124,58,237,0.08)' }}>
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">Quick Quiz</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{idx + 1} / {questions.length}</span>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-foreground mb-4">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correct;
            const isSelected = i === selected;
            let bg = 'hsl(var(--secondary))';
            let border = '1px solid hsl(var(--border))';
            let textColor = 'hsl(var(--foreground) / 0.8)';
            if (selected !== null) {
              if (isCorrect) { bg = 'rgba(34,197,94,0.12)'; border = '1px solid rgba(34,197,94,0.4)'; textColor = '#86efac'; }
              else if (isSelected) { bg = 'rgba(239,68,68,0.08)'; border = '1px solid rgba(239,68,68,0.3)'; textColor = '#fca5a5'; }
            }
            return (
              <button key={i} onClick={() => pick(i)}
                className="w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-between gap-3"
                style={{ background: bg, border, color: textColor, cursor: selected !== null ? 'default' : 'pointer' }}>
                <span>{opt}</span>
                {selected !== null && isCorrect && <CheckIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                {selected !== null && isSelected && !isCorrect && <XIcon className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
        {selected !== null && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{q.explanation}</p>
            <button onClick={next} className="rounded-xl px-4 py-1.5 text-xs font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}>
              {idx + 1 >= questions.length ? 'See Results' : 'Next Question →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Tutor chat ─────────────────────────────────────────────────────────────

interface TutorMsg { role: 'user' | 'assistant'; content: string; }

const QUICK_PROMPTS = [
  'What makes a great scene heading?',
  'How do I write subtext in dialogue?',
  'What\'s the difference between action and shot?',
  'How long should an average scene be?',
  'Explain the Save the Cat beat sheet',
  'What is a parenthetical and when should I use it?',
  'How do I format a montage?',
  'What makes dialogue feel natural?',
];

function AIChatPanel() {
  const [messages, setMessages] = useState<TutorMsg[]>([
    { role: 'assistant', content: 'Hi! I\'m your personal screenwriting coach. Ask me anything about screenplay format, structure, dialogue, story beats — or share a line and I\'ll give feedback. What do you want to learn today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    setInput('');
    const newMsgs: TutorMsg[] = [...messages, { role: 'user', content: t }];
    setMessages(newMsgs);
    setLoading(true);

    const history = newMsgs.slice(1).map(m => ({ role: m.role, content: m.content }));
    const systemContext = 'You are an expert screenwriting coach embedded in DraftRoom, a professional screenplay tool. Answer questions clearly, with examples when useful. Keep responses concise (2–4 paragraphs max). Use proper screenplay terminology. When giving examples, format them as: CHARACTER NAME on one line, dialogue below. Always be encouraging and practical.';

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'script_doctor',
          scriptText: '',
          title: 'Writing Guide Tutor',
          question: systemContext + '\n\nStudent question: ' + t,
          history: history.slice(-6),
          stream: false,
        }),
      });
      const raw = await res.text();
      const lines = raw.split('\n').filter(l => l.startsWith('data: '));
      let out = '';
      for (const l of lines) {
        const d = l.slice(6);
        if (d === '[DONE]') break;
        try { const p = JSON.parse(d); if (p.delta?.text) out += p.delta.text; else if (p.text) out += p.text; } catch { out += d; }
      }
      const reply = out.trim() || raw.trim() || 'Sorry, I couldn\'t respond right now. Try again.';
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Sorry, AI is unavailable right now.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${m.role === 'assistant' ? 'bg-violet-600 text-white' : 'bg-secondary text-foreground'}`}>
              {m.role === 'assistant' ? '✦' : 'U'}
            </div>
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] ${m.role === 'assistant' ? 'text-foreground/90' : 'text-foreground'}`}
              style={m.role === 'assistant'
                ? { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }
                : { background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">✦</div>
            <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <span className="animate-pulse text-muted-foreground">Writing response…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Quick questions</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)}
                className="text-[11px] px-3 py-1.5 rounded-full transition-colors"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground) / 0.7)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(124,58,237,0.4)'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground))'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.color = 'hsl(var(--foreground) / 0.7)'; }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 pt-2 border-t border-border">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask anything about screenwriting…"
            rows={2}
            className="flex-1 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none transition-all"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
          />
          <button onClick={() => send(input)} disabled={!input.trim() || loading}
            className="rounded-xl p-2.5 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            <SendIcon className="w-4 h-4 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Exercises section ─────────────────────────────────────────────────────────

const EXERCISE_PROMPTS = [
  {
    id: 'slugline', title: 'Write a Scene Heading', level: 'Beginner',
    description: 'Write a scene heading for a scene set inside a police interrogation room at night.',
    placeholder: 'INT. ...',
    evaluate: (t: string) => {
      const u = t.trim().toUpperCase();
      if (!u.startsWith('INT.') && !u.startsWith('EXT.')) return '✗ Scene headings must start with INT. or EXT.';
      if (!/ - (DAY|NIGHT|MORNING|EVENING|DUSK|DAWN|CONTINUOUS|LATER)/.test(u)) return '⚠ Remember to include the time of day at the end (e.g., - NIGHT)';
      if (u.toLowerCase() !== u.toUpperCase() && u !== t.trim().toUpperCase()) return '⚠ Scene headings must be ALL CAPS.';
      return '✓ Correct format! A proper scene heading.';
    }
  },
  {
    id: 'action', title: 'Write an Action Line', level: 'Beginner',
    description: 'Describe a nervous person waiting in a hospital waiting room. Use only what the camera can see — no thoughts.',
    placeholder: 'A man sits alone...',
    evaluate: (t: string) => {
      if (t.trim().split(' ').length < 10) return '⚠ Too short. Add more visual detail — what does the room look like? What is the person doing?';
      if (/thinks?|feels?|wonders?|knows?|realizes?/i.test(t)) return '⚠ Action lines can\'t describe what a character thinks or feels — only what we can see and hear on screen.';
      if (/he had|she had|they had|walked|opened|said/i.test(t)) return '⚠ Write in present tense: "He sits", not "He sat."';
      return '✓ Good! Action lines describe only what the camera sees, in present tense.';
    }
  },
  {
    id: 'dialogue', title: 'Write a Dialogue Exchange', level: 'Intermediate',
    description: 'Write 2–3 lines of dialogue between a detective and a suspect. The detective suspects the suspect is lying but doesn\'t accuse directly.',
    placeholder: 'DETECTIVE\nSo where were you last Tuesday...',
    evaluate: (t: string) => {
      const lines = t.trim().split('\n').filter(l => l.trim());
      if (lines.length < 4) return '⚠ A dialogue exchange needs at least 2 character names and 2 lines of dialogue.';
      return '✓ Good structure! Ask AI for feedback on the subtext and tone.';
    }
  },
  {
    id: 'subtext', title: 'Subtext in Dialogue', level: 'Advanced',
    description: 'Two old friends haven\'t seen each other in 5 years after a falling out. Write their awkward first meeting — they never directly mention the argument.',
    placeholder: 'SARAH\nYou look... the same.',
    evaluate: (t: string) => {
      if (t.trim().length < 100) return '⚠ Build the scene out more. Show the tension through small details — what they DON\'T say matters as much as what they do.';
      if (/I\'m sorry|forgive|that argument|the fight/i.test(t)) return '⚠ They should avoid mentioning the real issue directly — that\'s what subtext is. Let the tension come through what they say around it.';
      return '✓ Nice attempt! Great subtext feels like two conversations happening at once. Ask AI for feedback.';
    }
  },
  {
    id: 'scene-heading-time', title: 'Time Continuity', level: 'Intermediate',
    description: 'Write 3 consecutive scene headings: a coffee shop scene during the day, then the same location later that night, then a rooftop exterior scene at dusk.',
    placeholder: 'INT. COFFEE SHOP - DAY\n...',
    evaluate: (t: string) => {
      const headings = t.trim().split('\n').filter(l => /^(INT\.|EXT\.)/.test(l.trim().toUpperCase()));
      if (headings.length < 3) return '⚠ Write 3 separate scene headings, each on its own line starting with INT. or EXT.';
      if (!headings.some(h => h.toUpperCase().includes('NIGHT'))) return '⚠ One of the scenes should be at NIGHT.';
      if (!headings.some(h => /^EXT\./i.test(h.trim()))) return '⚠ The rooftop scene should use EXT. (exterior).';
      return '✓ Correct! Each scene heading establishes a new time and place.';
    }
  },
  {
    id: 'parenthetical', title: 'Use a Parenthetical', level: 'Beginner',
    description: 'A character named MARCUS is speaking. He starts speaking to his boss, then turns aside to mutter under his breath to himself. Format both beats of dialogue with the correct parenthetical.',
    placeholder: 'MARCUS\n(to his boss)\nAbsolutely, sir...',
    evaluate: (t: string) => {
      if (!t.includes('(') || !t.includes(')')) return '⚠ Parentheticals appear in parentheses below the character name, before the dialogue line they affect.';
      if ((t.match(/\(/g) ?? []).length < 2) return '⚠ You need two parentheticals — one for each beat of dialogue.';
      return '✓ Good use of parentheticals! Remember: use them sparingly — let the dialogue speak for itself most of the time.';
    }
  },
];

function ExercisesSection({ pro }: { pro: boolean }) {
  const [active, setActive] = useState<string | null>(null);

  if (!pro) return <ProGate feature="Writing Exercises" />;

  return (
    <>
      <SectionTitle>Writing Exercises</SectionTitle>
      <Body>Practice makes perfect. These exercises range from beginner formatting drills to advanced craft challenges. Each one has instant format checking and AI coaching.</Body>
      <div className="space-y-4 mt-6">
        {EXERCISE_PROMPTS.map(ex => {
          const isOpen = active === ex.id;
          const levelColor = ex.level === 'Beginner' ? '#10b981' : ex.level === 'Intermediate' ? '#f59e0b' : '#ef4444';
          return (
            <div key={ex.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
              <button className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-secondary/30"
                onClick={() => setActive(isOpen ? null : ex.id)}>
                <div className="flex items-center gap-3">
                  <PenIcon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ex.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ex.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${levelColor}18`, color: levelColor }}>{ex.level}</span>
                  <ChevronRightIcon className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {isOpen && (
                <div className="px-5 pb-5">
                  <TryItBox prompt={ex.description} placeholder={ex.placeholder} evaluate={ex.evaluate} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Pro gate overlay ──────────────────────────────────────────────────────────

function ProGate({ feature }: { feature: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <LockIcon className="w-6 h-6 text-violet-400" />
      </div>
      <p className="text-lg font-bold text-foreground mb-2">{feature} is a Pro feature</p>
      <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
        Upgrade to DraftRoom Pro to unlock the AI Writing Tutor, interactive exercises, quizzes, and more.
      </p>
      <div className="rounded-2xl p-5 text-left w-full max-w-sm" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">Pro includes</p>
        <ul className="space-y-2">
          {['AI Writing Tutor — ask anything, get instant coaching', 'Interactive exercises with AI feedback', 'Section quizzes to test your knowledge', 'Format sandbox for real-time practice', 'Full access to all guide sections'].map(f => (
            <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
              <SparklesIcon className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Section exercises + quizzes (per section) ─────────────────────────────────

const SECTION_EXTRAS: Partial<Record<SectionId, { exercise?: typeof EXERCISE_PROMPTS[0]; quiz?: QuizQ[] }>> = {
  'scene-headings': {
    exercise: EXERCISE_PROMPTS.find(e => e.id === 'slugline'),
    quiz: [
      { q: 'Which scene heading is correctly formatted?', options: ['Int. coffee shop - day', 'INT. COFFEE SHOP - DAY', 'INT.COFFEE SHOP-DAY', 'interior coffee shop, daytime'], correct: 1, explanation: 'Scene headings are always ALL CAPS, include a space after INT./EXT., and use a dash before the time of day.' },
      { q: 'You\'re shooting a scene where an actor steps from inside a building to a street outside. What scene heading prefix should you use?', options: ['INT.', 'EXT.', 'INT./EXT.', 'Both INT. and EXT. on separate lines'], correct: 2, explanation: 'INT./EXT. signals a scene that moves between interior and exterior — common for car windows, doorways, or transitional moments.' },
      { q: 'Which time of day is NOT a valid scene heading time?', options: ['CONTINUOUS', 'LATER', 'AFTERNOON', '3:47 PM'], correct: 3, explanation: 'Use general time labels (DAY, NIGHT, CONTINUOUS, LATER, DUSK, etc). Specific clock times break the visual language of screenplays.' },
    ],
  },
  action: {
    exercise: EXERCISE_PROMPTS.find(e => e.id === 'action'),
    quiz: [
      { q: 'Which action line follows screenplay rules?', options: ['John thinks about his dead wife.', 'John slowly opens the drawer. A GUN sits inside, fully loaded.', 'John had never felt so alone in his life.', 'John (feeling nervous) walks to the door.'], correct: 1, explanation: 'Action lines describe only what the audience can see or hear. No internal thoughts, no past tense, no parentheticals.' },
      { q: 'How long should most action paragraphs be?', options: ['As long as needed to describe the scene fully', '1 sentence maximum', '3 lines maximum', '1–2 full pages'], correct: 2, explanation: 'Action paragraphs should be 1–3 lines maximum. Long blocks of action slow the read. Break dense description into multiple short paragraphs.' },
    ],
  },
  dialogue: {
    exercise: EXERCISE_PROMPTS.find(e => e.id === 'dialogue'),
    quiz: [
      { q: 'When does a character\'s name get the extension (CONT\'D)?', options: ['Always, on every line', 'When they speak more than once in a scene', 'When their dialogue continues across a page break', 'When they are speaking off-screen'], correct: 2, explanation: '(CONT\'D) is added to a character name only when their speech is interrupted by a page break — to tell the reader the same character is still speaking on the next page.' },
      { q: 'What is subtext in dialogue?', options: ['The literal meaning of what a character says', 'The meaning underneath what a character says', 'A parenthetical directing the actor', 'Dialogue spoken off-screen'], correct: 1, explanation: 'Subtext is what characters communicate without saying it directly. Great dialogue works on two levels: what\'s said, and what\'s really meant.' },
      { q: 'Which dialogue sounds most natural for a screenplay?', options: ['"I am going to kill him because he lied to me about the money."', '"He lied. The money\'s gone. I\'m going to find him."', '"Due to the fact that he has been untruthful regarding the financial situation, I intend to seek him out."', '"He always lies about everything, and now the money is gone, which means I will go find him."'], correct: 1, explanation: 'Good screenplay dialogue is short, active, and specific. Characters don\'t explain themselves — they act.' },
    ],
  },
  parenthetical: {
    exercise: EXERCISE_PROMPTS.find(e => e.id === 'parenthetical'),
    quiz: [
      { q: 'When should you use a parenthetical?', options: ['Every time a character speaks', 'To describe every actor emotion', 'Only when the tone is genuinely ambiguous without it', 'To direct camera movement'], correct: 2, explanation: 'Parentheticals should be rare — used only when the delivery can\'t be inferred from the dialogue itself. Overuse insults the actor and clutters the page.' },
      { q: 'Which parenthetical is appropriate?', options: ['(speaking dramatically)', '(to JAMES)', '(emotionally)', '(seriously and with great concern)'], correct: 1, explanation: '"(to JAMES)" tells us who the character is addressing — functional and clear. Emotional directions like "dramatically" or "emotionally" step on the actor\'s craft.' },
    ],
  },
  structure: {
    quiz: [
      { q: 'The "All Is Lost" beat typically falls around which page in a 110-page screenplay?', options: ['Page 25', 'Page 55', 'Page 75', 'Page 95'], correct: 2, explanation: 'All Is Lost (around p.75) is the protagonist\'s lowest moment — everything they\'ve worked for seems gone. It\'s the emotional nadir before the final push.' },
      { q: 'What is the inciting incident?', options: ['The climax of the film', 'The event that disrupts the protagonist\'s normal world and kicks off the story', 'The first page of the script', 'The protagonist\'s backstory'], correct: 1, explanation: 'The inciting incident (around p.10) is the event that forces the protagonist out of their comfort zone and sets the central story in motion.' },
      { q: 'In Save the Cat\'s beat sheet, what is the "Fun and Games" section?', options: ['Act I setup', 'The promise of the premise — the most entertaining part of the concept before stakes get heavy', 'The climax of Act III', 'The epilogue'], correct: 1, explanation: 'Fun and Games (pp. 30–55) is where the film delivers on its premise. If it\'s a heist film — this is the heist training. A romance — this is the falling in love. The audience came for this.' },
    ],
  },
  intro: {
    quiz: [
      { q: 'How many screenplay pages roughly equal one minute of screen time?', options: ['Half a page', '1 page', '2 pages', '3 pages'], correct: 1, explanation: 'The "one page per minute" rule is a rough industry standard. A 90-minute film typically has around 90 pages.' },
      { q: 'Which of these is acceptable to include in a screenplay?', options: ['What a character is secretly thinking', 'A beautiful sunset that two characters watch together', 'Instructions for the editor on how to cut the scene', 'Details the audience can never see on screen'], correct: 1, explanation: 'Screenplays describe only what the camera can capture — what we see and hear. Thoughts, editing notes, and invisible details don\'t belong.' },
    ],
  },
};

// ── Module data ───────────────────────────────────────────────────────────────

const MODULES: ModuleDef[] = [
  {
    id: 'foundations', num: 1,
    title: 'Foundations', subtitle: 'Start here — the basics every screenwriter must know',
    color: '#7c3aed', icon: '✦',
    lessons: [
      { id: 'intro', title: 'Welcome to Screenwriting', tagline: 'What is a screenplay and how does it work?', readTime: '3 min' },
      { id: 'elements', title: 'The Six Script Elements', tagline: 'The building blocks of every screenplay', readTime: '3 min' },
    ],
  },
  {
    id: 'formatting', num: 2,
    title: 'Formatting', subtitle: 'Master the rules of professional screenplay format',
    color: '#3b82f6', icon: '⌘',
    lessons: [
      { id: 'scene-headings', title: 'Scene Headings', tagline: 'INT. LOCATION — TIME. Master the slugline.', readTime: '3 min' },
      { id: 'action', title: 'Action Lines', tagline: 'Write only what the camera can see', readTime: '3 min' },
      { id: 'character', title: 'Character Names', tagline: 'Introduce and name characters correctly', readTime: '2 min' },
      { id: 'dialogue', title: 'Dialogue', tagline: 'Every line reveals character or advances plot', readTime: '4 min' },
      { id: 'parenthetical', title: 'Parentheticals', tagline: 'Use them sparingly — let dialogue breathe', readTime: '2 min' },
      { id: 'transitions', title: 'Transitions', tagline: 'CUT TO:, FADE OUT., and when to use them', readTime: '2 min' },
    ],
  },
  {
    id: 'craft', num: 3,
    title: 'Story Craft', subtitle: 'Go beyond format — write stories that actually work',
    color: '#f59e0b', icon: '◈',
    lessons: [
      { id: 'structure',  title: 'Story Structure', tagline: 'Three acts, beat sheets, and the shape of a story', readTime: '5 min' },
      { id: 'beat-sheet', title: 'Beat Sheets',     tagline: 'Map your story before you write the first line', readTime: '4 min' },
      { id: 'tips',       title: 'Pro Tips',        tagline: 'Hard-won wisdom from working screenwriters', readTime: '4 min' },
    ],
  },
  {
    id: 'production', num: 4,
    title: 'Production Tools', subtitle: 'Plan the shoot before the cameras roll',
    color: '#06b6d4', icon: '◇',
    lessons: [
      { id: 'storyboard', title: 'Storyboards', tagline: 'Visualize every scene before you direct it', readTime: '3 min' },
      { id: 'budget',     title: 'Budgeting',   tagline: 'Track department spend, estimated vs actual', readTime: '4 min' },
    ],
  },
  {
    id: 'reference', num: 5,
    title: 'Quick Reference', subtitle: 'Everything at a glance when you need it fast',
    color: '#10b981', icon: '◎',
    lessons: [
      { id: 'cheatsheet', title: 'Cheat Sheet', tagline: 'Shortcuts, page counts, structure at a glance', readTime: '1 min' },
    ],
  },
  {
    id: 'interactive', num: 6,
    title: 'Interactive', subtitle: 'Put your knowledge to the test',
    color: '#ec4899', icon: '⚡',
    lessons: [
      { id: 'exercises', title: 'Writing Exercises', tagline: 'Practice with instant format feedback', readTime: 'Practice', proOnly: true },
      { id: 'ai-tutor', title: 'AI Writing Tutor', tagline: 'Your personal screenwriting coach', readTime: 'Chat', proOnly: true },
    ],
  },
];

// ── Static section content ────────────────────────────────────────────────────

const SECTIONS: Record<SectionId, React.ReactNode> = {
  'ai-tutor': null, // rendered separately
  exercises: null,  // rendered separately

  intro: (
    <>
      <SectionTitle>Welcome to Screenwriting</SectionTitle>
      <Body>Screenwriting is the art of writing scripts for film and television. Unlike novels or stage plays, screenplays follow a very specific format that every studio, director, and actor expects to see. This guide will teach you everything you need to know — from scratch.</Body>
      <Body>The good news: DraftRoom handles all the formatting automatically. Your only job is to tell the story.</Body>
      <Tip>A properly formatted screenplay page equals roughly one minute of screen time. A feature film is typically 90–120 pages.</Tip>
      <SubTitle>What is a Screenplay?</SubTitle>
      <Body>A screenplay is a blueprint for a film. It describes what we <em>see</em> and what we <em>hear</em> — nothing more. You cannot write what a character is thinking unless they say it aloud or we see it visually. Everything must be shown, not told.</Body>
      <ScriptExample lines={[
        { type: 'note', text: 'Every script starts with FADE IN:' },
        { type: 'transition', text: 'FADE IN:' },
        { type: 'note', text: 'Then a scene heading...' },
        { type: 'scene', text: 'INT. COFFEE SHOP - DAY' },
        { type: 'note', text: 'Then action describing what we see...' },
        { type: 'action', text: 'MAYA (30s, sharp eyes, never without a notebook) sits alone at a corner table. She stares at a blank page.' },
        { type: 'note', text: 'Then dialogue when a character speaks...' },
        { type: 'character', text: 'BARISTA' },
        { type: 'dialogue', text: 'Same order as yesterday?' },
        { type: 'character', text: 'MAYA' },
        { type: 'dialogue', text: 'Make it a double. Today I write the script.' },
      ]} />
      <SubTitle>The Golden Rule</SubTitle>
      <Body><strong>Write only what can be filmed.</strong> If a camera can't capture it, it doesn't belong on the page.</Body>
      <DoDont
        dos={['Write in present tense ("She walks in")', 'Keep action paragraphs short — 3 lines max', 'Describe only what the audience sees and hears', 'Use active, visual language']}
        donts={['Write in past tense ("She walked in")', 'Describe what characters are thinking', 'Write camera directions (leave that to the director)', 'Include novelistic descriptions']}
      />
      <SubTitle>Getting Started in DraftRoom</SubTitle>
      <Body>Use these keyboard shortcuts to switch between element types instantly:</Body>
      <div className="grid grid-cols-2 gap-2 my-4">
        {[{ key: '⌘1', label: 'Scene Heading' }, { key: '⌘2', label: 'Action' }, { key: '⌘3', label: 'Character' }, { key: '⌘4', label: 'Dialogue' }, { key: '⌘5', label: 'Parenthetical' }, { key: '⌘6', label: 'Transition' }].map(s => (
          <div key={s.key} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <KeyBadge>{s.key}</KeyBadge>
            <span className="text-sm text-foreground/80">{s.label}</span>
          </div>
        ))}
      </div>
      <Tip>Press <strong>Tab</strong> to cycle through element types, and <strong>Enter</strong> to create a new line below.</Tip>
    </>
  ),

  elements: (
    <>
      <SectionTitle>The Six Script Elements</SectionTitle>
      <Body>Every line in a screenplay belongs to one of six element types. Each is formatted differently and serves a specific purpose. DraftRoom automatically formats each one when you choose the type.</Body>
      <div className="space-y-3 my-6">
        {[
          { name: 'Scene Heading', color: '#7c3aed', desc: 'Tells us WHERE and WHEN we are. Always uppercase. Starts with INT. or EXT.', key: '⌘1' },
          { name: 'Action', color: '#3b82f6', desc: 'Describes what we SEE on screen. Present tense. Visual only.', key: '⌘2' },
          { name: 'Character', color: '#10b981', desc: 'The name of whoever is speaking. Always uppercase and centered.', key: '⌘3' },
          { name: 'Dialogue', color: '#f59e0b', desc: 'The words a character speaks. Centered in a narrow column.', key: '⌘4' },
          { name: 'Parenthetical', color: '#ec4899', desc: "A brief direction inside dialogue — tone, who they're speaking to.", key: '⌘5' },
          { name: 'Transition', color: '#6b7280', desc: 'How we move between scenes. CUT TO:, FADE TO:, SMASH CUT TO:', key: '⌘6' },
        ].map(el => (
          <div key={el.name} className="flex items-start gap-4 p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: el.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{el.name}</span>
                <KeyBadge>{el.key}</KeyBadge>
              </div>
              <p className="text-xs text-muted-foreground">{el.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Tip>You don't need to memorize all the formatting rules — DraftRoom applies them automatically when you set the element type.</Tip>
    </>
  ),

  'scene-headings': (
    <>
      <SectionTitle>Scene Headings (Sluglines)</SectionTitle>
      <Body>A scene heading — also called a <strong>slugline</strong> — opens every new scene. It tells the reader three things: whether we're inside or outside, where exactly we are, and what time of day it is.</Body>
      <div className="rounded-2xl p-5 my-5" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">Formula</p>
        <div className="flex items-center gap-2 flex-wrap">
          {['INT. or EXT.', '—', 'LOCATION', '—', 'TIME OF DAY'].map((part, i) => (
            <span key={i} className={`text-sm font-mono px-3 py-1.5 rounded-lg ${part === '—' ? 'text-muted-foreground' : 'font-bold'}`}
              style={part !== '—' ? { background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' } : {}}>
              {part}
            </span>
          ))}
        </div>
      </div>
      <SubTitle>INT. vs EXT.</SubTitle>
      <Body><strong>INT.</strong> means interior — inside a building, car, etc.</Body>
      <Body><strong>EXT.</strong> means exterior — outside.</Body>
      <Body>Use <strong>INT./EXT.</strong> when a character moves between inside and outside.</Body>
      <ScriptExample lines={[
        { type: 'note', text: 'Interior scene' },
        { type: 'scene', text: 'INT. HOSPITAL WAITING ROOM - NIGHT' },
        { type: 'action', text: 'Fluorescent lights flicker. A dozen anxious faces line plastic chairs.' },
        { type: 'note', text: 'Exterior scene' },
        { type: 'scene', text: 'EXT. CITY ROOFTOP - DAWN' },
        { type: 'action', text: 'The sun creeps above the skyline. DETECTIVE TORRES stubs out a cigarette.' },
        { type: 'note', text: 'Interior/Exterior' },
        { type: 'scene', text: 'INT./EXT. POLICE CAR - MOVING - DAY' },
        { type: 'action', text: 'Torres drives through heavy rain, eyes locked on the road.' },
      ]} />
      <SubTitle>Time of Day</SubTitle>
      <Body>Common options: <strong>DAY, NIGHT, MORNING, AFTERNOON, EVENING, DUSK, DAWN, CONTINUOUS, LATER, MOMENTS LATER</strong></Body>
      <Warning>Avoid specific clock times like "3:47 PM" in scene headings — they're too precise and break the visual language of the format.</Warning>
    </>
  ),

  action: (
    <>
      <SectionTitle>Action Lines</SectionTitle>
      <Body>Action lines describe what the audience sees on screen. They're the backbone of your visual storytelling. Every word must earn its place.</Body>
      <DoDont
        dos={['Write in present tense ("She opens the door")', 'Describe only what the camera can see', 'Keep paragraphs to 3 lines maximum', 'Use specific, visual nouns and verbs', 'Introduce characters with a brief physical note in CAPS']}
        donts={["Describe what characters think or feel internally", 'Write in past tense', 'Write camera directions (that\'s the director\'s job)', 'Write long, dense paragraphs', 'Use adverbs when a stronger verb will do']}
      />
      <ScriptExample lines={[
        { type: 'note', text: 'First appearance of a character — capitalize their name' },
        { type: 'scene', text: 'INT. BOXING GYM - EARLY MORNING' },
        { type: 'action', text: 'Empty. Silent. The ring glows under a single bare bulb.' },
        { type: 'action', text: 'DANNY MALONE (40s, ex-fighter, knuckles like cobblestones) wraps his hands. Slow. Methodical. Like he\'s done it ten thousand times.' },
        { type: 'note', text: 'Short paragraphs = faster read = more cinematic' },
        { type: 'action', text: 'He looks at his reflection in the cracked mirror.' },
        { type: 'action', text: 'Doesn\'t like what he sees.' },
      ]} />
      <Tip>Break your action into small paragraphs. A blank line on the page = a visual breath on screen. Dense text slows readers down; white space speeds them up.</Tip>
    </>
  ),

  character: (
    <>
      <SectionTitle>Character Names</SectionTitle>
      <Body>The Character element appears above any dialogue. It's always in ALL CAPS and centered on the page. The character's name on the page is the cue that dialogue follows.</Body>
      <ScriptExample lines={[
        { type: 'scene', text: 'INT. DINER - NIGHT' },
        { type: 'action', text: 'ELENA (20s, still in her hospital scrubs) slides into the booth across from her brother.' },
        { type: 'character', text: 'ELENA' },
        { type: 'dialogue', text: "I thought you left." },
        { type: 'character', text: 'MARCO' },
        { type: 'parenthetical', text: '(not looking up)' },
        { type: 'dialogue', text: "Tried to." },
      ]} />
      <SubTitle>Character Extensions</SubTitle>
      <div className="grid grid-cols-3 gap-3 my-4">
        {[{ ext: '(V.O.)', def: 'Voice Over — character narrates but is not present in the scene' }, { ext: "(O.S.)", def: 'Off Screen — character is nearby but not visible in frame' }, { ext: "(CONT'D)", def: 'Continued — character\'s dialogue carries across a page break' }].map(e => (
          <div key={e.ext} className="p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="font-mono text-sm font-bold text-violet-400 mb-2">{e.ext}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{e.def}</p>
          </div>
        ))}
      </div>
      <Tip>Only name characters who have dialogue or are significant to the action. Background characters should be described by function: BARTENDER, PEDESTRIAN #1, SECURITY GUARD.</Tip>
    </>
  ),

  dialogue: (
    <>
      <SectionTitle>Dialogue</SectionTitle>
      <Body>Dialogue is what a character says. It appears in a centered column, narrower than the action lines. Great screen dialogue sounds natural but is more compressed than real speech — every line does work.</Body>
      <SubTitle>The Rules of Good Screen Dialogue</SubTitle>
      <DoDont
        dos={['Make every line reveal character or advance plot', 'Read it aloud — if it feels awkward, fix it', 'Use interruptions, overlaps, and silences', 'Give each character a distinct voice', 'Use subtext — say one thing, mean another']}
        donts={['Write "on-the-nose" dialogue (characters saying exactly what they feel)', 'Use dialogue to dump exposition ("As you know, Bob...")', 'Let any character speak for more than 5 lines without interruption', 'Make all characters sound the same', 'Use dialogue to describe what we can already see on screen']}
      />
      <ScriptExample lines={[
        { type: 'note', text: 'On-the-nose (bad)' },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: "I am very angry at you because you betrayed my trust." },
        { type: 'note', text: 'Subtext (better)' },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: "The food's getting cold." },
        { type: 'character', text: 'DAVID' },
        { type: 'dialogue', text: "I said I was sorry." },
        { type: 'character', text: 'SARAH' },
        { type: 'dialogue', text: "I know you did." },
      ]} />
      <Warning>Avoid "maid and butler" dialogue — two characters explaining things to each other that they'd already know, just to fill in the audience. Find a more visual way to deliver exposition.</Warning>
    </>
  ),

  parenthetical: (
    <>
      <SectionTitle>Parentheticals</SectionTitle>
      <Body>A parenthetical is a brief direction that appears between the character name and the dialogue, or within dialogue. It tells the actor something specific about the delivery — who they're addressing, a physical action, or a tonal shift.</Body>
      <ScriptExample lines={[
        { type: 'character', text: 'DETECTIVE HAYES' },
        { type: 'parenthetical', text: '(to the suspect, quietly)' },
        { type: 'dialogue', text: "We found the bag." },
        { type: 'parenthetical', text: '(beat)' },
        { type: 'dialogue', text: "All of it." },
      ]} />
      <SubTitle>When to Use Them</SubTitle>
      <div className="space-y-2 my-4">
        {[
          { use: 'Addressing someone', ex: '(to MARCUS)' },
          { use: 'A specific action mid-speech', ex: '(picking up the phone)' },
          { use: 'Tonal shift not clear from dialogue', ex: '(genuinely surprised)' },
          { use: 'The word "beat" for a pause', ex: '(beat)' },
        ].map(r => (
          <div key={r.use} className="flex items-center gap-4 p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <span className="text-xs text-muted-foreground w-44 flex-shrink-0">{r.use}</span>
            <code className="text-xs text-violet-400 font-mono">{r.ex}</code>
          </div>
        ))}
      </div>
      <Warning>Use parentheticals sparingly. Overuse signals a writer who doesn't trust their dialogue. If you need a parenthetical on every line, rewrite the dialogue until it's self-explanatory.</Warning>
    </>
  ),

  transitions: (
    <>
      <SectionTitle>Transitions</SectionTitle>
      <Body>Transitions tell us how we move from one scene to the next. In modern screenwriting, CUT TO: between scenes is often omitted — the scene heading itself implies a cut. But certain transitions carry meaning and should be used intentionally.</Body>
      <div className="space-y-3 my-5">
        {[
          { t: 'CUT TO:', desc: 'Immediate cut — standard. Often omitted in modern scripts.' },
          { t: 'SMASH CUT TO:', desc: 'Sudden, jarring cut — used for shock or contrast.' },
          { t: 'MATCH CUT TO:', desc: 'A visual match between two shots across scenes.' },
          { t: 'FADE TO:', desc: 'A slow transition, often indicating time has passed.' },
          { t: 'DISSOLVE TO:', desc: 'One image fades into the next — passage of time or dreamy quality.' },
          { t: 'FADE OUT.', desc: 'End of the film (or end of a major act).' },
          { t: 'FADE IN:', desc: 'First line of every screenplay.' },
        ].map(t => (
          <div key={t.t} className="flex gap-4 items-start p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <code className="text-sm font-mono font-bold text-violet-400 w-40 flex-shrink-0">{t.t}</code>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>
      <Tip>Modern screenplays rarely use CUT TO: between scenes — the scene heading itself signals the cut. Save transitions for moments where the specific type of cut carries meaning.</Tip>
    </>
  ),

  structure: (
    <>
      <SectionTitle>Story Structure</SectionTitle>
      <Body>Most successful films follow a three-act structure. This isn't a rigid rule — it's a framework that helps you give your story a satisfying shape.</Body>
      <div className="grid grid-cols-3 gap-4 my-6">
        {[
          { act: 'Act I', label: 'Setup', pages: 'pp. 1–25', color: '#7c3aed', bullets: ['Introduce the world and protagonist', 'Establish the status quo', 'Inciting Incident — something disrupts the normal world', 'End with the protagonist committing to a goal'] },
          { act: 'Act II', label: 'Confrontation', pages: 'pp. 25–85', color: '#f59e0b', bullets: ['Protagonist pursues their goal against mounting obstacles', 'Midpoint shifts the story\'s direction (pp. ~55)', 'Stakes keep rising — things get worse', 'All is Lost moment — darkest point before the finale'] },
          { act: 'Act III', label: 'Resolution', pages: 'pp. 85–110', color: '#3b82f6', bullets: ['Protagonist finds new resolve', 'Climax — the final confrontation', 'Resolution — the new normal', 'Theme is paid off visually and emotionally'] },
        ].map(a => (
          <div key={a.act} className="rounded-2xl p-4" style={{ background: 'hsl(var(--card))', border: `1px solid ${a.color}30`, borderTop: `3px solid ${a.color}` }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: a.color }}>{a.act}</p>
            <p className="text-base font-bold text-foreground mb-0.5">{a.label}</p>
            <p className="text-[10px] text-muted-foreground mb-3">{a.pages}</p>
            <ul className="space-y-1.5">
              {a.bullets.map(b => <li key={b} className="text-[11px] text-muted-foreground flex gap-1.5"><span style={{ color: a.color }}>·</span>{b}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <SubTitle>Key Story Beats</SubTitle>
      <div className="space-y-2 my-4">
        {[
          { page: '~10', name: 'Inciting Incident', desc: 'The event that kicks off the story and disrupts the protagonist\'s world.' },
          { page: '~25', name: 'End of Act I', desc: 'The protagonist commits to a goal. No turning back.' },
          { page: '~55', name: 'Midpoint', desc: 'A major shift — new information or event that changes the direction of the story.' },
          { page: '~75', name: 'All Is Lost', desc: 'The lowest point. Everything the protagonist has worked for seems lost.' },
          { page: '~85', name: 'Dark Night of the Soul', desc: 'The protagonist rethinks everything before finding the strength to continue.' },
          { page: '~90', name: 'Climax', desc: 'The final confrontation. The protagonist faces their ultimate challenge.' },
          { page: '~110', name: 'Resolution', desc: 'The new world. Show how things have changed.' },
        ].map(b => (
          <div key={b.name} className="flex gap-4 items-start p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <span className="text-[11px] font-mono font-bold text-violet-400 w-10 flex-shrink-0 pt-0.5">p.{b.page}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <Tip>Use DraftRoom's Beat Sheet tab to map out your story beats before you start writing. The AI can generate a beat sheet from your script too.</Tip>
    </>
  ),

  'beat-sheet': (
    <>
      <SectionTitle>Beat Sheets</SectionTitle>
      <Body>A beat sheet is a one-page outline of every major story beat in your screenplay, plotted against page numbers. It's the difference between writing into the dark and writing with a map. Use it to find structural problems <em>before</em> you've spent three months on a draft that doesn't work.</Body>
      <Body>Open the <strong>Beat Sheet</strong> tab in DraftRoom to see your story laid out as a timeline. Drop in beats by page, color-code them, and link each beat to the scene it represents.</Body>
      <SubTitle>The Save the Cat Beats</SubTitle>
      <Body>Blake Snyder's beat sheet is the most widely used template in modern screenwriting. Most studio films hit these beats within a few pages of where they're "supposed" to land.</Body>
      <div className="space-y-2 my-4">
        {[
          { page: 'p.1',   name: 'Opening Image',         desc: 'A snapshot of the protagonist\'s world before the story begins.' },
          { page: 'p.5',   name: 'Theme Stated',          desc: 'Someone says the lesson the hero will learn — usually unaware.' },
          { page: 'p.10',  name: 'Catalyst',              desc: 'The inciting incident. Life will never be the same.' },
          { page: 'p.12',  name: 'Debate',                desc: 'Hesitation. Should the hero accept the call?' },
          { page: 'p.25',  name: 'Break Into Two',        desc: 'The hero commits. New world, new rules.' },
          { page: 'p.30',  name: 'Fun and Games',         desc: 'The promise of the premise. The trailer moments.' },
          { page: 'p.55',  name: 'Midpoint',              desc: 'False victory or false defeat. Stakes raise.' },
          { page: 'p.75',  name: 'All Is Lost',           desc: 'Everything collapses. Often a "whiff of death."' },
          { page: 'p.85',  name: 'Dark Night of the Soul', desc: 'The hero processes the loss and finds new resolve.' },
          { page: 'p.85',  name: 'Break Into Three',      desc: 'A new plan. Synthesis of everything learned.' },
          { page: 'p.110', name: 'Final Image',           desc: 'A snapshot that mirrors the opening — proof of change.' },
        ].map(b => (
          <div key={b.name} className="flex gap-4 items-start p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <span className="text-[11px] font-mono font-bold text-violet-400 w-12 flex-shrink-0 pt-0.5">{b.page}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{b.name}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <SubTitle>Working in DraftRoom</SubTitle>
      <Body>The Beat Sheet view scales the act zones to your script's actual page count, so the 25/50/25 split is honest whether you're writing a 12-page short or a 130-page feature. Hit <strong>Generate from Script</strong> to have the AI read your draft and propose beats — useful when reverse-engineering structure from a finished pass.</Body>
      <DoDont
        dos={[
          'Outline before you write — fix structure on a single page, not in 90',
          'Plot beats as page targets, not exact pages — they\'re landing zones',
          'Color-code beats by storyline (A-plot, B-plot, theme) to see weaving',
          'Link each beat to the scene that pays it off, so the timeline stays honest',
          'Revise the beat sheet as the script evolves — they\'re a living document',
        ]}
        donts={[
          'Treat Save the Cat as a checklist — it\'s a tool, not a formula',
          'Write 80 beats. If you can\'t outline the story in ~15 beats, the spine isn\'t clear yet',
          'Skip the beat sheet because "it\'ll lock me in" — outlines free you to take risks',
          'Force every story into a 110-page shape. Indies, shorts, and TV all bend the math',
        ]}
      />
      <Tip>Stuck on Act II? Almost always the beat sheet is the problem, not the writing. If your Midpoint and All-Is-Lost don't feel like real reversals on paper, no amount of dialogue polish will fix the saggy middle.</Tip>
    </>
  ),

  storyboard: (
    <>
      <SectionTitle>Storyboards</SectionTitle>
      <Body>A storyboard is a visual outline of your film, scene by scene. Even if you're not directing, building one teaches you how the words on the page will translate to images on screen — and exposes scenes that <em>read</em> well but won't <em>shoot</em> well.</Body>
      <Body>DraftRoom's <strong>Storyboard</strong> tab auto-generates one tile per scene heading. Drop in a reference image — a photo, a movie still, a Pinterest shot — and the scene now has a visual anchor.</Body>
      <SubTitle>Why Writers Use Storyboards</SubTitle>
      <div className="space-y-3 my-5">
        {[
          { title: 'Find unfilmable scenes', desc: <>A scene that's nothing but two people talking on a couch for six pages reads fine. It also looks dead on screen. The storyboard makes that obvious.</> },
          { title: 'Mood boards by scene',   desc: <>Each scene gets a vibe — the lighting of <em>Blade Runner</em>, the kitchen warmth of <em>Pixar</em>. Producers and directors read a script differently when they can see what you saw.</> },
          { title: 'Pitch material',         desc: <>A 10-tile storyboard works in a pitch room when 110 pages of script don't. Showrunners and producers think visually.</> },
          { title: 'Block by scene',         desc: <>See the rhythm of your film — interiors vs exteriors, day vs night, intimate vs scaled. Imbalance shows up immediately.</> },
        ].map(t => (
          <div key={t.title} className="p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="text-sm font-semibold text-foreground mb-1">{t.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
          </div>
        ))}
      </div>
      <SubTitle>Working in DraftRoom</SubTitle>
      <Body>Every scene heading in your script becomes a storyboard tile automatically. Hover any tile to upload a reference image — JPG, PNG, screenshot, anything. The tile keeps your scene heading as the caption, so you always know what frame goes with what page.</Body>
      <DoDont
        dos={[
          'Use real movie stills as references — directors will recognize what you mean',
          'Build the storyboard scene-by-scene as you write, not all at once at the end',
          'Pull lighting and color references — "warm tungsten" or "cold fluorescent" tells a DP everything',
          'Show the storyboard to producers in pitches — it works',
        ]}
        donts={[
          'Try to draw shot-by-shot storyboards. That\'s a storyboard artist\'s job, not yours',
          'Use stock photos that fight the tone — generic happy-people imagery deflates a thriller',
          'Ignore scenes you "don\'t have a vibe for" — those are the scenes that need rewriting most',
        ]}
      />
      <Tip>If you can't find any reference image that matches a scene, the scene probably isn't visual enough. Rewrite it for the camera before the camera tells you the same thing the hard way.</Tip>
    </>
  ),

  budget: (
    <>
      <SectionTitle>Budgeting</SectionTitle>
      <Body>Every screenplay is also a number. Whether you're writing a $5K student short or a $100M feature, the script's <em>shape</em> determines what it costs — and writers who understand budget write more producible scripts.</Body>
      <Body>DraftRoom's <strong>Budget</strong> tab tracks line items by department, with estimated vs. actual side-by-side. Use it to plan a shoot, or to pressure-test whether the script you've written can actually be made for the money you have.</Body>
      <SubTitle>The Departments</SubTitle>
      <div className="space-y-3 my-5">
        {[
          { dept: 'Above the Line', icon: '🎬', desc: 'Writer, director, producers, lead cast. Often 30–50% of an indie budget.' },
          { dept: 'Camera',         icon: '📷', desc: 'Camera package, lenses, DP, AC. Bigger format = bigger number.' },
          { dept: 'Art Direction',  icon: '🎨', desc: 'Sets, props, dressing. Period pieces and sci-fi blow this up fastest.' },
          { dept: 'Costume',        icon: '👗', desc: 'Wardrobe, fittings, alterations. Multiplies with cast size.' },
          { dept: 'Sound',          icon: '🎙️', desc: 'Production sound, boom op. Dialogue-heavy scripts demand more.' },
          { dept: 'Lighting',       icon: '💡', desc: 'Gaffer, electric, lighting package. Night exteriors are expensive.' },
          { dept: 'Post Production', icon: '🖥️', desc: 'Edit, color, sound mix, music, VFX. Often underestimated.' },
        ].map(d => (
          <div key={d.dept} className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <span className="text-xl flex-shrink-0">{d.icon}</span>
            <div>
              <p className="text-sm font-semibold text-foreground">{d.dept}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <SubTitle>Estimated vs. Actual</SubTitle>
      <Body>Every line tracks both numbers. <strong>Estimated</strong> is what you budgeted; <strong>Actual</strong> is what you spent. Variance is the gap. The Budget view colors lines green when you're under, amber as you approach the cap, and red when you've gone over — so you see problems while there's still time to fix them.</Body>
      <SubTitle>Writing Cheaper Scripts</SubTitle>
      <DoDont
        dos={[
          'Limit locations — every new location is a half-day of move time',
          'Write contained scenes you can shoot in a single take if needed',
          'Use day for night sparingly — VFX is cheaper than relighting',
          'Keep speaking-role count tight; SAG rates are per-role-per-day',
          'Default to interiors. Weather, sun, traffic, and noise are exterior costs',
        ]}
        donts={[
          'Write crowd scenes you don\'t need — extras add up fast',
          'Stage car chases you can\'t afford. Stunt drivers, picture cars, road permits',
          'Set scenes at golden hour without a plan — you get 20 minutes a day',
          'Open with a $1M sequence on page 1. Save the splash for the end of Act 2',
          'Underestimate post — color, mix, and music are real numbers, not free',
        ]}
      />
      <Warning>The cheapest script is the one that's been to production. If you've never been on set, ask a line producer to read your script before you finalize it — they'll spot $50K of saveable cost in 20 minutes.</Warning>
      <Tip>The Budget view is for tracking too — once you're shooting, log actuals daily. Variance compounds; catching a department 10% over on day 3 lets you recover by day 18.</Tip>
    </>
  ),

  tips: (
    <>
      <SectionTitle>Pro Tips</SectionTitle>
      <Body>Hard-won advice from working screenwriters.</Body>
      <SubTitle>Write Fast, Edit Later</SubTitle>
      <Body>Your first draft is supposed to be bad. Get the story out. Perfectionism is the enemy of a finished script. Give yourself permission to write terrible scenes — you can fix them in draft two.</Body>
      <SubTitle>Read Scripts, Watch Films</SubTitle>
      <Body>The best way to learn screenwriting is to read produced screenplays while watching the film. See how the writer's words became images. Sites like IMSDB and The Script Lab have thousands of free scripts.</Body>
      <div className="grid grid-cols-2 gap-4 my-5">
        {[
          { title: 'Page Count', tip: 'Aim for 90–120 pages. Under 80 is too short; over 130 and readers start getting skeptical.' },
          { title: 'Scene Length', tip: 'Most scenes are 1–3 pages. If a scene runs 5+ pages, ask: what can I cut?' },
          { title: 'White Space', tip: 'More white space on the page means a faster, more cinematic read. Dense pages slow the read.' },
          { title: 'Name Characters', tip: 'Only name characters who have dialogue or significant action. Others are "BARTENDER" or "PEDESTRIAN."' },
          { title: 'Present Tense', tip: 'Always write in present tense. "She opens the door" — never "She opened the door."' },
          { title: 'Scene Goals', tip: 'Every scene needs someone who wants something. No want = no scene.' },
        ].map(t => (
          <div key={t.title} className="p-4 rounded-2xl" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="text-sm font-semibold text-foreground mb-1">{t.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.tip}</p>
          </div>
        ))}
      </div>
      <SubTitle>Use the AI Wisely</SubTitle>
      <Body>DraftRoom's AI assistant is like having a script consultant in your pocket. Use it to:</Body>
      <ul className="space-y-1.5 my-3">
        {['Get feedback on pacing — "Where does the script drag?"', 'Punch up dialogue — "Which exchange feels the weakest?"', 'Check story structure — "Does my midpoint land on the right page?"', 'Generate beat sheets to plan before you write', 'Analyze character arcs and motivation'].map(item => (
          <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="text-violet-400 mt-0.5">✨</span>{item}</li>
        ))}
      </ul>
    </>
  ),

  cheatsheet: (
    <>
      <SectionTitle>Quick Reference</SectionTitle>
      <Body>Everything you need at a glance.</Body>
      <SubTitle>Element Shortcuts</SubTitle>
      <div className="grid grid-cols-2 gap-2 my-4">
        {[
          { key: '⌘1', el: 'Scene Heading', format: 'INT./EXT. LOCATION - TIME' },
          { key: '⌘2', el: 'Action', format: 'Present tense, visual only' },
          { key: '⌘3', el: 'Character', format: 'CHARACTER NAME (ext.)' },
          { key: '⌘4', el: 'Dialogue', format: 'What the character says' },
          { key: '⌘5', el: 'Parenthetical', format: '(brief direction)' },
          { key: '⌘6', el: 'Transition', format: 'CUT TO: / FADE OUT.' },
          { key: 'Tab', el: 'Cycle types', format: 'Rotate through elements' },
          { key: '↵', el: 'New line', format: 'Add element below' },
        ].map(s => (
          <div key={s.key} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <KeyBadge>{s.key}</KeyBadge>
            <div><p className="text-xs font-semibold text-foreground">{s.el}</p><p className="text-[10px] text-muted-foreground">{s.format}</p></div>
          </div>
        ))}
      </div>
      <SubTitle>Page Count Guide</SubTitle>
      <div className="grid grid-cols-2 gap-3 my-4">
        {[
          { type: 'Short Film', pages: '5–40 pages' },
          { type: 'Feature Film', pages: '90–120 pages' },
          { type: 'TV Pilot (30 min)', pages: '22–35 pages' },
          { type: 'TV Pilot (60 min)', pages: '45–65 pages' },
          { type: '1 page =', pages: '~1 minute of screen time' },
          { type: 'Average scene =', pages: '1–3 pages' },
        ].map(g => (
          <div key={g.type} className="flex justify-between items-center p-3 rounded-xl" style={{ background: 'hsl(var(--secondary))' }}>
            <span className="text-xs text-muted-foreground">{g.type}</span>
            <span className="text-xs font-semibold text-foreground">{g.pages}</span>
          </div>
        ))}
      </div>
      <SubTitle>Structure at a Glance</SubTitle>
      <div className="rounded-2xl overflow-hidden my-4" style={{ border: '1px solid hsl(var(--border))' }}>
        {[
          { page: 'p.1', name: 'FADE IN:', color: '#7c3aed' },
          { page: 'p.10', name: 'Inciting Incident', color: '#7c3aed' },
          { page: 'p.25', name: 'End of Act I', color: '#7c3aed' },
          { page: 'p.55', name: 'Midpoint', color: '#f59e0b' },
          { page: 'p.75', name: 'All Is Lost', color: '#f59e0b' },
          { page: 'p.85', name: 'End of Act II', color: '#f59e0b' },
          { page: 'p.90', name: 'Climax', color: '#3b82f6' },
          { page: 'p.110', name: 'FADE OUT.', color: '#3b82f6' },
        ].map((b, i) => (
          <div key={b.name} className="flex items-center gap-4 px-4 py-2.5" style={{ background: i % 2 === 0 ? 'hsl(var(--card))' : 'transparent' }}>
            <span className="text-[11px] font-mono text-muted-foreground w-10">{b.page}</span>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: b.color }} />
            <span className="text-sm text-foreground">{b.name}</span>
          </div>
        ))}
      </div>
    </>
  ),
};

// ── Course platform helpers ───────────────────────────────────────────────────

// Keep NAV for legacy use in helper logic (not rendered as UI)
const NAV: NavSection[] = [
  { id: 'intro',          label: 'Getting Started',   icon: <StarIcon className="w-3.5 h-3.5" /> },
  { id: 'elements',       label: 'Script Elements',   icon: <FileTextIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'scene-headings', label: 'Scene Headings',    icon: <ZapIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'action',         label: 'Action Lines',      icon: <ArrowRightIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'character',      label: 'Character Names',   icon: <UserIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'dialogue',       label: 'Dialogue',          icon: <MessageSquareIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'parenthetical',  label: 'Parentheticals',    icon: <BookOpenIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'transitions',    label: 'Transitions',       icon: <ChevronRightIcon className="w-3.5 h-3.5" />, group: 'Formatting' },
  { id: 'structure',      label: 'Story Structure',   icon: <BookOpenIcon className="w-3.5 h-3.5" />, group: 'Story' },
  { id: 'beat-sheet',     label: 'Beat Sheets',       icon: <CheckCircleIcon className="w-3.5 h-3.5" />, group: 'Story' },
  { id: 'tips',           label: 'Pro Tips',          icon: <StarIcon className="w-3.5 h-3.5" />, group: 'Story' },
  { id: 'storyboard',     label: 'Storyboards',       icon: <FileTextIcon className="w-3.5 h-3.5" />, group: 'Production' },
  { id: 'budget',         label: 'Budgeting',         icon: <TrophyIcon className="w-3.5 h-3.5" />, group: 'Production' },
  { id: 'cheatsheet',     label: 'Quick Reference',   icon: <ZapIcon className="w-3.5 h-3.5" /> },
  { id: 'exercises',      label: 'Exercises',         icon: <PenIcon className="w-3.5 h-3.5" />, proOnly: true, group: 'Interactive' },
  { id: 'ai-tutor',       label: 'AI Tutor',          icon: <SparklesIcon className="w-3.5 h-3.5" />, proOnly: true, group: 'Interactive' },
];

// Flat ordered lesson list (mirrors NAV order)
const ALL_LESSONS: LessonMeta[] = MODULES.flatMap(m => m.lessons);

function findLessonModule(id: SectionId): ModuleDef | undefined {
  return MODULES.find(m => m.lessons.some(l => l.id === id));
}

function getModuleProgress(mod: ModuleDef, progress: Set<SectionId>): { completed: number; total: number } {
  return {
    completed: mod.lessons.filter(l => progress.has(l.id)).length,
    total: mod.lessons.length,
  };
}

function getNextLesson(id: SectionId): LessonMeta | null {
  const idx = ALL_LESSONS.findIndex(l => l.id === id);
  return idx >= 0 && idx < ALL_LESSONS.length - 1 ? ALL_LESSONS[idx + 1] : null;
}

function getPrevLesson(id: SectionId): LessonMeta | null {
  const idx = ALL_LESSONS.findIndex(l => l.id === id);
  return idx > 0 ? ALL_LESSONS[idx - 1] : null;
}

// ── Progress ring (SVG) ───────────────────────────────────────────────────────

function ProgressRing({ pct, color = '#7c3aed', size = 64 }: { pct: number; color?: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ── Lesson card ───────────────────────────────────────────────────────────────

interface LessonCardProps {
  lesson: LessonMeta;
  lessonNum: number;
  moduleColor: string;
  isComplete: boolean;
  isCurrent: boolean;
  isNextUp: boolean;
  pro: boolean;
  onClick: () => void;
}

function LessonCard({ lesson, lessonNum, moduleColor, isComplete, isCurrent, isNextUp, pro, onClick }: LessonCardProps) {
  const locked = lesson.proOnly && !pro;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={locked ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16,
        background: 'hsl(var(--card))',
        border: isCurrent
          ? `1px solid ${moduleColor}`
          : hovered
            ? '1px solid hsl(var(--border) / 0.8)'
            : '1px solid hsl(var(--border))',
        borderLeft: `3px solid ${moduleColor}`,
        cursor: locked ? 'default' : 'pointer',
        transform: hovered && !locked ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
        boxShadow: isCurrent ? `0 0 0 1px ${moduleColor}40` : hovered && !locked ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
        textAlign: 'left',
        padding: '14px 16px',
        width: '100%',
        opacity: locked ? 0.65 : 1,
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Lesson number badge */}
          <span
            className="text-[10px] font-bold rounded-md px-1.5 py-0.5 flex-shrink-0"
            style={{ background: `${moduleColor}18`, color: moduleColor }}
          >
            {String(lessonNum).padStart(2, '0')}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">{lesson.title}</span>
        </div>
        {/* Status icon */}
        <span className="flex-shrink-0">
          {locked && <LockIcon className="w-3.5 h-3.5 text-muted-foreground/50" />}
          {!locked && isComplete && (
            <span className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center inline-flex">
              <CheckIcon className="w-3 h-3 text-emerald-400" />
            </span>
          )}
          {!locked && !isComplete && isNextUp && (
            <span className="w-5 h-5 rounded-full flex items-center justify-center inline-flex" style={{ background: `${moduleColor}20` }}>
              <ArrowRightIcon className="w-3 h-3" style={{ color: moduleColor }} />
            </span>
          )}
        </span>
      </div>
      {/* Bottom row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex-1 truncate">{lesson.tagline}</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--muted-foreground))' }}
        >
          {lesson.readTime}
        </span>
        {lesson.proOnly && pro && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>PRO</span>
        )}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WritingGuide() {
  const [view, setView] = useState<'curriculum' | 'lesson'>('curriculum');
  const [activeLesson, setActiveLesson] = useState<SectionId>('intro');
  const [progress, setProgress] = useState<Set<SectionId>>(loadProgress);
  const plan = getPlan();
  const pro = isPro(plan);
  const contentRef = useRef<HTMLDivElement>(null);

  const markDone = useCallback((id: SectionId) => {
    setProgress(prev => {
      const next = new Set(prev);
      next.add(id);
      saveProgress(next);
      return next;
    });
  }, []);

  // Auto-mark complete after 30s in lesson view
  useEffect(() => {
    if (view !== 'lesson') return;
    const t = setTimeout(() => markDone(activeLesson), 30000);
    return () => clearTimeout(t);
  }, [activeLesson, view, markDone]);

  // Progress stats
  const totalLessons = ALL_LESSONS.length;
  const completedLessons = ALL_LESSONS.filter(l => progress.has(l.id)).length;
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Find the last visited lesson for "Continue" CTA
  const lastLesson = ALL_LESSONS.find(l => l.id === activeLesson) ?? ALL_LESSONS[0];

  // First incomplete lesson (next up)
  const nextUpLesson = ALL_LESSONS.find(l => !progress.has(l.id));

  function openLesson(id: SectionId) {
    setActiveLesson(id);
    setView('lesson');
    contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
  }

  function goToCurriculum() {
    setView('curriculum');
  }

  const activeMod = findLessonModule(activeLesson);
  const activeLessonMeta = ALL_LESSONS.find(l => l.id === activeLesson);
  const modLessons = activeMod?.lessons ?? [];
  const lessonIndexInMod = modLessons.findIndex(l => l.id === activeLesson);
  const lessonProgressPct = modLessons.length > 0 ? ((lessonIndexInMod + 1) / modLessons.length) * 100 : 0;

  const prevLesson = getPrevLesson(activeLesson);
  const nextLesson = getNextLesson(activeLesson);
  const isDone = progress.has(activeLesson);
  const extras = SECTION_EXTRAS[activeLesson];

  // ── Curriculum view ─────────────────────────────────────────────────────────
  if (view === 'curriculum') {
    return (
      <div
        ref={contentRef}
        className="flex flex-col h-full overflow-y-auto font-geist"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* Hero */}
        <div className="flex justify-center px-6 pt-8 pb-6">
          <div
            className="w-full rounded-3xl p-8 relative overflow-hidden"
            style={{
              maxWidth: 900,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.12) 0%, rgba(59,130,246,0.06) 100%)',
              border: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            {/* Decorative background glow */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
            />
            <div className="relative flex items-start justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400 px-2.5 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    Screenwriting Masterclass
                  </span>
                </div>
                <h1 className="text-2xl font-black text-foreground mb-2 leading-tight">
                  Learn to write screenplays<br />
                  <span style={{ color: '#a78bfa' }}>the right way.</span>
                </h1>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed max-w-md">
                  Master screenplay format, structure, and craft — at your own pace. From blank page to professional script.
                </p>
                {/* Progress summary */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{completedLessons}</span> of <span className="font-semibold text-foreground">{totalLessons}</span> lessons complete
                  </span>
                  <div className="flex-1 max-w-xs h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--secondary))' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${overallPct}%`, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }}
                    />
                  </div>
                  <span className="text-xs font-bold text-violet-400">{overallPct}%</span>
                </div>
                {/* Continue CTA */}
                <button
                  onClick={() => openLesson(nextUpLesson?.id ?? lastLesson.id)}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}
                >
                  {completedLessons === 0 ? 'Start Learning' : 'Continue Learning'}
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
                {completedLessons > 0 && nextUpLesson && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Up next: <span className="text-foreground/70">{nextUpLesson.title}</span>
                  </p>
                )}
              </div>
              {/* Progress ring */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="relative">
                  <ProgressRing pct={overallPct} color="#7c3aed" size={72} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-foreground">{overallPct}%</span>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">complete</span>
              </div>
            </div>
          </div>
        </div>

        {/* Module sections */}
        <div className="flex flex-col gap-8 px-6 pb-10 items-center">
          {MODULES.map(mod => {
            const { completed, total } = getModuleProgress(mod, progress);
            const modPct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div key={mod.id} className="w-full" style={{ maxWidth: 900 }}>
                {/* Module header */}
                <div className="relative flex items-start gap-5 mb-5 px-1">
                  {/* Big decorative module number */}
                  <div
                    className="absolute left-0 top-0 select-none pointer-events-none"
                    style={{
                      fontSize: 72,
                      fontWeight: 900,
                      lineHeight: 1,
                      opacity: 0.06,
                      color: mod.color,
                      letterSpacing: '-4px',
                    }}
                  >
                    {String(mod.num).padStart(2, '0')}
                  </div>
                  {/* Icon + title */}
                  <div className="flex items-center gap-3 relative z-10 ml-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 font-bold"
                      style={{ background: `${mod.color}18`, border: `1px solid ${mod.color}30`, color: mod.color }}
                    >
                      {mod.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-black text-foreground">
                          Module {mod.num}: {mod.title}
                        </h2>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${mod.color}15`, color: mod.color }}
                        >
                          {completed}/{total}
                        </span>
                        {modPct === 100 && (
                          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                            <CheckIcon className="w-3 h-3" /> Complete
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{mod.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Lesson cards grid */}
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}
                >
                  {mod.lessons.map((lesson, lIdx) => {
                    // Global lesson index for "next up" logic
                    const globalIdx = ALL_LESSONS.findIndex(l => l.id === lesson.id);
                    const nextUpGlobal = ALL_LESSONS.findIndex(l => !progress.has(l.id));
                    return (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        lessonNum={lIdx + 1}
                        moduleColor={mod.color}
                        isComplete={progress.has(lesson.id)}
                        isCurrent={activeLesson === lesson.id}
                        isNextUp={globalIdx === nextUpGlobal}
                        pro={pro}
                        onClick={() => openLesson(lesson.id)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Lesson view ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden font-geist" style={{ background: 'hsl(var(--background))' }}>

      {/* Lesson header */}
      <div
        className="flex-shrink-0 flex items-center gap-4 px-4 no-print"
        style={{
          height: 52,
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
        }}
      >
        {/* Back button */}
        <button
          onClick={goToCurriculum}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        >
          <ArrowRightIcon className="w-3.5 h-3.5 rotate-180" />
          Course
        </button>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs flex-1 min-w-0">
          <span className="text-muted-foreground truncate hidden sm:block">
            Module {activeMod?.num}: {activeMod?.title}
          </span>
          <ChevronRightIcon className="w-3 h-3 text-muted-foreground flex-shrink-0 hidden sm:block" />
          <span className="font-semibold text-foreground truncate">{activeLessonMeta?.title}</span>
        </div>

        {/* Lesson nav — prev/next */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            {lessonIndexInMod + 1} / {modLessons.length}
          </span>
          <button
            onClick={() => prevLesson && openLesson(prevLesson.id)}
            disabled={!prevLesson}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
          >
            <ArrowRightIcon className="w-3 h-3 rotate-180" />
          </button>
          <button
            onClick={() => nextLesson && openLesson(nextLesson.id)}
            disabled={!nextLesson}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
          >
            <ArrowRightIcon className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Module progress bar */}
      <div className="flex-shrink-0 h-0.5 w-full" style={{ background: 'hsl(var(--border))' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${lessonProgressPct}%`, background: activeMod?.color ?? '#7c3aed' }}
        />
      </div>

      {/* Lesson body */}
      <div
        ref={contentRef}
        className="flex-1 overflow-y-auto"
        style={{ background: 'hsl(var(--background))' }}
      >
        {/* AI Tutor: full-screen chat */}
        {activeLesson === 'ai-tutor' && (
          <div className="flex flex-col h-full">
            <div className="px-6 py-4 border-b border-border flex items-center gap-3" style={{ background: 'hsl(var(--card))' }}>
              <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Writing Tutor</p>
                <p className="text-[11px] text-muted-foreground">Your personal screenwriting coach — ask anything</p>
              </div>
              <span className="ml-auto text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>PRO</span>
            </div>
            <div className="flex-1 overflow-hidden">
              {pro ? <AIChatPanel /> : <ProGate feature="AI Writing Tutor" />}
            </div>
          </div>
        )}

        {/* Exercises */}
        {activeLesson === 'exercises' && (
          <div className="max-w-2xl mx-auto px-8 py-8">
            <ExercisesSection pro={pro} />
          </div>
        )}

        {/* Standard lesson content */}
        {activeLesson !== 'ai-tutor' && activeLesson !== 'exercises' && (
          <div className="max-w-2xl mx-auto px-8 py-10">
            {SECTIONS[activeLesson]}

            {/* Interactive extras (Pro) */}
            {extras && (
              <div className="mt-8 pt-6 border-t border-border">
                <div className="flex items-center gap-2 mb-4">
                  <SparklesIcon className="w-4 h-4 text-violet-400" />
                  <span className="text-sm font-semibold text-foreground">Practice &amp; Test Yourself</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>PRO</span>
                </div>
                {!pro ? <ProGate feature="Interactive exercises and quizzes" /> : (
                  <>
                    {extras.exercise && (
                      <TryItBox prompt={extras.exercise.description} placeholder={extras.exercise.placeholder} evaluate={extras.exercise.evaluate} />
                    )}
                    {extras.quiz && <QuizCard questions={extras.quiz} />}
                  </>
                )}
              </div>
            )}

            {/* Mark complete / footer */}
            <div className="mt-10 pt-6 border-t border-border">
              {!isDone ? (
                <button
                  onClick={() => markDone(activeLesson)}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}
                >
                  Mark as Complete
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <CheckIcon className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">Completed</span>
                  </div>
                  {nextLesson && (
                    <button
                      onClick={() => openLesson(nextLesson.id)}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff' }}
                    >
                      Next Lesson
                      <ArrowRightIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Prev / Next navigation links */}
              <div className="flex items-center justify-between mt-4 gap-3">
                {prevLesson ? (
                  <button
                    onClick={() => openLesson(prevLesson.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowRightIcon className="w-3.5 h-3.5 rotate-180" />
                    <span className="truncate max-w-[180px]">{prevLesson.title}</span>
                  </button>
                ) : <div />}
                {nextLesson && !isDone ? (
                  <button
                    onClick={() => openLesson(nextLesson.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span className="truncate max-w-[180px]">{nextLesson.title}</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                ) : <div />}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
