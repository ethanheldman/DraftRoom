import { useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { ScriptNode } from '../../types/screenplay';
import { getCharacterNames, getSceneHeadings, estimatePageCount, countWords } from '../../utils/storage';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ['#4ecdc4','#7c3aed','#3b82f6','#f59e0b','#ef4444','#10b981','#ec4899','#f97316','#6366f1','#14b8a6'];

const CHART_OPTIONS = {
  responsive: true,
  plugins: {
    legend: { labels: { color: '#9ca3af', font: { size: 10 }, boxWidth: 12 } },
    tooltip: { titleColor: '#fff', bodyColor: '#d1d5db' },
  },
  cutout: '60%',
};

interface Props { nodes: ScriptNode[]; title: string; onClose: () => void; }

type ChartView = 'chart' | 'table';

function ChartCard({ title, labels, data }: { title: string; labels: string[]; data: number[] }) {
  const [view, setView] = useState<ChartView>('chart');
  const total = data.reduce((a,b)=>a+b,0);
  return (
    <div className="rounded-2xl border border-white/5 p-5 bg-black/20 shadow-inner">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</h3>
        <div className="flex gap-1">
          {(['chart','table'] as ChartView[]).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className={`text-[10px] px-2 py-0.5 rounded-md transition-colors ${view===v?'bg-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]':'text-muted-foreground hover:text-white hover:bg-white/10'}`}>
              {v==='chart'?'◉':'☰'}
            </button>
          ))}
        </div>
      </div>
      {total===0 ? <p className="text-xs text-gray-600 text-center py-4">No data</p>
      : view==='chart' ? (
        <div className="flex justify-center">
          <div style={{width:160,height:160}}>
            <Doughnut data={{ labels, datasets:[{ data, backgroundColor:COLORS, borderColor:'#252525', borderWidth:2 }] }} options={CHART_OPTIONS}/>
          </div>
        </div>
      ) : (
        <table className="w-full text-[10px]">
          <tbody>
            {labels.map((l,i)=>(
              <tr key={l} className="border-t border-gray-800">
                <td className="py-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{background:COLORS[i%COLORS.length]}}/>
                  <span className="text-gray-300 truncate">{l}</span>
                </td>
                <td className="py-1 text-right text-gray-400">{data[i]}</td>
                <td className="py-1 text-right text-gray-600 pl-2">{Math.round(data[i]/total*100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ScriptInsights({ nodes, title, onClose }: Props) {
  const stats = useMemo(() => {
    const characters = getCharacterNames(nodes);
    const headings = getSceneHeadings(nodes);
    const locations = [...new Set(headings.map(h =>
      h.replace(/^(INT\.|EXT\.|INT\.\/EXT\.)\s*/i,'').split(/\s*[-–]\s*/)[0].trim()
    ))];

    // Dialogue per character
    const dialogueCounts: Record<string,number> = {};
    let lastChar = '';
    for (const n of nodes) {
      if (n.type==='character') lastChar = n.content.replace(/\(.*?\)/g,'').trim().toUpperCase();
      if (n.type==='dialogue' && lastChar) dialogueCounts[lastChar]=(dialogueCounts[lastChar]??0)+1;
    }

    // Action vs dialogue words
    let actionW=0, dialogueW=0;
    for (const n of nodes) {
      const w = n.content.trim().split(/\s+/).filter(Boolean).length;
      if (n.type==='action') actionW+=w;
      if (n.type==='dialogue') dialogueW+=w;
    }

    // Int/ext
    let intC=0, extC=0, otherC=0;
    for (const n of nodes) {
      if (n.type!=='scene_heading') continue;
      if (n.content.toUpperCase().startsWith('INT.')) intC++;
      else if (n.content.toUpperCase().startsWith('EXT.')) extC++;
      else otherC++;
    }

    // Location scene counts
    const locCounts: Record<string,number> = {};
    for (const n of nodes) {
      if (n.type==='scene_heading' && n.content.trim()) {
        const loc = n.content.replace(/^(INT\.|EXT\.|INT\.\/EXT\.)\s*/i,'').split(/\s*[-–]\s*/)[0].trim().toUpperCase();
        locCounts[loc]=(locCounts[loc]??0)+1;
      }
    }

    // Char by scene
    const charScenes: Record<string,Set<number>> = {};
    let sceneIdx=0, curChars = new Set<string>();
    for (const n of nodes) {
      if (n.type==='scene_heading') { sceneIdx++; curChars=new Set(); }
      if (n.type==='character') {
        const c=n.content.replace(/\(.*?\)/g,'').trim().toUpperCase();
        if (!charScenes[c]) charScenes[c]=new Set();
        charScenes[c].add(sceneIdx);
        curChars.add(c);
      }
    }

    return { characters, locations, words:countWords(nodes), pages:estimatePageCount(nodes),
      dialogueCounts, actionW, dialogueW, intC, extC, otherC, locCounts, charScenes };
  }, [nodes]);

  const topChars = Object.entries(stats.dialogueCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const topLocs  = Object.entries(stats.locCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const charSceneData = Object.entries(stats.charScenes).sort((a,b)=>b[1].size-a[1].size).slice(0,8);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] bg-card/80 backdrop-blur-3xl border border-white/10">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-8 py-5 border-b border-white/10 bg-card/60 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-white">Script Insights</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{title}</p>
          </div>
          <button onClick={onClose}
            className="px-6 py-2 rounded-xl text-sm font-medium text-white transition-all bg-white/10 hover:bg-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            Close
          </button>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Stats tiles */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label:'CHARACTERS', value: stats.characters.length },
              { label:'SETTINGS',   value: stats.locations.length },
              { label:'WORDS',      value: stats.words.toLocaleString() },
              { label:'PAGES',      value: stats.pages },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-white/5 p-5 text-center bg-black/20 shadow-inner">
                <div className="text-4xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-3 gap-4">
            <ChartCard title="Action vs Dialogue"
              labels={['Dialogue','Action']}
              data={[stats.dialogueW, stats.actionW]} />
            <ChartCard title="Interior vs Exterior"
              labels={['Interior','Exterior','Other']}
              data={[stats.intC, stats.extC, stats.otherC]} />
            <ChartCard title="Dialogue Distribution"
              labels={topChars.map(([l])=>l)}
              data={topChars.map(([,v])=>v)} />
            <ChartCard title="Setting Distribution"
              labels={topLocs.map(([l])=>l)}
              data={topLocs.map(([,v])=>v)} />
            <ChartCard title="Characters by Scene"
              labels={charSceneData.map(([l])=>l)}
              data={charSceneData.map(([,v])=>v.size)} />

            {/* Dialogue bar chart — wider */}
            <div className="rounded-2xl border border-white/5 p-5 bg-black/20 shadow-inner">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Dialogue Lines</h3>
              {topChars.length===0 ? <p className="text-xs text-gray-600 text-center py-4">No dialogue</p> : (
                <div className="space-y-2">
                  {topChars.map(([name,count],i)=>{
                    const max=topChars[0][1];
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <span className="w-20 text-[10px] text-gray-400 truncate">{name}</span>
                        <div className="flex-1 rounded-full bg-gray-800 h-1.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${count/max*100}%`,background:COLORS[i%COLORS.length]}}/>
                        </div>
                        <span className="text-[10px] text-gray-500 w-4 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
