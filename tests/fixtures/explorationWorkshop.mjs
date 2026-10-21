// Synthetic workshop contexts, never presented as real research or inserted into saved projects.
import {questionInput} from './exploration.mjs';
export const workshopProjects=[
 {name:'Citrus press',context:'A manual citrus press for people with limited hand strength in a home kitchen.',dimension:'Cleaning effort',label:'Easy to clean',meaning:'Explore removing pulp and rinsing with little hand effort.',research:'One participant avoids using the press because pulp sticks in small gaps.',idea:'A removable pulp tray catches the pulp.',development:'The tray slides out by a broad tab while the press stays on the counter.',initialFocus:/press|pulp|rins|clean/i,followFocus:/tray|pulp|tab|slid/i},
 {name:'Cycling bag',context:'A commuting bag used on a bicycle at night and carried into an office in daylight.',dimension:'Visibility',label:'Visible at night, quiet in daylight',meaning:'Explore night visibility while keeping an ordinary daytime appearance.',research:'One commuter wants the bag noticed by drivers after dark but does not want bright sports styling at work.',idea:'Reflective material on the outside of the bag.',development:'Reflective strips sit on the shoulder straps and should remain visible while riding.',initialFocus:/bag|night|dark|day|cycl/i,followFocus:/reflect|strip|strap|bag/i},
 {name:'Community seed library',context:'A seed-sharing service for first-time gardeners borrowing seeds at a community centre.',dimension:'Guidance',label:'Enough help to start independently',meaning:'Explore how a first-time borrower can choose and plant seeds without staff assistance.',research:'One visitor could not tell which seeds could be planted in a small pot.',idea:'Each seed packet has a picture showing the plant in a pot.',development:'The picture shows the grown plant next to the pot size; borrowers choose packets without asking staff.',initialFocus:/seed|plant|garden|borrow|pot/i,followFocus:/picture|packet|pot|seed/i},
];
export function workshopInput(project,stage='initial',previousQuestions=[]) {
 const input=questionInput();
 input.project={id:'workshop-project',name:project.name,context:project.context};
 input.settings=[{...input.settings[0],name:project.dimension,label:project.label,meaning:project.meaning}];
 input.claims=[];input.categories=[];input.evidence=[{...input.evidence[0],text:project.research,title:'Synthetic workshop interview',location:'Fixture paragraph 1'}];
 input.previousQuestions=previousQuestions;
 if(stage!=='initial'){
  const idea={id:'workshop-idea',revision:1,title:'Designer idea',kind:'idea',text:project.idea,origin:'researcher'};
  input.branch=[idea];
  if(stage==='developed')input.branch.push({id:'workshop-development',revision:1,title:'Designer development',kind:'note',text:project.development,origin:'researcher'});
  const selected=input.branch.at(-1);input.request={mode:'followup',selectedId:selected.id,parentId:selected.id};
 }
 return input;
}
