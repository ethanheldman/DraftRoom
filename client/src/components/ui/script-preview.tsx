import { useEffect, useRef, useState } from 'react';

const LINES = [
  { type: 'transition',    text: 'FADE IN:' },
  { type: 'scene',         text: 'INT. CAFÉ — NIGHT' },
  { type: 'action',        text: 'Rain streaks the windows. MAYA, 30s, sharp eyes, sits alone at a corner table nursing an espresso.' },
  { type: 'character',     text: 'MAYA' },
  { type: 'dialogue',      text: "You ever get the feeling you've already written this scene before?" },
  { type: 'action',        text: 'She turns the cup in her hands. The café is empty except for the BARTENDER who polishes the same glass on a loop.' },
  { type: 'character',     text: 'BARTENDER' },
  { type: 'parenthetical', text: '(not looking up)' },
  { type: 'dialogue',      text: "Every night, sweetheart. Every single night." },
  { type: 'action',        text: "Maya opens her laptop. A blank document stares back. The cursor blinks." },
  { type: 'scene',         text: 'EXT. ROOFTOP — CONTINUOUS' },
  { type: 'action',        text: 'The city below is a galaxy of amber light. Maya steps to the edge, script pages fanning in the wind.' },
  { type: 'transition',    text: 'CUT TO:' },
];

const TYPE_STYLES: Record<string, string> = {
  transition:    'text-right text-[10px] tracking-widest uppercase text-neutral-400',
  scene:         'text-[11px] font-bold tracking-wide uppercase text-neutral-100',
  action:        'text-[10px] leading-relaxed text-neutral-300',
  character:     'text-center text-[10px] font-bold uppercase tracking-wider text-neutral-100 pl-16',
  parenthetical: 'text-center text-[10px] italic text-neutral-400 pl-12',
  dialogue:      'text-[10px] leading-relaxed text-neutral-200 px-12',
};


export function ScriptPreview() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse tilt
  useEffect(() => {
    const el = containerRef.current?.closest('section') as HTMLElement | null;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const x = ((e.clientY - r.top) / r.height - 0.5) * 10;
      const y = ((e.clientX - r.left) / r.width - 0.5) * -10;
      setTilt({ x, y });
    }
    function onLeave() { setTilt({ x: 0, y: 0 }); }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave); };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center" style={{ perspective: 1000 }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />
      </div>

      {/* Paper shadow */}
      <div className="absolute"
        style={{
          width: 340,
          height: 480,
          borderRadius: 4,
          background: 'rgba(0,0,0,0.6)',
          filter: 'blur(24px)',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(16px)`,
          transition: 'transform 0.3s ease',
        }}
      />

      {/* Script page */}
      <div
        style={{
          width: 340,
          height: 480,
          background: 'linear-gradient(160deg, #fafaf8 0%, #f0ede6 100%)',
          borderRadius: 3,
          padding: '28px 20px',
          fontFamily: '"Courier Prime", "Courier New", monospace',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.8)',
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Hole punches */}
        {[60, 240, 420].map(top => (
          <div key={top} style={{
            position: 'absolute', left: 10, top,
            width: 10, height: 10, borderRadius: '50%',
            background: '#d4d0c8', border: '1px solid #b8b4aa',
          }} />
        ))}

        {/* Left margin rule */}
        <div style={{
          position: 'absolute', left: 28, top: 0, bottom: 0,
          width: 1, background: 'rgba(255,100,100,0.25)',
        }} />

        {/* Page number */}
        <div style={{
          position: 'absolute', top: 10, right: 16,
          fontSize: 9, color: '#999', fontFamily: 'inherit',
        }}>1.</div>

        {/* Script lines */}
        <div style={{ paddingLeft: 10, overflow: 'hidden', height: '100%' }}>
          {LINES.map((line, i) => (
            <div
              key={i}
              className={TYPE_STYLES[line.type]}
              style={{
                marginBottom: line.type === 'scene' ? 6 : line.type === 'transition' ? 6 : 2,
                marginTop: line.type === 'scene' ? 8 : 0,
                color: undefined, // let className handle it — but we need dark text on light paper
              }}
            >
              <span style={{ color: '#1a1a1a', opacity: line.type === 'action' ? 0.75 : line.type === 'parenthetical' ? 0.5 : 0.9 }}>
                {line.text}
              </span>
            </div>
          ))}
        </div>

        {/* Fade out at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
          background: 'linear-gradient(to bottom, transparent, #f0ede6)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Floating pages behind */}
      {[
        { rotate: -8, x: -24, y: 12, z: -1 },
        { rotate: 5, x: 18, y: 20, z: -2 },
      ].map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: 340, height: 480,
          background: i === 0 ? '#f5f2eb' : '#ece9e0',
          borderRadius: 3,
          transform: `rotate(${s.rotate}deg) translate(${s.x}px, ${s.y}px)`,
          zIndex: s.z,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          opacity: 0.6,
        }} />
      ))}
    </div>
  );
}
