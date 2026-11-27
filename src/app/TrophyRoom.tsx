import {useEffect,useMemo,useState} from 'react';
import type {Career} from '../game-core/career';
import {competitionTitles,type Championship} from '../game-core/competition-history';
import type {Competition,Season} from '../game-core/competitions';
import {fixtureStageName} from '../game-core/competitions';
import {formatCareerDay} from '../game-core/calendar';
import {defaultIdentity} from '../game-core/identity';
import {listCompetitions,type CompetitionState} from '../persistence/repository';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './Players';
import {TrophyArt} from './TrophyArt';

type Title=ReturnType<typeof competitionTitles>[number];

function ChampionBadge({team}:{team:Championship['champion']}){
 return team.identity?<Emblem identity={team.identity} code={team.code}/>:team.logo?
   <img src={team.logo.replace('res://','/')} alt={'Escudo de '+team.name}/>:<b>{team.code}</b>;
}

export function TitleLineup({title}:{title:Championship}){
 return <section className="panel"><h2>Elenco campeão</h2>
   {title.roster.length?<ul className="trophy-lineup">{title.roster.map(player=><li key={player.id}>
     {player.portraitIndex!==undefined&&<PlayerPortrait index={player.portraitIndex}/>}
     <strong>{player.nickname}</strong><small>{roleNames[player.role]??player.role}</small>
   </li>)}</ul>:<p>Esta edição não tem uma escalação de final registrada.</p>}
 </section>;
}

export function TitleHonors({title,edition}:{title:Championship;edition:Competition}){
 if(!title.honors.length)return <p className="muted">Dados insuficientes para premiações individuais.</p>;
 return <ul className="trophy-honors">{title.honors.map(row=><li key={row.kind+':'+row.athlete.id+':'+row.athlete.role}>
   <strong>{row.kind}</strong><span>{row.athlete.nickname} · {roleNames[row.athlete.role]??row.athlete.role} · {edition.participants.find(team=>team.id===row.team)?.name??row.team}</span>
   <small>Nota média {row.rating.toLocaleString('pt-BR')} · {row.maps} jogos ou mapas</small>
 </li>)}</ul>;
}

export function TitleCelebration({title,edition,season,close}:{title:Championship;edition:Competition;season:Season;close:()=>void}){
 const final=edition.fixtures.find(game=>game.id===title.finalId);
 const score=title.score&&(final?.home===title.champion.id?title.score:[title.score[1],title.score[0]]);
 const mvp=title.honors.find(row=>row.kind==='MVP da final');
 return <section className={'trophy-ceremony panel '+(edition.key==='moba_world'||edition.prestige==='Major'?'trophy-ceremony-world':'')} role="status" aria-label="Cerimônia de campeão">
   <TrophyArt event={edition}/>
   <div><span className="event-kicker">{edition.name} · {season.year}</span>
     <ChampionBadge team={title.champion}/><h2>{title.champion.name} conquista o título</h2>
     {title.runnerUp&&score&&<p>{title.champion.name} {score.join(' × ')} {title.runnerUp.name}</p>}
     {mvp&&<p>MVP da final · {mvp.athlete.nickname}</p>}
     <p>{title.roster.map(player=>player.nickname).join(' · ')}</p>
     <button onClick={close}>Continuar carreira →</button>
   </div>
 </section>;
}

function TitleDetails({win,openFixture}:{win:Title;openFixture:(id:string)=>void}){
 const {edition,season,history}=win;
 const route=edition.fixtures.filter(game=>game.result&&(game.home===edition.champion||game.away===edition.champion))
   .sort((a,b)=>a.result!.completedDay-b.result!.completedDay||a.day-b.day);
 const final=route.find(game=>game.id===history.finalId);
 return <article className="trophy-details">
   <div className="trophy-display panel"><TrophyArt event={edition}/><div>
     <ChampionBadge team={history.champion}/><h2>{edition.name}</h2>
     <p>{edition.mode==='FPS'?'CS2':'MOBA'} · {edition.prestige} · {season.year}</p>
     <p>{history.champion.name} · Campeã em {formatCareerDay(history.day)}</p>
     {history.runnerUp&&<p>Adversária da final · {history.runnerUp.name}</p>}
     {final?.result&&<button onClick={()=>openFixture(final.id)}>Ver decisão · {final.result.score.join(' × ')}</button>}
   </div></div>
   <TitleLineup title={history}/>
   <section className="panel"><h2>Premiações individuais</h2><TitleHonors title={history} edition={edition}/></section>
   <section className="panel"><h2>Caminho até o título</h2>
     {route.length?<ol className="event-history">{route.map(game=>{
       const opponent=edition.participants.find(team=>team.id===(game.home===edition.champion?game.away:game.home));
       return <li key={game.id}><button onClick={()=>openFixture(game.id)}>{formatCareerDay(game.result!.completedDay)} · {fixtureStageName(edition,game)} · {game.result!.winner===edition.champion?'Vitória':'Derrota'} contra {opponent?.name}</button></li>;
     })}</ol>:<p>Esta edição não tem confrontos arquivados.</p>}
   </section>
 </article>;
}

