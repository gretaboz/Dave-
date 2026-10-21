import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {loadEnvFile} from 'node:process';
import {writeFile} from 'node:fs/promises';
import {generateExplorationQuestion} from '../server/ai/exploration.mjs';
import {questionFingerprint} from '../src/features/exploration/questionContract.mjs';
import {workshopProjects,workshopInput} from './fixtures/explorationWorkshop.mjs';
test('live workshop questions: three projects, initial, first idea and developed idea', {skip:process.env.DAVE_LIVE_EXPLORATION!=='1',timeout:540000},async t=>{
 loadEnvFile(new URL('../server/.env',import.meta.url));
 const outputs=[];
 for(const project of workshopProjects){
  const previous=[];
  for(const stage of ['initial','idea','developed']){
   await t.test(project.name+' / '+stage,async()=>{
    const input=workshopInput(project,stage,previous);
    input.questionFingerprints=previous.map(questionFingerprint);
    const result=await generateExplorationQuestion(input,{apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-4.1-mini'});
    assert.match(result.question,stage==='initial'?project.initialFocus:project.followFocus);
    assert.equal(result.positionIds[0],input.settings[0].position.id);
    assert.equal(result.questionPurpose,stage==='initial'?'open_possibilities':stage==='idea'?'explore_alternatives':'challenge_assumptions');
    if(stage==='developed')assert.equal(result.grounding,'inferred');
    previous.push(result.question);outputs.push({project:project.name,stage,...result});
    // Public generated content only; no environment or credentials.
    t.diagnostic(project.name+' / '+stage+' ['+result.questionPurpose+']: '+result.question);
   });
  }
 }
 await writeFile('/private/tmp/dave-exploration-workshop-results.json',JSON.stringify(outputs,null,2));
});
