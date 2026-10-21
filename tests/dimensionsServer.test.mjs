import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateDimensionInput,validateDimensionOutput} from '../src/features/dimensions/contract.mjs';
import {generateDimensions} from '../server/ai/dimensions.mjs';
export const input=()=>({context:'Citrus press',categories:[{id:'cat-1',revision:1,name:'Effort',review:'accepted'}],evidence:[{id:'e-1',revision:1,text:'My hands tire.',source:{id:'s-1',revision:1},title:'Interview',location:'Paragraph 1',context:'Test',limitations:[]}],claims:[{id:'c-1',revision:1,statement:'Effort matters in this account.',context:'Interview',review:'accepted',limitations:[],evidence:[{id:'e-1',revision:1}]}],relationships:[],passages:[{categoryId:'cat-1',revision:1,index:0,text:'My hands tire.',source:{id:'s-1',revision:1},title:'Interview',location:'Paragraph 1',limitations:[]}],existingDimensions:[]});
export const proposal=()=>({name:'Mechanical assistance',explanation:'Different ways to provide pressing force.',rationale:'The participant describes hand fatigue.',grounding:'research_grounded',lowLabel:'Manual',midLabel:'Mechanically supported',highLabel:'Highly assisted',lowExplanation:'The user supplies force.',midExplanation:'A mechanism supports effort.',highExplanation:'The mechanism supplies most force.',claimIds:['c-1'],relationshipIds:[],evidenceIds:['e-1'],passages:[{categoryId:'cat-1',revision:1,index:0}],limitations:['One account.']});
const response=output=>async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.store,false);assert.match(body.instructions,/never undecided/);return {ok:true,json:async()=>({status:'completed',model:'test-model',output:[{content:[{type:'output_text',text:JSON.stringify({...output,dimensions:output.dimensions.map(({passages,...d})=>({...d,passageIds:passages.map(ref=>JSON.parse(body.input).passages.find(p=>p.categoryId===ref.categoryId&&p.revision===ref.revision&&p.index===ref.index)?.id??'unavailable')}))})}]}]})};};
test('valid proposals reference existing evidence and use the separate OpenAI task',async()=>{
 const result=await generateDimensions(input(),{apiKey:'test-only',fetchImpl:response({dimensions:[proposal()],warnings:[]})});
 assert.equal(result.dimensions.length,1);assert.equal(result.promptVersion,'dimensions-5');
});
test('fabricated references and incomplete or meaningless positions reject the whole batch',()=>{
 for(const patch of [{claimIds:['invented']},{relationshipIds:['invented']},{evidenceIds:['invented']},{passages:[{categoryId:'cat-1',revision:2,index:0}]},{midLabel:'Manual'},{highExplanation:''},{claimIds:[],relationshipIds:[],evidenceIds:[],passages:[]}])assert.throws(()=>validateDimensionOutput({dimensions:[proposal(),{...proposal(),name:'Second dimension',...patch}],warnings:[]},input()));
});
test('unreviewed material is usable while insufficient research and ambiguous references are rejected',()=>{
 assert.throws(()=>validateDimensionInput({...input(),claims:[],evidence:[],passages:[]}));
 assert.doesNotThrow(()=>validateDimensionInput({...input(),claims:[{...input().claims[0],review:'proposed'}]}));
 assert.throws(()=>validateDimensionInput({...input(),passages:[...input().passages,...input().passages]}));
 assert.equal(validateDimensionOutput({dimensions:[{...proposal(),claimIds:[],evidenceIds:[]}],warnings:[]},{...input(),categories:[{...input().categories[0],review:'proposed'}]}).dimensions[0].grounding,'research_grounded');
 assert.equal(validateDimensionOutput({dimensions:[{...proposal(),evidenceIds:[],passages:[]}],warnings:[]},input()).dimensions[0].grounding,'inferred');
 assert.equal(validateDimensionOutput({dimensions:[{...proposal(),grounding:'inferred',claimIds:[],evidenceIds:[]}],warnings:[]},{...input(),categories:[{...input().categories[0],review:'proposed'}]}).dimensions.length,1);
});
test('duplicates are filtered across saved decisions and within a batch',()=>{
 const p=proposal();const result=validateDimensionOutput({dimensions:[p,{...p,name:' MECHANICAL assistance!'}],warnings:[]},input());
 assert.equal(result.dimensions.length,1);assert.match(result.warnings[0],/duplicate/);
 const existing={id:'d-1',revision:1,name:p.name,lowLabel:p.lowLabel,midLabel:p.midLabel,highLabel:p.highLabel};
 assert.equal(validateDimensionOutput({dimensions:[{...p,name:'A renamed same axis'}],warnings:[]},{...input(),existingDimensions:[existing]}).dimensions.length,0);
});
test('empty results, unavailable API, incomplete output and refusal are honest failures',async()=>{
 assert.equal((await generateDimensions(input(),{apiKey:'test',fetchImpl:response({dimensions:[],warnings:['Insufficient context.']})})).dimensions.length,0);
 await assert.rejects(generateDimensions(input()),/not configured/);
 await assert.rejects(generateDimensions(input(),{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),/limits/);
 await assert.rejects(generateDimensions(input(),{apiKey:'test',fetchImpl:async()=>{throw new Error('offline')}}),/reach OpenAI/);
 await assert.rejects(generateDimensions(input(),{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'incomplete'})})}),/incomplete/);
 await assert.rejects(generateDimensions(input(),{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({status:'completed',output:[{content:[{type:'refusal'}]}]})})}),/declined/);
});

