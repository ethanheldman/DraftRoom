function rng(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 120 }, (_, i) => ({
  x:   rng(i * 3 + 1) * 100,
  y:   rng(i * 3 + 2) * 60,
  r:   rng(i * 3 + 3) * 1.4 + 0.5,
  del: rng(i * 3 + 4) * 5,
  dur: rng(i * 3 + 5) * 2.5 + 1.5,
}));

const BOKEH = Array.from({ length: 22 }, (_, i) => ({
  x:    rng(i * 7 + 10) * 100,
  y:    rng(i * 7 + 11) * 75,
  r:    rng(i * 7 + 12) * 22 + 8,
  op:   rng(i * 7 + 13) * 0.12 + 0.04,
  del:  rng(i * 7 + 14) * 6,
  dur:  rng(i * 7 + 15) * 4 + 3,
  hue:  Math.round(rng(i * 7 + 16) * 60 + 240), // blue-purple range
}));



export function HollywoodBackground() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: '#04003a url(/cinematic_bg.png) center center / cover no-repeat',
    }}>
      {/* Dimmed overlay to ensure text contrast */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(4,0,58,0.7) 0%, rgba(10,0,30,0.4) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Stars */}
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: Math.max(1, s.r) * 2,
          height: Math.max(1, s.r) * 2,
          borderRadius: '50%',
          background: '#fff',
          opacity: 0.9,
          animation: `hwStar ${s.dur}s ease-in-out ${s.del}s infinite`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Bokeh circles overlay */}
      {BOKEH.map((b, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${b.x}%`, top: `${b.y}%`,
          width: b.r * 2, height: b.r * 2,
          borderRadius: '50%',
          background: `radial-gradient(circle, hsl(${b.hue},80%,70%) 0%, transparent 70%)`,
          opacity: b.op * 0.5,
          animation: `hwBokeh ${b.dur}s ease-in-out ${b.del}s infinite`,
          pointerEvents: 'none',
          filter: 'blur(3px)',
          mixBlendMode: 'screen',
        }} />
      ))}

      <style>{`
        @keyframes hwStar {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50%       { opacity: 0.8; transform: scale(1.6); }
        }
        @keyframes hwBokeh {
          0%, 100% { opacity: calc(var(--op, 0.07) * 0.5); transform: scale(1); }
          50%       { opacity: calc(var(--op, 0.07) * 1.2); transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
