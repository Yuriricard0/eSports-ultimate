import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {formatCareerDay} from '../game-core/calendar';
import {playerCondition,teamChemistry} from '../game-core/development';
import {careerLineup} from '../game-core/matches';
import {estimatedStrength} from '../game-core/team-analysis';
import {analyzeRoles} from '../game-core/player-analysis';
import {trainingNames,type PlayerTraining} from '../game-core/training';
import {activityNames,intensityNames,trainingLoad,type Activity,type Intensity,type TrainingEvent,type TrainingSlot} from '../game-core/training-week';
import {applyTrainingModel,getTrainingWeek,listFavoriteLineups,planTrainingEvent,saveTrainingModel,updateTrainingEvent,updateTrainingModel,type TrainingWeek as Week} from '../persistence/repository';
import type {FavoriteLineup} from '../game-core/lineup-favorites';
import {attributeLabels} from './player-labels';

const weekdays=new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'});
const weekday=(day:number)=>weekdays.format(new Date(Date.UTC(2027,2,14+day)));
const modeName=(mode:string)=>mode==='FPS'?'CS2':mode;

export function TrainingWeek({career,players,contracts,training,onUpdated}:{
 career:Career;players:Player[];contracts:Contract[];training:PlayerTraining[];onUpdated:(career:Career)=>Promise<void>;
}){
 const [data,setData]=useState<Week|null>(null);
 const [favorites,setFavorites]=useState<FavoriteLineup[]>([]);
 const [week,setWeek]=useState(0);
 const [editing,setEditing]=useState<number|null>(null);
 const [kind,setKind]=useState<Activity>('individual');
 const [intensity,setIntensity]=useState<Intensity>('normal');
 const [objective,setObjective]=useState('');
 const [opponent,setOpponent]=useState('');
 const [lineupId,setLineupId]=useState('');
 const [scheduledIds,setScheduledIds]=useState<number[]|null>(null);
 const [modelName,setModelName]=useState('');
 const [modelId,setModelId]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
   let active=true;
   Promise.all([getTrainingWeek(career.id),listFavoriteLineups(career.id)]).then(([result,lineups])=>{
     if(active){setData(result);setFavorites(lineups);}
   }).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career]);
 const start=career.day+week*7;
 const mode=career.mode;
 const roster=players.filter(player=>player.mode===mode&&!player.status&&contracts.some(contract=>contract.player_id===player.id&&!contract.academy));
 const academy=players.filter(player=>player.mode===mode&&!player.status&&contracts.some(contract=>contract.player_id===player.id&&contract.academy));
 const official=careerLineup(roster,contracts);
 const selected=favorites.find(row=>row.id===lineupId);
 const selectedIds=lineupId==='scheduled'?scheduledIds:selected?.playerIds;
 const editDay=start+(editing??0);
 const active=contracts.filter(row=>!row.academy&&(!row.end_day||row.end_day>=editDay));
 const scrimLineup=careerLineup(roster,selectedIds?active.map(row=>({...row,starter:Number(selectedIds.includes(row.player_id))})):active);
 const scrimIds=scrimLineup.map(slot=>slot.player.id);
 const events=data?.events.filter(row=>row.mode===mode&&row.day>=start&&row.day<start+7)??[];
 const schedule=data?.schedule.filter(row=>row.day>=start&&row.day<start+7)??[];
 const fatigue=(squad:Player[])=>squad.length?Math.round(squad.reduce((sum,player)=>sum+playerCondition(player,career.day).fatigue,0)/squad.length):0;
 const load=trainingLoad([...events.filter(row=>row.done||row.day>=career.day),...schedule.filter(row=>row.mode===mode)],start,fatigue(roster));
 const recent=data?.events.filter(row=>row.mode===mode&&row.done&&row.day>=career.day-6&&row.day<=career.day)??[];
 const recentMatches=data?.schedule.filter(row=>row.mode===mode&&row.done&&row.day>=career.day-6&&row.day<=career.day)??[];
 const run=async(action:()=>Promise<unknown>)=>{
   if(busy)return;
   setBusy(true);setError('');
   try{await action();setData(await getTrainingWeek(career.id));}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 const beginEdit=(offset:number,event?:TrainingEvent)=>{
   setEditing(offset);setKind(event?.kind??'individual');setIntensity(event?.intensity??'normal');
   setObjective(event?.objective??'');setOpponent(event?.opponent??'');
   setScheduledIds(event?.players??null);
   setLineupId(event?.players?'scheduled':'');
 };
 const modelSlots:TrainingSlot[]=events.filter(row=>!row.done&&row.day>=career.day).map(({day,kind,intensity,objective,opponent,players})=>({
   offset:day-start,kind,intensity,objective,opponent,players,
 }));
 const chemistry=teamChemistry(scrimLineup,editDay);
 const substitutions=scrimLineup.filter(member=>!official.some(slot=>slot.player.id===member.player.id));
 const suggestions=official.flatMap(({player})=>{
   if(player.mode!=='MOBA'&&player.mode!=='FPS')return [];
   const attribute=analyzeRoles(player.attributes,player.mode,player.role)?.weaknesses[0];
   return attribute?[{player,key:attribute.key,value:attribute.value}]:[];
 }).slice(0,5);
 return <section className="panel training-week">
   <div className="players-heading"><h2>Planejamento semanal</h2>
     <div><button disabled={busy||week<=-8||start<=7} onClick={()=>{setWeek(week-1);setEditing(null);}}>Semana anterior</button>
       <button disabled={busy||week>=12} onClick={()=>{setWeek(week+1);setEditing(null);}}>Próxima semana</button></div>
   </div>
   <p>{formatCareerDay(Math.max(1,start))} a {formatCareerDay(Math.max(1,start+6))} · {modeName(mode)} · {load.heavy} dias ou eventos de alta carga · {load.recovery} recuperações</p>
   {!!load.reasons.length&&<aside className="training-load"><strong>Alerta de carga</strong><ul>{load.reasons.map(reason=><li key={reason}>{reason}</li>)}</ul></aside>}
   {error&&<p role="alert">{error}</p>}
   {!data&&!error&&<p role="status">Carregando planejamento…</p>}
   {data&&<>
     <div className="training-week-grid">{Array.from({length:7},(_,offset)=>{
       const day=start+offset;
       if(day<1)return null;
       const event=events.find(row=>row.day===day);
       const officialEvents=schedule.filter(row=>row.day===day);
       const blocked=officialEvents.some(row=>row.mode===mode);
       return <article key={day} className={day===career.day?'training-today':undefined}>
         <h3>{weekday(day)}</h3><time>{formatCareerDay(day)}</time>
         {officialEvents.map(row=><p key={row.kind+row.fixture}>{modeName(row.mode)} · {row.name} · {row.done?'Realizado':'Agendado'}</p>)}
         {event?<><p><strong>{activityNames[event.kind]}</strong> · {intensityNames[event.intensity]}</p>
           <p>{event.done?'Realizado':blocked?'Conflito com partida':day<career.day?'Não realizado':'Planejado'}</p>
           {event.opponentName&&<p>Adversário · {event.opponentName}</p>}
           {event.objective&&<p>{event.objective}</p>}
           {event.result&&<p>Resultado · {event.result.score.join(' × ')}</p>}
           {!event.done&&day>=career.day&&<>
             {!blocked&&<button disabled={busy} onClick={()=>beginEdit(offset,event)}>Editar</button>}
             <button disabled={busy} onClick={()=>void run(()=>updateTrainingEvent(career.id,day,'cancel'))}>Cancelar atividade</button>
             {!blocked&&day===career.day&&<button className="primary" disabled={busy} onClick={()=>void run(async()=>{
               await onUpdated(await updateTrainingEvent(career.id,day,'complete'));
             })}>{event.kind==='scrim'?'Disputar scrim':'Marcar realizada'}</button>}
           </>}
         </>:day>=career.day&&!blocked?<button disabled={busy} onClick={()=>beginEdit(offset)}>Planejar atividade</button>:null}
       </article>;
     })}</div>
     {editing!==null&&<form className="panel training-editor" onSubmit={event=>{
       event.preventDefault();
       void run(async()=>{
         await planTrainingEvent(career.id,editDay,{offset:0,kind,intensity,objective,opponent,players:scrimIds});
         setEditing(null);
       });
     }}>
       <h3>Atividade de {formatCareerDay(editDay)}</h3>
       <div className="world-filters">
         <label>Atividade<select value={kind} onChange={event=>setKind(event.target.value as Activity)}>
           {Object.entries(activityNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}
         </select></label>
         {kind!=='rest'&&<label>Intensidade<select value={intensity} onChange={event=>setIntensity(event.target.value as Intensity)}>
           {Object.entries(intensityNames).map(([key,name])=><option key={key} value={key}>{name}</option>)}
         </select></label>}
         <label>Objetivo<input maxLength={100} value={objective} onChange={event=>setObjective(event.target.value)}/></label>
         {kind==='scrim'&&<>
           <label>Adversário<select required value={opponent} onChange={event=>setOpponent(event.target.value)}><option value="">Selecione</option>
             {data.opponents.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
           </select></label>
           <label>Escalação da scrim<select value={lineupId} onChange={event=>setLineupId(event.target.value)}>
             <option value="">Titulares atuais</option>{scheduledIds&&<option value="scheduled">Escalação agendada</option>}
             {favorites.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
           </select></label>
         </>}
       </div>
       {kind==='scrim'&&<p>{scrimLineup.length} de 5 atletas · Overall coletivo {estimatedStrength(roster,scrimLineup.map(row=>row.player))??'indisponível'} · Entrosamento {chemistry??'indisponível'} · {substitutions.length?substitutions.map(row=>row.player.nickname).join(', '):'Sem substituições'}.</p>}
       <button type="button" onClick={()=>setEditing(null)}>Fechar edição</button>
       <button className="primary" disabled={busy||kind==='scrim'&&(!opponent||scrimIds.length!==5)}>Salvar atividade</button>
     </form>}
     <details><summary>Modelos de semana</summary>
       <div className="world-filters">
         <label>Modelo<select value={modelId} onChange={event=>setModelId(event.target.value)}><option value="">Selecione</option>
           {data.models.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
         </select></label>
         <label>Nome do modelo<input value={modelName} maxLength={40} onChange={event=>setModelName(event.target.value)}/></label>
       </div>
       <button disabled={busy||!modelSlots.length||!modelName.trim()} onClick={()=>void run(()=>saveTrainingModel(career.id,modelName,modelSlots))}>Salvar semana como modelo</button>
       <button disabled={busy||!modelId||start<career.day} onClick={()=>void run(()=>applyTrainingModel(career.id,modelId,start))}>Aplicar na semana</button>
       <button disabled={busy||!modelId||!modelName.trim()} onClick={()=>void run(()=>updateTrainingModel(career.id,modelId,'rename',modelName))}>Renomear</button>
       <button disabled={busy||!modelId} onClick={()=>void run(async()=>{await updateTrainingModel(career.id,modelId,'delete');setModelId('');})}>Excluir modelo</button>
     </details>
     <details><summary>Condições de treinamento e recomendações</summary>
       {[{name:modeName(mode),squad:roster,facility:'training'},{name:'Academy',squad:academy,facility:'academy'}].map(group=>{
         const ids=new Set(group.squad.map(player=>player.id));
         const focus=[...new Set(group.squad.map(player=>trainingNames[training.find(row=>row.player_id===player.id)?.focus??'balanced']))];
         return <section key={group.name}>
           <h3>{group.name}</h3>
           <p>{ids.size} atletas disponíveis · Fadiga média {group.squad.length?fatigue(group.squad):'indisponível'} · Instalação nível {data.facilities[group.facility]??0}.</p>
           {!!focus.length&&<p>Focos ativos · {focus.join(', ')}.</p>}
         </section>;
       })}
       <p>Últimos sete dias · {recent.length} atividades realizadas · {recentMatches.length} partidas · {recentMatches.length+recent.filter(row=>row.intensity==='high'||row.kind==='scrim').length} de alta carga.</p>
       {!!recent.length&&<ul>{recent.map(row=><li key={row.day}>{formatCareerDay(row.day)} · {activityNames[row.kind]} · {intensityNames[row.intensity]}</li>)}</ul>}
       {!!recentMatches.length&&<ul>{recentMatches.map(row=><li key={row.kind+row.fixture}>{formatCareerDay(row.day)} · {row.name}</li>)}</ul>}
       {load.reasons.length>0&&<p>Recomendação do treinador · Considere inserir recuperação após os compromissos de alta carga sinalizados.</p>}
       {suggestions.length>0&&<ul>{suggestions.map(({player,key,value})=><li key={player.id}>{player.nickname} · Priorizar {attributeLabels[key]??key} ({value}).</li>)}</ul>}
     </details>
     <details><summary>Histórico de scrims</summary>
       {data.events.some(row=>row.kind==='scrim'&&row.result)?<ul>{data.events.filter(row=>row.kind==='scrim'&&row.result).slice().reverse().map(row=><li key={row.mode+':'+row.day}>
         {formatCareerDay(row.day)} · {modeName(row.mode)} · {row.opponentName??row.opponent} · {row.result!.score.join(' × ')}
       </li>)}</ul>:<p>Nenhuma scrim realizada.</p>}
     </details>
   </>}
 </section>;
}
