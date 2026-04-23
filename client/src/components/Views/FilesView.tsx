import { useState, useRef } from 'react';
import type { MediaItem } from '../../types/screenplay';
import { makeId } from '../../utils/ids';

interface Props {
  mediaItems: MediaItem[];
  onChange: (items: MediaItem[]) => void;
}
function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fileIcon(type: string): string {
  if (type.startsWith('image')) return '🖼';
  if (type === 'url') return '🔗';
  if (type === 'text/html') return '📄';
  if (type.includes('presentation') || type.includes('pptx') || type.endsWith('.pptx')) return '📊';
  if (type.includes('pdf')) return '📑';
  return '📄';
}

function fileLabel(type: string, name: string): string {
  if (type === 'url') return 'Link';
  if (type === 'text/html') return 'HTML';
  if (type.includes('presentation') || name.endsWith('.pptx')) return 'PPTX';
  if (type.includes('pdf')) return 'PDF';
  return type.split('/').pop()?.toUpperCase() ?? 'File';
}

function downloadItem(item: MediaItem) {
  const a = document.createElement('a');
  a.href = item.url;
  a.download = item.name;
  a.click();
}

function openItem(item: MediaItem) {
  const win = window.open();
  if (win) {
    if (item.type === 'text/html') {
      // Decode base64 HTML and write into the new window
      try {
        const base64 = item.url.split(',')[1];
        const html = decodeURIComponent(escape(atob(base64)));
        win.document.write(html);
        win.document.close();
      } catch {
        win.location.href = item.url;
      }
    } else {
      win.location.href = item.url;
    }
  }
}

export default function FilesView({ mediaItems, onChange }: Props) {
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [urlDraft, setUrlDraft] = useState('');
  const [showUrlAdd, setShowUrlAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const readers = files.map(file => new Promise<MediaItem>(resolve => {
      const reader = new FileReader();
      reader.onload = ev => resolve({
        id: makeId(), sceneIndex: -1, url: ev.target?.result as string,
        caption: '', name: file.name, type: file.type || 'application/octet-stream',
        size: file.size, addedAt: new Date().toISOString(),
      });
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(newItems => onChange([...mediaItems, ...newItems]));
    e.target.value = '';
  }

  function addUrl() {
    if (!urlDraft.trim()) return;
    const name = urlDraft.split('/').pop() ?? 'Link';
    const item: MediaItem = {
      id: makeId(), sceneIndex: -1, url: urlDraft.trim(),
      caption: '', name, type: 'url', addedAt: new Date().toISOString(),
    };
    onChange([...mediaItems, item]);
    setUrlDraft(''); setShowUrlAdd(false);
  }

  function remove(id: string) { onChange(mediaItems.filter(m => m.id !== id)); }

  function saveRename(id: string) {
    onChange(mediaItems.map(m => m.id === id ? { ...m, name: renameDraft } : m));
    setRenameId(null);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background font-geist">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-foreground">Files & Media</span>
          <span className="text-xs text-muted-foreground">{mediaItems.length} item{mediaItems.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowUrlAdd(v => !v)}
            className="rounded-2xl border border-border px-3 py-1.5 text-xs text-foreground/80 hover:text-foreground hover:border-border/60 transition-colors">
            + URL
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="rounded-2xl px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
            Upload
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
        </div>
      </div>

      {showUrlAdd && (
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border">
          <input autoFocus value={urlDraft} onChange={e => setUrlDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addUrl()}
            placeholder="Paste URL…"
            className="flex-1 rounded-2xl border border-border bg-foreground/5 px-4 py-2 text-xs text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors placeholder:text-muted-foreground" />
          <button onClick={addUrl} className="rounded-2xl px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">Add</button>
          <button onClick={() => setShowUrlAdd(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <div className="text-4xl">📎</div>
            <p className="text-sm font-medium text-foreground/80">No files yet</p>
            <p className="text-xs max-w-xs text-center">Upload images or PDFs, or paste URLs to attach references to this project.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid gap-2 px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto' }}>
              <span>Name</span><span>Type</span><span>Size</span><span>Added</span><span />
            </div>
            {mediaItems.map(item => {
              const isGenerated = item.caption === 'ai-generated';
              const isHtml = item.type === 'text/html';
              const isPptx = item.type.includes('presentation') || item.name.endsWith('.pptx');
              const isUrl = item.type === 'url';
              const isImage = item.type.startsWith('image');

              return (
                <div key={item.id}
                  className="grid gap-2 items-center px-3 py-2.5 rounded-2xl border bg-card hover:border-violet-400/40 transition-colors"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr auto', borderColor: isGenerated ? 'rgba(124,58,237,0.3)' : undefined }}>

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{fileIcon(item.type)}</span>
                    <div className="min-w-0 flex-1">
                      {renameId === item.id ? (
                        <input autoFocus value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                          onBlur={() => saveRename(item.id)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRename(item.id); if (e.key === 'Escape') setRenameId(null); }}
                          className="w-full rounded-xl border border-violet-400/50 bg-secondary px-2 py-0.5 text-xs text-foreground outline-none" />
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-foreground/80 truncate cursor-pointer hover:text-foreground transition-colors"
                            onDoubleClick={() => { setRenameId(item.id); setRenameDraft(item.name); }}>
                            {item.name}
                          </span>
                          {isGenerated && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                              ✨ AI
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-muted-foreground truncate">{fileLabel(item.type, item.name)}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtSize(item.size)}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(item.addedAt)}</span>

                  <div className="flex gap-1.5 items-center">
                    {/* Open / view */}
                    {(isHtml || isPptx) && (
                      <button onClick={() => isHtml ? openItem(item) : downloadItem(item)}
                        className="text-[10px] px-2 py-0.5 rounded-lg font-medium transition-colors hover:text-white"
                        style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
                        title={isHtml ? 'Open in new tab (Ctrl+P to save as PDF)' : 'Download .pptx'}>
                        {isHtml ? '↗ Open' : '↓ Download'}
                      </button>
                    )}
                    {isUrl && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-violet-400 text-xs transition-colors">↗</a>
                    )}
                    {isImage && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-violet-400 text-xs transition-colors">↗</a>
                    )}
                    <button onClick={() => remove(item.id)}
                      className="text-muted-foreground hover:text-destructive text-xs transition-colors">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
