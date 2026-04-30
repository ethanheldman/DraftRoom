import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { ScriptNode, ElementType, Project, Beat, CastMember, BreakdownItem, Shot, BudgetLine, MediaItem } from '../types/screenplay';
import { getProject, upsertProject, loadScript, saveScript, defaultScript, createNewProject, estimatePageCount, countWords, saveVersionSnapshot, loadVersionHistory } from '../utils/storage';
import { exportFountain, exportTxt, exportFDX } from '../utils/fountain';
import InlineAIMenu from '../components/Editor/InlineAIMenu';

import Sidebar from '../components/Layout/Sidebar';
import type { EditorView } from '../components/Layout/Sidebar';
import MenuBar from '../components/Layout/MenuBar';
import EditorToolbar from '../components/Editor/EditorToolbar';
import NavigationPanel from '../components/Editor/NavigationPanel';
import StatusBar from '../components/Editor/StatusBar';
import FindReplace from '../components/Editor/FindReplace';
import TitlePage, { type TitlePageData } from '../components/Layout/TitlePage';
import RightToolsPanel, { type ToolTab } from '../components/Layout/RightToolsPanel';
import ScriptEditor, { type ScriptEditorHandle } from '../components/Editor/ScriptEditor';
import AIPanel, { type ChatMessage } from '../components/AIPanel/AIPanel';
import { getPlan, isPro } from '../lib/plan';
import { getTheme, THEME_STORAGE_KEY } from '../utils/themes';
import BeatSheetView from '../components/BeatSheet/BeatSheetView';
import ScriptInsights from '../components/Insights/ScriptInsights';
import CastCrewView from '../components/CastCrew/CastCrewView';
import StoryboardView from '../components/Views/StoryboardView';
import BudgetView from '../components/Views/BudgetView';
import ScheduleView from '../components/Views/ScheduleView';
import FilesView from '../components/Views/FilesView';

