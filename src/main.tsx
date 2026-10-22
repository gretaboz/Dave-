import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ProjectProvider } from './state/ProjectProvider';
import '@fontsource/dm-sans/400.css';
import '@fontsource-variable/dm-sans/wght.css';
import '@fontsource-variable/dm-sans/wght-italic.css';
import './app/styles.css';
import './app/research-relationships.css';
import './app/dimensions-exploration.css';
import './app/workspace-layout.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>,
);
