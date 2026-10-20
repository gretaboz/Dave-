const fail = message => { throw new Error(message); };
const record = x => x && typeof x === 'object' && !Array.isArray(x);
function object(x, keys) { if (!record(x) || Object.keys(x).some(k => !keys.includes(k))) fail('Invalid Exploration question data.'); }
function text(x, max=2000) { if (typeof x !== 'string' || x.length > max) fail('Exploration text exceeds the supported size or is invalid.'); }
function list(x, max=24) { if (!Array.isArray(x) || x.length > max) fail('Too much Exploration context. Select a shorter branch or fewer dimensions.'); }
function ref(x) { object(x,['id','revision']);text(x.id,160);if(!x.id || !Number.isInteger(x.revision)||x.revision<1)fail('Invalid Exploration reference.'); }
const norm = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function questionFingerprint(s) { let h=2166136261;for(const c of norm(s))h=Math.imul(h^c.codePointAt(0),16777619);return (h>>>0).toString(16); }
export function validateQuestionInput(input) {
 object(input,['project','session','request','branch','previousQuestions','questionFingerprints','settings','claims','relationships','evidence','categories','passages','limitations']);
 object(input.project,['id','name','context']);text(input.project.id,160);text(input.project.name,300);text(input.project.context,8000);
 ref(input.session);object(input.request,['mode','selectedId','parentId']);if(!['initial','followup','alternative'].includes(input.request.mode))fail('Invalid question request.');
 for(const k of ['selectedId','parentId'])if(input.request[k]!==null)text(input.request[k],160);
 list(input.settings,16);if(!input.settings.length)fail('Confirm Dimensions before asking DAVE.');
 for(const s of input.settings){object(s,['dimension','position','name','label','value','meaning']);ref(s.dimension);ref(s.position);text(s.name,300);text(s.label,400);text(s.meaning,800);if(!Number.isFinite(s.value)||s.value<0||s.value>1)fail('A confirmed position is unavailable.');}
 for(const k of ['branch','claims','relationships','evidence','categories','passages','previousQuestions','limitations'])list(input[k],k==='previousQuestions'?80:24);
 list(input.questionFingerprints,1000);input.questionFingerprints.forEach(s=>text(s,16));input.previousQuestions.forEach(s=>text(s,240));input.limitations.forEach(s=>text(s,500));
 for(const n of input.branch){object(n,['id','revision','title','kind','text','origin']);ref({id:n.id,revision:n.revision});text(n.title,300);text(n.text,2400);if(!['note','idea','question','image','sketch'].includes(n.kind)||!['dave','researcher','dave_edited_by_researcher'].includes(n.origin))fail('Invalid branch card.');}
 for(const c of input.claims){object(c,['id','revision','text','evidence','limitations']);ref({id:c.id,revision:c.revision});text(c.text);list(c.evidence);c.evidence.forEach(ref);list(c.limitations);c.limitations.forEach(s=>text(s,500));}
 for(const r of input.relationships){object(r,['id','revision','text','type','claims','limitations']);ref({id:r.id,revision:r.revision});text(r.text);text(r.type,80);list(r.claims);r.claims.forEach(ref);list(r.limitations);r.limitations.forEach(s=>text(s,500));}
 for(const e of input.evidence){object(e,['id','revision','text','source','title','location']);ref({id:e.id,revision:e.revision});ref(e.source);text(e.text,4000);text(e.title,300);text(e.location,500);}
 for(const p of input.passages){object(p,['id','category','source','sectionIndex','start','end','text','title','location']);text(p.id,240);ref(p.category);ref(p.source);text(p.text,4000);text(p.title,300);text(p.location,500);if(![p.sectionIndex,p.start,p.end].every(Number.isInteger)||p.start<0||p.end<=p.start||p.sectionIndex<0)fail('Invalid research passage.');}
 for(const p of input.passages)if(!input.categories.some(c=>c.id===p.category.id&&c.revision===p.category.revision)||p.end-p.start!==p.text.length)fail('A source passage reference is unavailable.');
 for(const c of input.categories){object(c,['id','revision','name','review']);ref({id:c.id,revision:c.revision});text(c.name,300);text(c.review,80);}
 for(const key of ['branch','claims','relationships','evidence','categories'])if(new Set(input[key].map(x=>x.id)).size!==input[key].length)fail('Ambiguous Exploration references.');
 for(const c of input.claims)if(c.evidence.some(r=>!input.evidence.some(e=>e.id===r.id&&e.revision===r.revision)))fail('A claim has unavailable evidence.');
 for(const r of input.relationships)if(r.claims.some(ref=>!input.claims.some(c=>c.id===ref.id&&c.revision===ref.revision)))fail('A relationship has unavailable claims.');
 if(input.request.mode==='initial' && (input.request.selectedId!==null||input.request.parentId!==null||input.branch.length))fail('Invalid initial question context.');
 if(input.request.mode!=='initial'&&!input.branch.some(n=>n.id===input.request.selectedId))fail('The selected card is unavailable.');
 if(input.request.parentId!==null&&!input.branch.some(n=>n.id===input.request.parentId))fail('The question parent is unavailable.');
 if(JSON.stringify(input).length>100000)fail('The Exploration context is too large.');
 return input;
}
export function validateQuestionOutput(output,input) {
 validateQuestionInput(input);
 object(output,['question','purpose','grounding','positionIds','claimIds','relationshipIds','evidenceIds','categoryIds','passageIds','limitations','model','promptVersion']);
 text(output.question,240);text(output.purpose,300);
 if([...input.settings.map(s=>s.position),...input.settings.map(s=>s.dimension),...input.claims,...input.relationships,...input.evidence,...input.categories,...input.branch].some(r=>r.id.length>=6&&(output.question.includes(r.id)||output.purpose.includes(r.id))))fail('DAVE included internal references in visible text. Request another question.');
 if(!output.purpose.trim()||!output.question.endsWith('?')||(output.question.match(/\?/g)||[]).length!==1||output.question.split(/\s+/).length>36||!/^(what|how|where|which|when|why|whose|in what|under what)\b/i.test(output.question))fail('DAVE returned a question that needs to be shorter and open-ended. Retry.');
 if(!['research_grounded','inferred'].includes(output.grounding))fail('Missing question grounding.');
 for(const [key,items] of [['positionIds',input.settings.map(s=>({id:s.position.id}))],['claimIds',input.claims],['relationshipIds',input.relationships],['evidenceIds',input.evidence],['categoryIds',input.categories],['passageIds',input.passages]]){
  list(output[key]);if(new Set(output[key]).size!==output[key].length||output[key].some(id=>typeof id!=='string'||!items.some(x=>x.id===id)))fail('DAVE returned an unavailable research reference. Nothing was added.');
 }
 if(!output.positionIds.length)fail('DAVE did not link its question to a confirmed setting.');
 if(output.grounding==='research_grounded'&&!output.claimIds.length&&!output.relationshipIds.length&&!output.evidenceIds.length&&!output.passageIds.length)fail('Research grounding needs supporting findings.');
 list(output.limitations,5);output.limitations.forEach(s=>text(s,300));if(output.grounding==='inferred'&&!output.limitations.length)fail('An exploratory inference needs a stated limitation.');
 if(input.questionFingerprints.includes(questionFingerprint(output.question)))fail('DAVE repeated an earlier question. Request another question.');
 for(const q of input.previousQuestions){const a=new Set(norm(q).split(' ')),b=new Set(norm(output.question).split(' '));const common=[...a].filter(w=>b.has(w)).length;if(common/new Set([...a,...b]).size>=.82)fail('DAVE repeated an earlier question. Request another question.');}
 return output;
}
