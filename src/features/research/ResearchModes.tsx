import { useState } from 'react';
import { ProjectProvider } from '../../state/ProjectProvider';
import type { ReactNode } from 'react';
import { ResearchWorkspace } from './ResearchWorkspace';
import { createDemoSession } from './demoResearch';

export function initialResearchMode(): 'demo' | 'live' {
  const saved = sessionStorage.getItem('dave-research-mode');
  return saved === 'live' || saved === 'demo' ? saved : import.meta.env.DEV ? 'demo' : 'live';
}

export function ResearchModes({ mode, onModeChange }: { mode: 'demo' | 'live'; onModeChange: (mode: 'demo' | 'live') => void }) {
  const switchMode = (next: 'demo' | 'live') => { sessionStorage.setItem('dave-research-mode', next); onModeChange(next); };
  const modeControl = <div className="research-mode-switch" role="group" aria-label="Research mode">
      <button type="button" className="research-text-button" aria-pressed={mode === 'demo'} onClick={() => switchMode('demo')}>Demo</button>
      <button type="button" className="research-text-button" aria-pressed={mode === 'live'} onClick={() => switchMode('live')}>Live AI</button>
      <span>{mode === 'demo' ? 'Demo mode · Synthetic material · No API calls' : 'Live AI mode · Analyses use OpenAI'}</span>
    </div>;
  return <ResearchWorkspace mode={mode} modeControl={modeControl} />;
}

/** The selected project is shared by every workflow stage, not just Research. */
export function ResearchProjectScope({mode,children}:{mode:'demo'|'live';children:ReactNode}) {
 const [demoSession]=useState(createDemoSession);
 return <ProjectProvider session={mode==='demo'?demoSession:undefined}><div key={mode}>{children}</div></ProjectProvider>;
}
