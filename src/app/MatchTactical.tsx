import {useEffect,useRef,useState} from 'react';
import type {Mode} from '../game-core/attributes';
import type {MatchResult,MatchStarter} from '../game-core/matches';
import {mapAffinity,objectiveNames,phaseNames,phaseStrength,preferredStrategy,strategyNames,tacticalMaps,type Strategy} from '../game-core/match-tactics';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './player-labels';

export function strategyLabel(mode:Mode,strategy:Strategy){
 return (strategyNames[mode] as Partial<Record<Strategy,string>>)[strategy]??'Equilibrada';
}
export function MatchPreparation({mode,opponent,lineup,matches,strategy,onStrategy,mapId,onMap}:{
 mode:Mode;opponent:string;lineup:MatchStarter[];matches:MatchResult[];strategy:Strategy;onStrategy:(strategy:Strategy)=>void;mapId?:string;onMap?:(id:string)=>void;
}){
 const past=matches.filter(result=>result.teams.some(team=>team.id===opponent));
 const known=past.flatMap(result=>{
   const side=result.teams.findIndex(team=>team.id===opponent);
   return result.strategies?.[side]?[result.strategies[side]]:[];
 });
 const counts=new Map<Strategy,number>();
 known.forEach(value=>counts.set(value,(counts.get(value)??0)+1));
 const common=[...counts].sort((a,b)=>b[1]-a[1])[0];
 const playedMaps=tacticalMaps.flatMap(map=>{
   const played=past.filter(result=>result.mapId===map.id);
   return played.length?[{name:map.name,count:played.length,wins:played.filter(result=>result.teams[result.winner].id===opponent).length}]:[];
 }).sort((a,b)=>b.count-a.count);
 const side={id:opponent,name:'',code:'',logo:'',lineup};
 const estimate=lineup.length===5?preferredStrategy(side,mode):null;
 const phaseScores=mode==='MOBA'&&lineup.length===5?phaseNames.map(phase=>({phase,value:phaseStrength(side,phase)})).sort((a,b)=>b.value-a.value):[];
 const strongest=phaseScores.length&&phaseScores[0].value-phaseScores.at(-1)!.value>=2?phaseScores[0].phase:null;
 const map=mode==='FPS'?tacticalMaps.find(row=>row.id===mapId):undefined;
 const edge=map&&lineup.length===5?mapAffinity(side,map):null;
 return <section className="match-preparation">
   <div className="world-filters">
     <label>Estratégia<select value={strategy} onChange={event=>onStrategy(event.target.value as Strategy)}>
       {Object.entries(strategyNames[mode]).map(([id,name])=><option key={id} value={id}>{name}</option>)}
     </select></label>
     {mode==='FPS'&&onMap&&<label>Mapa<select value={mapId??''} onChange={event=>onMap(event.target.value)}><option value="">Seleção automática</option>
       {tacticalMaps.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>}
   </div>
   <details><summary>Relatório do adversário</summary>
     <p>Amostra de {past.length} confrontos registrados. {common?`Estilo mais observado: ${strategyLabel(mode,common[0])} (${common[1]} ocorrências).`:'Ainda sem um estilo registrado.'}</p>
     {estimate&&<p>Perfil estimado pelos titulares atuais · {strategyLabel(mode,estimate)}.</p>}
     {!!playedMaps.length&&<ul>{playedMaps.map(row=><li key={row.name}>{row.name} · {row.wins} vitórias em {row.count} mapas registrados</li>)}</ul>}
     {strongest&&<p>Leitura do treinador · Revise o plano para o {strongest}, fase de maior nota técnica estimada do adversário.</p>}
     {edge!==null&&edge>0.25&&<p>Leitura do treinador · {map?.name} favorece atributos que se destacam na escalação rival.</p>}
     <p className="muted">A leitura tática é uma estimativa baseada nos dados disponíveis.</p>
   </details>
 </section>;
}

const colors=['#4aabff','#fb4c66'];
const mobaPaths:[number,number][][]=[[[8,90],[8,12],[93,12]],[[8,90],[93,12]],[[8,90],[93,90],[93,12]],[[10,14],[90,86]]];
const zones={top:[30,12],mid:[50,50],bot:[70,90],river:[58,59]};

export function TacticalBoard({result}:{result:MatchResult}){
 const frames=result.mode==='MOBA'?result.mobaFrames:result.roundFrames;
 const count=frames?.length??0;
 const [step,setStep]=useState(0);
 const [selectedMoment,setSelectedMoment]=useState<{round:number;index:number}|null>(null);
 const [playing,setPlaying]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null);
 const index=Math.min(step,Math.max(0,count-1));
 const moba=result.mobaFrames?.[index],fps=result.roundFrames?.[index];
 const momentIndex=selectedMoment&&selectedMoment.round===fps?.round?selectedMoment.index:0;
 const moment=fps?.moments?.[momentIndex];
 const alive=moment?.alive??fps?.alive;
 const map=tacticalMaps.find(item=>item.id===result.mapId);
 useEffect(()=>{
   if(!playing||index>=count-1)return;
   const timer=setTimeout(()=>setStep(index+1),550);
   return()=>clearTimeout(timer);
 },[playing,index,count]);
 useEffect(()=>{
   const context=canvas.current?.getContext('2d');
   if(!context||(!moba&&!fps))return;
   const w=640,h=400,px=(x:number)=>x*w/100,py=(y:number)=>y*h/100;
   context.fillStyle=result.mode==='MOBA'?'#14252b':'#202a38';context.fillRect(0,0,w,h);
   context.strokeStyle='#ffffff0b';context.lineWidth=1;
   for(let x=0;x<w;x+=24){context.beginPath();context.moveTo(x,0);context.lineTo(x,h);context.stroke();}
   for(let y=0;y<h;y+=24){context.beginPath();context.moveTo(0,y);context.lineTo(w,y);context.stroke();}
   const path=(points:[number,number][],color:string,width:number)=>{
     context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.lineJoin='round';context.beginPath();
     points.forEach(([x,y],i)=>i?context.lineTo(px(x),py(y)):context.moveTo(px(x),py(y)));context.stroke();
   };
   const mark=(x:number,y:number,name:string,color:string,size=12)=>{
     context.fillStyle=color;context.beginPath();context.arc(px(x),py(y),size,0,Math.PI*2);context.fill();
     context.fillStyle='#fff';context.font='bold 12px system-ui';context.textAlign='center';context.textBaseline='middle';
     context.fillText(name,px(x),py(y));
   };
   (moba?mobaPaths:map?.paths??[]).forEach((row,i)=>path(row,moba?i===3?'#1e6c91':'#596653':'#647084',moba&&i===3?19:13));
   if(moba){
     Object.entries(zones).forEach(([key,[x,y]])=>mark(x,y,key==='river'?'RIO':key.toUpperCase(),'#263747',19));
     for(const [idx,[x,y]] of [[8,90],[93,12],[8,40],[65,12],[34,90],[93,58]].entries())
       mark(x,y,idx<2?'B':'T',colors[idx%2],10);
   }else{
     map?.sites.forEach(([x,y],idx)=>mark(x,y,idx===0?'A':'B','#9d432b',22));
   }
   const point=moba?zones[moba.lane]:map?.sites[fps!.site]??[50,50];
   if(fps?.utility!=null){
     context.fillStyle='#d5e7fa39';context.beginPath();context.arc(px(point[0]),py(point[1]),32,0,Math.PI*2);context.fill();
   }
   mark(point[0],point[1],moba?.objective?'◆':fps?.utility!=null?'◌':'×',colors[moba?.team??fps!.winner],18);
   for(const side of [0,1] as const){
     const players=result.stats.filter(stat=>stat.team===side);
     players.forEach((player,i)=>{
       const x=Math.max(5,Math.min(95,point[0]+(side===0?-1:1)*(8+i*4)));
       const y=Math.max(6,Math.min(94,point[1]+((i%3)-1)*11+(side===0?5:-5)));
       if(alive?.includes(player.playerId)){
         context.fillStyle=colors[side]+'29';context.beginPath();context.moveTo(px(x),py(y));
         context.lineTo(px(x+(side===0?12:-12)),py(y-8));
         context.lineTo(px(x+(side===0?12:-12)),py(y+8));context.closePath();context.fill();
       }
       path([[x+(side===0?-4:4),y+4],[x,y]],colors[side]+'80',2);
       mark(x,y,String(i+1),alive&&!alive.includes(player.playerId)?'#475264':colors[side],10);
     });
   }
 },[fps,moba,map,result,alive]);
 if(!count)return <p className="muted">Visão tática disponível em novas partidas.</p>;
 const caption=moba?`${moba.phase} · ${moba.at} min · ${moba.objective?objectiveNames[moba.objective]:'confronto em '+moba.lane}`:
   `Round ${fps?.round} · Ponto ${fps?.site===0?'A':'B'}${moment?' · '+moment.label:''} · Bomba ${moment?.bomb??fps?.bomb}`;
 const at=moba?.at??fps?.round;
 const currentEvents=result.events.filter(event=>event.at===at);
 const currentActions=result.roleActions?.filter(action=>action.at===at)??[];
 const boardScore=moment?.score??currentEvents.at(-1)?.score;
 return <section className="tactical-board" aria-label="Visão tática 2D">
   <h3>{result.mode==='MOBA'?'Mapa tático MOBA':(map?.name??'Mapa')+' · Visão tática'}</h3>
   <div className="tactical-layout">
     {[0,1].map(side=><aside key={side} className={'tactical-side side-'+side}>
       <strong>{result.teams[side].name}</strong>
       {result.stats.filter(stat=>stat.team===side).map((stat,i)=><div key={stat.playerId}>
         {stat.portraitIndex!==undefined&&<PlayerPortrait index={stat.portraitIndex}/>}
         <span>{i+1} · {stat.nickname}<small>{roleNames[stat.role]}{alive?' · '+(alive.includes(stat.playerId)?'Vivo':'Eliminado'):''}</small></span>
       </div>)}
     </aside>)}
     <canvas ref={canvas} width="640" height="400" aria-label={caption}>{caption}</canvas>
   </div>
   <p><strong>{caption}</strong>{fps&&<> · Ataque {result.teams[fps.attack].name}{fps.utility!==null?' · Uso de utilitário registrado':''}</>}</p>
   {boardScore&&<p>{result.mode==='FPS'?'Placar do mapa':'Abates acumulados'} · {boardScore.join(' × ')}{alive&&
     <> · Vivos {result.stats.filter(stat=>stat.team===0&&alive.includes(stat.playerId)).length} × {result.stats.filter(stat=>stat.team===1&&alive.includes(stat.playerId)).length}</>}</p>}
   {fps?.moments&&<div className="advance-actions" aria-label="Momentos do round">{fps.moments.map((row,i)=><button key={row.label} aria-pressed={i===momentIndex} onClick={()=>{
     setPlaying(false);setSelectedMoment({round:fps.round,index:i});
   }}>{row.label}</button>)}</div>}
   {moment?<p>{moment.text}</p>:!!currentEvents.length&&<ul className="tactical-current-events">{currentEvents.map((event,i)=><li key={i}>{event.text}</li>)}</ul>}
   {!!currentActions.length&&(!moment||moment.label==='Fim do round')&&<details><summary>Ações dos atletas neste marco</summary><ul>{currentActions.map((action,i)=><li key={i}>
     {result.stats.find(stat=>stat.playerId===action.playerId)?.nickname} · {action.detail}
   </li>)}</ul></details>}
   <div className="advance-actions">
     <button disabled={index===0} onClick={()=>{setPlaying(false);setStep(index-1);}}>Anterior</button>
     <button onClick={()=>{if(index===count-1)setStep(0);setPlaying(!playing||index===count-1);}}>{playing&&index<count-1?'Pausar':'Reproduzir eventos'}</button>
     <button disabled={index===count-1} onClick={()=>{setPlaying(false);setStep(index+1);}}>Próximo</button>
     <input type="range" min={1} max={count} value={index+1} aria-label="Marco da partida" onChange={event=>{setPlaying(false);setStep(Number(event.target.value)-1);}}/>
   </div>
   <p className="muted">Diagrama esquemático dos acontecimentos. Posições e trajetórias são indicativas.</p>
 </section>;
}

