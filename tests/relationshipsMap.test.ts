import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createProjectStore} from '../src/state/projectStore';
import {claimCategories, deriveMap} from '../src/features/relationships/mapLayout';
test('category grounding avoids duplicates, unmatched evidence is unassigned and movement preserves reviews and revisions',()=>{
 const s=createProjectStore();s.createProject({name:'Map test',context:''});
 const source=s.sources.add({title:'Notes',originalFile:{id:'asset' as any,filename:'notes.txt',mediaType:'text/plain'},limitations:[],processingState:'ready',preparedContent:{format:'txt',extractedAt:new Date().toISOString(),sections:[{location:'Paragraph 1',text:'Cleaning takes effort.'}],limitations:[]}});
 const passage={source:{id:source.id,revision:1},sectionIndex:0,start:0,end:22};
 const a=s.categories.add({name:'Cleaning',order:0,passages:[passage]});
 const b=s.categories.add({name:'Ergonomics',order:1,passages:[passage]});
 const e=s.evidence.add({source:passage.source,text:'Cleaning takes effort.',form:'quotation',location:'Paragraph 1',context:'',limitations:[],passage,categories:[{id:a.id,revision:1},{id:b.id,revision:1}]},'dave');
 const c=s.claims.add({statement:'Cleanup may influence repeated use.',evidence:[{id:e.id,revision:1}],context:'Interview',limitations:[],review:{state:'accepted'}},'dave');
 assert.deepEqual(claimCategories(s.getProject()!,c),[a.id,b.id]);
 const m=deriveMap(s.getProject()!);assert.equal(m.regions.reduce((n,r)=>n+r.members.length,0),1);
 s.claims.update(c.id,{mapPosition:{x:90,y:100}});
 const moved=s.getProject()!.claims[0];assert.equal(moved.revision,1);assert.equal(moved.origin,'dave');assert.equal(moved.review.state,'accepted');assert.equal(moved.history.length,0);
 assert.throws(()=>s.claims.update(c.id,{mapPosition:{x:NaN,y:0}}));
 const restored=createProjectStore();restored.restoreProject(s.getProject()!);assert.deepEqual(deriveMap(restored.getProject()!).positions.get(c.id),{x:90,y:100});
 s.categories.remove(a.id);s.categories.remove(b.id);assert.equal(deriveMap(s.getProject()!).regions[0].name,'Unassigned');
});

import {claimMapLabel} from '../src/features/relationships/presentation';
test('map labels describe topics without changing full research interpretations',()=>{
 const examples=[
 ['Manual citrus presses are described with trade-offs involving price, size, leverage, sturdiness, and versatility.','Manual presses balance leverage, size and price'],
 ['Entry-level manual citrus presses focus on compactness, price, and easy rinsing, while more expensive options emphasize leverage.','Entry-level presses favour compactness and easy rinsing'],
 ['Leverage, grip, and control interact as a trade-off where increased leverage may reduce effort but decrease precision.','More leverage can reduce effort and precision'],
 ['Cleanup may discourage use.','Cleanup may discourage use'],
 ];
 for(const [original,expected]of examples){assert.equal(claimMapLabel(original),expected);assert.ok(!claimMapLabel(original).includes('…'));assert.ok(claimMapLabel(original).split(/\s+/).length<=10);}
});

import {claimMapLabels} from '../src/features/relationships/presentation';
test('different interpretations with matching topics get distinct meaningful labels',()=>{
 const claims=[{id:'a',statement:'Cleaning effort depends on residue visibility and confidence.'},{id:'b',statement:'Cleaning effort depends on removable parts and drying time.'}];
 const labels=claimMapLabels(claims);
 assert.notEqual(labels.get('a'),labels.get('b'));
 assert.match(labels.get('a')!,/residue|visibility|confidence/);
 assert.match(labels.get('b')!,/removable|drying/);
 assert.deepEqual(claimMapLabels([...claims].reverse()),labels);
 assert.equal(new Set(labels.values()).size,2);
});

test('long press-type comparisons receive a compact overview label',()=>{
 const statement='Manual citrus presses vary from basic handheld hinged squeezers to lever presses with a countertop base, decorative ceramic reamers, multi-part presses with interchangeable cones, and electric juicers; each type involves trade-offs between compactness, ease of rinsing, leverage, stability, versatility, footprint, and cleaning complexity.';
 assert.equal(claimMapLabels([{id:'press-types',statement}]).get('press-types'),'Press types involve different trade-offs');
});

import {limitMapLabel,MAX_MAP_LABEL_WORDS} from '../src/features/relationships/presentation';
test('all map labels including duplicate qualifiers stay within thirty words',()=>{
 const statement=Array.from({length:70},(_,i)=>`term${i}`).join(' ');
 const claims=[{id:'a',statement},{id:'b',statement}];
 const labels=claimMapLabels(claims);
 for(const label of labels.values())assert.ok(label.split(/\s+/).length<=MAX_MAP_LABEL_WORDS);
 assert.equal(new Set(labels.values()).size,2);
 assert.equal(limitMapLabel('A concise meaningful label'),'A concise meaningful label');
 assert.equal(claims[0].statement,statement);
});

