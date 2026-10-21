// Shared boundary validation: browser and backend validate the same catalogue.
const text=(v,max=1500)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const list=(v)=>Array.isArray(v)&&v.length<=2000;
const normal=v=>v.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const usable=v=>['accepted','partially_accepted','proposed','unresolved'].includes(v);
const reference=v=>v&&text(v.id,200)&&Number.isInteger(v.revision)&&v.revision>0;
export function validateDimensionInput(input) {
  if(!input||typeof input.context!=='string'||input.context.length>4000||!['categories','claims','relationships','evidence','passages','existingDimensions'].every(k=>list(input[k])))throw new Error('Invalid dimension context.');
  if(input.projectName!==undefined&&!text(input.projectName,2000))throw new Error('Invalid project name.');
  if(input.limitations!==undefined&&(!Array.isArray(input.limitations)||input.limitations.some(l=>!text(l))))throw new Error('Invalid context limitations.');
  for(const kind of ['categories','claims','relationships','evidence']) {
    if(new Set(input[kind].map(x=>x.id)).size!==input[kind].length||input[kind].some(x=>!reference(x)))throw new Error('Invalid dimension reference catalogue.');
  }
  if(input.categories.some(c=>!text(c.name,120)||!['accepted','partially_accepted','proposed','unresolved','unreviewed'].includes(c.review)))throw new Error('Invalid category context.');
  if(input.evidence.some(e=>!text(e.text,120000)||!reference(e.source)||!text(e.title,1000)||!text(e.location,1000)))throw new Error('Invalid source excerpt.');
  if(input.claims.some(c=>!text(c.statement,2000)||!usable(c.review)||!Array.isArray(c.evidence)||!c.evidence.length||c.evidence.some(r=>!input.evidence.some(e=>e.id===r.id&&e.revision===r.revision))))throw new Error('Only active claims with available evidence can motivate dimensions.');
  if(input.relationships.some(r=>!text(r.description,2000)||!usable(r.review)||!['connection','potential_tension'].includes(r.type)||!Array.isArray(r.claims)||r.claims.length!==2||r.claims.some(ref=>!input.claims.some(c=>c.id===ref.id&&c.revision===ref.revision))))throw new Error('Only active connections with available claims can motivate dimensions.');
  if(input.passages.some(p=>!input.categories.some(c=>c.id===p.categoryId&&c.revision===p.revision)||!Number.isInteger(p.index)||p.index<0||!text(p.text,120000)||!reference(p.source)||!text(p.title,1000)||!text(p.location,1000)))throw new Error('Invalid research passage.');
  if(new Set(input.passages.map(p=>`${p.categoryId}:${p.revision}:${p.index}`)).size!==input.passages.length)throw new Error('Duplicate research passage.');
  if(input.existingDimensions.some(d=>!reference(d)||!text(d.name,2000)))throw new Error('Invalid existing dimension.');
  if(!input.evidence.length&&!input.passages.length)throw new Error('Insufficient research. Add source excerpts or grounded claims first.');
  if(JSON.stringify(input).length>180000)throw new Error('Dimension context exceeds the prototype limit. Nothing was omitted; use a smaller research set.');
}
export function validateDimensionOutput(output,input) {
  validateDimensionInput(input);
  if(!output||!Array.isArray(output.dimensions)||output.dimensions.length>7||!Array.isArray(output.warnings)||output.warnings.length>30||output.warnings.some(w=>!text(w)))throw new Error('Invalid dimension response. Nothing was added.');
  const seen=new Set(input.existingDimensions.map(d=>normal(d.name)));
  const signatures=new Set(input.existingDimensions.filter(d=>d.lowLabel&&d.midLabel&&d.highLabel).map(d=>[d.lowLabel,d.midLabel,d.highLabel].map(normal).sort().join('|')));
  const endpoints=new Set(input.existingDimensions.filter(d=>d.lowLabel&&d.highLabel).map(d=>[d.lowLabel,d.highLabel].map(normal).sort().join('|')));
  let duplicates=0;
  const dimensions=[];
  for(let d of output.dimensions) {
    if(!d||!text(d.name,100)||!text(d.explanation,400)||!text(d.rationale,1000)||!['research_grounded','inferred'].includes(d.grounding)||!Array.isArray(d.limitations)||d.limitations.length>20||d.limitations.some(l=>!text(l)))throw new Error('Incomplete dimension proposal. Nothing was added.');
    for(const key of ['lowLabel','midLabel','highLabel'])if(!text(d[key],70))throw new Error('A dimension needs three meaningful labels.');
    for(const key of ['lowExplanation','midExplanation','highExplanation'])if(!text(d[key],400))throw new Error('A dimension needs three position explanations.');
    if(new Set([d.lowLabel,d.midLabel,d.highLabel].map(normal)).size!==3)throw new Error('Dimension positions must be distinct.');
    for(const [key,catalogue] of [['claimIds','claims'],['relationshipIds','relationships'],['evidenceIds','evidence']]) {
      if(!Array.isArray(d[key])||d[key].length>100||d[key].some(id=>!input[catalogue].some(item=>item.id===id)))throw new Error(`DAVE returned an unavailable ${catalogue==='claims'?'claim':catalogue==='relationships'?'relationship':'evidence'} reference. Nothing was added. Please generate dimensions again.`);
      d={...d,[key]:[...new Set(d[key])]};
    }
    if(!Array.isArray(d.passages)||d.passages.length>100||d.passages.some(p=>!input.passages.some(e=>e.categoryId===p?.categoryId&&e.revision===p.revision&&e.index===p.index)))throw new Error('DAVE returned an unavailable research excerpt. Nothing was added. Please generate dimensions again.');
    // Repeated valid excerpts do not invalidate otherwise usable dimensions.
    d={...d,passages:d.passages.filter((p,index,all)=>all.findIndex(other=>other.categoryId===p.categoryId&&other.revision===p.revision&&other.index===p.index)===index)};
    if(!d.claimIds.length&&!d.relationshipIds.length&&!d.evidenceIds.length&&!d.passages.length)throw new Error('A dimension must reference motivating research, including for inferences.');
    // Approval is not evidence. Keep references, but downgrade indirect support to inference.
    if(d.grounding==='research_grounded'&&!d.evidenceIds.length&&!d.passages.length) {
      d={...d,grounding:'inferred',limitations:[...d.limitations,'Evidence not verified: this dimension is based on interpretations without direct source references.']};
    }
    const name=normal(d.name),signature=[d.lowLabel,d.midLabel,d.highLabel].map(normal).sort().join('|');
    const endpoint=[d.lowLabel,d.highLabel].map(normal).sort().join('|');
    if(seen.has(name)||signatures.has(signature)||endpoints.has(endpoint)){duplicates++;continue;}
    seen.add(name);signatures.add(signature);endpoints.add(endpoint);dimensions.push(d);
  }
  return {dimensions,warnings:[...output.warnings,...(duplicates?[`${duplicates} duplicate proposal(s) omitted.`]:[])]};
}