export function MatchDebrief({result}:{result:MatchResult}){
 if(!result.strategies)return null;
 const winner=result.winner,loser=1-winner;
 const strongest=result.phases?.slice().sort((a,b)=>(b.objectives[winner]-b.objectives[loser])-(a.objectives[winner]-a.objectives[loser]))[0];
 const advantage=strongest?strongest.objectives[winner]-strongest.objectives[loser]:0;
 const closeRounds=result.roundFrames?.slice(-5).filter(row=>row.winner===winner).length;
 const decisive=result.events.filter(event=>event.team===winner&&event.kind===(result.mode==='MOBA'?'objective':'round')).at(-1);
 const context=decisive&&(result.mode==='MOBA'
   ?result.mobaFrames?.find(frame=>frame.at===decisive.at)
   :result.roundFrames?.find(frame=>frame.round===decisive.at));
 const action=decisive&&result.roleActions?.find(row=>row.at===decisive.at&&result.stats.some(stat=>stat.playerId===row.playerId&&stat.team===winner));
 const actor=action&&result.stats.find(row=>row.playerId===action.playerId);
 return <section className="match-debrief"><h3>Leitura pós-jogo</h3>
   <p>{result.teams.map((team,index)=>team.name+' · '+strategyLabel(result.mode,result.strategies![index])).join(' × ')}</p>
   {strongest&&advantage>0&&<p>{result.teams[winner].name} teve a maior vantagem de objetivos no {strongest.phase} ({strongest.objectives[winner]} a {strongest.objectives[loser]}).</p>}
   {closeRounds!==undefined&&<p>O vencedor levou {closeRounds} dos últimos cinco rounds.</p>}
   {result.mapEdge&&<p>Ajuste de afinidade ao mapa · {result.mapEdge.map(value=>value.toLocaleString('pt-BR',{maximumFractionDigits:1,signDisplay:'always'})).join(' × ')}.</p>}
   {decisive&&<div className="match-evidence">
     <p><strong>Jogada para revisar</strong> · {result.mode==='MOBA'?`${decisive.at} min`:`Round ${decisive.at}`} · {decisive.text}</p>
     {actor&&action&&<p>{actor.nickname} · {action.detail}.</p>}
     <p><strong>Sugestão do treinador</strong> · {context&&'site' in context
       ?`Reveja as trocas no ponto ${context.site===0?'A':'B'}${context.bomb==='não plantada'?' antes da entrada':' e o controle de espaço após o plant'}.`
       :'Reveja a rotação para o objetivo e quem participou do confronto que o antecedeu.'}</p>
   </div>}
 </section>;
}

export function RoleEvidence({result}:{result:MatchResult}){
 if(!result.roleActions?.length)return null;
 return <details className="match-evidence"><summary>Evidências das notas por função</summary>
   {result.stats.map(stat=>{
     const actions=result.roleActions!.filter(action=>action.playerId===stat.playerId);
     if(!actions.length)return null;
     return <details key={stat.playerId}><summary>{stat.nickname} · {roleNames[stat.role]} · {actions.length} ações</summary>
       <ol>{actions.map((action,i)=><li key={i}>{result.mode==='FPS'?'Round '+action.at:action.at+' min'} · {action.detail}</li>)}</ol></details>;
   })}
 </details>;
}