export function TrophyRoom({career,onOpenFixture}:{career:Career;onOpenFixture:(id:string)=>void}){
 const [state,setState]=useState<CompetitionState|null>(null),[error,setError]=useState('');
 const [mode,setMode]=useState(''),[prestige,setPrestige]=useState(''),[season,setSeason]=useState(0),[selected,setSelected]=useState('');
 useEffect(()=>{let active=true;listCompetitions(career.id).then(data=>{if(active)setState(data);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[career.id]);
 const titles=useMemo(()=>competitionTitles(state?.seasons??[]).filter(win=>win.edition.champion==='career'),[state]);
 const visible=titles.filter(win=>(!mode||win.edition.mode===mode)&&(!prestige||win.edition.prestige===prestige)&&(!season||win.season.number===season));
 const tier=(event:Competition)=>event.key==='moba_world'?3:event.prestige==='Major'?2:event.prestige==='Internacional'?1:0;
 const groups=new Map<string,Title[]>();
 for(const title of visible)groups.set(title.edition.key,[...groups.get(title.edition.key)??[],title]);
 const collection=[...groups.values()].sort((a,b)=>tier(b[0].edition)-tier(a[0].edition));
 const focused=visible.find(win=>win.edition.id===selected);
 const local=titles.filter(title=>title.edition.prestige==='Regional').length;
 const founding=career.hasGodotSource?null:formatCareerDay(1).split('/').at(-1);
 return <div className="trophy-room">
   <header className="trophy-room-hero"><div><h1>Sala de Troféus</h1><p>{career.name}{founding&&' · Fundação em '+founding}</p>
   </div><Emblem identity={career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol}} code={career.code}/></header>
   {error&&<p role="alert">{error}</p>}{!state&&!error&&<p role="status">Consultando conquistas…</p>}
   {state&&<>
     <div className="trophy-totals"><div><strong>{titles.length}</strong> Títulos</div><div><strong>{local}</strong> Regionais</div><div><strong>{titles.length-local}</strong> Internacionais</div></div>
     <div className="world-filters trophy-filters">
       <label>Modalidade<select value={mode} onChange={event=>{setMode(event.target.value);setSelected('');}}><option value="">Todas</option><option value="MOBA">MOBA</option><option value="FPS">CS2</option></select></label>
       <label>Prestígio<select value={prestige} onChange={event=>{setPrestige(event.target.value);setSelected('');}}><option value="">Todos</option><option>Regional</option><option>Internacional</option><option>Major</option></select></label>
       <label>Temporada<select value={season} onChange={event=>{setSeason(Number(event.target.value));setSelected('');}}><option value={0}>Todas</option>{state.seasons.map(item=><option key={item.number} value={item.number}>{item.year}</option>)}</select></label>
     </div>
     {focused?<><button onClick={()=>setSelected('')}>← Voltar à galeria</button>
       {(groups.get(focused.edition.key)?.length??0)>1&&<label>Conquista<select value={selected} onChange={event=>setSelected(event.target.value)}>
         {groups.get(focused.edition.key)!.map(win=><option key={win.edition.id} value={win.edition.id}>{win.season.year}</option>)}
       </select></label>}
       <TitleDetails win={focused} openFixture={onOpenFixture}/>
     </>:<div className="trophy-gallery">{collection.map((wins,index)=>{
       const {edition,season}=wins[0];
       const spotlight=index===0;
       return <button key={edition.key} className={spotlight?'trophy-card trophy-spotlight':'trophy-card'} onClick={()=>setSelected(edition.id)}>
         <span className="trophy-card-stage"><TrophyArt event={edition}/></span>
         <span className="trophy-card-caption"><small>{edition.mode==='FPS'?'CS2':'MOBA'} · {edition.prestige}</small>
           <strong>{edition.name}</strong><span>{wins.length===1?season.year:wins.length+' títulos · '+season.year+' mais recente'}</span>
           {spotlight?<span className="trophy-open">Ver conquista <span aria-hidden="true">↗</span></span>:<b aria-hidden="true">↗</b>}</span>
       </button>;
     })}</div>}
     {!visible.length&&<p className="panel">{titles.length?'Nenhuma conquista para os filtros selecionados.':'As conquistas oficiais da organização serão exibidas aqui.'}</p>}
   </>}
 </div>;
}