test('passage selection uses a constrained single ID and resolves exact category revisions and zero-based indices',async()=>{
 const i=input();i.categories[0].revision=7;i.categories[0].review='proposed';
 i.passages[0].revision=7;i.passages[0].index=4;
 const original=structuredClone(i);
 const result=await generateDimensions(i,{apiKey:'test',fetchImpl:async(_url,options)=>{
   const body=JSON.parse(options.body),sent=JSON.parse(body.input);
   const props=body.text.format.schema.properties.dimensions.items.properties;
   assert.deepEqual(props.passageIds.items.enum,['passage-1']);
   assert.ok(!('passages' in props));
   assert.equal(sent.passages[0].id,'passage-1');
   const {passages,...d}=proposal();
   return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dimensions:[{...d,passageIds:['passage-1','passage-1']}],warnings:[]})}]}]})};
 }});
 assert.deepEqual(result.dimensions[0].passages,[{categoryId:'cat-1',revision:7,index:4}]);
 assert.deepEqual(i,original);
});
test('unknown passage IDs fail without guessing a different source, including empty catalogues',async()=>{
 for(const passages of [input().passages,[]]) {
  await assert.rejects(generateDimensions({...input(),passages},{apiKey:'test',fetchImpl:async()=>{
    const {passages,...d}=proposal();
    return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({dimensions:[{...d,passageIds:['passage-999']}],warnings:[]})}]}]})};
  }}),/unavailable research excerpt/);
 }
});
test('repeated valid legacy references are deduplicated without mutating the response or accepting mismatches',()=>{
 const p=proposal();p.passages.push({...p.passages[0]});const original=structuredClone(p);
 assert.equal(validateDimensionOutput({dimensions:[p],warnings:[]},input()).dimensions[0].passages.length,1);
 assert.deepEqual(p,original);
 for(const patch of [{revision:2},{index:1},{categoryId:'missing'}])assert.throws(()=>validateDimensionOutput({dimensions:[{...proposal(),passages:[{...p.passages[0],...patch}]}],warnings:[]},input()),/unavailable research excerpt/);
});

test('all reference fields are constrained to their respective catalogues and duplicates preserve provenance',async()=>{
 const original=input();
 await generateDimensions(original,{apiKey:'test',fetchImpl:async(_url,options)=>{
   const props=JSON.parse(options.body).text.format.schema.properties.dimensions.items.properties;
   assert.deepEqual(props.claimIds.items.enum,['c-1']);
   assert.deepEqual(props.evidenceIds.items.enum,['e-1']);
   assert.equal(props.relationshipIds.maxItems,0);
   return response({dimensions:[proposal()],warnings:[]})(_url,options);
 }});
 const p=proposal();p.claimIds.push('c-1');p.evidenceIds.push('e-1');
 const before=structuredClone(p);
 const result=validateDimensionOutput({dimensions:[p],warnings:[]},original);
 assert.deepEqual(result.dimensions[0].claimIds,['c-1']);
 assert.deepEqual(result.dimensions[0].evidenceIds,['e-1']);
 assert.deepEqual(p,before);
 for(const [key,id] of [['claimIds','claim-999'],['relationshipIds','relationship-999'],['evidenceIds','evidence-999']])
   assert.throws(()=>validateDimensionOutput({dimensions:[{...proposal(),[key]:[id]}],warnings:[]},original),/unavailable .* reference/);
});

test('dimension output allows seven distinct choices and rejects an eighth',()=>{
 const dimensions=Array.from({length:7},(_,i)=>({...proposal(),name:'Choice '+i,lowLabel:'Low '+i,midLabel:'Middle '+i,highLabel:'High '+i}));
 assert.equal(validateDimensionOutput({dimensions,warnings:[]},input()).dimensions.length,7);
 assert.throws(()=>validateDimensionOutput({dimensions:[...dimensions,{...proposal(),name:'Extra'}],warnings:[]},input()),/Invalid dimension response/);
});
