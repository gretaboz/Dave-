
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {hasGeneratedDimensions,applyDimensions} from '../src/features/dimensions/generation';
import type {DimensionInput} from '../src/features/dimensions/contract.mjs';
test('generation lock survives edits, archival and project restoration',()=>{
 const store=createProjectStore();store.createProject({name:'Test',context:''});
 assert.equal(hasGeneratedDimensions(store.getProject()!),false);
 const d=store.dimensions.add({name:'Guidance',explanation:'Guidance choices',lowLabel:'Open',midLabel:'Optional',highLabel:'Guided',claims:[],relationships:[],limitations:[],review:{state:'proposed'},generation:{model:'test',promptVersion:'test',generatedAt:new Date().toISOString()}},'dave');
 store.dimensions.update(d.id,{name:'Edited'});
 store.dimensions.remove(d.id);
 const restored=createProjectStore();restored.restoreProject(store.getProject()!);
 const project=restored.getProject()!;
 assert.equal(hasGeneratedDimensions(project),true);
 assert.throws(()=>applyDimensions(project,{} as DimensionInput,{}),/already been generated/);
 assert.deepEqual(restored.getProject(),project);
});
