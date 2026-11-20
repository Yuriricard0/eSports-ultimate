import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {academyEligible} from '../game-core/academy';
import {athleteAge} from '../game-core/development';
import {formatCareerDay} from '../game-core/calendar';
import {trainingNames,type PlayerTraining,type TrainingFocus} from '../game-core/training';
import {chooseTraining,listTraining,moveToAcademy} from '../persistence/repository';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './Players';

export function Academy({career,players,contracts,view,onUpdated,onMarket}:{
 career:Career;players:Player[];contracts:Contract[];view:'academy'|'training';onUpdated:(career:Career)=>Promise<void>;onMarket:()=>void;
}){
 const [training,setTraining]=useState<PlayerTraining[]>([]),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState('');
 useEffect(()=>{
   let active=true;
   listTraining(career.id).then(rows=>{if(active){setTraining(rows);setLoaded(true);}}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career]);
 const settings=new Map(training.map(row=>[row.player_id,row]));
 const owned=new Map(contracts.map(row=>[row.player_id,row]));
 const squad=players.filter(player=>owned.has(player.id)&&player.mode===career.mode)
   .sort((a,b)=>b.overall-a.overall||a.id-b.id);
 const matches=(player:Player)=>[player.name,player.nickname,roleNames[player.role]].join(' ').toLowerCase().includes(search.trim().toLowerCase());
 const academy=squad.filter(player=>owned.get(player.id)?.academy);
 const eligible=squad.filter(player=>!owned.get(player.id)?.academy&&academyEligible(player,career.day));
 const perform=async(operation:()=>Promise<Career>,message:string)=>{
   if(busy)return;setBusy(true);setError('');setNotice('');
   try{await onUpdated(await operation());setTraining(await listTraining(career.id));setNotice(message);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 const row=(player:Player,placement:boolean)=>{
   const config=settings.get(player.id),inAcademy=!!owned.get(player.id)?.academy;
   const last=player.developmentHistory?.at(-1);
   return <article className="player-row" key={player.id}>
     <PlayerPortrait index={player.portraitIndex}/>
     <div><strong>{player.nickname} · {roleNames[player.role]}</strong><small>{player.name} · {athleteAge(player.birthDay,career.day)} anos · {inAcademy?'Academy':'Elenco principal'}</small></div>
     <div><strong>OVR {player.overall.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong>
       <small>Potencial estimado {player.estimateLow??'—'}–{player.estimateHigh??'—'}</small>
       {last&&<small>Última evolução: {formatCareerDay(last.day)} · OVR {last.overall.toLocaleString('pt-BR')}</small>}
     </div>
     <label>Foco de treinamento<select aria-label={'Treinamento de '+player.nickname} value={config?.focus??'balanced'} disabled={busy||!loaded}
       onChange={e=>void perform(()=>chooseTraining(career.id,player.id,e.target.value as TrainingFocus),'Foco de '+player.nickname+' salvo.')}>
       {Object.entries(trainingNames).map(([value,name])=><option key={value} value={value}>{name}</option>)}
     </select></label>
     {placement&&<button className={inAcademy?'primary':''} disabled={busy||!loaded} onClick={()=>void perform(
       ()=>moveToAcademy(career.id,player.id,!inAcademy),inAcademy?player.nickname+' promovido ao elenco principal.':player.nickname+' adicionado à Academy.'
     )}>{inAcademy?'Promover ao principal':'Adicionar à Academy'}</button>}
   </article>;
 };
 return <>
   <div className="players-heading"><h1>{view==='academy'?'Academy':'Treinamento'}</h1>{view==='academy'&&<button onClick={onMarket}>Contratar no Mercado →</button>}</div>
   <p className="muted">{view==='academy'?'Atletas de 16 a 21 anos podem entrar na base. A promoção mantém o mesmo contrato e salário.':'Escolha o foco dos atletas do elenco principal e da Academy.'}</p>
   <p className="muted">A evolução ocorre a cada 30 dias, conforme idade e potencial. Mecânica, Estratégia e Comunicação direcionam os ganhos; Equilibrado distribui o desenvolvimento entre os atributos.</p>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!loaded&&!error&&<p role="status">Carregando treinamento…</p>}
   <div className="panel player-filters"><input aria-label="Buscar atleta na Academy e treinamento" placeholder="Buscar nome, nickname ou função…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {view==='academy'?<>
     <h2>Jogadores da base · {academy.length}</h2><div className="player-list">{academy.filter(matches).map(player=>row(player,true))}
       {!academy.length&&<p>A Academy ainda está vazia. Adicione abaixo um jovem contratado pela organização.</p>}</div>
     <h2>Jovens elegíveis do elenco · {eligible.length}</h2><div className="player-list">{eligible.filter(matches).map(player=>row(player,true))}
       {!eligible.length&&<p>Nenhum jovem elegível no elenco principal. Contrate atletas de 16 a 21 anos pelo Mercado.</p>}</div>
   </>:<>
     <p>{squad.length} atletas · {squad.length-academy.length} no principal · {academy.length} na Academy</p>
     <div className="player-list">{squad.filter(matches).map(player=>row(player,false))}{!squad.length&&<p>Contrate jogadores para começar o treinamento.</p>}</div>
   </>}
 </>;
}
