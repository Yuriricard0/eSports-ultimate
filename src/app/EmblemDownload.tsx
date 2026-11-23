import {useRef,useState} from 'react';
import type {Identity} from '../game-core/identity';
import {Emblem} from './IdentityEditor';

export function EmblemDownload({identity,code}:{identity:Identity;code:string}){
 const frame=useRef<HTMLDivElement>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const download=async()=>{
   const emblem=frame.current?.firstElementChild;
   if(!(emblem instanceof HTMLElement))return;
   setBusy(true);setError('');
   try{
     const {toBlob}=await import('html-to-image');
     await document.fonts.ready;
     const file=await toBlob(emblem,{pixelRatio:3});
     if(!file)throw Error('Não foi possível gerar o PNG.');
     const url=URL.createObjectURL(file);
     const link=document.createElement('a');
     link.href=url;
     link.download=`escudo-${code.toLowerCase().replace(/[^a-z0-9]/g,'')||'uem'}.png`;
     link.click();
     setTimeout(()=>URL.revokeObjectURL(url),1000);
   }catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível exportar o escudo.');}
   finally{setBusy(false);}
 };
 return <>
   <div className="emblem-download-source" ref={frame} aria-hidden="true"><Emblem identity={identity} code={code}/></div>
   <button disabled={busy} onClick={()=>void download()}>{busy?'Gerando PNG…':'Baixar escudo salvo em PNG'}</button>
   {error&&<p role="alert">{error}</p>}
 </>;
}
