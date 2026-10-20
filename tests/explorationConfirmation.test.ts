import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {explorationSettings,confirmReviewedExploration} from '../src/features/dimensions/explorationConfirmation';
test('explicit review repairs stale references without moving positions or changing earlier snapshots',()=>{
 const s=createProjectStore();s.createProject({name:'Test',context:''});const d=s.dimensions.add({name:'Guidance',lowLabel:'Open',midLabel:'Optional',highLabel:'Guided',explanation:'Test',claims:[],relationships:[],limitations:[],review:{state:'accepted'}});s.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:1});const earlier=s.confirmExploration();s.dimensions.update(d.id,{highLabel:'More guidance'});
 const before=s.getProject()!;const review=explorationSettings(before);assert.equal(review[0].previousLabel,'Guided');assert.equal(review[0].label,'More guidance');assert.equal(review[0].changed,true);
 const result=confirmReviewedExploration(before,review);assert.equal(result.dimensionPositions[0].value,1);assert.equal(result.dimensionPositions[0].selected,true);assert.equal(result.dimensionPositions[0].history[0].content.dimension.revision,1);assert.equal(result.exploration!.sessions[1].tuningSnapshot[0].positionLabel,'More guidance');assert.deepEqual(result.exploration!.sessions[0],earlier);assert.deepEqual(s.getProject(),before);
 s.dimensions.update(d.id,{highLabel:'Changed again'});assert.throws(()=>confirmReviewedExploration(s.getProject()!,review),/changed during review/);
});

test('proposed AI dimensions can be confirmed without approval or research, preserving provenance',()=>{
 const s=createProjectStore();s.createProject({name:'Test',context:''});
 const d=s.dimensions.add({name:'Guidance',lowLabel:'Open',midLabel:'Optional',highLabel:'Guided',explanation:'Possibility',claims:[],relationships:[],limitations:['No evidence supplied.'],grounding:'inferred',review:{state:'proposed'}},'dave');
 s.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:.5});
 assert.equal(s.getProject()!.exploration,undefined);
 assert.equal(explorationSettings(s.getProject()!).length,1);
 s.confirmExploration();
 assert.deepEqual(s.getProject()!.dimensions[0],d);
 assert.equal(s.getProject()!.exploration!.sessions.length,1);
});
