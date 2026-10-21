import {validateQuestionInput,validateQuestionOutput,questionStrategy} from '../../src/features/exploration/questionContract.mjs';
import {instructions,schema,PROMPT_VERSION,qualityCriteria} from '../prompts/exploration.mjs';
export {validateQuestionInput};
// Derived request context only: no new stored card fields or project migrations.
const openingPatterns = [
 ['what could you sketch', /^what could you sketch\b/i],
 ['how might you', /^how might you\b/i],
 ['what would happen if', /^what would happen if\b/i],
 ['how could', /^how could\b/i],
 ['what would change if', /^what would change if\b/i],
];
const sketching = q => /\b(sketch\w*|draw|drawing)\b/i.test(q);
export function questionDiversity(input) {
 const recent = input.previousQuestions.slice(-4);
 return {
  overusedOpenings: openingPatterns.filter(([,pattern]) => recent.filter(q=>pattern.test(q)).length>=2).map(([name])=>name),
  avoidSketching: recent.filter(sketching).length>=2,
 };
}
export function validateQuestionQuality(raw,input) {
 const {qualityCheck,...output}=raw;
 const diversity=questionDiversity(input);
 if(typeof output.question==='string' && (
  openingPatterns.some(([name,pattern])=>diversity.overusedOpenings.includes(name)&&pattern.test(output.question)) ||
  (diversity.avoidSketching&&sketching(output.question))))
  throw new Error('Recent questions repeat this opening or sketching activity. Choose a different natural sentence and exploration activity, grounded in the branch responses and confirmed settings.');
 if(!qualityCheck||Object.keys(qualityCheck).length!==qualityCriteria.length||qualityCriteria.some(k=>qualityCheck[k]!==true))
  throw new Error('The question needs revision against the six workshop quality criteria.');
 if(!questionStrategy(input).allowedPurposes.includes(output.questionPurpose))
  throw new Error('Choose a question purpose that fits the designer contribution on this path.');
 if(typeof output.question!=='string'||output.question.trim().split(/\s+/).length>28||
  /\b(prominence|modalities|facilitate|optimi[sz]e|perceived|enhance|integration|user satisfaction|user experience|engagement paradigm)\b/i.test(output.question)||
  /^(could you add|have you considered|why not (?:add|use))\b/i.test(output.question))
  throw new Error('Use one short everyday question that opens a concrete design activity without prescribing a feature or predicting satisfaction.');
 if(output.questionPurpose==='challenge_assumptions'&&output.grounding!=='inferred')
  throw new Error('An assumption challenge is a provisional test, not a research finding. Set grounding to inferred and state that the scenario needs to be tried; retain motivating research references.');
 return validateQuestionOutput(output,input);
}
export async function generateExplorationQuestion(input,{apiKey,model='gpt-4.1-mini',fetchImpl=fetch}={}) {
 validateQuestionInput(input);
 if(!apiKey)throw new Error('OpenAI is not configured on the server. Manual exploration remains available.');
 const signal=AbortSignal.timeout(60000);
 let revision;
 for(let attempt=0;attempt<2;attempt++) {
  let response;
  try {response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal,body:JSON.stringify({model,store:false,instructions,input:JSON.stringify({...input,questionStrategy:questionStrategy(input),questionDiversity:questionDiversity(input),...(revision?{revision}:{})}),max_output_tokens:1800,text:{format:{type:'json_schema',name:'exploration_question',strict:true,schema}}})});}
  catch{throw new Error('Could not reach OpenAI or the request timed out. Retry; manual exploration remains available.');}
  if(!response.ok)throw new Error(response.status===429?'OpenAI usage or rate limits were reached. Retry later.':'OpenAI could not generate a question. Check server configuration and retry.');
  const result=await response.json();if(result.status!=='completed')throw new Error('OpenAI returned an incomplete question. Nothing was added.');
  const content=result.output?.flatMap(x=>x.content??[])??[];
  if(content.some(c=>c.type==='refusal'))throw new Error('OpenAI declined this question request. Nothing was added.');
  let output;try{output=JSON.parse(content.filter(c=>c.type==='output_text').map(c=>c.text).join(''));}
  catch{throw new Error('OpenAI returned an unreadable question. Nothing was added.');}
  try {
   return {...validateQuestionQuality(output,input),model:result.model??model,promptVersion:PROMPT_VERSION};
  } catch(error) {
   if(attempt===1)throw new Error('DAVE could not produce a useful, grounded workshop question. Nothing was added. Please retry.');
   revision={rejectedQuestion:typeof output?.question==='string'?output.question.slice(0,240):'',feedback:error.message,instruction:'Revise the rejected question. Recheck every quality criterion and supplied reference before returning.'};
  }
 }
}
