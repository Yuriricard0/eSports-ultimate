import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {Career} from '../game-core/career';
import type {Identity} from '../game-core/identity';
import {defaultIdentity} from '../game-core/identity';
import {defaultUniform,uniformPatterns,type Uniform,type UniformVariant} from '../game-core/uniform';
import {listFinances,saveUniform} from '../persistence/repository';
import {Emblem} from './IdentityEditor';

export function Jersey({uniform,identity,code}:{uniform:Uniform;identity?:Identity;code:string}){
 return <div className={'jersey jersey-'+uniform.pattern} role="img" aria-label={'Camisa competitiva de '+code}
   style={{'--jersey-main':uniform.primary,'--jersey-secondary':uniform.secondary,'--jersey-detail':uniform.detail} as CSSProperties}>
   <div className="jersey-collar" aria-hidden="true"/>
   {uniform.crest&&identity&&<div className="jersey-crest"><Emblem identity={identity} code={code}/></div>}
   {uniform.monogram&&<strong>{code}</strong>}
   {uniform.sponsor&&<span>{uniform.sponsor}</span>}
 </div>;
}

const models={lisa:'Lisa',faixa:'Faixa central',listras:'Listras verticais',diagonal:'Diagonal'};
export function UniformEditor({career,onUpdated}:{career:Career;onUpdated:(career:Career)=>Promise<void>}){
 const identity=career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol};
 const initial=(variant:UniformVariant)=>career.uniforms?.[variant]??defaultUniform(identity.primary,identity.secondary,variant);
 const [variant,setVariant]=useState<UniformVariant>('home');
 const [drafts,setDrafts]=useState(()=>({home:initial('home'),away:initial('away')}));
 const [sponsors,setSponsors]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const poster=useRef<HTMLDivElement>(null);
 const draft=drafts[variant];
 useEffect(()=>{
   let active=true;
   listFinances(career.id).then(data=>{
     if(active)setSponsors([...new Set(data.sponsors.filter(s=>s.state==='accepted'&&s.accepted_day+s.duration-1>=career.day).map(s=>s.company))]);
   }).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career.id,career.day]);
 const change=(values:Partial<Uniform>)=>setDrafts(current=>({...current,[variant]:{...current[variant],...values}}));
 const perform=async(action:()=>Promise<void>)=>{
   setBusy(true);setError('');setNotice('');
   try{await action();}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}
 };
 return <section className="panel uniform-editor">
   <header className="equipment-heading"><div><h1>Editor de Uniformes</h1><p>{career.name} · {career.mode==='FPS'?'CS2':'MOBA'}</p></div></header>
   <nav className="event-tabs" aria-label="Versão do uniforme">
     <button aria-pressed={variant==='home'} onClick={()=>setVariant('home')}>Principal</button>
     <button aria-pressed={variant==='away'} onClick={()=>setVariant('away')}>Alternativa</button>
   </nav>
   {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
   <div className="uniform-workspace">
     <div ref={poster} className="uniform-poster"><small>{variant==='home'?'Principal':'Alternativa'} · {career.code}</small>
       <Jersey uniform={draft} identity={identity} code={career.code}/><h2>{career.name}</h2>
     </div>
     <div className="uniform-controls">
       <div className="uniform-colors">{([['primary','Cor principal'],['secondary','Cor secundária'],['detail','Detalhes']] as const).map(([key,label])=>
         <label key={key}>{label}<input type="color" value={draft[key]} onChange={e=>change({[key]:e.target.value})}/></label>)}</div>
       <label>Padrão<select value={draft.pattern} onChange={e=>change({pattern:e.target.value as Uniform['pattern']})}>
         {uniformPatterns.map(pattern=><option key={pattern} value={pattern}>{models[pattern]}</option>)}
       </select></label>
       <label><input type="checkbox" checked={draft.crest} onChange={e=>change({crest:e.target.checked})}/> Mostrar escudo</label>
       <label><input type="checkbox" checked={draft.monogram} onChange={e=>change({monogram:e.target.checked})}/> Mostrar sigla {career.code}</label>
       <label>Patrocinador<select value={draft.sponsor} onChange={e=>change({sponsor:e.target.value})}>
         <option value="">Sem patrocinador</option>{draft.sponsor&&!sponsors.includes(draft.sponsor)&&<option value={draft.sponsor} disabled>{draft.sponsor} · inativo</option>}
         {sponsors.map(sponsor=><option key={sponsor}>{sponsor}</option>)}
       </select></label>
       <button disabled={busy} onClick={()=>change(defaultUniform(identity.primary,identity.secondary,variant))}>Restaurar modelo</button>
       <button className="primary" disabled={busy} onClick={()=>void perform(async()=>{
         await onUpdated(await saveUniform(career.id,variant,draft));setNotice('Uniforme salvo.');
       })}>Salvar uniforme</button>
       <button disabled={busy} onClick={()=>void perform(async()=>{
         if(!poster.current)return;
         const {toPng}=await import('html-to-image');
         const link=document.createElement('a');
         link.href=await toPng(poster.current,{pixelRatio:2,skipFonts:true});
         link.download=career.code+'-uniforme-'+(variant==='home'?'principal':'alternativo')+'.png';
         link.click();
       })}>Exportar PNG</button>
     </div>
   </div>
 </section>;
}
