import type { ExplorationNode, ExplorationSession, ExplorationSetting, Project } from '../../model/types';
export const EXPLORATION_X = 1430;
export const BRANCH_WIDTH = 260;
export const CONTENT_X = EXPLORATION_X + BRANCH_WIDTH + 80;
export const IDEA_WIDTH = 240;
export const IDEA_HEIGHT = 240;
export const IDEA_TOP = 40;
export function branchName(project:Project,branch:ExplorationSession) { return branch.name ?? `Branch ${(project.exploration?.sessions.findIndex(s=>s.id===branch.id)??0)+1}`; }
export function branchPoint(project:Project,branch:ExplorationSession) { return branch.position ?? {x:EXPLORATION_X,y:40+Math.max(0,project.exploration?.sessions.findIndex(s=>s.id===branch.id)??0)*480}; }
export function branchHeight(branch:ExplorationSession,expanded=branch.expanded??false) { return expanded?86+Math.min(300,branch.tuningSnapshot.length*72):86; }
export function ideaPoint(node: ExplorationNode) {
  // Legacy positions stay intact in storage. New coordinates leave room for tuning branches.
  if(node.branchAligned)return node.position;
  return node.coordinateSpace === 'design-map' ? {x:node.position.x+BRANCH_WIDTH+80,y:node.position.y} : {x:node.position.x+CONTENT_X+24,y:node.position.y+220};
}
export function branchStart(project:Project,branch:ExplorationSession) { const p=branchPoint(project,branch);return {x:Math.max(CONTENT_X,p.x+BRANCH_WIDTH+80),y:p.y}; }
export function nextBranchPoint(project:Project) {
 return {x:EXPLORATION_X,y:Math.max(40,...(project.exploration?.sessions??[]).map(s=>branchPoint(project,s).y+branchHeight(s,true)+80),...project.explorationNodes.filter(n=>!n.archivedAt).map(n=>ideaPoint(n).y+IDEA_HEIGHT+80))};
}
type TuningConfiguration=Pick<ExplorationSetting,'dimension'|'value'|'lowLabel'|'midLabel'|'highLabel'>;
export function identicalTuning(a:TuningConfiguration[],b:TuningConfiguration[]) {
 const signature=(s:TuningConfiguration[])=>JSON.stringify(s.map(p=>({id:p.dimension.id,value:p.value,low:p.lowLabel,mid:p.midLabel,high:p.highLabel})).sort((a,b)=>a.id.localeCompare(b.id)));
 return signature(a)===signature(b);
}
export function freeIdeaPoint(nodes: ExplorationNode[], preferred: { x: number; y: number }, except?: string) {
  const p = { x: Math.max(CONTENT_X, preferred.x), y: Math.max(IDEA_TOP, preferred.y) };
  const occupied = (x: number, y: number) => nodes.some(n => {
    if (n.id === except) return false;
    const q = ideaPoint(n);
    return x < q.x + IDEA_WIDTH + 24 && x + IDEA_WIDTH + 24 > q.x && y < q.y + IDEA_HEIGHT + 24 && y + IDEA_HEIGHT + 24 > q.y;
  });
  while (occupied(p.x, p.y)) p.y += IDEA_HEIGHT + 32;
  return p;
}
