import {validateDimensionInput,validateDimensionOutput} from '../../src/features/dimensions/contract.mjs';
import {instructions,dimensionSchema,PROMPT_VERSION} from '../prompts/dimensions.mjs';
export {validateDimensionInput};
export async function generateDimensions(input,{apiKey,model='gpt-4.1-mini',fetchImpl=fetch}={}) {
  validateDimensionInput(input);
  if(!apiKey)throw new Error('OpenAI is not configured on the server. Manual dimensions remain available.');
  // These short IDs are request-local. Saved projects keep the original references.
  const passages=input.passages.map((p,index)=>({...p,id:`passage-${index+1}`}));
  const modelInput={...input,passages};
  let response;
  try { response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model,store:false,instructions,input:JSON.stringify(modelInput),max_output_tokens:10000,text:{format:{type:'json_schema',name:'dimension_proposals',strict:true,schema:dimensionSchema(modelInput)}}})}); }
  catch {throw new Error('Could not reach OpenAI or generation timed out. Your dimensions are unchanged. Retry.');}
  if(!response.ok)throw new Error(response.status===429?'OpenAI usage or rate limits were reached. Retry later.':'OpenAI could not generate dimensions. Check server configuration and retry.');
  const result=await response.json();
  if(result.status!=='completed')throw new Error('OpenAI returned incomplete dimension proposals. Nothing was added.');
  const content=result.output?.flatMap(x=>x.content??[])??[];
  if(content.some(x=>x.type==='refusal'))throw new Error('OpenAI declined generation. Nothing was added.');
  let output;try {output=JSON.parse(content.filter(x=>x.type==='output_text').map(x=>x.text).join(''));}
  catch {throw new Error('OpenAI returned unreadable proposals. Nothing was added.');}
  if(!output||!Array.isArray(output.dimensions))throw new Error('Invalid dimension response. Nothing was added.');
  output={...output,dimensions:output.dimensions.map(d=>{
    if(!d||!Array.isArray(d.passageIds)||d.passageIds.length>100||d.passageIds.some(id=>typeof id!=='string'||!passages.some(p=>p.id===id)))
      throw new Error('DAVE returned an unavailable research excerpt. Nothing was added. Please generate dimensions again.');
    const {passageIds,...content}=d;
    return {...content,passages:[...new Set(passageIds)].map(id=>{
      const p=passages.find(p=>p.id===id);
      return {categoryId:p.categoryId,revision:p.revision,index:p.index};
    })};
  })};
  return {...validateDimensionOutput(output,input),model:result.model??model,promptVersion:PROMPT_VERSION};
}