test('explicit reorganisation preserves content and produces compact non-overlapping regions',()=>{
 const s=createProjectStore();s.createProject({name:'Layout',context:''});
 const source=s.sources.add({title:'Notes',originalFile:{id:'asset' as any,filename:'notes',mediaType:'text/plain'},limitations:[],processingState:'ready'});
 const e=s.evidence.add({source:{id:source.id,revision:1},text:'Test research',form:'quotation',location:'P1',context:'',limitations:[]});
 const categories=Array.from({length:4},(_,i)=>s.categories.add({name:`Category ${i}`,order:i}));
 const claims=categories.map((cat,i)=>{const ev=s.evidence.add({...e,categories:[{id:cat.id,revision:cat.revision}]});return s.claims.add({statement:`Research claim number ${i}`,evidence:[{id:ev.id,revision:1}],context:'Test',limitations:[],review:{state:'accepted'},mapPosition:{x:i*50,y:i*50}},'dave');});
 s.relationships.add({description:'Meaningful connection',type:'connection',claims:[{claim:{id:claims[0].id,revision:1}},{claim:{id:claims[1].id,revision:1}}],explanation:'Synthetic relationship',limitations:[],review:{state:'accepted'}});
 const before=s.getProject()!;
 const automatic=deriveMap(before,{ignoreManual:true});
 for(let i=0;i<automatic.regions.length;i++)for(const b of automatic.regions.slice(i+1)){const a=automatic.regions[i];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
 for(const r of automatic.regions)for(const c of r.members){const p=automatic.positions.get(c.id)!;assert.ok(p.x>=r.x&&p.x+260<=r.x+r.width&&p.y>=r.y&&p.y+automatic.heights.get(c.id)!<=r.y+r.height);}
 s.setClaimMapPositions([...automatic.positions].map(([id,position])=>({id:id as typeof claims[0]['id'],position})));
 const after=s.getProject()!;
 const research=(p:typeof before)=>({...p,claims:p.claims.map(({mapPosition,updatedAt,...c})=>c)});
 assert.deepEqual(research(after),research(before));
 for(const c of after.claims)assert.deepEqual(deriveMap(after).positions.get(c.id),c.mapPosition);
});

import {relationshipRoute} from '../src/features/relationships/mapLayout';
test('relationship nodes sit on a route whose endpoints touch the actual cards',()=>{
 const route=relationshipRoute({x:65,y:120},{x:355,y:120},160,160);
 assert.deepEqual(route.from,{x:325,y:200});assert.deepEqual(route.to,{x:355,y:200});
 const centre={x:route.node.x+80,y:route.node.y+20};
 const numbers=route.path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
 const points=Array.from({length:numbers.length/2},(_,i)=>({x:numbers[i*2],y:numbers[i*2+1]}));
 assert.ok(points.slice(1).some((b,i)=>{const a=points[i];return (a.x===b.x&&centre.x===a.x&&centre.y>=Math.min(a.y,b.y)&&centre.y<=Math.max(a.y,b.y))||(a.y===b.y&&centre.y===a.y&&centre.x>=Math.min(a.x,b.x)&&centre.x<=Math.max(a.x,b.x));}));
 assert.ok(route.node.y>=280);
});

import {layeredRelationshipRoute} from '../src/features/relationships/mapLayout';
test('layered connections use the actual claim edge and relationship input port',()=>{
 const route=layeredRelationshipRoute({x:65,y:170},160,{x:600,y:240},1);
 assert.deepEqual(route.from,{x:325,y:250});assert.deepEqual(route.to,{x:600,y:325});
 assert.match(route.path,/^M 325 250 C /);
});

test('layered regions stack and incremental additions retain existing research',()=>{
 const s=createProjectStore();s.createProject({name:'Incremental',context:''});
 const source=s.sources.add({title:'Notes',originalFile:{id:'file' as any,filename:'notes',mediaType:'text/plain'},processingState:'ready',limitations:[]});
 const cats=[s.categories.add({name:'First',order:0}),s.categories.add({name:'Second',order:1})];
 const make=(statement:string,category:typeof cats[number])=>{const e=s.evidence.add({source:{id:source.id,revision:1},text:'Synthetic evidence',form:'quotation',location:'Paragraph 1',context:'',limitations:[],categories:[{id:category.id,revision:1}]});return s.claims.add({statement,evidence:[{id:e.id,revision:1}],context:'Test',limitations:[],review:{state:'accepted'}},'dave');};
 const a=make('First research interpretation',cats[0]),b=make('Second research interpretation',cats[1]);
 const link=s.relationships.add({type:'connection',description:'Two connected claims',claims:[{claim:{id:a.id,revision:1}},{claim:{id:b.id,revision:1}}],explanation:'Synthetic reasoning',limitations:[],review:{state:'accepted'}});
 const before=s.getProject()!;const layout=deriveMap(before);
 assert.ok(layout.regions[0].x+layout.regions[0].width<=layout.regions[1].x||layout.regions[0].y+layout.regions[0].height<layout.regions[1].y);
 assert.ok(layout.relationshipPositions.has(link.id));
 make('An added isolated claim',cats[0]);const after=s.getProject()!;
 assert.deepEqual(after.claims.slice(0,2),before.claims);assert.deepEqual(after.relationships,before.relationships);assert.deepEqual(after.categories,before.categories);
 const addedLayout=deriveMap(after);assert.equal(addedLayout.claims.length,3);assert.equal(addedLayout.regions[0].x,addedLayout.regions[1].x);assert.ok(addedLayout.regions[0].y+addedLayout.regions[0].height<addedLayout.regions[1].y);const first=addedLayout.regions[0];assert.equal(new Set(first.members.map(c=>addedLayout.positions.get(c.id)!.x)).size,1);
});

import {relationshipBrief} from '../src/features/relationships/presentation';
test('relationship card descriptions are clauses from the stored reasoning',()=>{
 const explanation='Better filtration may complicate cleaning, which needs further review.';
 assert.equal(relationshipBrief({description:'Trade-off between filtration and cleaning',explanation}),'Better filtration may complicate cleaning');
 assert.equal(explanation,'Better filtration may complicate cleaning, which needs further review.');
});

test('category boxes use a compact vertical claim stack by default',()=>{
 const s=createProjectStore();s.createProject({name:'Stack test',context:''});const source=s.sources.add({title:'Notes',originalFile:{id:'file' as any,filename:'notes',mediaType:'text/plain'},processingState:'ready',limitations:[]});const cat=s.categories.add({name:'Cleaning',order:0});const e=s.evidence.add({source:{id:source.id,revision:1},text:'Synthetic evidence',form:'quotation',location:'P1',context:'',limitations:[],categories:[{id:cat.id,revision:1}]});
 for(let i=0;i<3;i++)s.claims.add({statement:`Research claim ${i}`,evidence:[{id:e.id,revision:1}],context:'',limitations:[],review:{state:'proposed'}});
 const map=deriveMap(s.getProject()!,{ignoreManual:true});const pts=map.claims.map(c=>map.positions.get(c.id)!);assert.equal(new Set(pts.map(p=>p.x)).size,1);assert.equal(pts[1].y-pts[0].y,92);assert.ok(map.regions[0].height<400);
});

test('Research category edits synchronise the map without rewriting claims or historic evidence',()=>{
 const s=createProjectStore();s.createProject({name:'Consistency',context:''});
 const source=s.sources.add({title:'Notes',originalFile:{id:'asset' as any,filename:'notes',mediaType:'text/plain'},processingState:'ready',limitations:[],preparedContent:{format:'txt',extractedAt:new Date().toISOString(),sections:[{location:'P1',text:'Cleaning takes effort.'}],limitations:[]}});
 const passage={source:{id:source.id,revision:1},sectionIndex:0,start:0,end:22};
 const a=s.categories.add({name:'Cleaning',order:0,passages:[passage]}),b=s.categories.add({name:'Use',order:1,passages:[passage]});
 const e=s.evidence.add({source:passage.source,text:'Cleaning takes effort.',form:'quotation',location:'P1',context:'',limitations:[],passage,categories:[{id:a.id,revision:1},{id:b.id,revision:1}]});
 const c=s.claims.add({statement:'Cleaning can influence use.',evidence:[{id:e.id,revision:1}],context:'Interview',limitations:[],review:{state:'accepted'}},'dave');
 const before=s.getProject()!;
 assert.deepEqual(claimCategories(before,c),[a.id,b.id]);
 s.categories.update(a.id,{name:'Cleanup effort'});assert.equal(deriveMap(s.getProject()!).regions[0].name,'Cleanup effort');
 s.categories.update(a.id,{passages:[]});assert.deepEqual(claimCategories(s.getProject()!,c),[b.id]);
 const added=s.categories.add({name:'New context',order:2,passages:[passage]});assert.deepEqual(claimCategories(s.getProject()!,c),[b.id,added.id]);
 s.categories.update(b.id,{review:{state:'rejected'}});assert.deepEqual(claimCategories(s.getProject()!,c),[added.id]);
 s.categories.remove(added.id);assert.deepEqual(claimCategories(s.getProject()!,c),[]);assert.ok(deriveMap(s.getProject()!).regions.some(r=>r.name==='Unassigned'));
 assert.deepEqual(s.getProject()!.claims,before.claims);assert.deepEqual(s.getProject()!.evidence,before.evidence);assert.deepEqual(s.getProject()!.sources,before.sources);
 const restored=createProjectStore();restored.restoreProject(s.getProject()!);assert.deepEqual(deriveMap(restored.getProject()!).regions.map(r=>r.name),deriveMap(s.getProject()!).regions.map(r=>r.name));
});
