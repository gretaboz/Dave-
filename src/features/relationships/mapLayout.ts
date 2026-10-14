import { claimMapLabels, relationshipType } from './presentation';
import type { Claim, Project } from '../../model/types';
export interface Point { x: number; y: number }
export const CARD_WIDTH = 260;
export const CARD_HEIGHT = 100;
export function claimCategories(project: Project, claim: Claim): string[] {
  const active = project.categories.filter(c => !c.archivedAt && c.review?.state !== 'rejected').sort((a,b) => a.order - b.order || a.id.localeCompare(b.id));
  const counts = new Map<string, number>();
  for (const ref of claim.evidence) {
    const entity = project.evidence.find(e => e.id === ref.id);
    const evidence = entity?.revision === ref.revision ? entity : entity?.history.find(h => h.revision === ref.revision)?.content;
    if (!evidence) continue;
    for (const c of active) {
      const explicit = evidence.categories?.some(r => r.id === c.id);
      const range = evidence.passage;
      const matched = range && c.passages?.some(p => p.source.id === range.source.id && p.source.revision === range.source.revision && p.sectionIndex === range.sectionIndex && p.start <= range.start && p.end >= range.end);
      // Older evidence can be matched only to exact source text, never category names.
      const exact = !range && c.passages?.some(p => {
        if (p.source.id !== evidence.source.id || p.source.revision !== evidence.source.revision) return false;
        const source = project.sources.find(s => s.id === p.source.id);
        const content = source?.revision === p.source.revision ? source : source?.history.find(h => h.revision === p.source.revision)?.content;
        const section = content?.preparedContent?.sections[p.sectionIndex];
        return section?.text.slice(p.start,p.end) === evidence.text;
      });
      if (range ? matched : (exact || explicit)) counts.set(c.id,(counts.get(c.id) ?? 0)+1);
    }
  }
  return active.filter(c => counts.has(c.id)).sort((a,b) => counts.get(b.id)! - counts.get(a.id)! || a.order - b.order || a.id.localeCompare(b.id)).map(c => c.id);
}
export function deriveMap(project: Project, options: {ignoreManual?:boolean;expandedClaimId?:string|null}={}) {
 const claims=project.claims.filter(c=>!c.archivedAt),relationships=project.relationships.filter(r=>!r.archivedAt);
 const labels=claimMapLabels(claims),associations=new Map(claims.map(c=>[c.id,claimCategories(project,c)]));
 const heights=new Map<string,number>(claims.map(c=>[c.id,c.id===options.expandedClaimId?220:80]));
 const categories=project.categories.filter(c=>!c.archivedAt&&c.review?.state!=='rejected').sort((a,b)=>a.order-b.order);
 const groups=[...categories.map(c=>({id:c.id as string,name:c.name})),...(claims.some(c=>!associations.get(c.id)?.length)?[{id:'unassigned',name:'Unassigned'}]:[])];
 const regions=groups.map(g=>{const members=claims.filter(c=>(associations.get(c.id)?.[0]??'unassigned')===g.id);const rowHeights=members.map(c=>heights.get(c.id)!);const headerHeight=Math.max(56,20+Math.ceil(g.name.length/38)*20);return {...g,members,x:40,y:0,columns:1,width:400,headerHeight,height:headerHeight+20+rowHeights.reduce((sum,h)=>sum+h+12,0),rowHeights};});
 let y=40;for(const r of regions){r.y=y;y+=r.height+24;}
 const positions=new Map<string,Point>();
 for(const r of regions){const slots:Point[]=[];let rowY=r.y+r.headerHeight;for(const h of r.rowHeights){for(let j=0;j<r.columns;j++)slots.push({x:r.x+25+j*290,y:rowY});rowY+=h+12;}
   const placed:{id:string;p:Point}[]=[];
   const collides=(id:string,p:Point)=>placed.some(q=>p.x<q.p.x+CARD_WIDTH+6&&p.x+CARD_WIDTH+6>q.p.x&&p.y<q.p.y+heights.get(q.id)!+6&&p.y+heights.get(id)!+6>q.p.y);
   for(const c of r.members){const saved=options.ignoreManual?undefined:c.mapPosition;const defaultPoint=slots[r.members.indexOf(c)];let p=saved?{x:Math.max(r.x+25,Math.min(saved.x,r.x+r.width-CARD_WIDTH-25)),y:Math.max(r.y+r.headerHeight,Math.min(saved.y,r.y+r.height-heights.get(c.id)!-20))}:defaultPoint;
     if(collides(c.id,p))p=slots.find(q=>q.y+heights.get(c.id)!<=r.y+r.height-24&&!collides(c.id,q))??defaultPoint;
     positions.set(c.id,p);placed.push({id:c.id,p});
   }
   if(placed.some((a,i)=>placed.slice(i+1).some(b=>a.p.x<b.p.x+CARD_WIDTH+6&&a.p.x+CARD_WIDTH+6>b.p.x&&a.p.y<b.p.y+heights.get(b.id)!+6&&a.p.y+heights.get(a.id)!+6>b.p.y)))r.members.forEach((c,i)=>positions.set(c.id,slots[i]));
 }
 const visible=relationships.filter(r=>relationshipType(r.type)!=='unclassified'&&r.claims.length===2&&r.claims.every(c=>positions.has(c.claim.id)));
 const relationshipPositions=new Map<string,Point>();
 const desired=(r:typeof visible[number])=>r.claims.reduce((sum,c)=>sum+positions.get(c.claim.id)!.y+heights.get(c.claim.id)!/2,0)/2-50;
 let nextY=40;
 for(const r of [...visible].sort((a,b)=>desired(a)-desired(b)||a.id.localeCompare(b.id))){const y=Math.max(nextY,desired(r));relationshipPositions.set(r.id,{x:600,y});nextY=y+124;}
 return {claims,relationships,regions,positions,associations,heights,labels,relationshipPositions};
}
export function relationshipRoute(a:Point,b:Point,aHeight:number,bHeight:number) {
 const horizontal=Math.abs(a.x-b.x)>=CARD_WIDTH;
 const from=horizontal?{x:a.x+(b.x>a.x?CARD_WIDTH:0),y:a.y+aHeight/2}:{x:a.x+CARD_WIDTH/2,y:a.y+(b.y>a.y?aHeight:0)};
 const to=horizontal?{x:b.x+(b.x>a.x?0:CARD_WIDTH),y:b.y+bHeight/2}:{x:b.x+CARD_WIDTH/2,y:b.y+(b.y>a.y?0:bHeight)};
 const midpoint={x:(from.x+to.x)/2,y:(from.y+to.y)/2};
 if(horizontal&&Math.abs(from.x-to.x)<180&&Math.abs(from.y-to.y)<40){const y=Math.max(a.y+aHeight,b.y+bHeight)+30;return {from,to,node:{x:midpoint.x-80,y:y-20},path:`M ${from.x} ${from.y} L ${from.x+10*(b.x>a.x?1:-1)} ${from.y} L ${from.x+10*(b.x>a.x?1:-1)} ${y} L ${to.x-10*(b.x>a.x?1:-1)} ${y} L ${to.x-10*(b.x>a.x?1:-1)} ${to.y} L ${to.x} ${to.y}`};}
 return {from,to,node:{x:midpoint.x-80,y:midpoint.y-20},path:horizontal?`M ${from.x} ${from.y} L ${midpoint.x} ${from.y} L ${midpoint.x} ${to.y} L ${to.x} ${to.y}`:`M ${from.x} ${from.y} L ${from.x} ${midpoint.y} L ${to.x} ${midpoint.y} L ${to.x} ${to.y}`};
}

export function layeredRelationshipRoute(claim:Point,height:number,node:Point,port:number) {
 const right=node.x+105>=claim.x+CARD_WIDTH/2;
 const from={x:claim.x+(right?CARD_WIDTH:0),y:claim.y+height/2},to={x:node.x+(right?0:210),y:node.y+(port===0?35:85)};
 const bend=Math.max(40,Math.abs(to.x-from.x)/2);
 return {from,to,path:`M ${from.x} ${from.y} C ${from.x+(right?bend:-bend)} ${from.y}, ${to.x+(right?-bend:bend)} ${to.y}, ${to.x} ${to.y}`};
}
