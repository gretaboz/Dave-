import {createPortal} from 'react-dom';
import {useEffect,useState} from 'react';
import type {AssetReference} from '../../model/types';
import {useProjectSession} from '../../state/ProjectProvider';
export function SketchImage({asset}:{asset:AssetReference}) {
 const session=useProjectSession();const [url,setUrl]=useState('');const [error,setError]=useState('');const [open,setOpen]=useState(false);
 useEffect(()=>{let cancelled=false,objectUrl='';setUrl('');setError('');
  void session.loadFile(asset.id).then(blob=>{if(cancelled)return;if(!blob)throw new Error('This image is unavailable in local storage.');objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);}).catch(()=>{if(!cancelled)setError('This image is unavailable in local storage.');});
  return()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[asset.id,session]);
 return <>{url&&<button className="exploration-image-button" onClick={()=>setOpen(true)} aria-label={`Inspect image ${asset.filename}`}><img className="exploration-thumbnail" src={url} alt={asset.filename}/></button>}{error&&<small>{error}</small>}
  {open&&createPortal(<div className="exploration-image-overlay" role="dialog" aria-label={`Image: ${asset.filename}`} aria-modal="true" onPointerDown={e=>e.stopPropagation()}><button autoFocus onClick={()=>setOpen(false)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>Close image</button><img src={url} alt={asset.filename}/></div>,document.body)}
 </>;
}
