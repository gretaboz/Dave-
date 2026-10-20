import { categoryStyle } from '../../app/categoryStyles';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { MapStage, MapViewport, Project } from '../../model/types';
import { CARD_HEIGHT, CARD_WIDTH, deriveMap, layeredRelationshipRoute } from './mapLayout';
import { relationshipLabels, relationshipType, relationshipBrief } from './presentation';
import type { Point } from './mapLayout';
export type MapSelection = {kind:'claim' | 'relationship';id:string};
const label=(s:string)=>s.replaceAll('_',' ');
export function RelationshipsMap({project,selection,onSelect,onMove,onReorganise,extension,readOnly=false,stage='Relationships',onViewChange,exploration,focusRequest}: {
  project:Project; selection:MapSelection|null; onSelect:(s:MapSelection|null)=>void;
  onMove:(s:MapSelection,p:Point)=>void; onReorganise:(positions:Map<string,Point>)=>void; readOnly?:boolean;
  stage?:MapStage; onViewChange?:(stage:MapStage,view:MapViewport)=>void;
  focusRequest?:{dimensionId?:string;point?:Point;token:number};
  exploration?:{content:(scale:number)=>ReactNode;focus?:Point;bounds:{x:number;y:number;width:number;height:number}};
  extension?:{content:ReactNode;height:number;selectedDimensionId?:string|null;associations?:(MapSelection & {dimensionId:string})[]};
}) {
  const [expandedClaimId,setExpandedClaimId]=useState<string|null>(null);
  const map=deriveMap(project,{expandedClaimId});
  const [view,setView]=useState<MapViewport>(()=>project.mapViews?.[stage] ?? {x:20,y:20,scale:.85});
  const viewCache=useRef<Partial<Record<MapStage,MapViewport>>>({...project.mapViews});
  const lastStage=useRef(stage);
  const viewDirty=useRef(false);
  useLayoutEffect(()=>{
    if(viewDirty.current && lastStage.current!==stage) {
      const previous=viewCache.current[lastStage.current];
      if(previous)onViewChange?.(lastStage.current,previous);
      viewDirty.current=false;
    }
    lastStage.current=stage;
    const saved=viewCache.current[stage] ?? project.mapViews?.[stage];
    const x=stage==='Dimensions'?1000:stage==='Explore'?1430:40;
    setView(saved ?? {x:30-x*.85,y:20,scale:.85});
    // Entity updates do not refocus the viewport.
  },[stage,project.id]);
  useEffect(()=>{
    if(!onViewChange || !viewDirty.current)return;
    const timer=setTimeout(()=>{onViewChange(stage,view);viewDirty.current=false;},180);
    return ()=>clearTimeout(timer);
  },[view,stage,onViewChange]);
  function changeView(next:MapViewport|((old:MapViewport)=>MapViewport)) {
    const value=typeof next==='function'?next(view):next;
    viewCache.current[stage]=value;
    viewDirty.current=true;
    setView(value);
  }
  const [dragged,setDragged]=useState<{id:string;point:Point}|null>(null);
  const host=useRef<HTMLDivElement>(null);
  const dimensionArea=useRef<HTMLDivElement>(null);
  const dimensionHeight=useRef(0);
  const [dimensionY,setDimensionY]=useState<Record<string,number>>({});
  useLayoutEffect(()=>{
    const area=dimensionArea.current;if(!area)return;
    const measure=()=>{
      dimensionHeight.current=area.offsetHeight;
      const next:Record<string,number>={};
      area.querySelectorAll<HTMLElement>('[data-dimension-id]').forEach(card=>{next[card.dataset.dimensionId!]=40+card.offsetTop+card.offsetHeight/2;});
      setDimensionY(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(area);
    area.querySelectorAll('[data-dimension-id]').forEach(card=>observer.observe(card));
    return ()=>observer.disconnect();
  },[extension?.content]);
  useLayoutEffect(()=>{
    if(!focusRequest)return;
    if(focusRequest.point){const p=focusRequest.point;changeView({x:(host.current?.clientWidth??800)/2-(p.x+120)*.85,y:(host.current?.clientHeight??680)/2-(p.y+120)*.85,scale:.85});return;}
    const y=(dimensionY[focusRequest.dimensionId??''] ?? 160)-120;
    changeView({x:30-1000*.9,y:30-y*.9,scale:.9});
  },[focusRequest]);
  const drag=useRef<{selection:MapSelection|null;start:Point;initial:Point;moved:boolean}|null>(null);
  const point=(id:string)=>dragged?.id===id ? dragged.point : map.positions.get(id)!;
  const selectedRelations=map.relationships.filter(r=>selection?.kind==='claim' ? relationshipType(r.type)!=='unclassified' && r.claims.some(c=>c.claim.id===selection.id) : r.id===selection?.id);
  const connected=new Set(selectedRelations.flatMap(r=>r.claims.map(c=>c.claim.id)));
  if(selection?.kind==='claim') connected.add(selection.id as Project['claims'][number]['id']);
  const faded=(id:string,kind:'claim'|'relationship')=>!!selection && (kind==='claim' ? !connected.has(id as Project['claims'][number]['id']) : !selectedRelations.some(r=>r.id===id));
  function start(event:PointerEvent,s:MapSelection|null) {
    if(event.button!==0 || (!s && (event.target as Element).closest('button,input,textarea,summary,a'))) return;
    event.preventDefault();event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current={selection:s,start:{x:event.clientX,y:event.clientY},initial:s ? point(s.id) : {x:view.x,y:view.y},moved:false};
  }
  function move(event:PointerEvent) {
    const d=drag.current;if(!d)return;
    const dx=event.clientX-d.start.x,dy=event.clientY-d.start.y;
    if(Math.hypot(dx,dy)>4)d.moved=true;
    if(d.selection && !readOnly)setDragged({id:d.selection.id,point:{x:d.initial.x+dx/view.scale,y:d.initial.y+dy/view.scale}});
    else if(!d.selection) changeView(v=>({...v,x:d.initial.x+dx,y:d.initial.y+dy}));
  }
  function finish(cancel=false) {
    const d=drag.current;if(!d)return;
    if(!cancel && d.selection) { if(d.moved && dragged){const region=map.regions.find(r=>r.members.some(c=>c.id===d.selection!.id));const p=region?{x:Math.max(region.x+25,Math.min(dragged.point.x,region.x+region.width-CARD_WIDTH-25)),y:Math.max(region.y+region.headerHeight,Math.min(dragged.point.y,region.y+region.height-(map.heights.get(d.selection.id)??80)-24))}:dragged.point;onMove(d.selection,p);}else {if(d.selection.kind==='claim')setExpandedClaimId(id=>id===d.selection!.id?null:d.selection!.id);onSelect(d.selection);} }
    else if(!cancel && !d.moved){onSelect(null);setExpandedClaimId(null);}
    drag.current=null;setDragged(null);
  }
  function zoom(scale:number,anchor?:Point) {
    const a=anchor ?? {x:(host.current?.clientWidth ?? 800)/2,y:(host.current?.clientHeight ?? 650)/2};
    changeView(v=>{const s=Math.max(.2,Math.min(2,scale));return {scale:s,x:a.x-(a.x-v.x)*s/v.scale,y:a.y-(a.y-v.y)*s/v.scale};});
  }
  function fit() {
    const pts=[...(exploration ? [{x:exploration.bounds.x+exploration.bounds.width-CARD_WIDTH,y:exploration.bounds.y+exploration.bounds.height-CARD_HEIGHT}] : []),...(extension ? [{x:1000,y:40+(dimensionHeight.current || extension.height)}] : []),...map.positions.values(),...relationshipPositions.values(),...map.regions.map(r=>({x:r.x+r.width-CARD_WIDTH,y:r.y+r.height-CARD_HEIGHT}))];
    const minX=Math.min(0,...pts.map(p=>p.x)),minY=Math.min(0,...pts.map(p=>p.y));
    const maxX=Math.max(900,...pts.map(p=>p.x+CARD_WIDTH)),maxY=Math.max(500,...pts.map(p=>p.y+CARD_HEIGHT),...[...map.positions.entries()].map(([id,p])=>p.y+(map.heights.get(id) ?? CARD_HEIGHT)));
    const scale=Math.max(.55,Math.min(1,((host.current?.clientWidth ?? 900)-60)/(maxX-minX),((host.current?.clientHeight ?? 650)-60)/(maxY-minY)));
    changeView({x:30-minX*scale,y:30-minY*scale,scale});
  }
  const visibleRelationships=map.relationships.filter(r=>map.relationshipPositions.has(r.id));
  const relationshipPositions=map.relationshipPositions;
  const edges=visibleRelationships.flatMap(r=>r.claims.map((ref,port)=>({r,ref,port,route:layeredRelationshipRoute(point(ref.claim.id),map.heights.get(ref.claim.id)!,relationshipPositions.get(r.id)!,port)})));
  const earlier=map.relationships.filter(r=>relationshipType(r.type)==='unclassified');
  return <div className="relationship-map-shell"><div className="relationship-map-toolbar"><span>{extension ? 'Design Map' : 'Research relationship map'}</span><div><button onClick={()=>zoom(view.scale/1.2)} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(view.scale*100)}%</span><button onClick={()=>zoom(view.scale*1.2)} aria-label="Zoom in">+</button><button onClick={fit} title="Keeps text readable. Pan or use the stage focus controls to reach the wider map.">Fit map</button><button onClick={()=>changeView({x:0,y:20,scale:.85})}>Show research</button>{!readOnly && <button onClick={()=>{onReorganise(deriveMap(project,{ignoreManual:true}).positions);setExpandedClaimId(null);changeView({x:20,y:20,scale:.85});}}>Reorganise map</button>}{extension && <button onClick={()=>changeView({x:40-1000*view.scale,y:20,scale:view.scale})}>Show dimensions</button>}{exploration && <button onClick={()=>changeView({x:30-(exploration.focus?.x??exploration.bounds.x)*.85,y:20-(exploration.focus?.y??40)*.85,scale:.85})}>Show exploration</button>}<button onClick={()=>onSelect(null)}>Clear selection</button></div></div>
  <p className="relationship-map-help">Research categories, claims and relationships. Select a card or node to inspect it. Solid line: Connection. Dashed line: Potential tension, for you to review.</p>
  {earlier.length>0&&<details className="map-earlier-relationships"><summary>{earlier.length} earlier relationships need classification</summary><p>Their original wording and reviews are kept. Inspect each before choosing a type.</p>{earlier.map(r=><button className="research-text-button" key={r.id} onClick={()=>onSelect({kind:'relationship',id:r.id})}>{r.description} · {label(r.review.state)}</button>)}</details>}
  <p className="relationship-map-help">Drag the canvas to pan. Scroll to zoom. {!readOnly && 'Drag cards to arrange them.'} Connections show interpretations, not causality.</p>
  <div ref={host} className="relationship-map-canvas" aria-label={extension ? 'Design Map' : 'Research relationship map'} onPointerDown={e=>start(e,null)} onPointerMove={move} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onWheel={e=>{const rect=e.currentTarget.getBoundingClientRect();zoom(view.scale*(e.deltaY<0?1.1:1/1.1),{x:e.clientX-rect.left,y:e.clientY-rect.top});}}>
  <div className="relationship-map-world" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
    {extension && <div className="map-dimensions-area" ref={dimensionArea} style={{left:1000,top:40}} onPointerDown={e=>e.stopPropagation()}>{extension.content}</div>}
    {exploration?.content(view.scale)}
    {map.regions.map((r,i)=><section key={r.id} className={`map-category map-category-${r.id==='unassigned'?'neutral':i%4}`} style={{...categoryStyle(project,r.id),left:r.x,top:r.y,width:r.width,height:r.height}} aria-label={`Category: ${r.name}`}><h3>{r.name}</h3>{!r.members.length && <p>No grounded claims in this category yet.</p>}</section>)}
    
    {extension?.associations && <svg className="map-edges" width="1" height="1" overflow="visible">{extension.associations.map(a=>{
      const p=a.kind==='claim'?map.positions.get(a.id):relationshipPositions.get(a.id);
      const targetY=dimensionY[a.dimensionId];
      if(!p || targetY===undefined)return null;
      const x=p.x+(a.kind==='claim'?CARD_WIDTH:210),y=p.y+(a.kind==='claim'?(map.heights.get(a.id)??80)/2:50);
      return <path key={`${a.dimensionId}-${a.kind}-${a.id}`} data-association-from={a.id} data-association-to={a.dimensionId} opacity={extension.selectedDimensionId===a.dimensionId?.72:.13} d={`M ${x} ${y} C 900 ${y}, 920 ${targetY}, 1000 ${targetY}`} fill="none" stroke="#91b0d2" strokeWidth="2" strokeDasharray="4 5"/>;
    })}</svg>}
    <svg className="map-edges" width="1" height="1" overflow="visible">{edges.map(({r,ref,port,route})=><g key={`${r.id}-${port}`} className={`map-edge ${relationshipType(r.type)==='potential_tension'?'map-edge-tension':''}`} opacity={faded(r.id,'relationship')?.16:.55} data-from={ref.claim.id} data-to={r.id}><path d={route.path}/><circle cx={route.from.x} cy={route.from.y} r={3}/><circle cx={route.to.x} cy={route.to.y} r={3}/></g>)}</svg>
    {map.claims.map(c=>{const p=point(c.id);const expanded=expandedClaimId===c.id;return <article key={c.id} className="map-node map-claim map-compact-claim" data-map-id={c.id} data-selected={selection?.id===c.id} style={{left:p.x,top:p.y,minHeight:map.heights.get(c.id),opacity:faded(c.id,'claim')?.55:1}} onPointerDown={e=>start(e,{kind:'claim',id:c.id})}><button className="map-claim-heading" aria-label={`${c.statement} ${label(c.review.state)}`} aria-expanded={expanded} onClick={e=>{if(e.detail===0){setExpandedClaimId(id=>id===c.id?null:c.id);onSelect({kind:'claim',id:c.id});}}}><strong>{map.labels.get(c.id)}</strong></button>{expanded&&<><p className="map-expanded-interpretation" onPointerDown={e=>e.stopPropagation()}>{c.statement}</p><button className="research-text-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect({kind:'claim',id:c.id})}>Inspect research</button></>}<small>{label(c.review.state)}</small></article>;})}
    {visibleRelationships.map(r=>{const p=relationshipPositions.get(r.id)!;return <button key={r.id} className={`map-relationship-node ${relationshipType(r.type)==='potential_tension'?'map-relationship-node-tension':''}`} style={{left:p.x,top:p.y,minHeight:100,opacity:faded(r.id,'relationship')?.55:1}} aria-label={`${relationshipLabels[r.type]}: ${r.description}`} aria-pressed={selection?.id===r.id} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect({kind:'relationship',id:r.id})}><strong>{relationshipLabels[r.type]}</strong><span>{relationshipBrief(r)}</span></button>;})}

  </div>{!map.claims.length&&!extension&&<p className="map-empty">No claims yet. Analyse relationships when your research is ready.</p>}</div></div>;
}
