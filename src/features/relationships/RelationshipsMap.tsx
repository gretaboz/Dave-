import { createPortal } from 'react-dom';
import { useWorkspaceLayout } from '../../app/WorkspaceLayout';
import { categoryStyle } from '../../app/categoryStyles';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import type { MapStage, MapViewport, Project } from '../../model/types';
import { CARD_HEIGHT, CARD_WIDTH, claimCategories, deriveMap, layeredRelationshipRoute } from './mapLayout';
import { relationshipLabels, relationshipType, relationshipBrief } from './presentation';
import type { Point } from './mapLayout';
export type MapSelection = {kind:'claim' | 'relationship';id:string};
const label=(s:string)=>s.replaceAll('_',' ');
export function RelationshipsMap({project,selection,onSelect,onMove,onReorganise,extension,readOnly=false,stage='Relationships',onViewChange,exploration,focusRequest,secondaryToolbar}: {
  secondaryToolbar?:ReactNode;
  project:Project; selection:MapSelection|null; onSelect:(s:MapSelection|null)=>void;
  onMove:(s:MapSelection,p:Point)=>void; onReorganise:(positions:Map<string,Point>)=>void; readOnly?:boolean;
  stage?:MapStage; onViewChange?:(stage:MapStage,view:MapViewport)=>void;
  focusRequest?:{dimensionId?:string;point?:Point;token:number};
  exploration?:{content:(scale:number)=>ReactNode;focus?:Point;bounds:{x:number;y:number;width:number;height:number}};
  extension?:{content:ReactNode;height:number;selectedDimensionId?:string|null;associations?:{kind:'claim'|'relationship'|'category';id:string;dimensionId:string}[]};
}) {
  const { helpHost, inspectCategory, categorySelection, resetPanelOverview } = useWorkspaceLayout();
  const showExploration = stage === 'Explore';
  const showRelationships = stage !== 'Research';
  const showDimensions = stage === 'Dimensions' || stage === 'Explore';
  const associationMarkerId = useId().replaceAll(':', '');
  const [explorationToolsCollapsed,setExplorationToolsCollapsed]=useState(false);
  const [expandedClaimId,setExpandedClaimId]=useState<string|null>(null);
  const [researchSizes,setResearchSizes]=useState<{projectId:string;heights:Record<string,number>}>({projectId:project.id,heights:{}});
  const [relationshipSizes,setRelationshipSizes]=useState<{projectId:string;heights:Record<string,number>}>({projectId:project.id,heights:{}});
  const baseMap=deriveMap(project,{expandedClaimId, reserveCategorySpace:stage!=='Relationships',relationshipHeights:relationshipSizes.projectId===project.id?new Map(Object.entries(relationshipSizes.heights)):undefined});
  // Research shows flowing text, not claim slots. Stack its naturally sized boxes.
  let researchY=40;
  const map=stage==='Research'?{...baseMap,regions:baseMap.regions.map(region=>{
    const height=(researchSizes.projectId===project.id?researchSizes.heights[region.id]:undefined)??region.height;
    const positioned={...region,y:researchY,height};
    researchY+=height+24;
    return positioned;
  })}:baseMap;
  const [view,setView]=useState<MapViewport>(()=>project.mapViews?.[stage] ?? {x:20,y:20,scale:.85});
  const viewCache=useRef<Partial<Record<MapStage,MapViewport>>>({...project.mapViews});
  const lastStage=useRef(stage);
  const lastProject=useRef(project.id);
  const viewDirty=useRef(false);
  useLayoutEffect(()=>{
    if(viewDirty.current && lastStage.current!==stage) {
      const previous=viewCache.current[lastStage.current];
      if(previous)onViewChange?.(lastStage.current,previous);
      viewDirty.current=false;
    }
    const changedProject = lastProject.current !== project.id;
    if(changedProject) {
      lastProject.current = project.id;
      setView(project.mapViews?.[stage] ?? {x:20,y:20,scale:.85});
      setExpandedClaimId(null);
    }
    lastStage.current=stage;
    // Stage changes reveal layers without restoring a different camera.
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
  useLayoutEffect(()=>{
    if(stage==='Research' || !host.current)return;
    const nodes=[...host.current.querySelectorAll<HTMLElement>('.map-relationship-node')];
    const measure=()=>{
      const heights=Object.fromEntries(nodes.map(node=>[node.dataset.relationshipId!,node.offsetHeight]));
      setRelationshipSizes(previous=>previous.projectId===project.id && Object.keys(previous.heights).length===nodes.length && nodes.every(node=>previous.heights[node.dataset.relationshipId!]===heights[node.dataset.relationshipId!])?previous:{projectId:project.id,heights});
    };
    measure();
    const observer=new ResizeObserver(measure);
    nodes.forEach(node=>observer.observe(node,{box:'border-box'}));
    return ()=>observer.disconnect();
  },[stage,project.id,project.relationships,project.claims,project.categories]);
  useLayoutEffect(()=>{
    if(stage!=='Research' || !host.current)return;
    const categories=[...host.current.querySelectorAll<HTMLElement>('.map-category')];
    const measure=()=>{
      const heights=Object.fromEntries(categories.map(category=>[category.dataset.researchCategoryId!,category.offsetHeight]));
      setResearchSizes(previous=>previous.projectId===project.id && Object.keys(previous.heights).length===categories.length && categories.every(category=>previous.heights[category.dataset.researchCategoryId!]===heights[category.dataset.researchCategoryId!])?previous:{projectId:project.id,heights});
    };
    measure();
    const observer=new ResizeObserver(measure);
    categories.forEach(category=>observer.observe(category,{box:'border-box'}));
    return ()=>observer.disconnect();
  },[stage,project.id,project.categories]);
  const toolbarRef=useRef<HTMLDivElement>(null);
  const mapTop=()=> (toolbarRef.current?.offsetTop ?? 14)+(toolbarRef.current?.offsetHeight ?? 90)+20;
  const dimensionArea=useRef<HTMLDivElement>(null);
  const dimensionHeight=useRef(0);
  const [dimensionY,setDimensionY]=useState<Record<string,number>>({});
  useLayoutEffect(()=>{
    const area=dimensionArea.current;if(!area)return;
    const measure=()=>{
      dimensionHeight.current=area.offsetHeight;
      const next:Record<string,number>={};
      const areaRect=area.getBoundingClientRect();
      const scale=areaRect.width/area.offsetWidth || 1;
      area.querySelectorAll<HTMLElement>('[data-dimension-id]').forEach(card=>{const rect=card.getBoundingClientRect();next[card.dataset.dimensionId!]=40+(rect.top-areaRect.top+rect.height/2)/scale;});
      setDimensionY(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
    };
    measure();const observer=new ResizeObserver(measure);observer.observe(area);
    area.querySelectorAll('[data-dimension-id]').forEach(card=>observer.observe(card));
    return ()=>observer.disconnect();
  },[extension?.content,showDimensions]);
  useLayoutEffect(()=>{
    if(!focusRequest)return;
    if(focusRequest.point){const p=focusRequest.point;changeView({x:(host.current?.clientWidth??800)/2-(p.x+120)*.85,y:(host.current?.clientHeight??680)/2-(p.y+120)*.85,scale:.85});return;}
    const y=(dimensionY[focusRequest.dimensionId??''] ?? 160)-120;
    changeView({x:30-1000*.9,y:30-y*.9,scale:.9});
  },[focusRequest]);
  const drag=useRef<{selection:MapSelection|null;start:Point;initial:Point;moved:boolean;emptyCanvas:boolean}|null>(null);
  const point=(id:string)=>dragged?.id===id ? dragged.point : map.positions.get(id)!;
  const selectedRelations=map.relationships.filter(r=>selection?.kind==='claim' ? relationshipType(r.type)!=='unclassified' && r.claims.some(c=>c.claim.id===selection.id) : r.id===selection?.id);
  const connected=new Set(selectedRelations.flatMap(r=>r.claims.map(c=>c.claim.id)));
  if(selection?.kind==='claim') connected.add(selection.id as Project['claims'][number]['id']);
  const faded=(id:string,kind:'claim'|'relationship')=>!!selection && (kind==='claim' ? !connected.has(id as Project['claims'][number]['id']) : !selectedRelations.some(r=>r.id===id));
  function start(event:PointerEvent,s:MapSelection|null) {
    if(event.button!==0 || (!s && (event.target as Element).closest('button,input,textarea,summary,a'))) return;
    event.preventDefault();event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const target=event.target as HTMLElement;
    const overCategory=[...host.current!.querySelectorAll('.map-category')].some(category=>{
      const rect=category.getBoundingClientRect();
      return event.clientX>=rect.left && event.clientX<=rect.right && event.clientY>=rect.top && event.clientY<=rect.bottom;
    });
    const emptyCanvas=(target===host.current || target.classList.contains('relationship-map-world')) && !overCategory;
    drag.current={selection:s,start:{x:event.clientX,y:event.clientY},initial:s ? point(s.id) : {x:view.x,y:view.y},moved:false,emptyCanvas};
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
    else if(!cancel && !d.moved){
      const resetOverview=stage==='Research'||stage==='Relationships';
      if(!resetOverview || d.emptyCanvas){
        onSelect(null);setExpandedClaimId(null);
        if(resetOverview)resetPanelOverview();
      }
    }
    drag.current=null;setDragged(null);
  }
  function zoom(scale:number,anchor?:Point) {
    if((stage==='Research'||stage==='Relationships') && drag.current)drag.current.moved=true;
    const a=anchor ?? {x:(host.current?.clientWidth ?? 800)/2,y:(host.current?.clientHeight ?? 650)/2};
    changeView(v=>{const s=Math.max(.2,Math.min(2,scale));return {scale:s,x:a.x-(a.x-v.x)*s/v.scale,y:a.y-(a.y-v.y)*s/v.scale};});
  }
  function fit() {
    const pts=[...(showExploration && exploration ? [{x:exploration.bounds.x+exploration.bounds.width-CARD_WIDTH,y:exploration.bounds.y+exploration.bounds.height-CARD_HEIGHT}] : []),...(showDimensions && extension ? [{x:1000,y:40+(dimensionHeight.current || extension.height)}] : []),...(showRelationships ? [...map.positions.values(),...relationshipPositions.values()] : []),...map.regions.map(r=>({x:r.x+r.width-CARD_WIDTH,y:r.y+r.height-CARD_HEIGHT}))];
    const minX=Math.min(0,...pts.map(p=>p.x)),minY=Math.min(0,...pts.map(p=>p.y));
    const maxX=Math.max(900,...pts.map(p=>p.x+CARD_WIDTH)),maxY=Math.max(500,...pts.map(p=>p.y+CARD_HEIGHT),...(showRelationships ? [...map.positions.entries()].map(([id,p])=>p.y+(map.heights.get(id) ?? CARD_HEIGHT)) : []),...(showRelationships ? [...relationshipPositions.entries()].map(([id,p])=>p.y+(map.relationshipHeights.get(id) ?? 100)) : []));
    const top=mapTop();
    const scale=Math.max(.01,Math.min(1,((host.current?.clientWidth ?? 900)-60)/(maxX-minX),Math.max(1,(host.current?.clientHeight ?? 650)-top-30)/(maxY-minY)));
    changeView({x:30-minX*scale,y:top-minY*scale,scale});
  }
  const visibleRelationships=map.relationships.filter(r=>map.relationshipPositions.has(r.id));
  const relationshipPositions=map.relationshipPositions;
  const edges=(stage==='Research'?[]:visibleRelationships).flatMap(r=>r.claims.map((ref,port)=>({r,ref,port,route:layeredRelationshipRoute(point(ref.claim.id),map.heights.get(ref.claim.id)!,relationshipPositions.get(r.id)!,port,map.relationshipHeights.get(r.id))})));
  const earlier=map.relationships.filter(r=>relationshipType(r.type)==='unclassified');
  function focusArea(points:Point[]) {
    if(!points.length)return;
    const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
    changeView({x:30-x*.85,y:mapTop()-y*.85,scale:.85});
  }
  const toolbar=<div className="relationship-map-toolbar" role="toolbar" aria-label="Design Map controls" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
    <div><button onClick={()=>zoom(view.scale/1.2)} aria-label="Zoom out">−</button><span aria-live="polite">{Math.round(view.scale*100)}%</span><button onClick={()=>zoom(view.scale*1.2)} aria-label="Zoom in">+</button><button onClick={fit}>Fit map</button></div>
    <div><button disabled={!map.regions.length} onClick={()=>focusArea(map.regions)}>Show research</button>
    <button disabled={stage==='Research' || (!map.claims.length && !visibleRelationships.length)} onClick={()=>focusArea([...map.positions.values(),...relationshipPositions.values()])}>Show relationships</button>
    <button disabled={!showDimensions || !extension || !project.dimensions.some(d=>!d.archivedAt && d.review.state!=='rejected')} onClick={()=>focusArea([{x:1000,y:40}])}>Show dimensions</button>
    <button disabled={!showExploration || !exploration} onClick={()=>{if(exploration)focusArea([exploration.focus??exploration.bounds]);}}>Show exploration</button></div>
    {!readOnly && <div><button onClick={()=>{onReorganise(deriveMap(project,{ignoreManual:true}).positions);setExpandedClaimId(null);changeView({x:20,y:mapTop(),scale:.85});}}>Reorganise map</button></div>}
  </div>;
  return <div className="relationship-map-shell"><span className="design-map-title">Design Map</span>
  {showRelationships && earlier.length>0&&<details className="map-earlier-relationships"><summary>{earlier.length} earlier relationships need classification</summary><p>Their original wording and reviews are kept. Inspect each before choosing a type.</p>{earlier.map(r=><button className="research-text-button" key={r.id} onClick={()=>onSelect({kind:'relationship',id:r.id})}>{r.description} · {label(r.review.state)}</button>)}</details>}
  <div ref={host} className="relationship-map-canvas" aria-label={extension ? 'Design Map' : 'Research relationship map'} onPointerDown={e=>start(e,null)} onPointerMove={move} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onWheel={e=>{const rect=e.currentTarget.getBoundingClientRect();zoom(view.scale*(e.deltaY<0?1.1:1/1.1),{x:e.clientX-rect.left,y:e.clientY-rect.top});}}>
  <div className="map-toolbox-stack" ref={toolbarRef} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
    {toolbar}
  </div>
  {showExploration && secondaryToolbar && <aside className="map-exploration-toolbox" data-collapsed={explorationToolsCollapsed} aria-label="Exploration tools" onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
    <button className="exploration-toolbox-toggle" type="button" aria-expanded={!explorationToolsCollapsed} onClick={()=>setExplorationToolsCollapsed(value=>!value)} aria-label={explorationToolsCollapsed?'Expand exploration tools':'Collapse exploration tools'}><span>{explorationToolsCollapsed?'‹':'›'}</span> Exploration</button>
    <div hidden={explorationToolsCollapsed}>{secondaryToolbar}</div>
  </aside>}
  <div className="relationship-map-world" style={{transform:`translate(${view.x}px,${view.y}px) scale(${view.scale})`}}>
    {showDimensions && extension && <div className="map-dimensions-area" ref={dimensionArea} style={{left:1000,top:40}} onPointerDown={e=>e.stopPropagation()}>{extension.content}</div>}
    {showExploration && exploration?.content(view.scale)}
    {map.regions.map((r,i)=><section key={r.id} className={`map-category map-category-${r.id==='unassigned'?'neutral':i%4}`} data-research-category-id={stage==='Research'?r.id:undefined} data-selected={stage==='Research'?categorySelection?.id===r.id:undefined} tabIndex={stage==='Research'?0:undefined} onPointerDown={stage==='Research'?e=>e.stopPropagation():undefined} onClick={stage==='Research'?e=>{if(!(e.target as HTMLElement).closest('button'))inspectCategory(r.id);}:undefined} onKeyDown={stage==='Research'?e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();inspectCategory(r.id);}}:undefined} style={{...categoryStyle(project,r.id),left:r.x,top:r.y,width:r.width,height:stage==='Research'?'auto':r.height}} aria-label={`Category: ${r.name}`}><h3><button className="map-category-inspect" aria-pressed={stage==='Research'?categorySelection?.id===r.id:undefined} onPointerDown={e=>e.stopPropagation()} onClick={()=>inspectCategory(r.id)}>{r.name}</button></h3>{stage==='Research' && <div className="map-category-research"><p>{project.categories.find(c=>c.id===r.id)?.description || 'Research organised in this category.'}</p><button type="button" className="project-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>inspectCategory(r.id)}>Inspect sources</button></div>}{stage!=='Research' && !r.members.length && <p>No grounded claims in this category yet.</p>}</section>)}
    
    {showDimensions && extension?.associations && <svg className="map-edges" width="1" height="1" overflow="visible"><defs><marker id={associationMarkerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="context-stroke" strokeWidth="1.5" /></marker></defs>{extension.associations.map(a=>{
      const current=a.kind==='claim'?map.positions.get(a.id):a.kind==='relationship'?relationshipPositions.get(a.id):undefined;
      // A compact claim overview must not erase provenance to earlier findings.
      // Anchor those links at their research category; the dimension inspector
      // continues to show the exact original finding and revision.
      const earlierClaim=a.kind==='claim'?project.claims.find(c=>c.id===a.id):undefined;
      const earlierRelationship=a.kind==='relationship'?project.relationships.find(r=>r.id===a.id):undefined;
      const categoryIds=earlierClaim?claimCategories(project,earlierClaim):earlierRelationship?.claims.flatMap(ref=>{
        const c=project.claims.find(c=>c.id===ref.claim.id);
        return c?claimCategories(project,c):[];
      })??[];
      const region=a.kind==='category'?map.regions.find(r=>r.id===a.id):!current?map.regions.find(r=>categoryIds.includes(r.id))??map.regions.find(r=>r.id==='unassigned'):undefined;
      const p=region?{x:region.x+region.width,y:region.y+region.headerHeight/2}:current;
      const targetY=dimensionY[a.dimensionId];
      if(!p || targetY===undefined)return null;
      const x=p.x+(region?0:a.kind==='claim'?CARD_WIDTH:210),y=p.y+(region?0:a.kind==='claim'?(map.heights.get(a.id)??80)/2:(map.relationshipHeights.get(a.id)??100)/2);
      return <path key={`${a.dimensionId}-${a.kind}-${a.id}`} data-association-earlier={!current && a.kind!=='category' ? true : undefined} data-association-from={a.id} data-association-to={a.dimensionId} className="dimension-map-association" data-active={extension.selectedDimensionId===a.dimensionId} markerEnd={`url(#${associationMarkerId})`} d={`M ${x} ${y} C 900 ${y}, 920 ${targetY}, 1000 ${targetY}`} fill="none"><title>{!current && a.kind!=='category' ? 'Earlier associated finding, grouped at its research category. Select the dimension to inspect the original finding.' : 'Associated research. Select the dimension to inspect.'}</title></path>;
    })}</svg>}
    <svg className="map-edges" width="1" height="1" overflow="visible">{edges.map(({r,ref,port,route})=><g key={`${r.id}-${port}`} className={`map-edge ${relationshipType(r.type)==='potential_tension'?'map-edge-tension':''}`} opacity={faded(r.id,'relationship')?.16:.55} data-from={ref.claim.id} data-to={r.id}><path d={route.path}/><circle cx={route.from.x} cy={route.from.y} r={3}/><circle cx={route.to.x} cy={route.to.y} r={3}/></g>)}</svg>
    {stage!=='Research' && map.claims.map(c=>{const p=point(c.id);const expanded=expandedClaimId===c.id;return <article key={c.id} className="map-node map-claim map-compact-claim" data-map-id={c.id} data-selected={selection?.id===c.id} style={{...categoryStyle(project,map.associations.get(c.id)?.[0] ?? ''),left:p.x,top:p.y,minHeight:map.heights.get(c.id),opacity:faded(c.id,'claim')?.55:1}} onPointerDown={e=>start(e,{kind:'claim',id:c.id})}><button className="map-claim-heading" aria-label={`${c.statement} ${label(c.review.state)}`} aria-expanded={expanded} onClick={e=>{if(e.detail===0){setExpandedClaimId(id=>id===c.id?null:c.id);onSelect({kind:'claim',id:c.id});}}}><strong>{map.labels.get(c.id)}</strong></button>{expanded&&<><p className="map-expanded-interpretation" onPointerDown={e=>e.stopPropagation()}>{c.statement}</p><button className="research-text-button" onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect({kind:'claim',id:c.id})}>Inspect research</button></>}<small>{c.origin==='researcher'?'Designer interpretation':'AI interpretation'}</small></article>;})}
    {stage!=='Research' && visibleRelationships.map(r=>{const p=relationshipPositions.get(r.id)!;return <button key={r.id} data-relationship-id={r.id} className={`map-relationship-node ${relationshipType(r.type)==='potential_tension'?'map-relationship-node-tension':''}`} style={{left:p.x,top:p.y,minHeight:100,opacity:faded(r.id,'relationship')?.55:1}} aria-label={`${relationshipLabels[r.type]}: ${r.description}`} aria-pressed={selection?.id===r.id} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect({kind:'relationship',id:r.id})}><strong>{relationshipLabels[r.type]}</strong><span>{relationshipBrief(r)}</span></button>;})}

  </div>{!map.regions.length&&<p className="map-empty">Your map is waiting. Organise research to add categories.</p>}</div>
  {helpHost ? createPortal(<>
  <p className="relationship-map-help">Research categories, claims and relationships. Select a card or node to inspect it. Solid line: Connection. Dashed line: Potential tension, for you to review.</p>
  <p className="relationship-map-help">Drag the canvas to pan. Scroll to zoom. {!readOnly && 'Drag cards to arrange them.'} Connections show interpretations, not causality.</p>
  </>, helpHost) : <>
  <p className="relationship-map-help">Research categories, claims and relationships. Select a card or node to inspect it. Solid line: Connection. Dashed line: Potential tension, for you to review.</p>
  <p className="relationship-map-help">Drag the canvas to pan. Scroll to zoom. {!readOnly && 'Drag cards to arrange them.'} Connections show interpretations, not causality.</p>
  </>}
  </div>;
}