export default function ProjectEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const editorRef = useRef<ScriptEditorHandle>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<ScriptNode[]>([]);
  const [activeType, setActiveType] = useState<ElementType>('action');
  const [view, setView] = useState<EditorView>('script');
  const [zoom, setZoom] = useState(100);
  const [nightMode, setNightMode] = useState(false);
  // Default to 'auto' — paper surfaces derive from the active App Theme's CSS
  // vars, so switching from Lavender → Forest → Dracula instantly re-tints
  // the script page too. Users who want a specific paper colour override via
  // View → Paper Style.
  //
  // One-time migration: previous builds stored any exploratory Paper Style
  // pick (Night / Coffee Shop / etc.) which would persist even after the user
  // never wanted it. We bump a version flag; on the first load after this
  // deploy, we clear stale picks and fall through to 'auto'. Subsequent
  // user-initiated picks are remembered normally.
  const [themeId, setThemeId] = useState(() => {
    const PS_VERSION_KEY = 'sr-paper-style-version';
    const CURRENT_VERSION = '2';
    const prevVersion = localStorage.getItem(PS_VERSION_KEY);
    if (prevVersion !== CURRENT_VERSION) {
      localStorage.setItem(PS_VERSION_KEY, CURRENT_VERSION);
      // Wipe the stale atmosphere pick so the new default takes effect.
      localStorage.removeItem('sr-atmosphere-theme');
      return 'auto';
    }
    return localStorage.getItem('sr-atmosphere-theme') ?? 'auto';
  });
  const [showNav, setShowNav] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiChatHistory, setAiChatHistory] = useState<ChatMessage[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [showSceneNumbers, setShowSceneNumbers] = useState(false);
  const [showTitlePage, setShowTitlePage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<ToolTab>('stats');
  const [scriptNotes, setScriptNotes] = useState('');
  const [showScriptGoals, setShowScriptGoals] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<{ ts: string; nodes: ScriptNode[] }[]>([]);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [printWatermark, setPrintWatermark] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [writingTime, setWritingTime] = useState(0);
  const [thinkingTime, setThinkingTime] = useState(0);
  const [isWritingRunning, setIsWritingRunning] = useState(false);
  const [isThinkingRunning, setIsThinkingRunning] = useState(false);
  const [titlePageData, setTitlePageData] = useState<TitlePageData>({ title: '', author: '', basedOn: '', contactName: '', contactEmail: '', contactPhone: '', contactAgent: '', draftLabel: '', draftDate: '' });
  const [scriptAppliedAt, setScriptAppliedAt] = useState<number>(0);

  // Script goals draft state
  const [goalDraft, setGoalDraft] = useState({ pageGoal: 120, dailyWordGoal: 500, deadline: '', logline: '', genre: '' });

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref of latest values for beforeunload
  const latestProject = useRef<Project | null>(null);
  const latestWritingTime = useRef(0);
  const latestThinkingTime = useRef(0);
  const latestNodes = useRef<ScriptNode[]>([]);
  const plan = getPlan();

  useEffect(() => { latestProject.current = project; }, [project]);
  useEffect(() => { latestWritingTime.current = writingTime; }, [writingTime]);
  useEffect(() => { latestThinkingTime.current = thinkingTime; }, [thinkingTime]);
  useEffect(() => { latestNodes.current = nodes; }, [nodes]);

  // Load
  useEffect(() => {
    if (!projectId) return;
    let proj = getProject(projectId);
    if (!proj) {
      proj = createNewProject(projectId === 'demo' ? 'Demo Script' : 'Untitled Script');
      proj = { ...proj, id: projectId };
      upsertProject(proj);
    }
    setProject(proj);
    setWritingTime(proj.settings.writingTime);
    setThinkingTime(proj.settings.thinkingTime);
    setTitlePageData({ title: proj.title, author: '', basedOn: '', contactName: '', contactEmail: '', contactPhone: '', contactAgent: '', draftLabel: '', draftDate: '' });
    setGoalDraft({
      pageGoal: proj.settings.pageGoal,
      dailyWordGoal: proj.settings.dailyWordGoal ?? 500,
      deadline: proj.settings.deadline ?? '',
      logline: proj.logline ?? '',
      genre: proj.genre ?? '',
    });
    const script = loadScript(projectId);
    setNodes(script.length ? script : defaultScript());
  }, [projectId]);

  // Save timers on beforeunload
  useEffect(() => {
    function onUnload() {
      const proj = latestProject.current;
      if (!proj || !projectId) return;
      upsertProject({ ...proj, settings: { ...proj.settings, writingTime: latestWritingTime.current, thinkingTime: latestThinkingTime.current } });
      if (latestNodes.current.length) saveScript(projectId, latestNodes.current);
    }
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      onUnload(); // also save on unmount
    };
  }, [projectId]);

  // Tour: listen for editor-view navigation events
  useEffect(() => {
    function onTourEditorView(e: Event) {
      const view = (e as CustomEvent).detail as string;
      if (view === 'beat-sheet' || view === 'cast-crew' || view === 'script') {
        setView(view as 'beat-sheet' | 'cast-crew' | 'script');
      }
    }
    window.addEventListener('tour:editor-view', onTourEditorView);
    return () => window.removeEventListener('tour:editor-view', onTourEditorView);
  }, []);

  // Writing timer
  useEffect(() => {
    if (isWritingRunning) {
      writingInterval.current = setInterval(() => setWritingTime(t => t + 1), 1000);
    } else if (writingInterval.current) clearInterval(writingInterval.current);
    return () => { if (writingInterval.current) clearInterval(writingInterval.current); };
  }, [isWritingRunning]);

  // Thinking timer
  useEffect(() => {
    if (isThinkingRunning) {
      thinkingInterval.current = setInterval(() => setThinkingTime(t => t + 1), 1000);
    } else if (thinkingInterval.current) clearInterval(thinkingInterval.current);
    return () => { if (thinkingInterval.current) clearInterval(thinkingInterval.current); };
  }, [isThinkingRunning]);

  // Track whether there are unsaved edits — powers StatusBar's "Unsaved changes"
  // indicator and the beforeunload guard.
  const [dirty, setDirty] = useState(false);

  // Autosave + autosnapshot.
  //
  // Previously autosave only wrote the working script; version snapshots were
  // gated behind manual ⌘S. Users who never hit ⌘S had an empty Version
  // History modal, despite the reassuring "Versions are saved automatically"
  // copy. Now we take a fresh snapshot at most once every AUTOSNAPSHOT_INTERVAL
  // so crashes / bad AI edits are always recoverable.
  const AUTOSNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const lastSnapshotRef = useRef<number>(0);

  const scheduleSave = useCallback((n: ScriptNode[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDirty(true);
    setSaving(false);
    saveTimer.current = setTimeout(() => {
      if (!projectId) return;
      setSaving(true);
      saveScript(projectId, n);
      const now = Date.now();
      if (now - lastSnapshotRef.current >= AUTOSNAPSHOT_INTERVAL_MS) {
        saveVersionSnapshot(projectId, n);
        lastSnapshotRef.current = now;
      }
      setLastSaved(new Date());
      setSaving(false);
      setDirty(false);
    }, 2000);
  }, [projectId]);

  function handleNodesChange(n: ScriptNode[]) {
    setNodes(n); scheduleSave(n);
    if (!isWritingRunning) setIsWritingRunning(true);
  }

  // Warn the user before closing/reloading if there are unsaved edits.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Cross-tab sync — if another tab on the same origin saves this project,
  // pull the fresh nodes in when we detect a storage event. Prevents two-tab
  // divergence that would otherwise silently overwrite edits.
  useEffect(() => {
    if (!projectId) return;
    function onStorage(e: StorageEvent) {
      if (!e.key || !projectId) return;
      // storage.ts writes scripts under a key like `sr-script:<projectId>`.
      if (e.key !== `sr-script:${projectId}`) return;
      try {
        const fresh = JSON.parse(e.newValue || 'null') as ScriptNode[] | null;
        if (Array.isArray(fresh)) {
          setNodes(fresh);
          setDirty(false);
          setLastSaved(new Date());
        }
      } catch { /* ignore parse errors */ }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [projectId]);

  // Any open modal / panel closes with Escape. Prior to this Escape did
  // nothing in Version History, Script Insights, Script Goals, Print
  // Options, or Find & Replace — users had to hunt for tiny × buttons.
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Find & Replace has its own internal close; handle it first.
      if (showFindReplace)    { e.preventDefault(); setShowFindReplace(false); return; }
      if (showVersionHistory) { e.preventDefault(); setShowVersionHistory(false); return; }
      if (showInsights)       { e.preventDefault(); setShowInsights(false); return; }
      if (showScriptGoals)    { e.preventDefault(); setShowScriptGoals(false); return; }
      if (showPrintOptions)   { e.preventDefault(); setShowPrintOptions(false); return; }
    }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [showFindReplace, showVersionHistory, showInsights, showScriptGoals, showPrintOptions]);

  // Global shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); manualSave(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') { e.preventDefault(); window.print(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setShowFindReplace(v => !v); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [projectId, nodes]);

  function manualSave() {
    if (!projectId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveScript(projectId, nodes);
    saveVersionSnapshot(projectId, nodes);
    setLastSaved(new Date());
    setSaving(false);
    setDirty(false);
  }

  function updateProject(updated: Project) { setProject(updated); upsertProject(updated); }

  function handleExportFountain() {
    const text = exportFountain(nodes, project?.title ?? 'Script');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project?.title ?? 'script'}.fountain`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportTxt() {
    const text = exportTxt(nodes);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project?.title ?? 'script'}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportFDX() {
    const text = exportFDX(nodes, project?.title ?? 'Script', titlePageData.author);
    const blob = new Blob([text], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${project?.title ?? 'script'}.fdx`; a.click();
    URL.revokeObjectURL(url);
  }

  function openVersionHistory() {
    setVersionHistory(loadVersionHistory(projectId ?? ''));
    setShowVersionHistory(true);
  }

  function handleInlineApply(nodeIdx: number, content: string) {
    const n = [...nodes];
    if (n[nodeIdx]) { n[nodeIdx] = { ...n[nodeIdx], content }; }
    setNodes(n);
    latestNodes.current = n;
    if (projectId) { saveScript(projectId, n); setLastSaved(new Date()); }
    editorRef.current?.replaceContent(nodeIdx, content);
  }

  function handleSceneColorChange(nodeIndex: number, color: string | undefined) {
    const n = nodes.map((node, i) => i === nodeIndex ? { ...node, color } : node);
    setNodes(n);
    latestNodes.current = n;
    if (projectId) saveScript(projectId, n);
    editorRef.current?.resetNodes(n);
  }

  function handlePrint() {
    if (printWatermark.trim()) {
      const style = document.createElement('style');
      style.id = 'print-watermark-style';
      style.textContent = `@media print { .script-print-only::before { content: "${printWatermark.trim()}"; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 72pt; color: rgba(0,0,0,0.06); font-family: Arial, sans-serif; font-weight: bold; pointer-events: none; z-index: 9999; white-space: nowrap; } }`;
      document.head.appendChild(style);
      setTimeout(() => { window.print(); setTimeout(() => { style.remove(); }, 500); }, 100);
    } else {
      window.print();
    }
    setShowPrintOptions(false);
  }

  function saveGoals() {
    if (!project) return;
    updateProject({ ...project, logline: goalDraft.logline, genre: goalDraft.genre, settings: { ...project.settings, pageGoal: goalDraft.pageGoal, dailyWordGoal: goalDraft.dailyWordGoal, deadline: goalDraft.deadline } });
    setShowScriptGoals(false);
  }

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground text-sm">Loading…</span>
      </div>
    );
  }

  const pages = estimatePageCount(nodes);
  const words = countWords(nodes);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background font-geist">
      <MenuBar
        title={project.title}
        onImport={n => { setNodes(n); scheduleSave(n); }}
        onExportFountain={handleExportFountain}
        onExportTxt={handleExportTxt}
        onRename={() => {
          const name = prompt('Rename script:', project.title);
          if (name?.trim()) updateProject({ ...project, title: name.trim() });
        }}
        onSave={manualSave}
        onBold={() => editorRef.current?.applyMark('bold')}
        onItalic={() => editorRef.current?.applyMark('italic')}
        onUnderline={() => editorRef.current?.applyMark('underline')}
        onToggleSceneNumbers={() => setShowSceneNumbers(v => !v)}
        onFindReplace={() => setShowFindReplace(v => !v)}
        onToggleTitlePage={() => setShowTitlePage(v => !v)}
        onInsights={() => setShowInsights(true)}
        onToggleNav={() => setShowNav(v => !v)}
        onZoom={setZoom}
        onNightMode={() => setNightMode(v => !v)}
        currentThemeId={themeId}
        onSetTheme={(id) => { setThemeId(id); localStorage.setItem(THEME_STORAGE_KEY, id); }}
        onScriptGoals={() => setShowScriptGoals(true)}
        onUndo={() => editorRef.current?.undo()}
        onRedo={() => editorRef.current?.redo()}
        plan={plan}
        onAIPanel={() => { setShowAI(v => { if (!v) setShowRightPanel(false); return !v; }); }}
        onExportFDX={handleExportFDX}
        onVersionHistory={openVersionHistory}
        onPrintOptions={() => setShowPrintOptions(true)}
        nightMode={nightMode}
        currentZoom={zoom}
        sceneNumbersVisible={showSceneNumbers}
      />

      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <div className="hidden md:block">
            <Sidebar project={project} currentView={view} onNavigate={v => setView(v as EditorView)} onClose={() => setShowSidebar(false)} />
          </div>
        )}

        {!showSidebar && (
          <button
            onClick={() => setShowSidebar(true)}
            title="Show sidebar"
            aria-label="Show sidebar"
            className="no-print absolute left-0 top-4 z-20 text-muted-foreground hover:text-violet-400 bg-secondary rounded-r px-1 py-2 text-xs transition-colors hidden md:block"
            style={{ borderRight: '1px solid hsl(var(--border))', borderTop: '1px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border))', top: 60 }}
          >▶</button>
        )}

        <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
          {view === 'script' && (
            <>
              <EditorToolbar
                activeType={activeType} zoom={zoom}
                onToggleNav={() => setShowNav(v => !v)}
                onTypeChange={setActiveType}
                onBold={() => editorRef.current?.applyMark('bold')}
                onItalic={() => editorRef.current?.applyMark('italic')}
                onUnderline={() => editorRef.current?.applyMark('underline')}
                onZoom={setZoom}
                onUndo={() => editorRef.current?.undo()}
                onRedo={() => editorRef.current?.redo()}
                onToggleComments={() => { setShowRightPanel(true); setRightPanelTab('notes'); }}
              />

              <div className="relative flex flex-1 overflow-hidden">
                {showNav && (
                  <NavigationPanel nodes={nodes}
                    onJump={i => { editorRef.current?.scrollToScene(i); setShowNav(false); }}
                    onClose={() => setShowNav(false)}
                    onColorChange={handleSceneColorChange} />
                )}

                <div ref={scrollAreaRef} data-tour="script-editor-area" className="script-scroll-area flex-1 overflow-auto min-w-0" style={{ background: getTheme(themeId).scrollBg }}>
                  <div
                    className="script-content-wrapper flex justify-center py-8 min-h-full"
                    style={{
                      paddingLeft: 16,
                      // Only reserve space for the right panel on ≥lg screens where it's actually pinned;
                      // below that it collapses and shouldn't push the paper off-screen.
                      paddingRight: showRightPanel && typeof window !== 'undefined' && window.innerWidth >= 1024 ? 220 + 16 : 16,
                    }}
                  >
                    <div className="script-zoom-wrapper" style={{ zoom: `${zoom}%`, maxWidth: '100%' }}>
                      {showTitlePage && (
                        <div className="mb-2">
                          <TitlePage data={titlePageData} onChange={setTitlePageData} />
                        </div>
                      )}
                      <ScriptEditor ref={editorRef} nodes={nodes} onChange={handleNodesChange}
                        onActiveTypeChange={setActiveType} activeElementType={activeType}
                        showSceneNumbers={showSceneNumbers} zoom={100} themeId={themeId}
                        appliedAt={scriptAppliedAt} />
                    </div>
                  </div>
                  {isPro(plan) && (
                    <InlineAIMenu
                      nodes={nodes}
                      scriptTitle={project.title}
                      onApply={handleInlineApply}
                      containerRef={scrollAreaRef}
                    />
                  )}
                </div>

                {/* Right panel — absolute overlay so script never shifts. Hidden below lg. */}
                <div
                  className="no-print absolute top-0 right-0 h-full z-10 overflow-hidden transition-[width] duration-200 border-l border-border hidden lg:block"
                  style={{ width: showRightPanel ? 220 : 0 }}
                >
                  <RightToolsPanel
                    nodes={nodes}
                    onClose={() => setShowRightPanel(false)}
                    activeTab={rightPanelTab}
                    onTabChange={setRightPanelTab}
                    notes={scriptNotes}
                    onNotesChange={setScriptNotes}
                    pageGoal={project.settings.pageGoal}
                  />
                </div>

                {!showRightPanel && (
                  <button
                    onClick={() => setShowRightPanel(true)}
                    title="Show tools panel"
                    aria-label="Show tools panel"
                    className="no-print absolute right-0 top-4 z-10 text-muted-foreground hover:text-violet-400 bg-secondary rounded-l px-1 py-2 text-xs transition-colors hidden lg:block"
                    style={{ borderLeft: '1px solid hsl(var(--border))', borderTop: '1px solid hsl(var(--border))', borderBottom: '1px solid hsl(var(--border))' }}
                  >◀</button>
                )}

                {showAI && (
                  <div className="no-print w-72 flex-shrink-0 overflow-hidden">
                    <AIPanel
                      nodes={nodes}
                      title={project.title}
                      onClose={() => setShowAI(false)}
                      onScriptUpdate={n => {
                        setNodes(n);
                        latestNodes.current = n; // sync immediately so beforeunload saves correct data
                        if (saveTimer.current) clearTimeout(saveTimer.current); // cancel debounce
                        if (projectId) {
                          saveScript(projectId, n);
                          setLastSaved(new Date());
                          setSaving(false);
                          setDirty(false);
                        }
                        editorRef.current?.resetNodes(n);
                        setScriptAppliedAt(Date.now());
                      }}
                      chatHistory={aiChatHistory}
                      onChatHistoryChange={setAiChatHistory}
                      beats={project.beatSheet ?? []}
                      castAndCrew={project.castAndCrew ?? []}
                      budget={project.budget ?? []}
                      onBeatsUpdate={beats => updateProject({ ...project, beatSheet: beats })}
                      onCastUpdate={cast => updateProject({ ...project, castAndCrew: cast })}
                      onBudgetUpdate={b => updateProject({ ...project, budget: b })}
                      onSwitchView={v => setView(v as EditorView)}
                      onRenameProject={name => updateProject({ ...project!, title: name })}
                      onAddFile={item => updateProject({ ...project, mediaItems: [...(project.mediaItems ?? []), item] })}
                      plan={getPlan()}
                    />
                  </div>
                )}
              </div>

              <StatusBar pages={pages} pageGoal={project.settings.pageGoal}
                words={words} writingTime={writingTime} thinkingTime={thinkingTime}
                isWritingRunning={isWritingRunning} isThinkingRunning={isThinkingRunning}
                onToggleWriting={() => setIsWritingRunning(v => !v)}
                onToggleThinking={() => setIsThinkingRunning(v => !v)}
                saving={saving} lastSaved={lastSaved} dirty={dirty} />
            </>
          )}

          {view === 'beat-sheet' && (
            // The wrapper used `display: contents` previously, which strips the
            // box from layout — `getBoundingClientRect()` returned zeros and the
            // tour spotlight had nothing to highlight. Use a real flex box that
            // fills the parent so the spotlight has a target.
            <div data-tour="beat-sheet-view" className="flex flex-1 flex-col overflow-hidden">
            <BeatSheetView beats={project.beatSheet}
              onChange={beats => updateProject({ ...project, beatSheet: beats })}
              nodes={nodes}
              title={project.title}
              pageGoal={project.settings.pageGoal} />
            </div>
          )}

          {view === 'cast-crew' && (
            <CastCrewView members={project.castAndCrew}
              onChange={(members: CastMember[]) => updateProject({ ...project, castAndCrew: members })}
              nodes={nodes}
              aiCharacters={project.aiCache.characters} />
          )}

          {view === 'storyboard' && (
            <StoryboardView
              nodes={nodes}
              mediaItems={project.mediaItems ?? []}
              onMediaChange={items => updateProject({ ...project, mediaItems: items })} />
          )}

          {view === 'budget' && (
            <BudgetView
              budget={project.budget ?? []}
              onChange={(lines: BudgetLine[]) => updateProject({ ...project, budget: lines })} />
          )}

          {view === 'schedule' && (
            <ScheduleView nodes={nodes} onSceneClick={i => { setView('script'); setTimeout(() => editorRef.current?.scrollToScene(i), 50); }} />
          )}

          {view === 'files' && (
            <FilesView
              mediaItems={project.mediaItems ?? []}
              onChange={items => updateProject({ ...project, mediaItems: items })} />
          )}
        </div>
      </div>

      {/* Modals */}
      {showInsights && <ScriptInsights nodes={nodes} title={project.title} onClose={() => setShowInsights(false)} />}
      {showFindReplace && (
        <FindReplace nodes={nodes} onReplace={n => { setNodes(n); scheduleSave(n); }} onClose={() => setShowFindReplace(false)}
          onScrollTo={i => editorRef.current?.scrollToNode(i)} />
      )}

      {/* Script Goals Modal */}
      {showScriptGoals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowScriptGoals(false)}>
          <div className="w-[420px] rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-foreground mb-1">Script Goals</h2>
            <p className="text-xs text-muted-foreground mb-5">Track your progress and set daily writing targets.</p>

            {/* Progress */}
            <div className="mb-5 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Pages</span>
                  <span>{pages} / {project.settings.pageGoal}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-primary" style={{ width: `${Math.min(100, (pages / project.settings.pageGoal) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Words today</span>
                  <span>{words.toLocaleString()} / {(project.settings.dailyWordGoal ?? 500).toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-all bg-violet-400" style={{ width: `${Math.min(100, (words / (project.settings.dailyWordGoal ?? 500)) * 100)}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Logline</label>
                <input type="text" value={goalDraft.logline}
                  onChange={e => setGoalDraft(d => ({ ...d, logline: e.target.value }))}
                  placeholder="One-sentence summary of your script..."
                  className="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Genre</label>
                <input type="text" value={goalDraft.genre}
                  onChange={e => setGoalDraft(d => ({ ...d, genre: e.target.value }))}
                  placeholder="e.g. Drama, Thriller, Comedy..."
                  className="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Page Goal</label>
                <input type="number" min="1" max="999" value={goalDraft.pageGoal}
                  onChange={e => setGoalDraft(d => ({ ...d, pageGoal: Number(e.target.value) }))}
                  className="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Daily Word Goal</label>
                <input type="number" min="1" value={goalDraft.dailyWordGoal}
                  onChange={e => setGoalDraft(d => ({ ...d, dailyWordGoal: Number(e.target.value) }))}
                  className="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Deadline</label>
                <input type="date" value={goalDraft.deadline}
                  onChange={e => setGoalDraft(d => ({ ...d, deadline: e.target.value }))}
                  className="w-full rounded-2xl border border-border bg-foreground/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-violet-400/70 focus:bg-violet-500/10 transition-colors" />
              </div>
            </div>

            {goalDraft.deadline && (() => {
              const days = Math.ceil((new Date(goalDraft.deadline).getTime() - Date.now()) / 86400000);
              // Use color, not emoji — keeps the chrome looking like a premium writing tool.
              const tone =
                days < 0 ? { color: 'rgb(239 68 68)', text: `Deadline passed ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` } :
                days === 0 ? { color: 'rgb(245 158 11)', text: 'Deadline is today' } :
                { color: 'hsl(var(--muted-foreground))', text: `${days} day${days === 1 ? '' : 's'} until deadline` };
              return (
                <div className="mb-4 text-xs font-medium" style={{ color: tone.color }}>
                  {tone.text}
                </div>
              );
            })()}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowScriptGoals(false)} className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-xl">Cancel</button>
              <button onClick={saveGoals} className="px-5 py-2.5 text-sm font-medium text-primary-foreground rounded-2xl bg-primary hover:bg-primary/90 transition-colors">Save Goals</button>
            </div>
          </div>
        </div>
      )}

      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowVersionHistory(false)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Version History</h2>
              <button onClick={() => setShowVersionHistory(false)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {versionHistory.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                  No saved versions yet. Versions are saved automatically when you manually save (⌘S).
                </div>
              ) : (
                versionHistory.map((v, i) => {
                  const wordCount = v.nodes.reduce((sum, n) => sum + (n.content.trim().split(/\s+/).filter(Boolean).length), 0);
                  const d = new Date(v.ts);
                  return (
                    <div key={v.ts} className="flex items-center justify-between px-6 py-3 border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <div>
                        <div className="text-sm text-foreground">{d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div className="text-xs text-muted-foreground">{d.toLocaleTimeString()} · {wordCount.toLocaleString()} words · {v.nodes.filter(n => n.type === 'scene_heading').length} scenes</div>
                      </div>
                      <div className="flex gap-2 items-center">
                        {i === 0 && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}>Latest</span>}
                        <button
                          onClick={() => {
                            if (confirm(`Restore version from ${d.toLocaleString()}? Current script will be overwritten.`)) {
                              const n = v.nodes;
                              setNodes(n); latestNodes.current = n;
                              if (projectId) { saveScript(projectId, n); setLastSaved(new Date()); }
                              editorRef.current?.resetNodes(n);
                              setShowVersionHistory(false);
                            }
                          }}
                          className="text-xs px-3 py-1.5 rounded-xl transition-colors"
                          style={{ background: 'hsl(var(--secondary))', color: 'hsl(var(--foreground) / 0.8)', border: '1px solid hsl(var(--border))' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--primary) / 0.5)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; }}
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showPrintOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => e.target === e.currentTarget && setShowPrintOptions(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <h2 className="text-sm font-semibold text-foreground mb-4">Print / Export PDF</h2>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground font-medium block mb-1.5">Watermark (optional)</label>
              <input
                value={printWatermark}
                onChange={e => setPrintWatermark(e.target.value)}
                placeholder="e.g. CONFIDENTIAL — John Smith"
                className="w-full rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all"
                style={{ background: 'hsl(var(--secondary))', border: '1px solid hsl(var(--border))' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'hsl(var(--primary) / 0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'hsl(var(--border))')}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Watermark appears diagonally across each page. Use per-recipient names to prevent leaks.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handlePrint}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(262 90% 50%))' }}>
                Print / Save PDF
              </button>
              <button onClick={() => setShowPrintOptions(false)}
                className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
