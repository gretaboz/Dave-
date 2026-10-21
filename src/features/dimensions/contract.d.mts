export interface DimensionInput {
  context:string;projectName?:string;limitations?:string[];
  categories:{id:string;revision:number;name:string;review:string}[];
  claims:{id:string;revision:number;statement:string;context:string;stakeholder?:string;limitations:string[];review:string;evidence:{id:string;revision:number}[]}[];
  relationships:{id:string;revision:number;description:string;type:string;review:string;explanation:string;contextCheck?:string;challenge?:string;limitations:string[];claims:{id:string;revision:number}[]}[];
  evidence:{id:string;revision:number;text:string;source:{id:string;revision:number};title:string;location:string;context:string;limitations:string[]}[];
  passages:{categoryId:string;revision:number;index:number;text:string;source:{id:string;revision:number};title:string;location:string;limitations:string[]}[];
  existingDimensions:{id:string;revision:number;name:string;explanation:string;lowLabel:string;midLabel?:string;highLabel:string;review:string}[];
}
export interface DimensionProposal {
 name:string;explanation:string;rationale:string;grounding:'research_grounded'|'inferred';
 lowLabel:string;midLabel:string;highLabel:string;lowExplanation:string;midExplanation:string;highExplanation:string;
 claimIds:string[];relationshipIds:string[];evidenceIds:string[];passages:{categoryId:string;revision:number;index:number}[];limitations:string[];
}
export interface DimensionOutput {dimensions:DimensionProposal[];warnings:string[]}
export function validateDimensionInput(input:unknown):asserts input is DimensionInput;
export function validateDimensionOutput(output:unknown,input:DimensionInput):DimensionOutput;
