import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';

test('one canvas retains its camera and category identity through stages and retractable panel changes',async()=>{
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE??'playwright');
 const server=await createServer({server:{host:'127.0.0.1',port:5235,strictPort:false}});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);await page.getByRole('button',{name:'Holding and pressing',exact:true}).waitFor();
 const canvas=page.locator('.relationship-map-canvas'),world=page.locator('.relationship-map-world');
 await canvas.evaluate(el=>el.dataset.persistent='yes');
 const positions=()=>page.locator('.map-category').evaluateAll(els=>els.map(el=>({name:el.getAttribute('aria-label'),left:el.style.left,top:el.style.top})));
 const initialPositions=await positions();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();const camera=await world.getAttribute('style');const bounds=await canvas.boundingBox();
 for(const stage of ['Relationships','Dimensions','Exploration','Research']){
  await page.getByRole('navigation').getByRole('button',{name:stage,exact:true}).click();
  assert.equal(await canvas.getAttribute('data-persistent'),'yes');assert.equal(await world.getAttribute('style'),camera);
  assert.deepEqual((await positions()).map(({top,...identity})=>identity),initialPositions.map(({top,...identity})=>identity));
  if(stage==='Research')assert.deepEqual(await positions(),initialPositions);
  const box=await canvas.boundingBox();for(const key of ['x','y','width','height'])assert.ok(Math.abs(box[key]-bounds[key])<1,`${stage}: ${key}`);
 }
 await page.getByRole('button',{name:'Move panel right',exact:true}).click();assert.equal(await page.locator('.continuous-workspace').getAttribute('data-panel-side'),'right');
 assert.equal(await world.getAttribute('style'),camera);
 const panel=page.getByRole('complementary',{name:'Research panel',exact:true});
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();assert.equal(await panel.isVisible(),false);assert.ok((await canvas.boundingBox()).width>bounds.width);
 await page.getByRole('button',{name:'Show panel',exact:true}).click();assert.equal(await panel.isVisible(),true);
 await page.getByRole('button',{name:'Move panel left',exact:true}).click();assert.equal(await world.getAttribute('style'),camera);
 await page.getByRole('navigation').getByRole('button',{name:'Exploration',exact:true}).click();await page.getByRole('button',{name:'Hide panel',exact:true}).click();assert.equal(await page.locator('#stage-side-panel').isVisible(),false);await page.getByRole('button',{name:'Show panel',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Research',exact:true}).click();
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();await page.locator('.map-category').first().getByRole('button',{name:'Inspect sources',exact:true}).click();assert.equal(await panel.isVisible(),true);
 await page.getByRole('button',{name:'Live AI',exact:true}).click();await page.getByLabel('Project name',{exact:true}).fill('Continuous layout test');await page.getByRole('button',{name:'Create project',exact:true}).click();
 await page.evaluate(async()=>{const s=(await import('/src/state/projectStore.ts')).projectStore;const c=s.categories.add({name:'Use',order:0});s.categories.add({name:'Cleaning',order:1});const source=s.sources.add({title:'Synthetic interview',originalFile:{id:'test',filename:'test.txt',mediaType:'text/plain'},limitations:[],processingState:'ready'});const e=s.evidence.add({source:{id:source.id,revision:1},categories:[{id:c.id,revision:1}],text:'Hands tire.',form:'quotation',location:'Paragraph 1',context:'Test',limitations:[]});window.auditEvidence=e;});
 const before=await positions();await page.evaluate(async()=>{const s=(await import('/src/state/projectStore.ts')).projectStore;s.claims.add({statement:'Effort varies.',evidence:[{id:window.auditEvidence.id,revision:1}],limitations:[],review:{state:'proposed'}});});
 await page.getByRole('navigation').getByRole('button',{name:'Relationships',exact:true}).click();assert.deepEqual((await positions()).map(({top,...identity})=>identity),before.map(({top,...identity})=>identity));assert.equal(await page.locator('.map-claim').count(),1);
 await page.getByRole('navigation').getByRole('button',{name:'Research',exact:true}).click();assert.equal(await page.locator('.map-claim').count(),0);assert.deepEqual(await positions(),before);
 await page.getByRole('navigation').getByRole('button',{name:'Dimensions',exact:true}).click();await page.getByRole('button',{name:'Add dimension',exact:true}).click();const editor=page.getByRole('form',{name:'Add dimension',exact:true});await editor.getByLabel('Title',{exact:true}).fill('Unfinished tuning draft');await page.getByRole('navigation').getByRole('button',{name:'Research',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Dimensions',exact:true}).click();assert.equal(await editor.getByLabel('Title',{exact:true}).inputValue(),'Unfinished tuning draft');
 assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
});
