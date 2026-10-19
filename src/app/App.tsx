import { DimensionsWorkspace } from '../features/dimensions/DimensionsWorkspace';
import { useState } from 'react';
import { RelationshipsWorkspace } from '../features/relationships/RelationshipsWorkspace';
import { ProjectWorkspace } from './ProjectWorkspace';
import { ResearchModes, ResearchProjectScope, initialResearchMode } from '../features/research/ResearchModes';

const stages = ['Research', 'Relationships', 'Dimensions', 'Explore', 'Directions'] as const;

export function App() {
  const [researchMode, setResearchMode] = useState(initialResearchMode);
  const [activeStage, setActiveStage] = useState<(typeof stages)[number]>('Research');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-identity">DAVE</h1>
        <span className="app-description">Design workspace</span>
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
                onClick={() => setActiveStage(stage)}
              >
                <span className="workflow-number" aria-hidden="true">{index + 1}.</span>
                {stage}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <ResearchProjectScope mode={researchMode}><main className={`workspace${activeStage === 'Research' ? ' workspace-research' : ''}`} aria-label="Design workspace">
        {activeStage !== 'Research' && <h2 className="workspace-title">{activeStage}</h2>}
        <ProjectWorkspace />
        {activeStage === 'Dimensions' && <DimensionsWorkspace mode={researchMode} />}
        <div hidden={activeStage !== 'Relationships'}><RelationshipsWorkspace mode={researchMode} /></div>
        <div hidden={activeStage !== 'Research'}><ResearchModes mode={researchMode} onModeChange={setResearchMode} /></div>
      </main></ResearchProjectScope>
    </div>
  );
}
