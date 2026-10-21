import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {generateExplorationQuestion,validateQuestionQuality,questionDiversity} from '../server/ai/exploration.mjs';
import {validateQuestionInput,validateQuestionOutput,questionFingerprint,questionStrategy} from '../src/features/exploration/questionContract.mjs';
import {qualityCriteria} from '../server/prompts/exploration.mjs';
import {questionInput,questionOutput} from './fixtures/exploration.mjs';
const checked=(input,extra={})=>({...questionOutput(input),questionPurpose:'open_possibilities',qualityCheck:Object.fromEntries(qualityCriteria.map(k=>[k,true])),...extra});
const completed=output=>({ok:true,json:async()=>({status:'completed',model:'synthetic-model',output:[{content:[{type:'output_text',text:JSON.stringify(output)}]}]})});
test('one structured question uses a separate task, server-side credentials, bounded text and store:false',async()=>{
 const input=questionInput();let calls=0;
 const result=await generateExplorationQuestion(input,{apiKey:'synthetic-key',fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);assert.equal(body.store,false);assert.equal(body.text.format.name,'exploration_question');assert.match(body.instructions,/Never produce a design/);assert.deepEqual(JSON.parse(body.input),{...input,questionStrategy:questionStrategy(input),questionDiversity:questionDiversity(input)});return {ok:true,json:async()=>({status:'completed',model:'synthetic-model',output:[{content:[{type:'output_text',text:JSON.stringify(checked(input))}]}]})};}});
 assert.equal(calls,1);assert.equal(result.promptVersion,'exploration-3');assert.equal(result.model,'synthetic-model');
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

test('six quality checks, academic questions and premature challenges trigger one revision, never fabricated success',async()=>{
 const input=questionInput();const before=structuredClone(input);
 const bad=checked(input,{question:'How might reflective prominence affect user satisfaction?'});
 assert.throws(()=>validateQuestionQuality(bad,input),/everyday/);
 for(const key of qualityCriteria)assert.throws(()=>validateQuestionQuality(checked(input,{qualityCheck:{...bad.qualityCheck,[key]:false}}),input),/six workshop/);
 assert.throws(()=>validateQuestionQuality(checked(input,{questionPurpose:'challenge_assumptions'}),input),/purpose/);
 let calls=0;
 const result=await generateExplorationQuestion(input,{apiKey:'synthetic',fetchImpl:async(url,options)=>{
  const sent=JSON.parse(JSON.parse(options.body).input);calls++;
  if(calls===1)return completed(bad);
  assert.equal(sent.revision.rejectedQuestion,bad.question);assert.match(sent.revision.feedback,/everyday/);
  return completed(checked(input,{question:'What different ways could you sketch for removing pulp from the press?'}));
 }});
 assert.equal(calls,2);assert.ok(!('qualityCheck' in result));assert.deepEqual(input,before);
 calls=0;await assert.rejects(generateExplorationQuestion(input,{apiKey:'synthetic',fetchImpl:async()=>{calls++;return completed(bad);}}),/Nothing was added/);assert.equal(calls,2);
});
test('purpose selection follows human contributions on the selected path; replacements use the original parent',()=>{
 const i=questionInput();assert.deepEqual(questionStrategy(i).allowedPurposes,['open_possibilities']);
 const q={id:'q-root',revision:1,title:'DAVE',kind:'question',text:'What could you sketch?',origin:'dave'};
 const idea={id:'idea-test',revision:1,title:'Pulp tray',kind:'idea',text:'A removable pulp tray.',origin:'researcher'};
 const develop={id:'note-test',revision:1,title:'Try it',kind:'note',text:'The tray slides out by a wide tab while the press stays on the counter.',origin:'researcher'};
 const follow={...i,request:{mode:'followup',selectedId:idea.id,parentId:idea.id},branch:[q,idea]};
 assert.equal(questionStrategy(follow).preferredPurpose,'explore_alternatives');
 assert.equal(questionStrategy(follow).latestContribution.id,idea.id);
 assert.equal(questionStrategy({...follow,branch:[q,idea,develop],request:{...follow.request,selectedId:develop.id,parentId:develop.id}}).preferredPurpose,'challenge_assumptions');
 const onlyQuestion={...i,branch:[q],request:{mode:'followup',selectedId:q.id,parentId:q.id}};
 assert.throws(()=>validateQuestionOutput({...questionOutput(i),questionPurpose:'challenge_assumptions'},onlyQuestion),/purpose/);
 assert.deepEqual(questionStrategy({...onlyQuestion,request:{mode:'alternative',selectedId:q.id,parentId:null}}).allowedPurposes,['open_possibilities']);
 assert.throws(()=>validateQuestionQuality(checked(follow,{questionPurpose:'challenge_assumptions',question:'What changes if the tray is wet?'}),follow),/provisional test/);
 assert.doesNotThrow(()=>validateQuestionQuality(checked(follow,{questionPurpose:'challenge_assumptions',grounding:'inferred',question:'Would the tray still slide out if someone held the press with one hand?'}),follow));
 assert.throws(()=>validateQuestionQuality(checked(follow,{questionPurpose:'challenge_assumptions',grounding:'inferred',question:'Would the tray work?'}),follow),/open-ended/);
});

