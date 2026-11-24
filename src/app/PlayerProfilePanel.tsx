import {useEffect,useRef,useState} from 'react';
import {PlayerPortrait} from './PlayerPortrait';
import {PlayerAnalysis} from './PlayerAnalysis';
import {attributeLabels,roleNames} from './player-labels';
import {analyzeRoles,playerMarkers} from '../game-core/player-analysis';
import {athleteAge,playerCondition} from '../game-core/development';
import {formatCareerDay} from '../game-core/calendar';
import {perkById,personalityNames,prospect} from '../game-core/traits';
import {styleOf} from '../game-core/team-analysis';
import {personalObjectiveNames} from '../game-core/player-identity';
import {playerMilestones,type PlayerMilestone} from '../game-core/player-milestones';
import {currentPlayerSituation} from '../game-core/news';
import {listPlayerMilestones} from '../persistence/repository';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';

const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});

export function PlayerProfilePanel({player,players,career,contracts,organizations,startFull=false,onClose}:{
 player:Player;players:Player[];career?:Career|null;contracts:Contract[];organizations:Record<string,string>;startFull?:boolean;onClose:()=>void;
}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [full,setFull]=useState(startFull);
 const day=career?.day??1;
 useEffect(()=>{
   const element=dialog.current;
   if(!element)return;
   element.showModal();
   return ()=>element.close();
 },[]);
 const age=athleteAge(player.birthDay,day);
 const mode=player.mode==='MOBA'||player.mode==='FPS'?player.mode:null;
 const analysis=mode?analyzeRoles(player.attributes,mode,player.role):null;
 const markers=playerMarkers(player,age,analysis?.versatility);
 const condition=player.condition?playerCondition(player,day):null;
 const knownPerks=(player.perks??[]).filter(perk=>perk.known).flatMap(instance=>{
   const perk=perkById.get(instance.id);return perk?[perk]:[];
 });
 return <dialog ref={dialog} className={`player-profile-dialog${full?' full-profile':''}`} aria-label={`Perfil de ${player.nickname}`}
   onCancel={event=>{event.preventDefault();onClose();}}>
   <div className="profile-heading"><PlayerPortrait index={player.portraitIndex}/><div><h2>{player.nickname}</h2><p>{player.name}</p></div><button autoFocus onClick={onClose}>Fechar perfil</button></div>
   <p>{age} anos · {regions.of(player.country)} · {mode==='FPS'?'CS2':mode??player.mode} · {roleNames[player.role]??player.role}</p>
   <p><strong>Overall {Math.round(player.overall)}</strong> · {currentPlayerSituation(player,contracts,organizations,career?.name??'Minha organização')}{condition&&` · Moral ${Math.round(condition.morale)}`}</p>
   {!!markers.length&&<div className="player-markers">{markers.map(marker=><details key={marker.label}><summary>{marker.label}</summary><p>{marker.description}</p></details>)}</div>}
   <p><strong>Pontos fortes</strong> · {analysis?.strengths.map(row=>attributeLabels[row.key]??row.key).join(', ')||'Sem destaques registrados'}</p>
   <p><strong>Traços conhecidos</strong> · {knownPerks.map(perk=>perk.name).join(', ')||'Nenhum'}</p>
   <button aria-expanded={full} onClick={()=>setFull(!full)}>{full?'Voltar ao perfil rápido':'Ver perfil completo'}</button>
   {full&&<div className="full-player-data">
     <p>Potencial estimado {player.estimateLow??'—'}–{player.estimateHigh??'—'} · {prospect(age,player.estimateLow,player.estimateHigh,player.overall)}
       {player.personality?' · '+personalityNames[player.personality]:''}</p>
     <p>Estilo de jogo · {styleOf(player)}{condition&&` · Forma ${Math.round(condition.form)} · Fadiga ${Math.round(condition.fatigue)}`}</p>
     {player.personalObjective&&<p>Objetivo pessoal · <strong>{personalObjectiveNames[player.personalObjective]}</strong></p>}
     <PlayerAnalysis player={player} players={players} day={day} attributeLabels={attributeLabels} roleNames={roleNames}/>
     {!!knownPerks.length&&<details><summary>Descrição dos traços conhecidos</summary><ul>{knownPerks.map(perk=><li key={perk.id}>{perk.name} · {perk.description}</li>)}</ul></details>}
     <details><summary>Influência dos traços em partidas</summary>
       {player.perkInfluences?.length?<ul>{player.perkInfluences.slice().reverse().map((effect,index)=><li key={`${effect.day}:${effect.perkId}:${index}`}>
         {formatCareerDay(effect.day)} · {perkById.get(effect.perkId)?.name} · {effect.delta>0?'+':''}{effect.delta.toLocaleString('pt-BR')} {effect.metric==='strength'?'na força individual usada na partida':`${effect.metric==='morale'?'na moral':'na fadiga'} após ${effect.result==='win'?'vitória':'derrota'}`}
       </li>)}</ul>:<p className="muted">Nenhum efeito de traço conhecido registrado em partidas.</p>}
     </details>
     {!!player.perkHistory?.length&&<details><summary>Histórico de traços</summary><ul>{player.perkHistory.map(entry=><li key={entry.day+entry.id}>
       {formatCareerDay(entry.day)} · {entry.action==='acquired'?'Ganhou':entry.action==='intensified'?'Intensificou':'Perdeu'} {perkById.get(entry.id)?.name??entry.id}
     </li>)}</ul></details>}
     {!!player.developmentHistory?.length&&<details><summary>Registros recentes de Overall</summary><ul>{player.developmentHistory.slice(-6).reverse().map(point=><li key={point.day}>{formatCareerDay(point.day)} · {point.overall.toLocaleString('pt-BR')}</li>)}</ul></details>}
     <PlayerTimeline player={player} careerId={career?.id} day={day}/>
   </div>}
 </dialog>;
}

function PlayerTimeline({player,careerId,day}:{player:Player;careerId?:string;day:number}){
 const [open,setOpen]=useState(false),[events,setEvents]=useState<PlayerMilestone[]|null>(null);
 const [error,setError]=useState(''),[visible,setVisible]=useState(20);
 useEffect(()=>{
   if(!careerId||!open||events!==null)return;
   let active=true;
   setError('');
   void listPlayerMilestones(careerId,player.id).then(rows=>{if(active)setEvents(rows);}).catch(reason=>{if(active)setError(String(reason));});
   return ()=>{active=false;};
 },[careerId,player.id,open,events]);
 const timeline=open?playerMilestones(player,events??[],day):[];
 return <details onToggle={event=>setOpen(event.currentTarget.open)}><summary>Linha do tempo do atleta</summary>
   {error&&<p role="alert">{error}</p>}
   {open&&careerId&&events===null&&!error&&<p role="status">Consultando histórico…</p>}
   {open&&!timeline.length&&(!careerId||events!==null)&&<p>Nenhum acontecimento registrado para este atleta.</p>}
   {!!timeline.length&&<ol className="career-timeline">{timeline.slice(0,visible).map(entry=><li key={entry.id??`${entry.day}:${entry.kind}:${entry.text}`}>
     <time>{formatCareerDay(entry.day)}</time> · <strong>{entry.kind}</strong> · {entry.text}
   </li>)}</ol>}
   {visible<timeline.length&&<button onClick={()=>setVisible(visible+20)}>Ver acontecimentos anteriores</button>}
 </details>;
}
