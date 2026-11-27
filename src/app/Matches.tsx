import {isScheduledFixture,type Season} from '../game-core/competitions';
import {championshipFromResults} from '../game-core/competition-history';
import {competitionLineup,registrationDeadline} from '../game-core/competition-registration';
import {useEffect,useMemo,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import type {WorldCatalog} from '../game-core/world';
import type {Mode} from '../game-core/attributes';
import {roles} from '../game-core/attributes';
import {loanPlayers,type Loan} from '../game-core/loans';
import {mobaImports,regionalPolicies,registeredMobaLineup} from '../game-core/moba-eligibility';
import {careerLineup,rivalLineup,type MatchResult,type MatchTeam} from '../game-core/matches';
import type {StoredMatch} from '../game-core/match-store';
import {defaultIdentity} from '../game-core/identity';
import {formatCareerDay} from '../game-core/calendar';
import {cancelMatch,listLoans,listMatches,playMatch,prepareFriendly} from '../persistence/repository';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './Players';
import {listCompetitions,playCompetitiveFixture,type CompetitionState} from '../persistence/repository';
import {tacticalMaps,type Strategy} from '../game-core/match-tactics';
import {MatchDebrief,MatchPreparation,RoleEvidence,TacticalBoard} from './MatchTactical';
import {TitleCelebration} from './TrophyRoom';
import {Jersey} from './UniformEditor';

function TeamBadge({team}:{team:MatchTeam}){
 return <div className="match-team-badge">{team.identity?<Emblem identity={team.identity} code={team.code}/>:
   team.logo?<img src={team.logo.replace('res://','/')} alt={'Escudo de '+team.name}/>:<span className="team-monogram">{team.code}</span>}
   <strong>{team.name}</strong>{team.uniform&&<Jersey uniform={team.uniform} identity={team.identity} code={team.code}/>}</div>;
}

export function Matches(props:Parameters<typeof FriendlyMatches>[0]&{fixtureId?:string;onCompetitions:()=>void}){
 const [loans,setLoans]=useState<Loan[]>([]);
 useEffect(()=>{
   let active=true;
   listLoans(props.career.id).then(rows=>{if(active)setLoans(rows);}).catch(()=>{if(active)setLoans([]);});
   return()=>{active=false;};
 },[props.career]);
 const sport={...props,players:loanPlayers(props.players,loans,props.career.day)};
 return props.fixtureId?<CompetitiveMatch {...sport} fixtureId={props.fixtureId}/>:<FriendlyMatches {...sport}/>;
}

function FriendlyMatches({career,players,contracts,catalog,onUpdated,onRoster}:{
 career:Career;players:Player[];contracts:Contract[];catalog:WorldCatalog;onUpdated:(career:Career)=>Promise<void>;onRoster:()=>void;
}){
 const [rows,setRows]=useState<StoredMatch[]>([]),[loaded,setLoaded]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [search,setSearch]=useState(''),[opponentId,setOpponent]=useState(''),[viewId,setViewId]=useState('');
 const [strategy,setStrategy]=useState<Strategy>('balanced'),[mapId,setMapId]=useState('');
 useEffect(()=>{
   let active=true;
   listMatches(career.id).then(entries=>{if(active){setRows(entries);setLoaded(true);}}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career]);
 const mode=career.mode as Mode;
 const options=useMemo(()=>{
   const byTeam=new Map<string,Set<string>>();
   for(const player of players){if(!player.team||player.mode!==mode||player.status)continue;
     if(!byTeam.has(player.team))byTeam.set(player.team,new Set());byTeam.get(player.team)!.add(player.role);
   }
   const leagues=new Map(catalog.leagues.map(l=>[l.id,l.discipline]));
   return catalog.teams.filter(team=>leagues.get(team.league)===mode&&roles[mode].every(role=>byTeam.get(team.id)?.has(role)))
     .sort((a,b)=>a.name.localeCompare(b.name));
 },[catalog,players,mode]);
 const pending=rows.find(row=>!row.result);
 const focused=rows.find(row=>row.id===viewId)??pending??rows[0];
 const selected=catalog.teams.find(team=>team.id===(pending?.opponent_team_id??opponentId));
 const org=catalog.organizations.find(org=>org.id===selected?.organization);
 const home=careerLineup(players,contracts),away=selected?rivalLineup(players,selected.id,mode,career.day):[];
 const validHome=home.length===5&&roles[mode].every(role=>home.some(slot=>slot.role===role));
 const badges:MatchTeam[]=[{id:'career:'+career.id,name:career.name,code:career.code,logo:'',identity:career.identity??{...defaultIdentity,primary:career.color,symbol:career.symbol}},
   {id:selected?.id??'',name:selected?.name??'Adversário',code:org?.code??'—',logo:org?.logo??''}];
 const perform=async(action:()=>Promise<void>)=>{
   if(busy)return;setBusy(true);setError('');
   try{await action();}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{try{setRows(await listMatches(career.id));}catch(reason){setError(String(reason));}setBusy(false);}
 };
 return <>
   <div className="players-heading"><h1>Partidas</h1><span>{mode} · {formatCareerDay(career.day)}</span></div>
   <p className="muted">Amistosos com os elencos da carreira. Moral, forma e fadiga são atualizadas; o resultado fica salvo no histórico.</p>
   {error&&<p role="alert">{error}</p>}{!loaded&&!error&&<p role="status">Carregando partidas…</p>}
   {!pending&&<form className="panel" onSubmit={e=>{e.preventDefault();void perform(async()=>{
     const match=await prepareFriendly(career.id,opponentId);setViewId(match.id);
   });}}>
     <h2>Preparar amistoso</h2>
     <div className="world-filters"><label>Buscar equipe<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome da equipe…"/></label>
       <label>Adversário<select required value={opponentId} disabled={busy} onChange={e=>setOpponent(e.target.value)}>
         <option value="">Selecione uma equipe</option>{options.filter(team=>team.name.toLowerCase().includes(search.trim().toLowerCase())||team.id===opponentId)
           .map(team=><option value={team.id} key={team.id}>{team.name}</option>)}
       </select></label>
     </div>
     {!validHome&&<p role="status">Complete as cinco funções com titulares do elenco principal para disputar uma partida. <button type="button" onClick={onRoster}>Abrir elenco →</button></p>}
     <button className="primary" disabled={busy||!loaded||!opponentId||!validHome}>Preparar partida</button>
   </form>}
   {(pending||(!focused?.result&&selected))&&<section className="panel" aria-label="Preparação da partida">
     <div className="match-scoreboard"><TeamBadge team={badges[0]}/><strong>×</strong><TeamBadge team={badges[1]}/></div>
     <div className="match-lineups">{[home,away].map((lineup,index)=><div key={index}><h3>{badges[index].name}</h3>
       {lineup.map(slot=><div className="match-lineup-player" key={slot.player.id}><PlayerPortrait index={slot.player.portraitIndex}/><span>{slot.player.nickname}<small>{roleNames[slot.role]} · OVR {Math.round(slot.player.overall)}</small></span></div>)}
     </div>)}</div>
     {pending&&<>
       <MatchPreparation mode={mode} opponent={pending.opponent_team_id} lineup={away} matches={rows.flatMap(row=>row.result?[row.result]:[])}
         strategy={strategy} onStrategy={setStrategy} mapId={mapId} onMap={setMapId}/>
       <p>Amistoso no dia atual · {mode==='FPS'?'13 rounds para vencer; em 12–12, prorrogação até 16.':'Simulação simplificada de uma partida MOBA.'}</p>
       <button className="primary" disabled={busy||!validHome||away.length!==5} onClick={()=>void perform(async()=>{
         const completed=await playMatch(career.id,pending.id,strategy,mapId||undefined);setViewId(pending.id);await onUpdated(completed.career);
       })}>{busy?'Simulando…':'Simular Partida'}</button>
       <button disabled={busy} onClick={()=>void perform(async()=>{await cancelMatch(career.id,pending.id);setViewId('');})}>Cancelar amistoso</button>
       {!validHome&&<p role="alert">A escalação mudou. Complete os cinco titulares no elenco antes de simular.</p>}
     </>}
   </section>}
   {focused?.result&&<MatchResultView result={focused.result}/>}
   <section className="panel"><h2>Histórico de partidas</h2>
     {!rows.some(row=>row.result)&&<p>Nenhuma partida concluída.</p>}
     <div className="match-history">{rows.filter(row=>row.result).map(row=>{
       const result=row.result!;
       return <button key={row.id} disabled={busy} aria-pressed={focused?.id===row.id} onClick={()=>setViewId(row.id)}>
         {formatCareerDay(row.day)} · {result.teams[0].name} {result.score[0]} × {result.score[1]} {result.teams[1].name}
       </button>;
     })}</div>
   </section>
 </>;
}

function CompetitiveMatch({career,players,contracts,fixtureId,onUpdated,onCompetitions,onRoster}:{
 career:Career;players:Player[];contracts:Contract[];fixtureId:string;onUpdated:(career:Career)=>Promise<void>;onCompetitions:()=>void;onRoster:()=>void;
}){
 const [state,setState]=useState<CompetitionState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[mapIndex,setMap]=useState(0);
 const [strategy,setStrategy]=useState<Strategy>('balanced');
 const [confirmForfeit,setConfirmForfeit]=useState(false);
 const [celebrated,setCelebrated]=useState<Season>();
 useEffect(()=>{let active=true;listCompetitions(career.id).then(data=>{if(active)setState(data);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[career,fixtureId]);
 const edition=state?.seasons.flatMap(s=>s.editions).find(e=>e.fixtures.some(g=>g.id===fixtureId));
 const game=edition?.fixtures.find(g=>g.id===fixtureId);
 const teams=game&&edition?[game.home,game.away].flatMap(id=>edition.participants.filter(p=>p.id===id)):[];
 const fixtureMode=edition?.mode??career.mode as Mode;
 const region=edition?.importRegion;
 const registration=edition?competitionLineup(edition,players,contracts,career.day):undefined;
 const lineups=teams.map(team=>team.id==='career'?(registration?.lineup??[]):
   region?registeredMobaLineup(players,team.id,career.day,region):rivalLineup(players,team.id,fixtureMode,career.day));
 const valid=lineups.length===2&&lineups.every((lineup,index)=>teams[index].id!=='career'&&region||
   (lineup.length===5&&(!region||mobaImports(lineup,region)<=regionalPolicies[region].limit)));
 const own=game&&(game.home==='career'||game.away==='career');
 const opponent=teams.findIndex(team=>team.id!=='career');
 const submit=async(forfeit=false)=>{
   setBusy(true);setError('');
   try{
     const completed=await playCompetitiveFixture(career.id,fixtureId,strategy,forfeit);
     const winner=completed.season.editions.find(event=>event.id===edition?.id);
     if(winner?.champion==='career'&&winner.key!==completed.season.pyramid?.playIn&&edition?.champion!=='career')setCelebrated(completed.season);
     await onUpdated(completed.career);setState(await listCompetitions(career.id));setMap(0);
   }
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}
 };
 const winningEdition=celebrated?.editions.find(event=>event.id===edition?.id);
 const title=winningEdition&&(winningEdition.championship??championshipFromResults(winningEdition));
 return <>
   <div className="players-heading"><h1>Confronto de campeonato</h1><button onClick={onCompetitions}>← Competições</button></div>
   {celebrated&&winningEdition&&title&&<TitleCelebration title={title} edition={winningEdition} season={celebrated} close={()=>setCelebrated(undefined)}/>}
   {error&&<p role="alert">{error}</p>}{!state&&!error&&<p role="status">Carregando confronto…</p>}
   {state&&!game&&<p>Confronto não encontrado.</p>}
   {game&&teams.length!==2&&<p role="alert">Confronto inválido: faltam participantes na edição.</p>}
   {game&&edition&&teams.length===2&&<section className="panel">
     <h2>{edition.name} · MD{game.bestOf}</h2><p>{formatCareerDay(game.day)} · {edition.prestige} · {edition.region}</p>
     <div className="match-scoreboard"><TeamBadge team={teams[0]}/><strong>{game.result?game.result.score.join(' × '):'×'}</strong><TeamBadge team={teams[1]}/></div>
     {game.result?<>
       <p><strong>{teams.find(team=>team.id===game.result!.winner)?.name} venceu a série.</strong> {game.result.administrative?'Resultado administrativo por falta de escalação elegível.':game.result.maps.length+' '+(edition.mode==='FPS'?'mapas':'jogos')+' disputados.'}</p>
       <div className="advance-actions">{game.result.maps.map((map,index)=><button aria-pressed={mapIndex===index} key={index} onClick={()=>setMap(index)}>{tacticalMaps.find(item=>item.id===map.mapId)?.name??((edition.mode==='FPS'?'Mapa':'Jogo')+' '+(index+1))} · {map.score.join(' × ')}</button>)}</div>
     </>:!isScheduledFixture(game)?<p>Confronto indisponível para disputa.</p>:<>
       <div className="match-lineups">{lineups.map((lineup,index)=><div key={index}><h3>{teams[index].name}</h3>{lineup.map(slot=><div className="match-lineup-player" key={slot.player.id}><PlayerPortrait index={slot.player.portraitIndex}/><span>{slot.player.nickname}<small>{roleNames[slot.role]} · OVR {Math.round(slot.player.overall)}</small></span></div>)}</div>)}</div>
       {career.day<game.day&&<p>Avance o calendário até {formatCareerDay(game.day)} para disputar esta série.</p>}
       {own&&registration&&state?.seasons.find(season=>season.number===edition.season)?.rosterRegistration&&<details open={!registration.valid}>
         <summary>Inscrição de elenco · prazo {formatCareerDay(registrationDeadline(edition))}</summary>
         <p>{edition.registration?'Lista fechada.':'Lista aberta até o prazo.'} Titulares atuais são mantidos. Trocas são feitas no elenco.</p>
         <p>Reservas elegíveis · {registration.reserve.map(player=>player.nickname+' ('+roleNames[player.role]+')').join(', ')||'Nenhuma'}</p>
         {!!registration.unavailable.length&&<ul>{registration.unavailable.map(({player,reason})=><li key={player.id}>{player.nickname} · {reason}</li>)}</ul>}
         {!!registration.missingRoles.length&&<p>Funções sem titular elegível · {registration.missingRoles.map(role=>roleNames[role]).join(', ')}.</p>}
         {registration.overImport&&<p>Limite de importados excedido.</p>}
       </details>}
       {!valid&&<p role="alert">Complete as cinco funções titulares do elenco principal. <button onClick={onRoster}>Abrir elenco →</button></p>}
       {own&&opponent>=0&&<MatchPreparation mode={fixtureMode} opponent={teams[opponent].id} lineup={lineups[opponent]}
         matches={state?.seasons.flatMap(season=>season.editions.filter(row=>row.mode===fixtureMode).flatMap(row=>row.fixtures.flatMap(fixture=>fixture.result?.maps??[])))??[]}
         strategy={strategy} onStrategy={setStrategy}/>}
       {own?<button className="primary" disabled={busy||career.day<game.day||!valid||!registration?.valid} onClick={()=>void submit()}>{busy?'Simulando série…':'Simular série MD'+game.bestOf}</button>:<p>Confronto da IA: simulação automática na data agendada.</p>}
       {own&&edition.registration&&!registration?.valid&&career.day>=game.day&&
         (confirmForfeit?<p>Esta série será registrada como derrota administrativa. <button disabled={busy} onClick={()=>void submit(true)}>Confirmar derrota</button> <button onClick={()=>setConfirmForfeit(false)}>Cancelar</button></p>:
           <button disabled={busy} onClick={()=>setConfirmForfeit(true)}>Registrar derrota por falta de elenco</button>)}
     </>}
   </section>}
   {game?.result?.maps[Math.min(mapIndex,game.result.maps.length-1)]&&<MatchResultView key={mapIndex} result={game.result.maps[Math.min(mapIndex,game.result.maps.length-1)]}/>}
 </>;
}

export function MatchResultView({result}:{result:MatchResult}){
 const mvp=result.stats.find(stat=>stat.playerId===result.mvp)!;
 return <section className="panel" aria-label="Resultado da partida">
   <h2>Resultado · {result.mode} · {formatCareerDay(result.day)}</h2>
   <div className="match-scoreboard"><TeamBadge team={result.teams[0]}/><strong>{result.score[0]} × {result.score[1]}</strong><TeamBadge team={result.teams[1]}/></div>
   <p role="status"><strong>{result.teams[result.winner].name} venceu.</strong> · Duração aproximada {result.durationMinutes.toLocaleString('pt-BR')} min · MVP {mvp.nickname}</p>
   {result.mode==='MOBA'&&<p>Abates das equipes: {result.kills[0]} × {result.kills[1]}</p>}
   <TacticalBoard result={result}/>
   <MatchDebrief result={result}/>
   {!!result.phases?.length&&<div className="player-table"><table><thead><tr><th>Fase</th><th>Ouro registrado</th><th>Experiência</th><th>Visão</th><th>Objetivos</th><th>Pressão de mapa</th></tr></thead><tbody>
     {result.phases.map(phase=><tr key={phase.phase}><th scope="row">{phase.phase}</th>{[phase.gold,phase.experience,phase.vision,phase.objectives,phase.pressure].map((value,index)=><td key={index}>{value.join(' × ')}</td>)}</tr>)}
   </tbody></table></div>}
   <div className="match-statistics">{result.teams.map((team,index)=><div className="player-table" key={team.id}>
     <h3>{team.name}</h3><table><thead><tr><th>Jogador</th><th>Abates</th><th>Mortes</th><th>Assist.</th>{result.mode==='FPS'&&<th>Rounds vencidos</th>}{result.strategies&&<><th>Ações da função</th><th>Nota</th></>}</tr></thead>
       <tbody>{result.stats.filter(stat=>stat.team===index).map(stat=><tr key={stat.playerId}><th scope="row">{stat.nickname}{stat.playerId===result.mvp?' · MVP':''}<small>{roleNames[stat.role]}</small></th><td>{stat.kills}</td><td>{stat.deaths}</td><td>{stat.assists}</td>{result.mode==='FPS'&&<td>{stat.roundsWon}</td>}{result.strategies&&<><td>{stat.contribution}</td><td>{stat.rating?.toLocaleString('pt-BR')}</td></>}</tr>)}</tbody>
     </table>
   </div>)}</div>
   <RoleEvidence result={result}/>
   {result.strategies&&<details><summary>Comparar notas por função</summary><ul>{result.stats.filter(stat=>stat.team===0).map(home=>{
     const away=result.stats.find(stat=>stat.team===1&&stat.role===home.role);
     return <li key={home.playerId}>{roleNames[home.role]} · {home.nickname} ({home.rating?.toLocaleString('pt-BR')}) × {away?.nickname} ({away?.rating?.toLocaleString('pt-BR')})</li>;
   })}</ul></details>}
   <h3>Acontecimentos principais</h3><ol className="career-timeline">{result.events.map((event,index)=><li key={index}>
     {result.mode==='FPS'?'Round '+event.at:event.at+' min'} · {event.text} <span className="muted">{event.score[0]}–{event.score[1]}{result.mode==='MOBA'?' abates':''}</span>
   </li>)}</ol>
 </section>;
}
