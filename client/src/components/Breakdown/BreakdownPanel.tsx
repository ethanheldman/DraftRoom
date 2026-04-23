import { useEffect, useState } from 'react';
import type { ScriptNode } from '../../types/screenplay';
import { getSceneHeadings } from '../../utils/storage';
import { makeId as sharedMakeId } from '../../utils/ids';

const DEFAULT_CATEGORIES = ['Character','Props','Location','Wardrobe','Animals','Vehicles','Sound','Makeup/Hair','Special Effects','Electrics','Construction','Extras','Camera','Music'];
const CUSTOM_CATEGORIES_KEY = 'sr-breakdown-custom-categories';

function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(c => typeof c === 'string') : [];
  } catch { return []; }
}

interface BreakdownItem { id: string; text: string; category: string; sceneIndex: number; marked?: boolean; }
interface Props { nodes: ScriptNode[]; items: BreakdownItem[]; onItemsChange: (items: BreakdownItem[]) => void; }

const makeId = sharedMakeId;

export default function BreakdownPanel({ nodes, items, onItemsChange }: Props) {
  const scenes = getSceneHeadings(nodes);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [customCategories, setCustomCategories] = useState<string[]>(() => loadCustomCategories());
  const CATEGORIES = [...DEFAULT_CATEGORIES, ...customCategories];
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Character']));
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCat, setNewCat] = useState('Character');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
  }, [customCategories]);

  const sceneItems = items.filter(i=>i.sceneIndex===sceneIdx);
  const allMarked = sceneItems.length > 0 && sceneItems.every(i => i.marked);

  function toggleMarkAll() {
    const next = !allMarked;
    onItemsChange(items.map(i => i.sceneIndex === sceneIdx ? { ...i, marked: next } : i));
  }

  function toggleMarkOne(id: string) {
    onItemsChange(items.map(i => i.id === id ? { ...i, marked: !i.marked } : i));
  }

  function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    if ([...DEFAULT_CATEGORIES, ...customCategories].some(c => c.toLowerCase() === name.toLowerCase())) {
      setNewCategoryName('');
      setAddingCategory(false);
      return;
    }
    setCustomCategories(prev => [...prev, name]);
    setNewCategoryName('');
    setAddingCategory(false);
  }

  function toggleCat(cat: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function addItem() {
    if (!newText.trim()) return;
    onItemsChange([...items, { id: makeId(), text: newText.trim(), category: newCat, sceneIndex: sceneIdx }]);
    setNewText(''); setAdding(false);
  }

  function removeItem(id: string) { onItemsChange(items.filter(i=>i.id!==id)); }

  return (
    <div className="flex flex-col h-full text-xs bg-card">
      <div className="px-3 py-2.5 border-b border-border">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Breakdown</div>
        <select value={sceneIdx} onChange={e=>setSceneIdx(Number(e.target.value))}
          className="w-full rounded-xl border border-border bg-secondary text-foreground px-2 py-1 text-[10px] outline-none focus:border-violet-400/70 transition-colors">
          {scenes.length===0
            ? <option value={0}>No scenes</option>
            : scenes.map((s,i)=><option key={i} value={i}>{i+1}: {s.slice(0,30)}</option>)
          }
        </select>
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer" title="Mark every breakdown item in this scene as tagged on a printed breakdown sheet">
          <input
            type="checkbox"
            className="accent-violet-500"
            checked={allMarked}
            disabled={sceneItems.length === 0}
            onChange={toggleMarkAll}
          />
          {allMarked ? 'Clear all' : 'Mark all'}
        </label>
        <div className="flex items-center gap-1">
          <button onClick={()=>setAddingCategory(v=>!v)}
            className="h-6 px-2 rounded-full flex items-center justify-center text-[10px] font-medium text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 transition-colors"
            title="Create a custom category">
            + Category
          </button>
          <button onClick={()=>setAdding(v=>!v)}
            className="w-6 h-6 rounded-full flex items-center justify-center text-primary-foreground text-base font-bold bg-primary hover:bg-primary/90 transition-colors"
            title="Tag a new item">
            +
          </button>
        </div>
      </div>

      {addingCategory && (
        <div className="px-3 py-2 border-b border-border flex gap-1">
          <input value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} placeholder="New category (e.g. Permits)"
            onKeyDown={e => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setNewCategoryName(''); setAddingCategory(false); } }}
            className="flex-1 rounded-xl border border-border bg-secondary px-2 py-1 text-[10px] text-foreground outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground" autoFocus/>
          <button onClick={addCategory} className="py-1 px-3 rounded-xl text-[10px] text-primary-foreground font-medium bg-primary hover:bg-primary/90 transition-colors">Add</button>
        </div>
      )}

      {adding && (
        <div className="px-3 py-2 border-b border-border space-y-1.5">
          <input value={newText} onChange={e=>setNewText(e.target.value)} placeholder="Item name"
            className="w-full rounded-xl border border-border bg-secondary px-2 py-1 text-[10px] text-foreground outline-none focus:border-violet-400/70 transition-colors placeholder:text-muted-foreground" autoFocus/>
          <select value={newCat} onChange={e=>setNewCat(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary text-foreground px-2 py-1 text-[10px] outline-none focus:border-violet-400/70 transition-colors">
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>
          <div className="flex gap-1">
            <button onClick={addItem} className="flex-1 py-1 rounded-xl text-[10px] text-primary-foreground font-medium bg-primary hover:bg-primary/90 transition-colors">TAG</button>
            <button onClick={()=>setAdding(false)} className="text-[10px] text-muted-foreground px-2 hover:text-foreground transition-colors">✕</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {CATEGORIES.map(cat => {
          const catItems = sceneItems.filter(i=>i.category===cat);
          if (catItems.length===0) return null;
          const open = expanded.has(cat);
          return (
            <div key={cat} className="border-b border-border/50">
              <button onClick={()=>toggleCat(cat)}
                className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-foreground/80 hover:bg-secondary/50 transition-colors">
                <span className="font-semibold uppercase tracking-wider">{cat}</span>
                <span className="text-muted-foreground">{catItems.length} {open?'▴':'▾'}</span>
              </button>
              {open && catItems.map(item=>(
                <div key={item.id} className="flex items-center justify-between px-5 py-1 hover:bg-secondary/30 transition-colors">
                  <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-violet-500"
                      checked={!!item.marked}
                      onChange={() => toggleMarkOne(item.id)}
                    />
                    <span style={item.marked ? { color: 'hsl(var(--foreground))', fontWeight: 500 } : undefined}>{item.text}</span>
                  </label>
                  <button onClick={()=>removeItem(item.id)} className="text-muted-foreground/50 hover:text-destructive text-[10px] transition-colors">×</button>
                </div>
              ))}
            </div>
          );
        })}
        {sceneItems.length===0 && (
          <p className="px-3 py-4 text-[10px] text-muted-foreground text-center">No items tagged for this scene.<br/>Click + to add.</p>
        )}
      </div>
    </div>
  );
}
