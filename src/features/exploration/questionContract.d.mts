export type QuestionPurpose='open_possibilities'|'explore_alternatives'|'challenge_assumptions';
export interface Ref {id:string;revision:number}
export interface QuestionInput {
 project:{id:string;name:string;context:string};session:Ref;request:{mode:'initial'|'followup'|'alternative';selectedId:string|null;parentId:string|null};
 branch:{id:string;revision:number;title:string;kind:string;text:string;origin:string}[];previousQuestions:string[];questionFingerprints:string[];
 settings:{dimension:Ref;position:Ref;name:string;label:string;value:number;meaning:string}[];
 claims:{id:string;revision:number;text:string;evidence:Ref[];limitations:string[]}[];
 relationships:{id:string;revision:number;text:string;type:string;claims:Ref[];limitations:string[]}[];
 evidence:{id:string;revision:number;text:string;source:Ref;title:string;location:string}[];categories:{id:string;revision:number;name:string;review:string}[];passages:{id:string;category:Ref;source:Ref;sectionIndex:number;start:number;end:number;text:string;title:string;location:string}[];limitations:string[];
}
export interface QuestionOutput {question:string;questionPurpose?:QuestionPurpose;purpose:string;grounding:'research_grounded'|'inferred';positionIds:string[];claimIds:string[];relationshipIds:string[];evidenceIds:string[];categoryIds:string[];passageIds:string[];limitations:string[];model?:string;promptVersion?:string}
export function validateQuestionInput(input:QuestionInput):QuestionInput;
export function validateQuestionOutput(output:unknown,input:QuestionInput):QuestionOutput;
export function questionFingerprint(text:string):string;

export function questionStrategy(input:QuestionInput):{allowedPurposes:QuestionPurpose[];preferredPurpose:QuestionPurpose;latestContribution:QuestionInput['branch'][number]|null};
