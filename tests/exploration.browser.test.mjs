import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';

async function setup(run) {
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE??'playwright');
 const server=await createServer({server:{host:'127.0.0.1',port:5203,strictPort:false}});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1200}});page.setDefaultTimeout(8000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));let apiCalls=0;
  await page.route('**/api/**',r=>{apiCalls++;return r.abort();});
  await page.goto(server.resolvedUrls.local[0]);await page.getByRole('button',{name:'Live AI',exact:true}).click();
  await page.getByLabel('Project name',{exact:true}).fill('Integrated exploration');await page.getByRole('button',{name:'Create project',exact:true}).click();
  const snapshot=()=>page.evaluate(async()=>(await import('/src/state/projectStore.ts')).projectStore.getProject());
  const save=()=>page.getByText('Saved locally.',{exact:true}).waitFor();
  const stage=name=>page.getByRole('button',{name,exact:true}).click();
  await run({page,snapshot,save,stage});assert.equal(apiCalls,0);assert.deepEqual(errors,[]);
 } finally {await browser.close();await server.close();}
}
async function seed(page) {
 return page.evaluate(async()=>{
  const s=(await import('/src/state/projectStore.ts')).projectStore;
  const cat=s.categories.add({name:'Use',order:0});
  const source=s.sources.add({title:'Interview',originalFile:{id:'test',filename:'test.txt',mediaType:'text/plain'},processingState:'ready',limitations:[]});
  const e=s.evidence.add({source:{id:source.id,revision:1},categories:[{id:cat.id,revision:1}],text:'Hand effort varies.',form:'quotation',location:'Paragraph 1',context:'Synthetic check',limitations:[]});
  const claims=['Effort varies.','Support affects effort.'].map(statement=>s.claims.add({statement,evidence:[{id:e.id,revision:1}],limitations:[],review:{state:'accepted'}}));
  const r=s.relationships.add({description:'Support and effort',type:'connection',claims:claims.map(c=>({claim:{id:c.id,revision:1}})),explanation:'Test relationship',limitations:[],review:{state:'accepted'}});
  const d=s.dimensions.add({name:'Guidance',lowLabel:'Open',midLabel:'Optional',highLabel:'Guided',explanation:'Level of guidance',claims:[{id:claims[0].id,revision:1}],relationships:[{id:r.id,revision:1}],limitations:[],review:{state:'accepted'}});
  s.setDimensionPosition({dimension:{id:d.id,revision:1},selected:true,value:.5});return s.getProject();
 });
}

