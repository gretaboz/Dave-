import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {validateDimensionInput,validateDimensionOutput} from '../src/features/dimensions/contract.mjs';
import {generateDimensions} from '../server/ai/dimensions.mjs';
export const input=()=>({context:'Citrus press',categories:[{id:'cat-1',revision:1,name:'Effort',review:'accepted'}],evidence:[{id:'e-1',revision:1,text:'My hands tire.',source:{id:'s-1',revision:1},title:'Interview',location:'Paragraph 1',context:'Test',limitations:[]}],claims:[{id:'c-1',revision:1,statement:'Effort matters in this account.',context:'Interview',review:'accepted',limitations:[],evidence:[{id:'e-1',revision:1}]}],relationships:[],passages:[{categoryId:'cat-1',revision:1,index:0,text:'My hands tire.',source:{id:'s-1',revision:1},title:'Interview',location:'Paragraph 1',limitations:[]}],existingDimensions:[]});
export const proposal=()=>({name:'Mechanical assistance',explanation:'Different ways to provide pressing force.',rationale:'The participant describes hand fatigue.',grounding:'research_grounded',lowLabel:'Manual',midLabel:'Mechanically supported',highLabel:'Highly assisted',lowExplanation:'The user supplies force.',midExplanation:'A mechanism supports effort.',highExplanation:'The mechanism supplies most force.',claimIds:['c-1'],relationshipIds:[],evidenceIds:['e-1'],passages:[{categoryId:'cat-1',revision:1,index:0}],limitations:['One account.']});
const response=output=>async(_url,options)=>{const body=JSON.parse(options.body);assert.equal(body.store,false);assert.match(body.instructions,/never undecided/);return {ok:true,json:async()=>({status:'completed',model:'test-model',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})};};
test('valid proposals reference existing evidence and use the separate OpenAI task',async()=>{
 const result=await generateDimensions(input(),{apiKey:'test-only',fetchImpl:response({dimensions:[proposal()],warnings:[]})});
 assert.equal(result.dimensions.length,1);assert.equal(result.promptVersion,'dimensions-1');
});
test('fabricated references and incomplete or meaningless positions reject the whole batch',()=>{
 for(const patch of [{claimIds:['invented']},{relationshipIds:['invented']},{evidenceIds:['invented']},{passages:[{categoryId:'cat-1',revision:2,index:0}]},{midLabel:'Manual'},{highExplanation:''},{claimIds:[],relationshipIds:[],evidenceIds:[],passages:[]}])assert.throws(()=>validateDimensionOutput({dimensions:[proposal(),{...proposal(),name:'Second dimension',...patch}],warnings:[]},input()));
});
test('insufficient research, unreviewed claims and ambiguous references are rejected',()=>{
 assert.throws(()=>validateDimensionInput({...input(),claims:[],evidence:[],passages:[]}));
 assert.throws(()=>validateDimensionInput({...input(),claims:[{...input().claims[0],review:'proposed'}]}));
 assert.throws(()=>validateDimensionInput({...input(),passages:[...input().passages,...input().passages]}));
 assert.throws(()=>validateDimensionOutput({dimensions:[{...proposal(),claimIds:[],evidenceIds:[]}],warnings:[]},{...input(),categories:[{...input().categories[0],review:'proposed'}]}));
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
