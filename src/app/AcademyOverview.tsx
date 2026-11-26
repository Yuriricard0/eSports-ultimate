import {academyChange,type AcademySnapshot} from '../game-core/academy-evaluation';
import {formatCareerDay} from '../game-core/calendar';
import type {Career} from '../game-core/career';
import {defaultIdentity} from '../game-core/identity';
import type {Player} from '../game-core/recruitment';
import {promotionRecommendation} from '../game-core/talent-development';
import type {AcademyEvaluation} from '../persistence/repository';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './player-labels';

export function academyPeriod(players:Player[],snapshots:AcademySnapshot[],day:number){
 const active=new Set(players.map(player=>player.id));
 const latest=snapshots.filter(row=>row.day<=day&&(row.day-1)%30===0&&active.has(row.player_id)).at(-1)?.day;
 const samples=latest===undefined?[]:players.flatMap(player=>{
   const points=snapshots.filter(row=>row.player_id===player.id&&row.day>=latest-30&&row.day<=latest);
   const first=points[0],last=points.at(-1);
   return first&&last&&last.day===latest&&first.day<last.day?[{player,...academyChange(first.snapshot,last.snapshot)}]:[];
 }).sort((a,b)=>b.change-a.change||a.player.id-b.player.id);
 return {latest,samples,average:samples.length?samples.reduce((sum,row)=>sum+row.change,0)/samples.length:null};
}

export function AcademyOverview({career,academy,main,players,data,onPlayer,onAthletes,onScouting}:{
 career:Career;academy:Player[];main:Player[];players:Player[];data:AcademyEvaluation|null;
 onPlayer:(player:Player)=>void;onAthletes:()=>void;onScouting:()=>void;
}){
 const identity=career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol};
 const period=academyPeriod(academy,data?.snapshots??[],career.day);
 const recommendations=academy.map(player=>({player,...promotionRecommendation(player,main,career.day)}));
 const ready=recommendations.filter(row=>row.label==='Pronto para promoção');
 const evaluate=recommendations.filter(row=>row.label==='Avaliar com o elenco principal');
 const highlights=period.samples.filter(row=>row.change>=.25).slice(0,4);
 const commitments=(data?.tryouts??[]).filter(row=>row.state==='active'&&row.end_day>=career.day).sort((a,b)=>a.end_day-b.end_day);
 const names=new Map(players.map(player=>[player.id,player.nickname]));
 return <div className="academy-dashboard">
   <header className="panel academy-dashboard-club">
     <Emblem identity={identity} code={career.code}/>
     <div><h2>{career.name}</h2><p>Academy · {career.mode==='FPS'?'CS2':career.mode}</p></div>
   </header>
   <dl className="academy-metrics">
     <div><dt>Jovens na Academy</dt><dd>{academy.length}</dd></div>
     <div><dt>Evolução média no período</dt><dd>{period.average===null?'Sem dados':period.average.toLocaleString('pt-BR',{maximumFractionDigits:2,signDisplay:'always'})+' OVR'}</dd>
       {!!period.samples.length&&<small>{period.samples.length} atletas avaliados · até {formatCareerDay(period.latest!)}</small>}</div>
     <div><dt>Para avaliar no principal</dt><dd>{evaluate.length}</dd></div>
     <div><dt>Prontos para promoção</dt><dd>{ready.length}</dd></div>
   </dl>
   <section className="panel">
     <div className="players-heading"><h2>Leitura do treinador</h2><button onClick={onAthletes}>Ver atletas</button></div>
     {data?.coach&&<p>Especialização em desenvolvimento de jovens ativa.</p>}
     {ready.length+evaluate.length>0?<ul>{[...ready,...evaluate].map(row=><li key={row.player.id}>
       <button onClick={()=>onPlayer(row.player)}>{row.player.nickname}</button> · {row.label}
     </li>)}</ul>:<p>{academy.length?'As recomendações atuais indicam continuar o desenvolvimento.':'Adicione um jovem à Academy para iniciar as avaliações.'}</p>}
   </section>
   <section className="panel">
     <h2>Jovens em destaque</h2>
     {highlights.length?<ul className="academy-spotlight">{highlights.map(row=><li key={row.player.id}>
       <PlayerPortrait index={row.player.portraitIndex}/><button onClick={()=>onPlayer(row.player)}>{row.player.nickname}</button>
       <small>{roleNames[row.player.role]??row.player.role}</small><strong>+{row.change.toLocaleString('pt-BR')} OVR</strong>
     </li>)}</ul>:<p>{period.samples.length?'Nenhum jovem registrou ganho de pelo menos 0,25 OVR neste período.':'Aguardando registros comparáveis de desenvolvimento.'}</p>}
   </section>
   <section className="panel">
     <div className="players-heading"><h2>Próximos compromissos</h2><button onClick={onScouting}>Ver tryouts</button></div>
     {commitments.length?<ul>{commitments.map(row=><li key={row.player_id+':'+row.start_day}>
       {formatCareerDay(row.end_day)} · Fim da avaliação de {names.get(row.player_id)??'Atleta '+row.player_id}
     </li>)}</ul>:<p>Nenhum compromisso da Academy registrado.</p>}
   </section>
 </div>;
}
