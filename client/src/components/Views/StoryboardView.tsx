import { useState } from 'react';
import type { ScriptNode, MediaItem } from '../../types/screenplay';
import { getSceneHeadings } from '../../utils/storage';
import { makeId } from '../../utils/ids';

interface Props {
  nodes: ScriptNode[];
  mediaItems: MediaItem[];
  onMediaChange: (items: MediaItem[]) => void;
}

export default function StoryboardView({ nodes, mediaItems, onMediaChange }: Props) {
  const scenes = getSceneHeadings(nodes);
  const [descriptions, setDescriptions] = useState<Record<number, string>>({});

  function getMediaForScene(idx: number) {
    return mediaItems.find(m => m.sceneIndex === idx && (m.type === 'image' || m.url));
  }

  function handleImageUpload(sceneIdx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const existing = mediaItems.findIndex(m => m.sceneIndex === sceneIdx && m.type === 'image');
      const newItem: MediaItem = {
        id: makeId(), sceneIndex: sceneIdx, url, caption: scenes[sceneIdx] ?? '',
        name: file.name, type: 'image', size: file.size, addedAt: new Date().toISOString(),
      };
      if (existing >= 0) {
        const updated = [...mediaItems];
        updated[existing] = newItem;
        onMediaChange(updated);
      } else {
        onMediaChange([...mediaItems, newItem]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  if (scenes.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <div className="text-4xl mb-3">🎞</div>
          <p className="text-sm font-medium text-foreground/80">No scenes yet</p>
          <p className="text-xs mt-1">Add scene headings to your script to build a storyboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background font-geist">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="font-semibold text-foreground">Storyboard</h2>
        <span className="text-xs text-muted-foreground">{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {scenes.map((heading, idx) => {
          const media = getMediaForScene(idx);
          return (
            <div key={idx} className="rounded-2xl border border-border bg-card overflow-hidden hover:border-violet-400/40 transition-colors">
              {/* Thumbnail */}
              <div className="relative h-36 bg-secondary flex items-center justify-center group">
                {media ? (
                  <img src={media.url} alt={heading} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-muted-foreground text-xs text-center px-2">
                    <svg className="mx-auto mb-1 opacity-30" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                    No image
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-white text-xs font-medium px-3 py-1 bg-white/10 rounded-full">
                    {media ? 'Change' : 'Add Image'}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(idx, e)} />
                </label>
                <div className="absolute top-2 left-2 bg-black/70 text-violet-400 text-[10px] font-mono px-1.5 py-0.5 rounded-lg">
                  {idx + 1}
                </div>
              </div>
              {/* Info */}
              <div className="p-3">
                <p className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wide truncate">{heading}</p>
                <textarea
                  value={descriptions[idx] ?? ''}
                  onChange={e => setDescriptions(d => ({ ...d, [idx]: e.target.value }))}
                  placeholder="Scene description…"
                  rows={2}
                  className="mt-2 w-full resize-none rounded-xl border border-border bg-foreground/5 px-2 py-1 text-[10px] text-muted-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors placeholder:text-muted-foreground/60"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
