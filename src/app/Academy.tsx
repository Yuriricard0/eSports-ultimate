import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {academyEligible} from '../game-core/academy';
import {athleteAge} from '../game-core/development';
import {formatCareerDay} from '../game-core/calendar';
import {trainingNames,type PlayerTraining,type TrainingFocus} from '../game-core/training';
import {chooseTraining,getAcademyEvaluation,listRankedWatch,listTraining,moveToAcademy,type AcademyEvaluation as Evaluation} from '../persistence/repository';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './Players';
import {promotionRecommendation} from '../game-core/talent-development';
import {AcademyEvaluation} from './AcademyEvaluation';
import {AcademyOverview} from './AcademyOverview';
import {TrainingWeek} from './TrainingWeek';
import {PlayerProfilePanel} from './PlayerProfilePanel';
import type {RankedObservation} from '../game-core/talent-development';

export function Academy({career,players,contracts,view,onUpdated,onMarket,onScouting,organizations}:{
 career:Career;players:Player[];contracts:Contract[];view:'academy'|'training';onUpdated:(career:Career)=>Promise<void>;onMarket:()=>void;
 onScouting?:()=>void;organizations?:Record<string,string>;
}){
 const [training,setTraining]=useState<PlayerTraining[]>([]),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState('');
 const [tab,setTab]=useState<'overview'|'athletes'|'scouting'>('overview');
 const [profileId,setProfileId]=useState<number|null>(null);
 const [evaluation,setEvaluation]=useState<Evaluation|null>(null);
 const [watch,setWatch]=useState<{ids:number[];history:RankedObservation[]}>({ids:[],history:[]});
 useEffect(()=>{
   let active=true;
   listTraining(career.id).then(rows=>{if(active){setTraining(rows);setLoaded(true);}}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career]);
 useEffect(()=>{
   if(view!=='academy')return;
   let active=true;
   Promise.all([getAcademyEvaluation(career.id),listRankedWatch(career.id)]).then(([data,observed])=>{
     if(active){setEvaluation(data);setWatch(observed);}
   }).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[view,career,contracts]);
 const refreshEvaluation=async()=>{
   const [data,observed]=await Promise.all([getAcademyEvaluation(career.id),listRankedWatch(career.id)]);
   setEvaluation(data);setWatch(observed);
 };
 const settings=new Map(training.map(row=>[row.player_id,row]));
 const owned=new Map(contracts.map(row=>[row.player_id,row]));
 const squad=players.filter(player=>owned.has(player.id)&&player.mode===career.mode)
   .sort((a,b)=>b.overall-a.overall||a.id-b.id);
 const matches=(player:Player)=>[player.name,player.nickname,roleNames[player.role]].join(' ').toLowerCase().includes(search.trim().toLowerCase());
 const academy=squad.filter(player=>owned.get(player.id)?.academy);
 const main=squad.filter(player=>!owned.get(player.id)?.academy);
 const eligible=squad.filter(player=>!owned.get(player.id)?.academy&&academyEligible(player,career.day));
 const profile=players.find(player=>player.id===profileId);
 const onPlayer=(player:Player)=>setProfileId(player.id);
 const scoutingReports=new Set(watch.history.map(row=>row.player_id));
 const watched=players.filter(player=>watch.ids.includes(player.id)).slice(0,5);
 const perform=async(operation:()=>Promise<Career>,message:string)=>{
   if(busy)return;setBusy(true);setError('');setNotice('');
   try{await onUpdated(await operation());setTraining(await listTraining(career.id));setNotice(message);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 const row=(player:Player,placement:boolean)=>{
   const config=settings.get(player.id),inAcademy=!!owned.get(player.id)?.academy;
   const last=player.developmentHistory?.at(-1);
   const recommendation=inAcademy&&placement?promotionRecommendation(player,main,career.day):null;
   return <article className="player-row" key={player.id}>
     <PlayerPortrait index={player.portraitIndex}/>
     <div><strong>{player.nickname} · {roleNames[player.role]}</strong><small>{player.name} · {athleteAge(player.birthDay,career.day)} anos · {inAcademy?'Academy':'Elenco principal'}</small></div>
     <div><strong>OVR {player.overall.toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong>
       <small>Potencial estimado {player.estimateLow??'—'}–{player.estimateHigh??'—'}</small>
       {last&&<small>Última evolução: {formatCareerDay(last.day)} · OVR {last.overall.toLocaleString('pt-BR')}</small>}
     </div>
     {view==='academy'&&<button onClick={()=>onPlayer(player)}>Ver perfil completo</button>}
     {recommendation&&<details className="academy-recommendation"><summary>{recommendation.label}</summary>
       <ul>{recommendation.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul>
     </details>}
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
   {view==='academy'&&<nav className="market-toolbar academy-nav" aria-label="Navegação da Academy">
     <button aria-pressed={tab==='overview'} onClick={()=>setTab('overview')}>Visão geral</button>
     <button aria-pressed={tab==='athletes'} onClick={()=>setTab('athletes')}>Atletas</button>
     <button aria-pressed={tab==='scouting'} onClick={()=>setTab('scouting')}>Scouting</button>
   </nav>}
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {profile&&<PlayerProfilePanel key={profile.id} player={profile} players={players} career={career} contracts={contracts} organizations={organizations??{}} startFull onClose={()=>setProfileId(null)}/>}
   {view==='academy'&&tab==='overview'&&<AcademyOverview career={career} academy={academy} main={main} players={players} data={evaluation}
     onPlayer={onPlayer} onAthletes={()=>setTab('athletes')} onScouting={()=>setTab('scouting')}/>}
   {view==='academy'&&tab==='scouting'&&<>
     <section className="panel">
       <div className="players-heading"><h2>Talentos observados</h2>{onScouting&&<button onClick={onScouting}>Abrir Central de scouting</button>}</div>
       <p>{watch.ids.length} observados · {scoutingReports.size} relatórios disponíveis · {evaluation?.tryouts.filter(row=>row.state==='active').length??0} tryouts ativos</p>
       {watched.length?<ul className="academy-spotlight">{watched.map(player=>{
         const history=watch.history.filter(row=>row.player_id===player.id);
         const rise=history.length>=2?history[0].position-history.at(-1)!.position:0;
         return <li key={player.id}><PlayerPortrait index={player.portraitIndex}/>
           <button onClick={()=>onPlayer(player)}>{player.nickname}</button><small>{roleNames[player.role]??player.role}</small>
           {player.status==='ranked'&&rise>=10&&<strong>Avaliar no tryout · subiu {rise} posições</strong>}</li>;
       })}</ul>:
         <p>Observe talentos na Ranked para acompanhar a evolução aqui.</p>}
       {watched.length>0&&<p className="muted">Use o histórico observado para selecionar candidatos. A avaliação técnica é apresentada nos tryouts.</p>}
     </section>
     <AcademyEvaluation career={career} players={players} contracts={contracts} academy={academy} onUpdated={onUpdated}
       data={evaluation} observations={watch.history} section="tryouts" refresh={refreshEvaluation}/>
   </>}
   {(view==='training'||tab==='athletes')&&<>
     {!loaded&&!error&&<p role="status">Carregando treinamento…</p>}
     <p className="muted">{view==='academy'?'Atletas de 16 a 21 anos podem entrar na base. A promoção mantém o contrato e o salário.':'Escolha o foco dos atletas do elenco principal e da Academy.'}</p>
     <div className="panel player-filters"><input aria-label="Buscar atleta na Academy e treinamento" placeholder="Buscar nome, nickname ou função…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   </>}
   {view==='academy'&&tab==='athletes'&&<>
     <h2>Jogadores da base · {academy.length}</h2><div className="player-list">{academy.filter(matches).map(player=>row(player,true))}
       {!academy.length&&<p>A Academy ainda está vazia. Adicione abaixo um jovem contratado pela organização.</p>}</div>
     <h2>Jovens elegíveis do elenco · {eligible.length}</h2><div className="player-list">{eligible.filter(matches).map(player=>row(player,true))}
       {!eligible.length&&<p>Nenhum jovem elegível no elenco principal. Contrate atletas de 16 a 21 anos pelo Mercado.</p>}</div>
     <AcademyEvaluation career={career} players={players} contracts={contracts} academy={academy} onUpdated={onUpdated}
       data={evaluation} observations={watch.history} section="reports" refresh={refreshEvaluation}/>
   </>}
   {view==='training'&&<>
     <TrainingWeek career={career} players={players} contracts={contracts} training={training} onUpdated={onUpdated}/>
     <p>{squad.length} atletas · {squad.length-academy.length} no principal · {academy.length} na Academy</p>
     <div className="player-list">{squad.filter(matches).map(player=>row(player,false))}{!squad.length&&<p>Contrate jogadores para começar o treinamento.</p>}</div>
   </>}
 </>;
}
