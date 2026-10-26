import {test,before,after} from 'node:test';
import {strict as assert} from 'node:assert';
import {createServer} from 'vite';
let server,browser;
before(async()=>{
 const {chromium}=await import(process.env.DAVE_PLAYWRIGHT_MODULE??'playwright');
 server=await createServer({server:{host:'127.0.0.1',port:5201,strictPort:false}});
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.DAVE_BROWSER_EXECUTABLE});
});
after(async()=>{await browser?.close();await server?.close();});
const node=(page,name)=>page.locator('.map-category').filter({has:page.getByRole('button',{name,exact:true})});
const panel=page=>page.getByRole('complementary',{name:'Research panel',exact:true});
async function start(){const context=await browser.newContext();const page=await context.newPage();await page.goto(server.resolvedUrls.local[0]);await node(page,'Holding and pressing').waitFor();return {context,page};}

test('the Research map is the only category navigation and opens compact source details',async()=>{
 const {context,page}=await start();try{
 const p=panel(page),list=p.getByRole('region',{name:'Source excerpts',exact:true});
 assert.equal(await p.locator('.research-category-row').count(),0);
 assert.equal(await list.locator('.research-excerpt').count(),9);
 await node(page,'Holding and pressing').getByText('Accounts of grip, wrist effort, and movement of the press during use.',{exact:true}).click();
 await p.getByRole('heading',{name:'Holding and pressing',exact:true}).waitFor();
 assert.equal(await node(page,'Holding and pressing').getAttribute('data-selected'),'true');
 assert.equal(await list.locator('.research-excerpt').count(),3);
 assert.equal(await p.getByText('2 supporting sources',{exact:true}).count(),1);
 await node(page,'Collecting and pouring juice').getByRole('button',{name:'Inspect sources',exact:true}).click();
 await p.getByRole('heading',{name:'Collecting and pouring juice',exact:true}).waitFor();
 assert.equal(await list.locator('.research-excerpt').count(),1);
 await list.getByRole('button',{name:'View source',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Source details',exact:true});await dialog.waitFor();
 assert.equal(await dialog.getByRole('heading',{name:'Synthetic use observations.txt',exact:true}).count(),1);
 assert.ok(await dialog.locator('blockquote').count());
 await dialog.getByRole('button',{name:'Close source details',exact:true}).click();
 assert.equal(await p.getByRole('heading',{name:'Collecting and pouring juice',exact:true}).count(),1);
 await p.getByRole('button',{name:'All sources',exact:true}).click();
 assert.equal(await list.locator('.research-excerpt').count(),9);
 assert.equal(await page.locator('.map-category[data-selected=true]').count(),0);
 }finally{await context.close();}
});

test('existing panel visibility and side controls work with both category entry points',async()=>{
 const {context,page}=await start();try{
 for(const side of ['left','right','left']){
 const workspace=page.locator('.continuous-workspace');
 if(await workspace.getAttribute('data-panel-side')!==side)await page.getByRole('button',{name:'Move panel '+side,exact:true}).click();
 assert.equal(await workspace.getAttribute('data-panel-side'),side);
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();assert.equal(await panel(page).isVisible(),false);
 await page.getByRole('button',{name:'Show panel',exact:true}).click();assert.equal(await panel(page).isVisible(),true);
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();
 await node(page,'Holding and pressing').getByRole('button',{name:'Holding and pressing',exact:true}).click();
 assert.equal(await panel(page).isVisible(),true);
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();
 await node(page,'Pulp and cleaning').getByRole('button',{name:'Inspect sources',exact:true}).click();
 assert.equal(await panel(page).isVisible(),true);
 await panel(page).getByRole('heading',{name:'Pulp and cleaning',exact:true}).waitFor();
 assert.equal(await workspace.getAttribute('data-panel-side'),side);
 }
 }finally{await context.close();}
});

test('relocated category management preserves demo documents and never calls AI',async()=>{
 const {context,page}=await start();let requests=0;
 await page.route('**/api/**',route=>{requests++;return route.abort();});
 try{
 const p=panel(page);await p.locator('.research-library-tools > summary').click();
 await p.getByRole('button',{name:'Analyse research',exact:true}).click();
 await p.getByRole('status').filter({hasText:'No OpenAI request was made'}).waitFor();
 await p.getByLabel('New category',{exact:true}).fill('Disposable test category');
 await p.getByRole('button',{name:'Create category',exact:true}).click();
 await p.getByRole('button',{name:'Rename Disposable test category',exact:true}).click();
 await p.getByLabel('Category name',{exact:true}).fill('Renamed test category');
 await p.getByRole('button',{name:'Save name',exact:true}).click();
 await node(page,'Renamed test category').waitFor();
 await page.getByRole('status').filter({hasText:'Saved locally.'}).waitFor();
 await page.reload();
 await node(page,'Renamed test category').getByRole('button',{name:'Inspect sources',exact:true}).click();
 page.once('dialog',dialog=>dialog.accept());
 await panel(page).getByRole('button',{name:'Delete category Renamed test category',exact:true}).click();
 await panel(page).getByRole('heading',{name:'All sources',exact:true}).waitFor();
 assert.equal(await node(page,'Renamed test category').count(),0);
 assert.equal(await panel(page).getByText('3 supporting sources',{exact:true}).count(),1);
 assert.equal(requests,0);
 }finally{await context.close();}
});

test('compact source view retains responsive panel layout and a scrollable excerpt list',async()=>{
 const {context,page}=await start();try{
 for(const width of [1440,792,390]){
 await page.setViewportSize({width,height:1000});
 assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth));
 const list=panel(page).locator('.research-source-list');
 assert.ok(await list.evaluate(el=>el.scrollHeight>el.clientHeight));
 await node(page,'Holding and pressing').getByRole('button',{name:'Inspect sources',exact:true}).click();
 await panel(page).getByRole('heading',{name:'Holding and pressing',exact:true}).waitFor();
 await panel(page).getByRole('button',{name:'All sources',exact:true}).click();
 }
 }finally{await context.close();}
});

