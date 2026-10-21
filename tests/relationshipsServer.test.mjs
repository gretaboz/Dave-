import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { analyseRelationships, validateInput as validateRelationshipInput, validateClaims, validateRelationships } from '../server/ai/relationships.mjs';
const chunks = [{ id: 'p', title: 'Synthetic interview', location: 'Paragraph 1', text: 'Cleaning takes effort.', categories: ['Cleaning'] }];
const claim = { id:'c', statement:'Cleanup can discourage repeated use in this interview.', passageIds:['p'], context:'Interview', stakeholder:'Participant', limitations:['Single participant'] };
const connection = { description:'Needs coexist', type:'connection', claimIds:['c','d'], passageIds:['p'], explanation:'Both needs were expressed.', contextCheck:'Same interview', challenge:'Would this apply elsewhere?', limitations:[] };
test('rejects fabricated references, duplicate claims and forced single-claim relationships', () => {
  assert.throws(() => validateClaims({claims:[{...claim,passageIds:['fake']}],warnings:[]},chunks));
  assert.throws(() => validateClaims({claims:[claim,claim],warnings:[]},chunks));
  assert.throws(() => validateRelationships({relationships:[{...connection,claimIds:['c','c']}],warnings:[]},[claim]));
  assert.throws(() => validateRelationships({relationships:[connection],warnings:[]},[claim]));
  const claims=[claim,{...claim,id:'d'}];
  assert.throws(()=>validateRelationships({relationships:[{...connection,type:'correlation'}],warnings:[]},claims));
  assert.throws(()=>validateRelationships({relationships:[{...connection,passageIds:['invented']}],warnings:[]},claims));
  assert.throws(()=>validateRelationships({relationships:[{...connection,claimIds:['c','d','e']}],warnings:[]},[...claims,{...claim,id:'e'}]));
  assert.throws(()=>validateRelationships({relationships:[{...connection,contextCheck:''}],warnings:[]},claims));
  assert.deepEqual(validateRelationships({relationships:[],warnings:['No meaningful connection.']},claims).relationships,[]);
});
test('separates claim and connection tasks and checks failure before returning results', async () => {
  let calls=0;
  const fetchImpl=async (_url,opts) => {
    calls++; const body=JSON.parse(opts.body); assert.equal(body.store,false);
    if(calls===2) assert.match(body.instructions,/contextCheck/);
    const output=calls===1 ? {claims:[claim,{...claim,id:'d'}],warnings:[]} : {relationships:[connection],warnings:[]};
    return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})};
  };
  const output=await analyseRelationships({chunks},{apiKey:'test-only',fetchImpl});
  assert.equal(calls,2); assert.equal(output.relationships.length,1);
  await assert.rejects(analyseRelationships({chunks}),/not configured/);
  await assert.rejects(analyseRelationships({chunks},{apiKey:'test-only',fetchImpl:async()=>({ok:false,status:429})}),/limits/);
});

test('existing category IDs and names are validated before sending research to OpenAI',()=>{
 const categories=[{id:'category-1',revision:2,name:'Cleaning'}];
 const input={categories,chunks:[{...chunks[0],categories:['Cleaning'],categoryReferences:[{id:'category-1',revision:2}]}]};
 assert.doesNotThrow(()=>validateRelationshipInput(input));
 assert.throws(()=>validateRelationshipInput({...input,chunks:[{...input.chunks[0],categoryReferences:[{id:'invented',revision:2}]}]}),/category reference/);
 assert.throws(()=>validateRelationshipInput({...input,chunks:[{...input.chunks[0],categories:['Invented category']}]}),/category reference/);
});

test('claims are capped per category before relationships are generated',()=>{
 const many=Array.from({length:12},(_,i)=>({...claim,id:'c'+i}));
 const result=validateClaims({claims:many,warnings:[]},chunks);
 assert.equal(result.claims.length,10);
 assert.deepEqual(result.claims.map(c=>c.id),many.slice(0,10).map(c=>c.id));
 const other={...chunks[0],id:'other',categories:['Materials']};
 assert.equal(validateClaims({claims:[...many,...many.map(c=>({...c,id:'other-'+c.id,passageIds:['other']}))],warnings:[]},[...chunks,other]).claims.length,20);
});

test('an unsupported relationship is omitted without discarding grounded claims',async()=>{
 let calls=0;
 const results=[{claims:[claim,{...claim,id:'d'}],warnings:[]},{relationships:[{...connection,passageIds:['unknown']}],warnings:[]}];
 const result=await analyseRelationships({chunks,context:''},{apiKey:'test-only',fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(results[calls++])}]}]})})});
 assert.equal(result.claims.length,2);
 assert.equal(result.relationships.length,0);
 assert.match(result.warnings.join(' '),/omitted/);
});