test('confirmation, one map, edits, branching, arrows, deletion, camera continuity and stable snapshots',async()=>setup(async({page,snapshot,save,stage})=>{
 await stage('Dimensions');await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Select at least one dimension'}).waitFor();assert.equal((await snapshot()).exploration,undefined);
 const original=await seed(page);await save();
 const map=page.locator('.relationship-map-canvas');
 await map.evaluate(el=>{el.dataset.sameCanvas='yes';});
 await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();
 await page.getByRole('button',{name:'Exploration',exact:true}).getAttribute('aria-current').then(v=>assert.equal(v,'step'));await save();
 assert.equal(await page.locator('.relationship-map-canvas').count(),1);assert.equal(await page.locator('.exploration-canvas').count(),0);assert.equal(await map.getAttribute('data-same-canvas'),'yes');
 const world=page.locator('.relationship-map-world');assert.equal(await world.locator('.map-category').count(),1);assert.equal(await world.locator('[data-map-id]').count(),2);assert.equal(await world.locator('[data-dimension-id]').count(),1);assert.equal(await world.getByRole('region',{name:'Exploration area'}).count(),1);
 const initial=await snapshot();let confirmed=initial.exploration.sessions[0];assert.equal(confirmed.tuningSnapshot[0].positionLabel,'Optional');assert.equal(confirmed.tuningSnapshot[0].value,.5);assert.deepEqual(initial.dimensions,original.dimensions);assert.deepEqual(initial.dimensionPositions,original.dimensionPositions);
 await world.getByRole('button',{name:'Expand Branch 1',exact:true}).click();confirmed=(await snapshot()).exploration.sessions[0];await world.getByRole('button',{name:'Guidance',exact:true}).click();
 await page.getByRole('complementary',{name:'Dimension and research inspector'}).getByText('Associated findings',{exact:true}).waitFor();await page.getByRole('button',{name:'Show exploration',exact:true}).click();
 const editor=page.locator('.exploration-editor');
 const fill=async(title,text)=>{await editor.getByLabel('Idea title',{exact:true}).fill(title);await editor.getByLabel('Idea text',{exact:true}).fill(text);await editor.getByRole('button',{name:'Save idea',exact:true}).click();await save();};
 await page.getByRole('button',{name:'Add text',exact:true}).click();await fill('First idea','A starting thought');
 await page.getByRole('button',{name:'Edit First idea',exact:true}).click();await fill('First idea edited','A revised thought');
 await page.getByRole('textbox',{name:'Text for First idea edited',exact:true}).fill('Edited directly on the card');
 await page.getByRole('textbox',{name:'Text for First idea edited',exact:true}).press('Tab');await save();
 let p=await snapshot();assert.equal(p.explorationNodes[0].content.text,'Edited directly on the card');assert.equal(p.explorationNodes[0].history.length,2);assert.equal(p.explorationNodes[0].explorationSession.id,confirmed.id);
 await page.getByRole('button',{name:'Add text',exact:true}).click();await fill('Second idea','Another route');
 p=await snapshot();assert.equal(p.explorationConnections.length,1);assert.equal(p.explorationConnections[0].fromNodeId,p.explorationNodes[0].id);assert.ok(p.explorationNodes[1].position.x>p.explorationNodes[0].position.x+240);
 await page.getByLabel('Active branch',{exact:true}).selectOption(confirmed.id);
 await page.getByRole('button',{name:'Add text',exact:true}).click();await fill('Third idea','A separate thought');
 await page.getByRole('button',{name:'Connect ideas',exact:true}).click();await page.getByRole('button',{name:'Second idea',exact:true}).click();assert.equal((await snapshot()).explorationConnections.length,2);
 await page.getByRole('button',{name:'Third idea',exact:true}).click();await page.getByRole('button',{name:'Connect ideas',exact:true}).click();await page.getByRole('button',{name:'Second idea',exact:true}).click();assert.equal((await snapshot()).explorationConnections.length,2);
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 const transform=await world.evaluate(el=>getComputedStyle(el).transform);const scale=Number(transform.match(/matrix\(([^,]+)/)[1]);
 p=await snapshot();const n=p.explorationNodes[1];const card=page.locator(`[data-idea-id="${n.id}"]`);const box=await card.boundingBox();
 await page.mouse.move(box.x+170*scale,box.y+150*scale);await page.mouse.down();await page.mouse.move(box.x+170*scale+70,box.y+150*scale+45,{steps:8});await page.mouse.up();await save();
 const moved=(await snapshot()).explorationNodes[1];assert.ok(Math.abs(moved.position.x-n.position.x-70/scale)<2);assert.equal(moved.revision,n.revision);
 const beforePan=await card.boundingBox();const canvas=await map.boundingBox();await page.mouse.move(canvas.x+canvas.width-25,canvas.y+25);await page.mouse.down();await page.mouse.move(canvas.x+canvas.width-85,canvas.y+55,{steps:5});await page.mouse.up();assert.ok(Math.abs((await card.boundingBox()).x-beforePan.x+60)<2);
 // Arrow selection works with keyboard even when the edge falls outside the focused viewport.
 const arrow=page.getByRole('button',{name:'Connection: Third idea to Second idea',exact:true});await arrow.focus();await arrow.press('Enter');await page.getByRole('button',{name:'Delete connection',exact:true}).click();assert.equal((await snapshot()).explorationConnections.filter(c=>!c.archivedAt).length,1);
 await page.getByRole('button',{name:'Second idea',exact:true}).click();await page.getByRole('button',{name:'Delete idea',exact:true}).click();p=await snapshot();assert.equal(p.explorationNodes.filter(n=>!n.archivedAt).length,2);assert.equal(p.explorationConnections.filter(c=>!c.archivedAt).length,0);assert.equal(p.explorationNodes.length,3);
 await page.waitForTimeout(250);await save();const camera=await world.getAttribute('style');
 await stage('Research');await stage('Relationships');assert.equal(await map.getAttribute('data-same-canvas'),'yes');await stage('Dimensions');
 await page.getByRole('button',{name:'Show dimensions',exact:true}).click();await page.getByRole('button',{name:'+1: Guided',exact:true}).click();await save();
 assert.deepEqual((await snapshot()).exploration.sessions[0],confirmed);
 await stage('Exploration');assert.equal(await world.getAttribute('style'),camera);await world.getByText('Current sliders have changed.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Add text',exact:true}).click();await fill('Fourth idea','Still uses confirmed context');
 p=await snapshot();assert.equal(p.explorationNodes.at(-1).dimensionPositions[0].revision,1);assert.deepEqual(p.exploration.sessions[0],confirmed);
 await stage('Dimensions');await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();await save();p=await snapshot();assert.equal(p.exploration.sessions.length,2);assert.equal(p.exploration.sessions[1].tuningSnapshot[0].positionLabel,'Guided');assert.deepEqual(p.exploration.sessions[0],confirmed);
 const stable=await snapshot();await page.reload();await stage('Exploration');await page.locator('.exploration-card').first().waitFor();p=await snapshot();assert.deepEqual(p.explorationNodes,stable.explorationNodes);assert.deepEqual(p.explorationConnections,stable.explorationConnections);assert.deepEqual(p.exploration,stable.exploration);
 await page.getByRole('button',{name:'Show exploration',exact:true}).click();await page.screenshot({path:'/private/tmp/dave-integrated-exploration.png',fullPage:true});
}));

