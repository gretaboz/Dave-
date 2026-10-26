import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type CategorySelection = { id: string; token: number } | null;
const WorkspaceContext = createContext<{
  panelStage: string;
  inspectStage: (stage: string) => void;
  stageHost: HTMLDivElement | null;
  helpHost: HTMLDivElement | null;
  inspectorHost: HTMLDivElement | null;
  inspectCategory: (id: string) => void;
  categorySelection: CategorySelection;
  revealPanel: () => void;
  showDimensionControls: boolean;
  openDimensions: () => void;
  closeDimensions: () => void;
}>({ panelStage: 'Research', inspectStage: () => {}, helpHost: null, stageHost: null, inspectorHost: null, inspectCategory: () => {}, categorySelection: null, revealPanel: () => {}, showDimensionControls: false, openDimensions: () => {}, closeDimensions: () => {} });
export const useWorkspaceLayout = () => useContext(WorkspaceContext);

export function WorkspaceLayout({ stage, panelReset = 0, panel, children }: { panelReset?: number; stage: string; panel: (stage: string) => ReactNode; children: ReactNode }) {
  const [panelView, setPanelView] = useState({ workflow: stage, panelReset, stage });
  if (panelView.workflow !== stage || panelView.panelReset !== panelReset) setPanelView({ workflow: stage, panelReset, stage });
  const panelStage = panelView.workflow === stage && panelView.panelReset === panelReset ? panelView.stage : stage;
  const panelRef = useRef<HTMLElement>(null);
  const [showDimensionControls, setShowDimensionControls] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [helpHost, setHelpHost] = useState<HTMLDivElement | null>(null);
  const [stageHost, setStageHost] = useState<HTMLDivElement | null>(null);
  const [inspectorHost, setInspectorHost] = useState<HTMLDivElement | null>(null);
  const [categorySelection, setCategorySelection] = useState<CategorySelection>(null);
  const revealPanel = () => { setCollapsed(false); requestAnimationFrame(() => panelRef.current?.scrollTo({ top: 0 })); };
  return <WorkspaceContext.Provider value={{ panelStage, inspectStage: next => { setPanelView({ workflow: stage, panelReset, stage: next }); revealPanel(); }, helpHost, stageHost, inspectorHost, categorySelection, revealPanel, showDimensionControls,
    openDimensions: () => { setShowDimensionControls(true); revealPanel(); }, closeDimensions: () => setShowDimensionControls(false),
    inspectCategory: id => { setPanelView({ workflow: stage, panelReset, stage: 'Research' }); setCategorySelection({ id, token: Date.now() }); revealPanel(); } }}>
    <section className="continuous-workspace" data-panel-side={side} data-panel-collapsed={collapsed} aria-label="Shared design workspace">
      <div className="workspace-panel-controls">
        <button className="project-button" type="button" aria-controls="stage-side-panel" aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? 'Show panel' : 'Hide panel'}</button>
        <button className="project-button" type="button" onClick={() => setSide(value => value === 'left' ? 'right' : 'left')}>Move panel {side === 'left' ? 'right' : 'left'}</button>
      </div>
      <aside ref={panelRef} id="stage-side-panel" className="stage-side-panel" aria-label={`${panelStage} panel`} hidden={collapsed}>
        {panel(panelStage)}<div ref={setStageHost} /><div className="workspace-inspector-host" ref={setInspectorHost} />
      </aside>
      <div className="persistent-map-area">{children}</div>
    </section>
    <div className="workspace-map-help" ref={setHelpHost} />
  </WorkspaceContext.Provider>;
}
