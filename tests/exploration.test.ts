import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {assertProjectSnapshot} from '../src/model/validateProject';
import {freeIdeaPoint, ideaPoint, EXPLORATION_X} from '../src/features/exploration/layout';

function setup() {
 const store=createProjectStore();store.createProject({name:'Test',context:''});
 const d=store.dimensions.add({name:'Guidance',explanation:'Test',lowLabel:'Open',midLabel:'Optional',highLabel:'Guided',claims:[],relationships:[],limitations:[],review:{state:'accepted'}});
 const p=store.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:.5});return {store,d,p};
}
test('confirmation is immutable, preserves tuning and provenance, and later confirmations append sessions',()=>{
 const {store,d,p}=setup();const before=store.getProject()!;const session=store.confirmExploration();
 assert.equal(session.tuningSnapshot[0].positionLabel,'Optional');assert.deepEqual(store.getProject()!.dimensions,before.dimensions);assert.deepEqual(store.getProject()!.dimensionPositions,before.dimensionPositions);
 store.setDimensionPosition({...p,value:1});store.dimensions.update(d.id,{name:'Updated guidance'});
 assert.deepEqual(store.getProject()!.exploration!.sessions[0],session);
 assert.throws(()=>store.confirmExploration(),/has changed/);
 const current=store.getProject()!.dimensions[0];store.setDimensionPosition({...p,dimension:{id:d.id,revision:current.revision},value:1});
 store.confirmExploration();assert.equal(store.getProject()!.exploration!.sessions.length,2);assert.deepEqual(store.getProject()!.exploration!.sessions[0],session);
});
test('invalid confirmation never changes the project',()=>{
 const {store,p}=setup();store.setDimensionPosition({...p,selected:false});let before=store.getProject();assert.throws(()=>store.confirmExploration(),/Select at least/);assert.deepEqual(store.getProject(),before);
 store.setDimensionPosition({...p,value:null});before=store.getProject();assert.throws(()=>store.confirmExploration(),/Choose a position/);assert.deepEqual(store.getProject(),before);
});
test('deletion archives cards and incident edges while preserving revisions and snapshot references',()=>{
 const {store}=setup();const session=store.confirmExploration();
 const input={title:'Idea',content:{type:'idea' as const,text:'Text'},position:{x:1454,y:280},coordinateSpace:'design-map' as const,references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:session.tuningSnapshot.map(s=>s.position),explorationSession:{id:session.id,revision:1},limitations:[]};
 const a=store.explorationNodes.add(input),b=store.explorationNodes.add({...input,position:{x:1800,y:280}});const c=store.explorationConnections.add({fromNodeId:a.id,toNodeId:b.id,directional:true});
 store.explorationNodes.update(a.id,{position:{x:1454,y:520}});assert.equal(store.getProject()!.explorationNodes[0].revision,1);
 store.explorationNodes.update(a.id,{title:'Edited'});store.explorationNodes.remove(a.id);
 const p=store.getProject()!;assert.ok(p.explorationNodes[0].archivedAt);assert.equal(p.explorationNodes[0].history[0].content.title,'Idea');assert.ok(p.explorationConnections.find(e=>e.id===c.id)!.archivedAt);assert.deepEqual(p.exploration!.sessions[0],session);assert.throws(()=>store.explorationConnections.add({fromNodeId:a.id,toNodeId:b.id,directional:true}),/deleted/);
});
test('legacy snapshots and layout stay readable; new placements avoid occupied cards',()=>{
 const {store}=setup();const node=store.explorationNodes.add({title:'Legacy',content:{type:'idea',text:'Keep'},position:{x:0,y:0},references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:[],limitations:[]});
 const snapshot=store.getProject()!;assert.equal(snapshot.exploration,undefined);assertProjectSnapshot(snapshot);
 const p=ideaPoint(node);assert.ok(p.x>EXPLORATION_X);assert.deepEqual(node.position,{x:0,y:0});assert.ok(freeIdeaPoint([node],p).y>=p.y+180);
 store.setMapView('Explore',{x:-1000,y:10,scale:.85});assertProjectSnapshot(store.getProject());assert.throws(()=>store.setMapView('Explore',{x:NaN,y:0,scale:1}),/Invalid/);
});
