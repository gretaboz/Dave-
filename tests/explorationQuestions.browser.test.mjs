import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';
import {questionOutput} from './fixtures/exploration.mjs';
test('explicit questions, branch-only follow-ups, responses, sketches, rationale, alternatives, stale rejection and failures persist on one map',async()=>{
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE??'playwright');const server=await createServer({server:{host:'127.0.0.1',port:5210,strictPort:false}});await server.listen();const browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1600,height:1300}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);await page.getByRole('button',{name:'Live AI',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Press');await page.getByRole('button',{name:'Create project',exact:true}).click();
 const original=await page.evaluate(async()=>{
  const s=(await import('/src/state/projectStore.ts')).projectStore;s.updateProject({context:'A citrus press for people with limited hand strength.'});
  const source=s.sources.add({title:'Interview',originalFile:{id:'test',filename:'test.txt',mediaType:'text/plain'},limitations:[],processingState:'ready'});
  const e=s.evidence.add({source:{id:source.id,revision:1},text:'I avoid washing extra parts.',location:'Paragraph 1',form:'quotation',context:'One participant',limitations:[]});
  const c=s.claims.add({statement:'Cleaning effort discourages use.',evidence:[{id:e.id,revision:1}],limitations:[],review:{state:'accepted'}});
  const d=s.dimensions.add({name:'Cleaning',lowLabel:'Quick rinse',midLabel:'Easy cleaning',highLabel:'Thorough cleaning',explanation:'Cleaning approach',claims:[{id:c.id,revision:1}],relationships:[],limitations:[],review:{state:'accepted'}});s.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:.5});return s.getProject();
 });
 const snapshot=()=>page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject());const saved=()=>page.getByText('Saved locally.',{exact:true}).waitFor();
 let calls=[];let fail=false,invalid=false,repeat=false,held=false,release;
 const questions=['What makes cleaning the press difficult with limited hand strength?','How could the cleaning step work when only one hand is available?','Which assumption about cleanup would you test with someone using this press?','What would change if the press had to be cleaned in a small sink?','How could this approach account for someone who tires quickly?'];
 await page.route('**/api/exploration/question',async route=>{
  const input=route.request().postDataJSON();calls.push(input);if(held)await new Promise(r=>{release=r;});
  if(fail)return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Synthetic AI failure. Manual exploration remains available.'})});
  const out=questionOutput(input,repeat?questions[0]:questions[Math.min(calls.length-1,questions.length-1)]);if(invalid)out.claimIds=['invented'];return route.fulfill({contentType:'application/json',body:JSON.stringify({...out,model:'synthetic',promptVersion:'test'})});
 });
 await page.getByRole('button',{name:'Dimensions',exact:true}).click();await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();assert.equal(calls.length,0);assert.equal(await page.locator('.relationship-map-canvas').count(),1);
 await page.getByRole('button',{name:'Dave asks',exact:true}).click();await page.locator('.exploration-question').waitFor();await saved();assert.equal(calls.length,1);assert.equal(calls[0].settings[0].label,'Easy cleaning');assert.equal(calls[0].branch.length,0);
 let p=await snapshot();const first=p.explorationNodes[0];assert.equal(first.origin,'dave');assert.equal(first.content.type,'question');assert.equal(p.explorationNodes.length,1);
 const firstCard=page.locator(`[data-idea-id="${first.id}"]`);const firstBox=await firstCard.boundingBox();await page.mouse.move(firstBox.x+170*.85,firstBox.y+100*.85);await page.mouse.down();await page.mouse.move(firstBox.x+170*.85+35,firstBox.y+100*.85+25,{steps:6});await page.mouse.up();assert.notDeepEqual((await snapshot()).explorationNodes[0].position,first.position);assert.equal((await snapshot()).explorationNodes[0].revision,first.revision);
 await firstCard.getByRole('button',{name:'Why this question?',exact:true}).click();await page.getByRole('region',{name:'Why DAVE asked'}).waitFor();await page.getByText('Findings considered (1)',{exact:true}).click();await page.getByText('Cleaning effort discourages use.',{exact:true}).waitFor();
 const editor=page.locator('.exploration-editor');const fill=async(title,text)=>{await editor.getByLabel('Idea title',{exact:true}).fill(title);await editor.getByLabel('Idea text',{exact:true}).fill(text);await editor.getByRole('button',{name:'Save idea',exact:true}).click();await editor.waitFor({state:'hidden'});await saved();};
 await page.getByRole('button',{name:'Add text',exact:true}).click();await editor.getByLabel('Card type',{exact:true}).selectOption('note');await fill('Response A','A smooth surface could reduce cleanup effort.');
 p=await snapshot();const a=p.explorationNodes.at(-1);assert.equal(a.content.type,'note');assert.equal(a.branchParent.id,first.id);
 // Create an alternative contribution from the same question, then ask from A.
 await page.getByRole('button',{name:'DAVE question',exact:true}).click();await page.getByRole('button',{name:'Add text',exact:true}).click();await fill('Response B','Unrelated sibling idea must stay out of A context.');
 await page.getByRole('button',{name:'Response A',exact:true}).click();await page.getByRole('button',{name:'Dave asks',exact:true}).click();await page.locator('.exploration-question').nth(1).waitFor();await saved();assert.deepEqual(calls[1].branch.map(n=>n.id),[first.id,a.id]);assert.ok(!JSON.stringify(calls[1]).includes('Unrelated sibling'));
 p=await snapshot();const follow=p.explorationNodes.at(-1);assert.equal(follow.branchParent.id,a.id);
 // Attach a real local PNG to a response and verify that only its caption enters the next request.
 await page.getByRole('button',{name:'Add text',exact:true}).click();await editor.getByLabel('Card type',{exact:true}).selectOption('sketch');await editor.getByLabel('Idea title',{exact:true}).fill('Sketch A');await editor.getByLabel('Image description',{exact:true}).fill('A large handle drawn beside a smooth pressing surface.');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=160;c.height=100;const x=c.getContext('2d');x.fillStyle='#dce6ef';x.fillRect(0,0,160,100);x.strokeRect(20,20,80,50);return c.toDataURL('image/png').split(',')[1];});
 await editor.getByLabel('Sketch or image',{exact:true}).setInputFiles({name:'sketch.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await editor.getByRole('button',{name:'Save idea',exact:true}).click();await page.getByRole('button',{name:'Inspect image sketch.png',exact:true}).waitFor();await saved();
 p=await snapshot();const sketch=p.explorationNodes.at(-1);assert.equal(sketch.content.type,'sketch');assert.equal(sketch.branchParent.id,follow.id);
 await page.getByRole('button',{name:'Inspect image sketch.png',exact:true}).click();await page.getByRole('dialog',{name:'Image: sketch.png'}).waitFor();await page.getByRole('button',{name:'Close image',exact:true}).click();
 await page.getByRole('button',{name:'Dave asks',exact:true}).click();await page.locator('.exploration-question').nth(2).waitFor();await saved();assert.ok(calls[2].branch.some(n=>n.kind==='sketch'&&n.text.includes('large handle')));assert.ok(!JSON.stringify(calls[2]).includes(png));assert.ok(!JSON.stringify(calls[2]).includes('asset'));
 p=await snapshot();const latest=p.explorationNodes.at(-1);await page.locator(`[data-idea-id="${latest.id}"]`).getByRole('button',{name:'Different question',exact:true}).click();await page.locator('.exploration-question').nth(3).waitFor();await saved();p=await snapshot();assert.equal(p.explorationNodes.find(n=>n.id===latest.id).questionState,'skipped');assert.equal(p.explorationNodes.at(-1).branchParent.id,sketch.id);
 // Invalid and repeated output add no nodes; failure leaves manual contributions available.
 let count=p.explorationNodes.length;invalid=true;await page.getByRole('button',{name:'Dave asks',exact:true}).click();await page.getByRole('alert').filter({hasText:'unavailable research reference'}).waitFor();assert.equal((await snapshot()).explorationNodes.length,count);invalid=false;
 repeat=true;await page.getByRole('button',{name:'Retry question',exact:true}).click();await page.getByRole('alert').filter({hasText:'repeated'}).waitFor();assert.equal((await snapshot()).explorationNodes.length,count);repeat=false;
 fail=true;await page.getByRole('button',{name:'Retry question',exact:true}).click();await page.getByRole('alert').filter({hasText:'Synthetic AI failure'}).waitFor();assert.equal((await snapshot()).explorationNodes.length,count);fail=false;
 held=true;const requested=calls.length;await page.getByRole('button',{name:'Dave asks',exact:true}).click();await page.waitForFunction(n=>window!==null&&document.body.textContent.includes('DAVE is considering'),requested);while(!release)await new Promise(r=>setTimeout(r,5));await page.evaluate(async()=>{(await import('/src/state/projectStore.ts')).projectStore.updateProject({context:'Edited while waiting.'});});release();held=false;await page.getByRole('alert').filter({hasText:'changed during generation'}).waitFor();assert.equal((await snapshot()).explorationNodes.length,count);
 const stable=await snapshot();assert.deepEqual(stable.dimensions,original.dimensions);assert.deepEqual(stable.dimensionPositions,original.dimensionPositions);await saved();await page.reload();await page.getByRole('button',{name:'Exploration',exact:true}).click();assert.deepEqual((await snapshot()).explorationNodes,stable.explorationNodes);
 await page.getByRole('button',{name:'Show exploration',exact:true}).click();await page.getByRole('button',{name:'Sketch A',exact:true}).focus();await page.getByRole('button',{name:'Sketch A',exact:true}).press('Enter');const thumb=page.locator(`[data-idea-id="${sketch.id}"] img`);await thumb.waitFor();await page.waitForFunction(id=>{const img=document.querySelector(`[data-idea-id="${id}"] img`);return img?.naturalWidth===160;},sketch.id);
 assert.deepEqual(errors,[]);await page.screenshot({path:'/private/tmp/dave-ai-exploration.png',fullPage:true});
 }finally{await browser.close();await server.close();}
});
