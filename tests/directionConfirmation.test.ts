import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {confirmDirection} from '../src/features/directions/directionConfirmation';

test('designer confirmation keeps relevance separate from an undecided orientation',()=>{
 const store=createProjectStore();store.createProject({name:'Test',context:''});
 const source=store.sources.add({title:'Interview',originalFile:{id:'asset-1' as never,filename:'interview.txt',mediaType:'text/plain'},limitations:[],preparedContent:{format:'txt',extractedAt:new Date().toISOString(),sections:[{location:'paragraph 1',text:'People need a clear handoff before they start.'}],limitations:[]},processingState:'ready'});
 const evidence=store.evidence.add({source:{id:source.id,revision:1},text:'People need a clear handoff before they start.',form:'quotation',location:'paragraph 1',context:'Participant interview',limitations:[]});
 const parameter=store.dimensions.add({name:'Handoff timing',explanation:'When the handoff happens.',lowLabel:'',highLabel:'',evidence:[{id:evidence.id,revision:1}],claims:[],relationships:[],limitations:[],review:{state:'proposed'},directionReview:{state:'included',variability:'adjustable',orientation:{status:'undecided'},relevanceEvidence:[{id:evidence.id,revision:1}],orientationEvidence:[],challenges:[]}},'dave');
 const before=store.getProject()!;const result=confirmDirection(before,{title:'Direction v1',openQuestions:['When should this remain adjustable?']});
 const snapshot=result.direction.parameterSnapshot![0];assert.equal(snapshot.dimension.id,parameter.id);assert.equal(snapshot.orientation.status,'undecided');assert.equal(snapshot.relevanceEvidence.length,1);assert.equal(snapshot.orientationEvidence.length,0);assert.equal(result.direction.state,'retained');assert.equal(result.project.directions.length,1);assert.deepEqual(store.getProject(),before);
});

test('only explicit reviewed choices are confirmed and later confirmation creates an immutable successor',()=>{
 const store=createProjectStore();store.createProject({name:'Test',context:''});
 const included=store.dimensions.add({name:'Control',explanation:'Who controls the flow.',lowLabel:'',highLabel:'',claims:[],relationships:[],limitations:[],review:{state:'accepted'},directionReview:{state:'included',variability:'fixed',orientation:{status:'designer_set',text:'Designer can pause the flow'},relevanceEvidence:[],orientationEvidence:[],challenges:[]}});
 store.dimensions.add({name:'Tone',explanation:'How the experience sounds.',lowLabel:'',highLabel:'',claims:[],relationships:[],limitations:[],review:{state:'proposed'},directionReview:{state:'excluded',orientation:{status:'undecided'},relevanceEvidence:[],orientationEvidence:[],challenges:[]}});
 const first=confirmDirection(store.getProject()!,{title:'First'});store.restoreProject(first.project);
 store.dimensions.update(included.id,{directionReview:{...store.getProject()!.dimensions[0].directionReview!,orientation:{status:'designer_set',text:'The participant can pause the flow'}}});
 const second=confirmDirection(store.getProject()!,{title:'Second'});
 assert.equal(second.direction.parentDirection!.id,first.direction.id);assert.equal(first.direction.parameterSnapshot![0].orientation.text,'Designer can pause the flow');assert.equal(second.direction.parameterSnapshot![0].orientation.text,'The participant can pause the flow');assert.equal(second.direction.parameterSnapshot![1].reviewState,'excluded');
});

test('confirmation rejects implicit AI decisions and more than three questions',()=>{
 const store=createProjectStore();store.createProject({name:'Test',context:''});store.dimensions.add({name:'Guidance',explanation:'Guidance level.',lowLabel:'',highLabel:'',claims:[],relationships:[],limitations:[],review:{state:'proposed'}},'dave');
 assert.throws(()=>confirmDirection(store.getProject()!,{title:'No review'}),/Include at least one reviewed parameter/);
 store.dimensions.update(store.getProject()!.dimensions[0].id,{directionReview:{state:'included',variability:'adjustable',orientation:{status:'undecided'},relevanceEvidence:[],orientationEvidence:[],challenges:[]}});
 assert.throws(()=>confirmDirection(store.getProject()!,{title:'Too many',openQuestions:['1','2','3','4']}),/one to three/);
});