test('legacy ideas and projects without new fields remain intact; invalid confirmation never changes tuning',async()=>setup(async({page,snapshot,save,stage})=>{
 const original=await seed(page);
 const old=await page.evaluate(async()=>{
  const s=(await import('/src/state/projectStore.ts')).projectStore;
  const n=s.explorationNodes.add({title:'Earlier idea',content:{type:'idea',text:'Keep me'},position:{x:80,y:80},references:{evidence:[],claims:[],relationships:[],dimensions:[]},dimensionPositions:[],limitations:[]});
  const p=s.getProject().dimensionPositions[0];s.setDimensionPosition({...p,value:null});return n;
 });
 await stage('Dimensions');await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();await page.getByRole('alert').filter({hasText:'Choose a position'}).waitFor();assert.equal((await snapshot()).dimensionPositions[0].value,null);
 await stage('Exploration');await page.getByRole('button',{name:'Earlier idea',exact:true}).waitFor();assert.deepEqual((await snapshot()).explorationNodes[0],old);await save();
 await page.reload();await stage('Exploration');assert.deepEqual((await snapshot()).explorationNodes[0],old);assert.deepEqual((await snapshot()).dimensions,original.dimensions);
}));

test('Confirm tuning uses edited labels directly and preserves the chosen values',async()=>setup(async({page,snapshot,save,stage})=>{
 await seed(page);await page.evaluate(async()=>{const s=(await import('/src/state/projectStore.ts')).projectStore;s.dimensions.update(s.getProject().dimensions[0].id,{midLabel:'Optional support'});});
 assert.equal((await snapshot()).exploration,undefined);
 await stage('Dimensions');await page.getByRole('button',{name:'Confirm tuning',exact:true}).click();
 await page.getByRole('button',{name:'Dave asks',exact:true}).waitFor();await save();
 const p=await snapshot();assert.equal(p.dimensionPositions[0].value,.5);assert.equal(p.exploration.sessions[0].tuningSnapshot[0].positionLabel,'Optional support');
 assert.equal(await page.getByRole('region',{name:'Review settings before exploration'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Exploration',exact:true}).getAttribute('aria-current'),'step');
}));