test('repeated openings and sketching trigger revision, while occasional use remains allowed',async()=>{
 const i=questionInput();
 const repeated=checked(i,{question:'What could you sketch to reduce effort when cleaning the press?'});
 assert.doesNotThrow(()=>validateQuestionQuality(repeated,i));
 i.previousQuestions=['What could you sketch for emptying the press?', 'Which press parts could you draw before testing cleanup?'];
 assert.throws(()=>validateQuestionQuality(repeated,i),/different natural sentence/);
 const before=structuredClone(i);let calls=0;
 const result=await generateExplorationQuestion(i,{apiKey:'synthetic',fetchImpl:async(url,options)=>{
  const sent=JSON.parse(JSON.parse(options.body).input);calls++;
  assert.equal(sent.questionDiversity.avoidSketching,true);
  if(calls===1)return completed(repeated);
  assert.match(sent.revision.feedback,/exploration activity/);
  return completed(checked(i,{question:'Which ways of removing pulp would keep cleanup effort low?'}));
 }});
 assert.equal(calls,2);assert.match(result.question,/removing pulp/);assert.deepEqual(i,before);
 for(const opening of ['How might you','What would happen if','How could','What would change if']){
  const input={...questionInput(),previousQuestions:[`${opening} clean the handle?`,`${opening} remove the pulp?`]};
  assert.throws(()=>validateQuestionQuality(checked(input,{question:`${opening} reduce cleaning effort for this press?`}),input),/different natural sentence/);
  assert.doesNotThrow(()=>validateQuestionQuality(checked(input,{question:'Where does pulp collect inside the press during use?'}),input));
 }
});
test('follow-up generation supplies designer responses and prior questions without modifying them',async()=>{
 const i=questionInput();
 i.branch=[{id:'question-root',revision:1,title:'Question',kind:'question',text:'Which ways could pulp leave the press?',origin:'dave'},
 {id:'idea-tray',revision:1,title:'Tray',kind:'idea',text:'A removable tray catches pulp; I want to compare how it comes out.',origin:'researcher'}];
 i.request={mode:'followup',selectedId:'idea-tray',parentId:'idea-tray'};
 i.previousQuestions=[i.branch[0].text];const before=structuredClone(i);
 await generateExplorationQuestion(i,{apiKey:'synthetic',fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body),sent=JSON.parse(body.input);
  assert.deepEqual(sent.branch,i.branch);assert.deepEqual(sent.previousQuestions,i.previousQuestions);
  assert.equal(sent.questionStrategy.latestContribution.text,i.branch[1].text);
  assert.match(body.instructions,/changing the opening alone is not diversity/);
  assert.match(body.instructions,/Revisit it only when a new response/);
  return completed(checked(i,{questionPurpose:'explore_alternatives',question:'Which other ways could the tray come out with little hand effort?'}));
 }});
 assert.deepEqual(i,before);
});
