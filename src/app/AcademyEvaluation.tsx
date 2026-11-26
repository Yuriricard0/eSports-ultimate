import {useState} from 'react';
import {academyChange,tryoutAvailable,tryoutDurations,tryoutEvidence,type Tryout} from '../game-core/academy-evaluation';
import {formatCareerDay} from '../game-core/calendar';
import type {Career} from '../game-core/career';
import {athleteAge} from '../game-core/development';
import type {Contract,Player} from '../game-core/recruitment';
import {scoutingConfidence} from '../game-core/solo-queue';
import {dismissTryout,finishOffer,specializeYouthCoach,startTryout,type AcademyEvaluation as Evaluation} from '../persistence/repository';
import type {RankedObservation} from '../game-core/talent-development';
import {attributeLabels,roleNames} from './player-labels';
import {PlayerPortrait} from './PlayerPortrait';
import {RankedHistory} from './RankedWatch';
import {MarketNegotiations} from './MarketNegotiations';

const states={active:'Em avaliação',completed:'Avaliação concluída',dismissed:'Dispensado',signed:'Contratado',unavailable:'Indisponível'};
const rating=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});

export function AcademyEvaluation({career,players,contracts,academy,onUpdated,data,observations,section,refresh}:{
 career:Career;players:Player[];contracts:Contract[];academy:Player[];onUpdated:(career:Career)=>Promise<void>;
 data:Evaluation|null;observations:RankedObservation[];section:'reports'|'tryouts';refresh:()=>Promise<void>;
}){
 const [query,setQuery]=useState('');
 const [role,setRole]=useState('');
 const [candidate,setCandidate]=useState(0);
 const [days,setDays]=useState<number>(14);
 const [draft,setDraft]=useState<Player|null>(null);
 const [negotiating,setNegotiating]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const perform=async(action:()=>Promise<unknown>)=>{
   if(busy)return;
   setBusy(true);setError('');
   try{await action();await refresh();}
   catch(reason){setError(String(reason));}
   finally{setBusy(false);}
 };
 const byId=new Map(players.map(player=>[player.id,player]));
 const reportDates=[...new Set(data?.snapshots.map(row=>row.day)??[])].sort((a,b)=>b-a);
 const [reportDay,setReportDay]=useState(0);
 const selectedDay=reportDay||reportDates[0];
 const roles=Object.entries(roleNames).filter(([key])=>players.some(player=>player.mode===career.mode&&player.role===key));
 const openIds=new Set(data?.tryouts.filter(row=>row.state==='active'||row.state==='completed').map(row=>row.player_id));
 const followed=new Set(observations.map(row=>row.player_id));
 const eligible=players.filter(player=>tryoutAvailable(player,career.mode)&&!openIds.has(player.id)&&!contracts.some(row=>row.player_id===player.id)&&
   (!role||role===player.role)&&(!query||player.nickname.toLowerCase().includes(query.trim().toLowerCase())))
   .sort((a,b)=>Number(followed.has(b.id))-Number(followed.has(a.id))||a.nickname.localeCompare(b.nickname))
   .slice(0,40);
 return <section className="panel academy-evaluation">
   {error&&<p role="alert">{error}</p>}
   {!data&&!error&&<p role="status">Carregando avaliações…</p>}
   {section==='reports'&&data&&<>
     <h2>Relatório mensal de desenvolvimento</h2>
     <label>Data de referência <select value={selectedDay??''} onChange={event=>setReportDay(Number(event.target.value))}>
       {!reportDates.length&&<option value="">Sem registros</option>}
       {reportDates.map(day=><option key={day} value={day}>{formatCareerDay(day)}</option>)}
     </select></label>
     <p>Especialização da equipe técnica · {data.coach?'Desenvolvimento de jovens ativo':'Treinamento padrão'}.</p>
     <button disabled={busy||!data.coachAvailable} onClick={()=>void perform(()=>specializeYouthCoach(career.id,!data.coach))}>
       {data.coach?'Voltar ao treinamento padrão':'Especializar em jovens'}
     </button>
     <p className="muted">{data.coachAvailable?'A especialização acrescenta até 2 pontos percentuais à eficiência de treinamento da Academy.':'Melhore a instalação Academy para o nível 1 para liberar a especialização.'}</p>
     {!academy.length&&<p>Adicione jovens à Academy para iniciar os relatórios.</p>}
     {academy.map(player=>{
       const samples=data.snapshots.filter(row=>row.player_id===player.id&&row.day<=selectedDay);
       const last=samples.at(-1),first=samples.at(-2);
       const progress=first&&last?academyChange(first.snapshot,last.snapshot):null;
       const series=data.competitive.flatMap(row=>row.mode===player.mode?row.appearances.filter(([id])=>id===player.id).map(([,impact])=>({...row,impact})):[]);
       return <details key={player.id}>
         <summary>{player.nickname} · {roleNames[player.role]??player.role} · {progress?.state??'Aguardando histórico'}</summary>
         {progress&&first&&last?<p>{formatCareerDay(first.day)} a {formatCareerDay(last.day)} · OVR {rating(first.snapshot.overall)} → {rating(last.snapshot.overall)}.</p>:
           <p>O primeiro registro será comparado ao próximo fechamento mensal.</p>}
         {!!progress?.attributes.length&&<ul>{progress.attributes.map(row=><li key={row.key}>{attributeLabels[row.key]??row.key} +{rating(row.gain)}</li>)}</ul>}
         <h3>Desempenho competitivo registrado</h3>
         {series.length?<><p>{series.length} séries oficiais recentes · {series.filter(row=>row.won).length} vitórias.</p>
           <ul>{series.map((row,index)=><li key={row.day+':'+index}>{formatCareerDay(row.day)} · {row.won?'Vitória':'Derrota'}</li>)}</ul></>:
           <p>Sem aparições oficiais recentes registradas.</p>}
       </details>;
     })}
   </>}
   {section==='tryouts'&&data&&<>
     <h2>Tryouts</h2>
     <div className="world-filters">
       <label>Função<select value={role} onChange={event=>{setRole(event.target.value);setCandidate(0);}}><option value="">Todas</option>
         {roles.map(([key,label])=><option key={key} value={key}>{label}</option>)}
       </select></label>
       <label>Buscar candidato<input value={query} onChange={event=>{setQuery(event.target.value);setCandidate(0);}}/></label>
       <label>Candidato<select value={candidate||''} onChange={event=>setCandidate(Number(event.target.value))}><option value="">Selecione</option>
         {eligible.map(player=><option key={player.id} value={player.id}>{player.nickname} · {roleNames[player.role]??player.role}{followed.has(player.id)?' · observado':''}</option>)}
       </select></label>
       <label>Duração<select value={days} onChange={event=>setDays(Number(event.target.value))}>
         {tryoutDurations.map(value=><option key={value} value={value}>{value} dias</option>)}
       </select></label>
     </div>
     <button className="primary" disabled={busy||!eligible.some(player=>player.id===candidate)} onClick={()=>void perform(async()=>{
       await startTryout(career.id,candidate,days);setCandidate(0);
     })}>Convidar para avaliação</button>
     {!data.tryouts.length&&<p>Nenhuma avaliação registrada.</p>}
     <div className="tryout-cards">{data.tryouts.flatMap(row=>{
       const player=byId.get(row.player_id);
       return player&&(!role||player.role===role)?[<TryoutCard key={row.player_id+':'+row.start_day} player={player} row={row} day={career.day}
         history={observations.filter(item=>item.player_id===player.id&&item.day<=Math.min(career.day,row.end_day))}
         onHire={()=>{setDraft(player);setNegotiating(true);}}
         onDismiss={()=>void perform(()=>dismissTryout(career.id,row.player_id,row.start_day))} busy={busy}/>]:[];
     })}</div>
     {negotiating&&<>
       <button onClick={()=>{setDraft(null);setNegotiating(false);}}>Voltar às avaliações</button>
       <MarketNegotiations career={career} players={players} contracts={contracts} draft={draft} onClearDraft={()=>setDraft(null)} onFinish={async id=>{
         await onUpdated(await finishOffer(career.id,id));await refresh();
       }} onUpdated={onUpdated} onSent={()=>{}}/>
     </>}
   </>}
 </section>;
}

