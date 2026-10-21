
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {prepareRelationships,applyRelationships,relationshipsUpToDate,stabiliseExistingRelationships} from '../src/features/relationships/analysis';
function setup(){
 const s=createProjectStore();s.createProject({name:'Test',context:'Bag research'});
 const source=s.sources.add({title:'Interview',originalFile:{id:'file' as never,filename:'notes.txt',mediaType:'text/plain'},processingState:'ready',limitations:[],preparedContent:{format:'txt',extractedAt:new Date().toISOString(),limitations:[],sections:[{location:'Paragraph 1',text:'Carrying the bag hurts.'}]}});
 s.categories.add({name:'Usage',order:0,passages:[{source:{id:source.id,revision:1},sectionIndex:0,start:0,end:22}]});
 return s;
}
const output=(id:string)=>({claims:[{id,statement:'Carrying was uncomfortable in this account.',passageIds:['passage-0'],context:'Interview',stakeholder:'Participant',limitations:[]}],relationships:[]});
test('unchanged research is idempotent across edits and restoration; new research enables refresh',()=>{
 const s=setup();const original=s.getProject()!;
 s.restoreProject(applyRelationships(original,prepareRelationships(original),output('first')));
 const c=s.getProject()!.claims[0];
 s.claims.update(c.id,{statement:'My corrected wording'});
 const saved=s.getProject()!;const restored=createProjectStore();restored.restoreProject(saved);
 assert.equal(relationshipsUpToDate(restored.getProject()!),true);
 assert.deepEqual(applyRelationships(saved,prepareRelationships(saved),output('again')),saved);
 restored.sources.add({title:'New source',originalFile:{id:'new-file' as never,filename:'new.txt',mediaType:'text/plain'},processingState:'ready',limitations:[]});
 assert.equal(relationshipsUpToDate(restored.getProject()!),false);
 const changed=restored.getProject()!;
 const next=applyRelationships(changed,prepareRelationships(changed),output('next'));
 assert.equal(next.claims.find(claim=>claim.id===c.id)!.statement,'My corrected wording');
 assert.equal(next.claims.find(claim=>claim.id===c.id)!.archivedAt,undefined);
});
test('refresh archives untouched AI claims and rejects category overflow atomically',()=>{
 const s=setup();const p=s.getProject()!;
 const first=applyRelationships(p,prepareRelationships(p),output('first'));
 s.restoreProject(first);s.updateProject({context:'Updated project context'});
 const changed=s.getProject()!;
 const next=applyRelationships(changed,prepareRelationships(changed),output('next'));
 assert.ok(next.claims[0].archivedAt);
 assert.equal(next.claims.filter(c=>!c.archivedAt).length,1);
 const tooMany={claims:Array.from({length:11},(_,i)=>({...output('c'+i).claims[0]})),relationships:[]};
 assert.throws(()=>applyRelationships(changed,prepareRelationships(changed),tooMany),/Too many claims/);
 assert.deepEqual(s.getProject(),changed);
});

test('legacy accumulated batches are consolidated without another analysis and remain locked',()=>{
 const s=setup();const p=s.getProject()!;
 const first=applyRelationships(p,prepareRelationships(p),output('first'));
 const legacy=structuredClone(first);delete legacy.relationshipResearchKey;
 const original=legacy.claims[0];
 original.createdAt='2026-10-20T10:00:00.000Z';
 for(let i=0;i<15;i++)legacy.claims.push({...structuredClone(original),id:('claim-'+i) as typeof original.id,statement:'Distinct claim '+i,createdAt:'2026-10-20T11:00:00.000Z'});
 const cleaned=stabiliseExistingRelationships(legacy);
 assert.equal(cleaned.claims.filter(c=>!c.archivedAt).length,10);
 assert.equal(cleaned.claims.length,16);
 assert.ok(cleaned.claims[0].archivedAt);
 assert.equal(relationshipsUpToDate(cleaned),true);
 assert.strictEqual(stabiliseExistingRelationships(cleaned),cleaned);
 s.restoreProject(cleaned);
 assert.equal(relationshipsUpToDate(s.getProject()!),true);
});
