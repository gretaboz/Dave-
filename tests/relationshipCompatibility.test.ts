import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {relationshipType} from '../src/features/relationships/presentation';
test('old types stay unclassified and review decisions are preserved',()=>{
 const s=createProjectStore();s.createProject({name:'Test',context:''});
 const source=s.sources.add({title:'Notes',originalFile:{id:'asset' as any,filename:'notes',mediaType:'text/plain'},limitations:[],processingState:'ready'});
 const e=s.evidence.add({source:{id:source.id,revision:1},text:'Synthetic evidence',form:'quotation',location:'Paragraph 1',context:'Interview',limitations:[]});
 const make=(statement:string)=>s.claims.add({statement,evidence:[{id:e.id,revision:1}],context:'Interview',limitations:[],review:{state:'accepted'}},'dave');
 const a=make('Cleaning effort influences use.'),b=make('Removable parts help expose residue.'),c=make('An independent reviewed claim.');
 const refs:[{claim:{id:typeof a.id;revision:number}},{claim:{id:typeof b.id;revision:number}}]=[{claim:{id:a.id,revision:1}},{claim:{id:b.id,revision:1}}];
 const legacy=s.relationships.add({description:'Older relationship',type:'trade_off',claims:refs,explanation:'Some competition',limitations:[],review:{state:'accepted'}});
 const modern=s.relationships.add({description:'Reviewed connection',type:'connection',claims:refs,evidence:[{id:e.id,revision:1}],explanation:'Related considerations',limitations:[],review:{state:'accepted'}});
 assert.equal(relationshipType(legacy.type),'unclassified');
 assert.equal(s.getProject()!.relationships.find(r=>r.id===legacy.id)!.review.state,'accepted');
 assert.throws(()=>s.relationships.add({description:'Invalid modern group',type:'potential_tension',claims:[...refs,{claim:{id:c.id,revision:1}}],explanation:'Not a pair',limitations:[],review:{state:'proposed'}}));
});
