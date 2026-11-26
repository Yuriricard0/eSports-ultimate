import {useEffect,useState} from 'react';
import {formatCareerDay} from '../game-core/calendar';
import {countryRegions} from '../game-core/countries';
import {analyzeRoles} from '../game-core/player-analysis';
import {scoutingConfidence,type WeeklyRankings} from '../game-core/solo-queue';
import type {RankedObservation} from '../game-core/talent-development';
import type {Player} from '../game-core/recruitment';
import {getSoloFinal,getSoloQueue} from '../persistence/repository';
import {attributeLabels,roleNames} from './player-labels';
import {RankedHistory} from './RankedWatch';

const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});
const modeName=(mode:string)=>mode==='FPS'?'CS2':'MOBA';

export function SoloQueueSeasons({careerId,day,players,mode,onPlayer}:{
 careerId:string;day:number;players:Player[];mode:string;onPlayer:(player:Player)=>void;
}){
 const [data,setData]=useState<Awaited<ReturnType<typeof getSoloQueue>>|null>(null);
 const [archive,setArchive]=useState<WeeklyRankings|null>(null);
 const [selected,setSelected]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   getSoloQueue(careerId).then(result=>{if(active)setData(result);}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[careerId,day]);
 useEffect(()=>{
   let active=true;
   setArchive(null);
   if(selected)getSoloFinal(careerId,Number(selected)).then(result=>{if(active)setArchive(result);})
     .catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[careerId,selected]);
 const season=data?.seasons[0],comparison=data?.comparison;
 const names=new Map(players.map(player=>[player.id,player]));
 const climbers=comparison?.climbers.filter(row=>row.mode===mode).slice(0,5)??[];
 return <section className="panel solo-queue-panel" aria-label="Temporadas da Solo Queue">
   <h2>Temporadas da Solo Queue</h2>
   {error&&<p role="alert">{error}</p>}
   {season?<p>Temporada atual · {formatCareerDay(season.start_day)} a {formatCareerDay(season.end_day)}. A pontuação passa por um ajuste parcial entre temporadas.</p>:
     data&&<p>A primeira temporada começa no próximo avanço do calendário.</p>}
   <details><summary>Destaques semanais · {modeName(mode)}</summary>
     {comparison?<p>{formatCareerDay(comparison.from)} a {formatCareerDay(comparison.to)}</p>:<p>Aguardando dois registros semanais da mesma temporada.</p>}
     {comparison&&!climbers.length&&<p>Nenhuma subida registrada neste período.</p>}
     {!!climbers.length&&<ol>{climbers.map(row=>{
       const player=names.get(row.id);
       return <li key={row.id}>{player?<button onClick={()=>onPlayer(player)}>{player.nickname}</button>:'Atleta '+row.id} · subiu {row.rise} posições · #{row.position}</li>;
     })}</ol>}
   </details>
   {!!data?.seasons.some(row=>row.closed)&&<details><summary>Classificações finais</summary>
     <label>Temporada <select value={selected} onChange={event=>setSelected(event.target.value)}>
       <option value="">Selecione</option>{data.seasons.filter(row=>row.closed).map(row=><option key={row.start_day} value={row.start_day}>{formatCareerDay(row.start_day)} a {formatCareerDay(row.end_day)}</option>)}
     </select></label>
     {archive&&<details open><summary>{modeName(mode)} · {archive[mode]?.length??0} atletas</summary>
       <ol>{archive[mode]?.map(([id,position,points])=><li key={id}>#{position} · {names.get(id)?.nickname??'Atleta '+id} · {points.toLocaleString('pt-BR')} pts</li>)}</ol>
     </details>}
   </details>}
 </section>;
}

export function ScoutingReports({players,history,onPlayer}:{players:Player[];history:RankedObservation[];onPlayer:(player:Player)=>void}){
 const [mode,setMode]=useState('');
 const [country,setCountry]=useState('');
 const [region,setRegion]=useState('');
 const [role,setRole]=useState('');
 const [confidence,setConfidence]=useState('');
 const [date,setDate]=useState('');
 const grouped=new Map<number,RankedObservation[]>();
 for(const row of history){
   const observations=grouped.get(row.player_id)??[];
   observations.push(row);grouped.set(row.player_id,observations);
 }
 const reports=players.flatMap(player=>{
   const observations=grouped.get(player.id);
   if(!observations?.length)return [];
   const latest=observations[observations.length-1],days=latest.day-observations[0].day;
   return [{player,observations,latest,days,confidence:scoutingConfidence(days,observations.length)}];
 }).sort((a,b)=>b.latest.day-a.latest.day||a.player.nickname.localeCompare(b.player.nickname));
 const regionOf=(player:Player)=>countryRegions[player.country]??'Região não cadastrada';
 const visible=reports.filter(report=>(!mode||report.player.mode===mode)&&(!country||report.player.country===country)&&(!region||regionOf(report.player)===region)&&
   (!role||report.player.role===role)&&(!confidence||report.confidence===confidence)&&(!date||String(report.latest.day)===date));
 return <section className="panel solo-queue-panel">
   <h2>Central de scouting</h2>
   <div className="world-filters">
     <label>Modalidade<select value={mode} onChange={event=>setMode(event.target.value)}><option value="">Todas</option><option value="MOBA">MOBA</option><option value="FPS">CS2</option></select></label>
     <label>Região<select value={region} onChange={event=>setRegion(event.target.value)}><option value="">Todas</option>
       {[...new Set(reports.map(row=>regionOf(row.player)))].sort().map(value=><option key={value}>{value}</option>)}
     </select></label>
     <label>País ou território<select value={country} onChange={event=>setCountry(event.target.value)}><option value="">Todos</option>
       {[...new Set(reports.map(row=>row.player.country))].sort().map(code=><option key={code} value={code}>{regions.of(code)??code}</option>)}
     </select></label>
     <label>Função<select value={role} onChange={event=>setRole(event.target.value)}><option value="">Todas</option>
       {[...new Set(reports.map(row=>row.player.role))].map(key=><option key={key} value={key}>{roleNames[key]??key}</option>)}
     </select></label>
     <label>Confiança<select value={confidence} onChange={event=>setConfidence(event.target.value)}><option value="">Todas</option>
       {['Inicial','Moderada','Alta'].map(value=><option key={value}>{value}</option>)}
     </select></label>
     <label>Data da avaliação<select value={date} onChange={event=>setDate(event.target.value)}><option value="">Todas</option>
       {[...new Set(reports.map(row=>row.latest.day))].map(day=><option key={day} value={day}>{formatCareerDay(day)}</option>)}
     </select></label>
   </div>
   {!visible.length&&<p>Nenhum relatório para estes filtros. Os relatórios começam quando você observa um talento na Ranked.</p>}
   {visible.map(({player,observations,latest,days,confidence:level})=>{
     const analysis=player.mode==='MOBA'||player.mode==='FPS'?analyzeRoles(player.attributes,player.mode,player.role):null;
     return <details key={player.id}>
       <summary>{player.nickname} · {roleNames[player.role]??player.role} · Confiança {level.toLowerCase()} · {formatCareerDay(latest.day)}</summary>
       <p>Trajetória na Ranked · {observations.length} registros em {days} dias.</p>
       {observations.length>=2&&<p>Faixa de posições observadas · #{Math.min(...observations.map(row=>row.position))} a #{Math.max(...observations.map(row=>row.position))}.</p>}
       {analysis&&<p>Adequação técnica atual {analysis.rating.toLocaleString('pt-BR',{maximumFractionDigits:1})} · Pontos fortes {analysis.strengths.map(row=>attributeLabels[row.key]??row.key).join(', ')||'sem destaque'} · Pontos a desenvolver {analysis.weaknesses.map(row=>attributeLabels[row.key]??row.key).join(', ')||'sem destaque'}.</p>}
       {player.estimateLow!=null&&player.estimateHigh!=null&&<p>Faixa de potencial já conhecida {player.estimateLow}–{player.estimateHigh}.</p>}
       <RankedHistory history={observations}/>
       <button onClick={()=>onPlayer(player)}>Abrir perfil</button>
     </details>;
   })}
 </section>;
}
