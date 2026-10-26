import { DimensionsWorkspace } from '../features/dimensions/DimensionsWorkspace';
import { useState } from 'react';
import { RelationshipsWorkspace } from '../features/relationships/RelationshipsWorkspace';
import { WorkspaceLayout } from './WorkspaceLayout';
import { ProjectWorkspace } from './ProjectWorkspace';
import { ResearchModes, ResearchProjectScope, initialResearchMode } from '../features/research/ResearchModes';

const daveLogo = new URL('../../design-reference/DAVE-UI-Handoff/visual-reference/assets/dave-logo.jpeg', import.meta.url).href;

const stages = ['Research', 'Relationships', 'Dimensions', 'Exploration'] as const;

export function App() {
  const [panelReset, setPanelReset] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [researchMode, setResearchMode] = useState(initialResearchMode);
  const [activeStage, setActiveStage] = useState<(typeof stages)[number]>('Research');


  return (
    <ResearchProjectScope mode={researchMode}><div className="app-shell">
      <header className="app-header">
        <img className="app-logo" src={daveLogo} alt="DAVE" />
        <ProjectWorkspace libraryOpen={libraryOpen} onLibraryChange={setLibraryOpen} onProjectOpened={() => { setLibraryOpen(false); setActiveStage('Research'); }} />
      </header>
      <nav className="workflow" aria-label="Design workflow">
        <ol className="workflow-stages">
          {stages.map((stage, index) => (
            <li className="workflow-stage" key={stage}>
              {index > 0 && <span className="workflow-connector" aria-hidden="true">→</span>}
              <button
                type="button"
                className="workflow-button"
                aria-current={activeStage === stage ? 'step' : undefined}
                onClick={() => { setLibraryOpen(false); setActiveStage(stage); setPanelReset(value => value + 1); }}
              >
                <span className="workflow-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                {stage}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <main className={`workspace${activeStage === 'Research' ? ' workspace-research' : activeStage === 'Relationships' ? ' workspace-relationships' : activeStage === 'Dimensions' ? ' workspace-dimensions' : ' workspace-exploration'}`} aria-label="Design workspace">
        <div hidden={libraryOpen}>
          <WorkspaceLayout stage={activeStage} panelReset={panelReset} panel={panelStage => <>
            <div hidden={panelStage !== 'Research'}><ResearchModes mode={researchMode} onModeChange={setResearchMode} /></div>
            <div hidden={panelStage !== 'Relationships'}><RelationshipsWorkspace mode={researchMode} controlsOnly /></div>
          </>}>
            <DimensionsWorkspace mode={researchMode} stage={activeStage === 'Exploration' ? 'Explore' : activeStage} onExplore={() => setActiveStage('Exploration')} />
          </WorkspaceLayout>
        </div>
      </main>
    </div></ResearchProjectScope>
  );
}
