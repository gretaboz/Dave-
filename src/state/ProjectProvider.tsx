import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createLocalPersistence } from '../persistence/localPersistence';
import { projectStore } from './projectStore';
import { createProjectSession } from './projectSession';

const appSession = createProjectSession(projectStore, createLocalPersistence());
type Session = ReturnType<typeof createProjectSession>;
const ProjectContext = createContext<Session | null>(null);

export function ProjectProvider({ children, session = appSession }: { children: ReactNode; session?: Session }) {
  useEffect(() => session.connect(), [session]);
  return <ProjectContext.Provider value={session}>{children}</ProjectContext.Provider>;
}

export function useProjectSession() {
  const session = useContext(ProjectContext);
  if (!session) throw new Error('Project hooks must be used inside ProjectProvider.');
  return session;
}

/** All stages read the same cached project and persistence status. */
export function useProject() {
  const session = useProjectSession();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}

/** Stable store access for later stage actions; does not add a read subscription. */
export function useProjectStore() {
  return useProjectSession().store;
}
