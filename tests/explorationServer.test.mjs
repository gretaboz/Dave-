import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {generateExplorationQuestion} from '../server/ai/exploration.mjs';
import {validateQuestionInput,validateQuestionOutput,questionFingerprint} from '../src/features/exploration/questionContract.mjs';
import {questionInput,questionOutput} from './fixtures/exploration.mjs';
test('one structured question uses a separate task, server-side credentials, bounded text and store:false',async()=>{
 const input=questionInput();let calls=0;
 const result=await generateExplorationQuestion(input,{apiKey:'synthetic-key',fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.name,'exploration_question');assert.match(body.instructions,/Never produce a design/);assert.deepEqual(JSON.parse(body.input),input);return {ok:true,json:async()=>({status:'completed',model:'synthetic-model',output:[{content:[{type:'output_text',text:JSON.stringify(questionOutput(input))}]}]})};}});
 assert.equal(calls,1);assert.equal(result.promptVersion,'exploration-1');assert.equal(result.model,'synthetic-model');
});
test('fabricated references, repeated questions, multi-questions, yes/no questions and unsupported grounding fail',()=>{
 const i=questionInput(),o=questionOutput(i);
 assert.throws(()=>validateQuestionOutput({...o,claimIds:['invented']},i),/unavailable research reference/);
 assert.throws(()=>validateQuestionOutput({...o,question:'Can you make the press washable?'},i),/open-ended/);
 assert.throws(()=>validateQuestionOutput({...o,question:'What changes? Why?'},i),/open-ended/);
 assert.throws(()=>validateQuestionOutput({...o,claimIds:[],relationshipIds:[],evidenceIds:[]},i),/supporting/);
 assert.throws(()=>validateQuestionOutput(o,{...i,questionFingerprints:[questionFingerprint(o.question)]}),/repeated/);
 assert.throws(()=>validateQuestionOutput({...o,question:o.question.replace('difficult','hard')},{...i,previousQuestions:[o.question]}),/repeated/);
 assert.throws(()=>validateQuestionInput({...i,image:'data:image/png;base64,private'}),/Invalid/);
 assert.throws(()=>validateQuestionInput({...i,settings:[]}),/Confirm/);
});
test('missing configuration, network failure, rate limit, refusal and incomplete output never fake a question',async()=>{
 const i=questionInput();await assert.rejects(generateExplorationQuestion(i,{}),/not configured/);
 await assert.rejects(generateExplorationQuestion(i,{apiKey:'test',fetchImpl:async()=>{throw new Error('offline')}}),/reach OpenAI/);
 await assert.rejects(generateExplorationQuestion(i,{apiKey:'test',fetchImpl:async()=>({ok:false,status:429})}),/limits/);
 for(const data of [{status:'incomplete'},{status:'completed',output:[{content:[{type:'refusal'}]}]},{status:'completed',output:[{content:[{type:'output_text',text:'broken'}]}]}])await assert.rejects(generateExplorationQuestion(i,{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>data})}));
});