async function emptyCanvasPoint(page){
 return page.locator('.relationship-map-canvas').evaluate(canvas=>{
  const bounds=canvas.getBoundingClientRect();
  const obstacles=[...canvas.querySelectorAll('.map-category,.map-node,.map-relationship-node,.map-toolbox-stack,.map-empty')].map(el=>el.getBoundingClientRect());
  for(let y=bounds.top+12;y<Math.min(bounds.bottom,innerHeight)-12;y+=20)for(let x=bounds.left+12;x<Math.min(bounds.right,innerWidth)-12;x+=20){
   const target=document.elementFromPoint(x,y);
   if((target===canvas||target?.classList.contains('relationship-map-world'))&&!obstacles.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))return {x,y};
  }
  throw new Error('No empty visible map canvas point available');
 });
}

test('empty Research canvas clears only selection and preserves controls, pan, visibility and side',async()=>{
 const {context,page}=await start();try{
 const category=node(page,'Holding and pressing');
 await category.getByRole('button',{name:'Inspect sources',exact:true}).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();
 assert.equal(await category.getAttribute('data-selected'),'true');
 const point=await emptyCanvasPoint(page);
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+15,point.y+15,{steps:4});await page.mouse.up();
 assert.equal(await category.getAttribute('data-selected'),'true');
 await page.getByRole('button',{name:'Move panel right',exact:true}).click();
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();
 const empty=await emptyCanvasPoint(page);await page.mouse.click(empty.x,empty.y);
 assert.equal(await page.locator('.map-category[data-selected=true]').count(),0);
 assert.equal(await panel(page).isVisible(),false);
 assert.equal(await page.locator('.continuous-workspace').getAttribute('data-panel-side'),'right');
 await page.getByRole('button',{name:'Show panel',exact:true}).click();
 await panel(page).getByRole('heading',{name:'All sources',exact:true}).waitFor();
 await node(page,'Pulp and cleaning').getByRole('button',{name:'Inspect sources',exact:true}).click();
 await panel(page).getByRole('heading',{name:'Pulp and cleaning',exact:true}).waitFor();
 }finally{await context.close();}
});

test('empty Relationships canvas restores its overview without revealing a hidden panel',async()=>{
 const {context,page}=await start();try{
 await page.evaluate(async()=>{
  const {createLocalPersistence}=await import('/src/persistence/localPersistence.ts');
  const {prepareRelationships,applyRelationships}=await import('/src/features/relationships/analysis.ts');
  const persistence=createLocalPersistence({databaseName:'dave-synthetic-demo'});
  const project=await persistence.loadProject(),passages=prepareRelationships(project);
  const claims=['a','b'].map((id,i)=>({id,statement:'Synthetic interpretation '+id,passageIds:[passages[i].id],context:'Synthetic fixture',stakeholder:'Fictional participant',limitations:[]}));
  const relationships=[{description:'Synthetic connection',type:'connection',claimIds:['a','b'],passageIds:[passages[0].id,passages[1].id],explanation:'Synthetic reasoning',contextCheck:'Test fixture',challenge:'Check context',limitations:[]}];
  await persistence.saveProject(applyRelationships(project,passages,{claims,relationships}));
 });
 await page.reload();await page.getByRole('button',{name:'Relationships',exact:true}).click();
 const relationship=page.getByRole('button',{name:'Connection: Synthetic connection',exact:true});await relationship.click();
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();assert.equal(await relationship.getAttribute('aria-pressed'),'true');
 const point=await emptyCanvasPoint(page);await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+15,point.y+15,{steps:4});await page.mouse.up();
 assert.equal(await relationship.getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Hide panel',exact:true}).click();
 const empty=await emptyCanvasPoint(page);await page.mouse.click(empty.x,empty.y);
 assert.equal(await relationship.getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#stage-side-panel').isVisible(),false);
 await page.getByRole('button',{name:'Show panel',exact:true}).click();
 await page.getByRole('heading',{name:'Relationships.',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Close inspector',exact:true}).count(),0);
 await relationship.click();await page.getByRole('button',{name:'Close inspector',exact:true}).waitFor();
 }finally{await context.close();}
});
