import type {Direction, DirectionContent, DirectionParameterSnapshot, EntityReference, Project, ResearchReferences} from '../../model/types';
import {createProjectStore} from '../../state/projectStore';

const ref = <K extends string>(item:{id:string;revision:number}):EntityReference<K> => ({id:item.id as EntityReference<K>['id'],revision:item.revision});
const unique = <K extends string>(items:EntityReference<K>[]) => [...new Map(items.map(item=>[`${item.id}:${item.revision}`,item])).values()];

export interface ConfirmDirectionInput {
  title: string;
  description?: string;
  reasoning?: string;
  openQuestions?: string[];
}

/** Build an immutable, designer-confirmed direction without changing the supplied project. */
export function confirmDirection(project:Project,input:ConfirmDirectionInput):{project:Project;direction:Direction} {
  const title=input.title.trim();
  if(!title)throw new Error('Give this direction a title.');
  const questions=(input.openQuestions??[]).map(question=>question.trim()).filter(Boolean);
  if(questions.length>3)throw new Error('Keep direction review to one to three designer-judgment questions.');
  const reviewed=project.dimensions.filter(d=>!d.archivedAt&&d.directionReview&&d.directionReview.state!=='proposed');
  const included=reviewed.filter(d=>d.directionReview!.state==='included');
  if(!included.length)throw new Error('Include at least one reviewed parameter before confirming a direction.');
  for(const dimension of included) {
    if(!dimension.directionReview!.variability)throw new Error(`Choose fixed or adjustable for “${dimension.name}”.`);
  }
  const parameterSnapshot:DirectionParameterSnapshot[]=reviewed.map(dimension=>({
    dimension:ref<'dimension'>(dimension),name:dimension.name,description:dimension.explanation,origin:dimension.origin,
    reviewState:dimension.directionReview!.state as DirectionParameterSnapshot['reviewState'],
    variability:dimension.directionReview!.variability,orientation:structuredClone(dimension.directionReview!.orientation),
    relevanceEvidence:structuredClone(dimension.directionReview!.relevanceEvidence),
    orientationEvidence:structuredClone(dimension.directionReview!.orientationEvidence),
    researchPassages:structuredClone(dimension.researchPassages??[]),challenges:[...dimension.directionReview!.challenges],limitations:[...dimension.limitations],
  }));
  const references:ResearchReferences={
    evidence:unique(parameterSnapshot.flatMap(parameter=>[...parameter.relevanceEvidence,...parameter.orientationEvidence])),
    claims:unique(reviewed.flatMap(dimension=>dimension.claims)),relationships:unique(reviewed.flatMap(dimension=>dimension.relationships)),
    dimensions:reviewed.map(dimension=>ref<'dimension'>(dimension)),
  };
  const previous=[...project.directions].reverse().find(direction=>direction.state==='retained'&&direction.parameterSnapshot);
  const content:Omit<DirectionContent,'tuningSnapshot'>={title,description:input.description?.trim()??'',reasoning:input.reasoning?.trim()??'',openQuestions:questions,state:'retained',explorationNodes:[],references,limitations:uniqueText(parameterSnapshot.flatMap(parameter=>parameter.limitations)),parameterSnapshot,confirmedAt:new Date().toISOString(),...(previous?{parentDirection:ref<'direction'>(previous)}:{})};
  const staged=createProjectStore();staged.restoreProject(project);const direction=staged.createDirection(content,[]);
  return {project:staged.getProject()!,direction};
}

function uniqueText(items:string[]) { return [...new Set(items.map(item=>item.trim()).filter(Boolean))]; }
