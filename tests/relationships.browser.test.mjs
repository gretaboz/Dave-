import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';
test('grounded proposals, edits, review and original evidence persist; failed retry preserves work',async()=>{
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE ?? 'playwright');
 const server=await createServer({server:{host:'127.0.0.1',port:5197,strictPort:false}}); await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
 try {
 const page=await browser.newPage(); await page.goto(server.resolvedUrls.local[0]);
 await page.getByRole('button',{name:'Live AI',exact:true}).click();
 await page.getByLabel('Project name',{exact:true}).fill('Synthetic relationship test'); await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.evaluate(async()=>{
 const {projectStore:s}=await import('/src/state/projectStore.ts');
 const source=s.sources.add({title:'Interview',originalFile:{id:crypto.randomUUID(),filename:'notes.txt',mediaType:'text/plain'},limitations:[],processingState:'ready',preparedContent:{format:'txt',extractedAt:new Date().toISOString(),sections:[{location:'Paragraph 1',text:'Cleanup takes effort and regular use matters.'}],limitations:[]}});
 s.categories.add({name:'Use',order:0,passages:[{source:{id:source.id,revision:1},sectionIndex:0,start:0,end:45}]});
 });
 await page.route('**/api/relationships/analyse',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({claims:[{id:'a',statement:'Cleanup may discourage use.',passageIds:['passage-0'],context:'Interview',stakeholder:'Participant',limitations:[]},{id:'b',statement:'Regular use matters to this participant.',passageIds:['passage-0'],context:'Interview',stakeholder:'Participant',limitations:[]}],relationships:[{description:'Use and cleanup coexist',type:'connection',claimIds:['a','b'],passageIds:['passage-0'],explanation:'Both occur in this account.',contextCheck:'Same account',challenge:'Does this hold elsewhere?',limitations:[]}],warnings:[]})}));
 await page.getByRole('button',{name:'Relationships',exact:true}).click(); await page.getByRole('button',{name:'Analyse relationships',exact:true}).click();
 await page.locator('.progressive-map-workspace .map-claim').first().waitFor();
 assert.equal(await page.locator('.progressive-map-workspace .map-claim').count(),2);
 assert.equal(await page.locator('.progressive-map-workspace .map-read-more').count(),0);
 assert.equal(await page.locator('.progressive-map-workspace .map-inline-explanation').count(),0);
 assert.equal(await page.locator('.progressive-map-workspace .map-relationship-node').count(),1);
 await page.getByRole('button',{name:'Cleanup may discourage use. proposed',exact:true}).click();
 assert.equal(await page.locator('.progressive-map-workspace .map-expanded-interpretation').innerText(),'Cleanup may discourage use.');
 await page.getByRole('button',{name:'Cleanup may discourage use. proposed',exact:true}).click();assert.equal(await page.locator('.progressive-map-workspace .map-expanded-interpretation').count(),0);
 assert.equal(await page.getByLabel('Evidence inspector').locator('.inspector-interpretation').innerText(),'Cleanup may discourage use.');
 assert.equal(await page.locator('.progressive-map-workspace .map-claim strong').first().innerText(),'Cleanup may discourage use');
 assert.equal(await page.locator('.progressive-map-workspace .map-relationship-node').count(),1);
 assert.equal(await page.locator('.progressive-map-workspace .map-edge').count(),2);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.equal(await page.locator('.progressive-map-workspace .map-edge').count(),2);
 await page.getByRole('button',{name:'Cleanup may discourage use. proposed',exact:true}).click();
 await page.locator('.progressive-map-workspace .map-relationship-node').click();
 const inspector=page.getByLabel('Evidence inspector');
 await inspector.getByRole('heading',{name:'Connected claims',exact:true}).waitFor();
 assert.equal(await inspector.getByText('Both occur in this account.',{exact:true}).isVisible(),true);
 assert.equal(await inspector.locator('blockquote').first().isVisible(),false);
 await page.getByRole('button',{name:'Cleanup may discourage use. proposed',exact:true}).click();

 assert.equal(await page.getByRole('heading',{name:'Use',exact:true}).count(),1);
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 const node=page.locator('.progressive-map-workspace .map-claim').first(); const box=await node.boundingBox();
 await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();await page.mouse.move(box.x+70,box.y+45,{steps:8});await page.mouse.up();
 const position=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject().claims[0].mapPosition);
 assert.ok(Number.isFinite(position.x));
 const beforeReorganise=await page.evaluate(async()=>{const p=(await import('/src/state/projectStore.ts')).projectStore.getProject();const {mapViews,...content}=p;return {...content,claims:p.claims.map(({mapPosition,updatedAt,...c})=>c)};});
 await page.getByRole('button',{name:'Reorganise map',exact:true}).click();
 const afterReorganise=await page.evaluate(async()=>{const p=(await import('/src/state/projectStore.ts')).projectStore.getProject();const {mapViews,...content}=p;return {...content,claims:p.claims.map(({mapPosition,updatedAt,...c})=>c)};});
 assert.deepEqual(afterReorganise,beforeReorganise);
 const reorganisedPosition=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject().claims[0].mapPosition);


 assert.equal(await page.getByLabel('Evidence inspector').locator('blockquote').isVisible(),false);
 assert.equal(await page.getByLabel('Evidence inspector').locator('textarea').count(),0);
 await page.getByLabel('Evidence inspector').getByText('Supporting research',{exact:true}).click();
 await page.getByLabel('Evidence inspector').locator('.inspector-excerpt summary').click();
 assert.equal(await page.getByLabel('Evidence inspector').locator('blockquote').innerText(),'Cleanup takes effort and regular use matters.');
 await page.getByLabel('Evidence inspector').getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Claim wording').fill('Cleanup can affect repeated use.'); await page.getByRole('button',{name:'Save wording'}).click(); await page.getByRole('button',{name:'Accept',exact:true}).click();
 await page.getByText('Saved locally.',{exact:true}).waitFor(); await page.reload(); await page.getByRole('button',{name:'Relationships',exact:true}).click();
 await page.getByRole('button',{name:'Cleanup can affect repeated use. accepted',exact:true}).waitFor();
 await page.route('**/api/relationships/analyse',route=>route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Not found.'})}));
 await page.getByRole('button',{name:'Analyse relationships',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'running DAVE AI server does not have the Relationships endpoint'}).waitFor();
 await page.getByRole('button',{name:'Cleanup can affect repeated use. accepted',exact:true}).waitFor();
 await page.route('**/api/relationships/analyse',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'Synthetic API failure'})}));
 await page.getByRole('button',{name:'Analyse relationships',exact:true}).click(); await page.getByRole('alert').filter({hasText:'Synthetic API failure'}).waitFor();
 const project=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject()); assert.equal(project.claims.length,2); assert.deepEqual(project.claims[0].mapPosition,reorganisedPosition); assert.equal(project.claims[0].history[0].content.statement,'Cleanup may discourage use.'); assert.equal(project.relationships[0].claims[0].claim.revision,1);

 await page.evaluate(async()=>{
   const s=(await import('/src/state/projectStore.ts')).projectStore;
   const p=s.getProject();
   s.relationships.add({description:'Legacy trade-off example',type:'trade_off',claims:p.claims.map(c=>({claim:{id:c.id,revision:c.revision}})),explanation:'Two considerations may compete in the same context.',contextCheck:'Synthetic interview',limitations:[],review:{state:'accepted'}},'dave');
 });
 assert.equal(await page.locator('.progressive-map-workspace .map-relationship').count(),0);
 await page.locator('.progressive-map-workspace').getByText('1 earlier relationships need classification',{exact:true}).click();
 await page.getByRole('button',{name:'Legacy trade-off example · accepted',exact:true}).click();
 await page.getByLabel('Evidence inspector').getByRole('heading',{name:'Needs classification',exact:true}).waitFor();
 const before=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject().relationships.at(-1));
 assert.equal(before.type,'trade_off');assert.equal(before.review.state,'accepted');
 await page.getByLabel('Evidence inspector').getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByLabel('Connection type').selectOption('potential_tension');
 await page.getByRole('button',{name:'Save wording',exact:true}).click();
 assert.equal(await page.locator('.progressive-map-workspace .map-edge-tension').count(),2);
 const after=await page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject().relationships.at(-1));
 assert.equal(after.id,before.id);assert.equal(after.history[0].content.type,'trade_off');assert.equal(after.history[0].content.review.state,'accepted');
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.equal(await page.locator('.progressive-map-workspace .map-edge').count(),4);
 } finally {await browser.close();await server.close();}
});
