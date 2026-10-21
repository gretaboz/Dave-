import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';

test('designer reviews a parameter and confirms an immutable direction with separate evidence lanes',async()=>{
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE??'playwright');
 const server=await createServer({server:{host:'127.0.0.1',port:5211,strictPort:false}});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);await page.getByRole('button',{name:'Live AI',exact:true}).click();
  await page.getByLabel('Project name',{exact:true}).fill('Direction test');await page.getByRole('button',{name:'Create project',exact:true}).click();
  await page.evaluate(async()=>{const store=(await import('/src/state/projectStore.ts')).projectStore;const source=store.sources.add({title:'Interview 1',originalFile:{id:'asset-1',filename:'interview.txt',mediaType:'text/plain'},limitations:[],processingState:'ready'});const evidence=store.evidence.add({source:{id:source.id,revision:1},text:'Participants need time to understand the handoff.',form:'quotation',location:'paragraph 4',context:'Prototype review',limitations:['One participant.']});store.dimensions.add({name:'Handoff timing',explanation:'When the handoff happens.',lowLabel:'Early',midLabel:'During',highLabel:'Late',evidence:[{id:evidence.id,revision:1}],claims:[],relationships:[],limitations:['One participant.'],review:{state:'proposed'}},'dave');});
  await page.getByRole('button',{name:'Directions',exact:true}).click();
  const card=page.locator('.direction-parameter').filter({has:page.getByRole('heading',{name:'Handoff timing',exact:true})});
  await card.getByLabel('Designer decision').selectOption('included');await card.getByLabel('Parameter type').selectOption('adjustable');
  await card.getByLabel('Chosen orientation, or leave undecided').fill('Before the first prototype review');
  await card.getByText('Evidence that this parameter is relevant (1)',{exact:true}).click();await card.locator('blockquote').filter({hasText:'Participants need time to understand the handoff.'}).waitFor();
  await card.getByText('Evidence for the chosen orientation (0)',{exact:true}).click();await card.getByRole('checkbox').check();
  await card.getByLabel('Challenges or gaps').fill('Only one participant is represented.');
  await page.getByLabel('Direction title').fill('Handoff-led direction');await page.getByLabel('Designer summary').fill('Keep handoff timing adjustable while testing.');
  await page.getByRole('button',{name:'Confirm direction',exact:true}).click();await page.getByText(/Confirmed Handoff-led direction as version 1/).waitFor();
  const project=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject());const direction=project.directions[0];const parameter=direction.parameterSnapshot[0];
  assert.equal(direction.state,'retained');assert.equal(parameter.reviewState,'included');assert.equal(parameter.variability,'adjustable');assert.equal(parameter.orientation.text,'Before the first prototype review');assert.equal(parameter.relevanceEvidence.length,1);assert.equal(parameter.orientationEvidence.length,1);assert.deepEqual(parameter.challenges,['Only one participant is represented.']);assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
