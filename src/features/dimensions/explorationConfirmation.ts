import {identicalTuning} from '../exploration/layout';
import type {DimensionContent,Project} from '../../model/types';
import {createProjectStore} from '../../state/projectStore';
function label(d:DimensionContent|undefined,value:number|null) {
 if(!d)return 'Earlier label unavailable';
 return value===null?'Undecided':value===0?d.lowLabel:value===.5?d.midLabel??'Middle label not set':value===1?d.highLabel:`${Math.round(value*100)}% between ${d.lowLabel} and ${d.highLabel}`;
}
export function explorationSettings(project:Project) {
 return project.dimensionPositions.filter(p=>p.selected&&!p.archivedAt).flatMap(p=>{
  const d=project.dimensions.find(d=>d.id===p.dimension.id&&!d.archivedAt&&(d.origin==='researcher'||d.review.state==='accepted'));
  if(!d)return [];
  const previous=d.revision===p.dimension.revision?d:d.history.find(h=>h.revision===p.dimension.revision)?.content;
  return [{position:{id:p.id,revision:p.revision},dimension:{id:d.id,revision:d.revision},name:d.name,value:p.value,label:label(d,p.value),previousLabel:label(previous,p.value),changed:d.revision!==p.dimension.revision}];
 });
}
export type ExplorationSettings=ReturnType<typeof explorationSettings>;
/** Explicitly reviewed labels can advance references, never the designer's numerical choices. */
export function confirmReviewedExploration(project:Project,reviewed:ExplorationSettings):Project {
 if(JSON.stringify(explorationSettings(project))!==JSON.stringify(reviewed))throw new Error('The selected settings changed during review. Click Confirm tuning to review them again.');
 const staged=createProjectStore();staged.restoreProject(project);
 for(const setting of reviewed.filter(s=>s.changed)){
  const position=project.dimensionPositions.find(p=>p.id===setting.position.id)!;
  staged.setDimensionPosition({...position,dimension:setting.dimension},{note:'Designer explicitly confirmed current dimension wording for exploration.'});
 }
 staged.confirmExploration();
 return staged.getProject()!;
}

/** Compare current selected tuning with saved snapshots, independent of revision counters. */
export function matchingExplorationBranch(project:Project) {
 const settings=explorationSettings(project);
 if(!settings.length||settings.some(s=>s.value===null))return undefined;
 const configuration=settings.map(s=>{
  const d=project.dimensions.find(d=>d.id===s.dimension.id)!;
  return {dimension:s.dimension,value:s.value!,lowLabel:d.lowLabel,midLabel:d.midLabel,highLabel:d.highLabel};
 });
 return project.exploration?.sessions.find(s=>identicalTuning(s.tuningSnapshot,configuration));
}
