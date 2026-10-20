import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {prepareQuestion,applyQuestion} from '../src/features/exploration/questions';
import type {QuestionInput} from '../src/features/exploration/questionContract.mjs';
function setup(){
 const store=createProjectStore();store.createProject({name:'Press',context:'A citrus press for people with limited strength.'});
 const source=store.sources.add({title:'Interview',originalFile:{id:'asset' as never,filename:'test.txt',mediaType:'text/plain'},processingState:'ready',limitations:[]});
 const evidence=store.evidence.add({source:{id:source.id,revision:1},text:'I avoid washing extra parts.',form:'quotation',location:'Paragraph 1',context:'One participant',limitations:[]});
 const claim=store.claims.add({statement:'Cleanup effort discourages use.',evidence:[{id:evidence.id,revision:1}],limitations:[],review:{state:'accepted'}});
 const d=store.dimensions.add({name:'Cleaning',explanation:'Cleaning effort',lowLabel:'Quick rinse',midLabel:'Easy cleaning',highLabel:'Deep cleaning',claims:[{id:claim.id,revision:1}],relationships:[],limitations:[],review:{state:'accepted'}});
 const p=store.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:.5});store.confirmExploration();return {store,p};
}
const output=(i:QuestionInput,question='What makes cleaning the press difficult with limited hand strength?')=>({question,purpose:'Explore cleanup effort.',grounding:'research_grounded',positionIds:[i.settings[0].position.id],claimIds:[i.claims[0].id],relationshipIds:[],evidenceIds:[],categoryIds:[],passageIds:[],limitations:[],model:'test',promptVersion:'test'});
test('questions retain provenance, confirmed tuning and only the selected branch; no images or sibling responses are sent',()=>{
 const {store,p}=setup();let project=store.getProject()!;const input=prepareQuestion(project);const result=applyQuestion(project,input,output(input));store.restoreProject(result.project);const q=result.node;
 const idea=(title:string)=>store.explorationNodes.add({title,content:{type:'idea',text:title},branchParent:{id:q.id,revision:q.revision},position:{x:1800,y:220},references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:q.dimensionPositions,explorationSession:q.explorationSession,limitations:[]});
 const a=idea('A: integrated cleaning surface'),b=idea('B: unrelated secret sibling');
 store.explorationConnections.add({fromNodeId:q.id,toNodeId:a.id,directional:true});store.explorationConnections.add({fromNodeId:q.id,toNodeId:b.id,directional:true});
 store.setDimensionPosition({...p,value:1});project=store.getProject()!;
 const follow=prepareQuestion(project,a.id,'followup');assert.equal(follow.settings[0].value,.5);assert.deepEqual(follow.branch.map(n=>n.id),[q.id,a.id]);assert.ok(!JSON.stringify(follow).includes(b.content.text));
 const next=applyQuestion(project,follow,output(follow,'How would someone clean that surface using only one hand?'));assert.equal(next.node.branchParent?.id,a.id);assert.equal(next.node.origin,'dave');assert.equal(next.node.question?.considered.claims.length,1);assert.equal(next.project.explorationNodes.length,4);
});
test('stale edits, fabricated references and duplicate questions leave project untouched; movements preserve pending context',()=>{
 const {store}=setup();const input=prepareQuestion(store.getProject()!);store.updateProject({context:'Changed research context'});const before=store.getProject();assert.throws(()=>applyQuestion(before!,input,output(input)),/changed/);assert.deepEqual(store.getProject(),before);
 const current=prepareQuestion(before!);assert.throws(()=>applyQuestion(before!,current,{...output(current),claimIds:['fabricated']}),/unavailable/);
 const first=applyQuestion(before!,current,output(current));store.restoreProject(first.project);
 const next=prepareQuestion(first.project,first.node.id,'followup');store.explorationNodes.update(first.node.id,{position:{x:2000,y:400}});assert.doesNotThrow(()=>applyQuestion(store.getProject()!,next,output(next,'How would a different user approach the cleaning step?')));
 assert.throws(()=>applyQuestion(first.project,next,output(next)),/repeated/);
});
test('alternatives preserve the original question and its responses; ambiguous legacy merges are not silently mixed',()=>{
 const {store}=setup();const i=prepareQuestion(store.getProject()!);const first=applyQuestion(store.getProject()!,i,output(i));
 const alt=prepareQuestion(first.project,first.node.id,'alternative');const second=applyQuestion(first.project,alt,output(alt,'Which part of cleanup needs the most attention for this user?'));
 assert.equal(second.project.explorationNodes[0].questionState,'skipped');assert.equal(second.node.branchParent,undefined);assert.equal(second.project.explorationNodes.length,2);
 store.restoreProject(second.project);const bare=store.explorationNodes.add({title:'Merged',content:{type:'idea',text:'Merged'},position:{x:2000,y:600},references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:[],limitations:[]});
 store.explorationConnections.add({fromNodeId:first.node.id,toNodeId:bare.id,directional:true});store.explorationConnections.add({fromNodeId:second.node.id,toNodeId:bare.id,directional:true});assert.throws(()=>prepareQuestion(store.getProject()!,bare.id,'followup'),/multiple branches/);
});

test('source passages remain original references and skipped questions retain DAVE authorship',()=>{
 const {store,p}=setup();const project=store.getProject()!;const source=store.sources.update(project.sources[0].id,{preparedContent:{format:'txt',extractedAt:new Date().toISOString(),sections:[{location:'Paragraph 1',text:'Cleanup is hard with one hand.'}],limitations:[]}});
 const passage={source:{id:source.id,revision:source.revision},sectionIndex:0,start:0,end:30};
 const category=store.categories.add({name:'Cleanup',order:0,passages:[passage],review:{state:'accepted'}});
 const d=store.dimensions.update(project.dimensions[0].id,{claims:[],researchPassages:[{category:{id:category.id,revision:category.revision},passage}]});
 store.setDimensionPosition({...p,dimension:{id:d.id,revision:d.revision},value:1});store.confirmExploration();
 const input=prepareQuestion(store.getProject()!);assert.equal(input.passages.length,1);assert.equal(input.passages[0].text,'Cleanup is hard with one hand.');
 const generated=applyQuestion(store.getProject()!,input,{question:'What changes when this press must be cleaned with one hand?',purpose:'Explore one-handed cleanup.',grounding:'research_grounded',positionIds:[p.id],claimIds:[],relationshipIds:[],evidenceIds:[],categoryIds:[category.id],passageIds:[input.passages[0].id],limitations:[],model:'test',promptVersion:'test'});
 assert.deepEqual(generated.node.question?.researchPassages?.[0].passage,passage);store.restoreProject(generated.project);store.explorationNodes.update(generated.node.id,{questionState:'skipped'});assert.equal(store.getProject()!.explorationNodes.at(-1)!.origin,'dave');
});