function TryoutCard({player,row,day,history,onHire,onDismiss,busy}:{
 player:Player;row:Tryout;day:number;history:RankedObservation[];onHire:()=>void;onDismiss:()=>void;busy:boolean;
}){
 const evidence=tryoutEvidence(player,row.final??(row.state==='active'?{overall:player.overall,attributes:player.attributes}:row.opening));
 const samples=history.filter(item=>item.day>=row.start_day);
 const confidence=scoutingConfidence(history.length?history[history.length-1].day-history[0].day:0,history.length);
 const change=row.final?academyChange(row.opening,row.final):null;
 return <article className="tryout-card">
   <header><PlayerPortrait index={player.portraitIndex}/><div><h3>{player.nickname}</h3><p>{athleteAge(player.birthDay,day)} anos · {roleNames[player.role]??player.role}</p></div></header>
   <p><strong>{states[row.state]}</strong> · {formatCareerDay(row.start_day)} a {formatCareerDay(row.end_day)}</p>
   {row.state==='active'&&<p>{Math.max(0,row.end_day-day)} dias restantes</p>}
   <p>OVR conhecido {rating(row.final?.overall??(row.state==='active'?player.overall:row.opening.overall))} · Adequação à função {evidence.rating===null?'indisponível':rating(evidence.rating)}</p>
   <p>Adaptação técnica {evidence.adaptation??'indisponível'} · Confiança do scouting {confidence.toLowerCase()}</p>
   {!!evidence.strengths.length&&<p>Pontos fortes · {evidence.strengths.map(key=>attributeLabels[key]??key).join(', ')}</p>}
   {change&&<p>Resumo do treinador · {change.state}. Variação registrada de {rating(change.change)} OVR.</p>}
   <p>Observações da Solo Queue durante o tryout · {samples.length}. A análise técnica é uma estimativa, e a classificação não garante desempenho profissional.</p>
   {!!history.length&&<details><summary>Histórico de scouting</summary><RankedHistory history={history}/></details>}
   {row.state==='completed'&&<button className="primary" disabled={busy} onClick={onHire}>Negociar contratação</button>}
   {(row.state==='completed'||row.state==='active')&&<button disabled={busy} onClick={onDismiss}>Dispensar candidato</button>}
 </article>;
}
