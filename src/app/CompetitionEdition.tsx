import {useMemo,type CSSProperties} from 'react';
import {fixtureStageName,standings,type Competition,type Fixture,type Season} from '../game-core/competitions';
import {registrationDeadline} from '../game-core/competition-registration';
import {formatCareerDay} from '../game-core/calendar';
import {CompetitionBracket} from './CompetitionBracket';
import {money} from './Players';
import {useViewPreference} from './view-preferences';
import {competitionTitles,longestTitleRun} from '../game-core/competition-history';
import {TrophyArt} from './TrophyArt';
import {TitleHonors,TitleLineup} from './TrophyRoom';

const identities:Record<string,[string,string,string]>={
 moba_world:['#ffd276','crown','Coroa Mundial'],cs_major:['#f08061','spire','Pináculo do Major'],
 cs_interregional:['#80bffc','orbit','Órbita Inter-regional'],cs_cologne:['#d7a5ff','spire','Taça de Colônia'],
 cs_league:['#79e7e0','orbit','Copa Internacional'],cblol:['#8cdeb0','shield','Escudo do Brasil'],
 lcs:['#89b7fb','shield','Taça Norte-Americana'],lec:['#cbbbff','spire','Cetro Europeu'],
 lck:['#ffb385','spire','Taça Coreana'],lpl:['#ff8198','crown','Coroa Chinesa'],lcp:['#87d8f7','orbit','Taça do Pacífico'],
 br_cup:['#bbdd87','shield','Copa do Brasil'],na_cup:['#aacfff','shield','Copa Norte-Americana'],
};
export function eventTheme(event:Competition){
 return identities[event.key]??(event.prestige==='Regional'?['#a3b1c7','entry',event.name]:['#ebca85','orbit',event.name]);
}
export function eventStatus(event:Competition,day:number){
 return event.champion?'Concluída':day<event.startDay||!event.fixtures.length?'Em breve':'Em andamento';
}
export function EventMark({event}:{event:Competition}){
 const [color,shape]=eventTheme(event);
 return <span aria-hidden="true" className={'event-mark event-mark-'+shape} style={{'--event-accent':color} as CSSProperties}><i/><b/><i/></span>;
}

const tabs=['Visão geral','Tabela','Playoffs','Estatísticas','Histórico','Regulamento'] as const;
const scheduled=(a:Fixture,b:Fixture)=>a.day-b.day||a.id.localeCompare(b.id);

export function CompetitionEdition({edition,season,seasons,day,favorite,toggleFavorite,back,openFixture,openOrganization,openEdition,preferenceKey=''}:{
 edition:Competition;season:Season;seasons:Season[];day:number;favorite:boolean;toggleFavorite:()=>void;back:()=>void;
 openFixture:(id:string)=>void;openOrganization?:(id:string)=>void;openEdition:(edition:Competition)=>void;preferenceKey?:string;
}){
 const [tab,setTab]=useViewPreference<typeof tabs[number]>(preferenceKey+':'+edition.id+':tab','Visão geral');
 const [color,,trophy]=eventTheme(edition);
 const teams=new Map(edition.participants.map(team=>[team.id,team]));
 const teamName=(id:string)=>teams.get(id)?.name??id;
 const upcoming=edition.fixtures.filter(game=>!game.result).sort(scheduled);
 const completed=edition.fixtures.filter(game=>game.result).sort((a,b)=>b.result!.completedDay-a.result!.completedDay||scheduled(a,b));
 const regular=standings(edition);
 const twoSplits=edition.leagueFormat?.splits===2;
 const history=useMemo(()=>competitionTitles(seasons,edition.key),[seasons,edition.key]);
 const currentTitle=history.find(win=>win.edition.id===edition.id)?.history;
 const streak=longestTitleRun(history);
 const format=edition.openingStage?.system==='groups'?'Grupos · MD'+edition.openingStage.bestOf:
   edition.openingStage?.system==='swiss'?'Suíço · MD'+edition.openingStage.bestOf:
   edition.doubleElimination?'Eliminação dupla':edition.format==='league'?(edition.leagueFormat?.splits===2?'Turno e returno':'Turno único'):'Eliminação simples';
 const fixtures=(games:Fixture[])=>games.length?<ul className="event-fixtures">{games.map(game=><li key={game.id}>
   <time>{formatCareerDay(game.result?.completedDay??game.day)} <small>{fixtureStageName(edition,game)} · MD{game.bestOf}</small></time>
   <strong>{teamName(game.home)} <span>{game.result?game.result.score.join(' × '):'×'}</span> {teamName(game.away)}</strong>
   <button onClick={()=>openFixture(game.id)}>{game.result?'Ver resultado':'Ver confronto'} <span aria-hidden="true">→</span></button>
 </li>)}</ul>:<p className="muted">Sem confrontos nesta etapa.</p>;
 const participants=()=>edition.participants.length?<ul className="event-participants">{edition.participants.map(team=><li key={team.id}>
   {team.logo?<img src={team.logo.replace('res://','/')} alt="" loading="lazy"/>:<span aria-hidden="true">{team.code}</span>}
   {openOrganization?<button onClick={()=>openOrganization(team.organization)}>{team.name}</button>:<strong>{team.name}</strong>}
 </li>)}</ul>:<p className="muted">Participantes serão definidos pela classificação.</p>;
 return <div className="event-page" style={{'--event-accent':color} as CSSProperties}>
   <button onClick={back}>← Portal de Competições</button>
   <header className={'event-hero '+(edition.prestige==='Regional'?'event-hero-local':'')}>
     <div><span className="event-kicker">{edition.prestige} · {edition.region}</span>
       <h1>{edition.name}</h1>
       <p>{edition.mode==='FPS'?'CS2':'MOBA'} · Temporada {season.year} · {eventStatus(edition,day)}</p>
       <p>{formatCareerDay(edition.startDay)} a {formatCareerDay(edition.endDay)}</p>
     </div>
     <EventMark event={edition}/>
     <button className="event-favorite" aria-pressed={favorite} onClick={toggleFavorite}>{favorite?'★ Favorito':'☆ Favoritar'}</button>
   </header>
   <nav className="event-tabs" aria-label="Seções do campeonato">
     {tabs.map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item}</button>)}
   </nav>
   {tab==='Visão geral'&&<>
     <div className="event-metrics"><div><small>Premiação</small><strong>{money(edition.prize)}</strong></div><div><small>Equipes</small><strong>{edition.participants.length||'A definir'}</strong></div><div><small>Formato</small><strong>{format}</strong></div></div>
     {edition.champion&&<section className="panel"><h2>Campeã da edição</h2><p>{teamName(edition.champion)}</p></section>}
     {edition.key!==season.pyramid?.playIn&&<section className="trophy-display panel"><TrophyArt event={edition}/>
       <div><h2>{trophy}</h2><p>{currentTitle?.champion.name??'Troféu da competição'}</p></div></section>}
     <section className="panel"><h2>Próximos confrontos</h2>{fixtures(upcoming.slice(0,8))}</section>
     <section className="panel"><h2>Participantes</h2>{participants()}</section>
     <section className="panel"><h2>Resultados recentes</h2>{fixtures(completed.slice(0,5))}</section>
   </>}
   {tab==='Tabela'&&<section className="panel player-table"><h2>Classificação</h2>
     {edition.format==='league'||edition.openingStage?<>
       {(edition.openingStage?.system==='groups'?edition.openingStage.groups:[edition.participants.map(team=>team.id)]).map((group,index)=><div key={index}>
         {edition.openingStage?.system==='groups'&&<h3>Grupo {String.fromCharCode(65+index)}</h3>}
         <table><thead><tr><th>Pos.</th><th>Organização</th><th>Séries</th><th>Vitórias</th><th>Derrotas</th><th>Saldo</th>{twoSplits&&<th>Pontos</th>}</tr></thead>
           <tbody>{regular.filter(row=>group.includes(row.team)).map((row,index)=><tr className={row.team==='career'?'own-team':''} key={row.team}>
             <td>{index+1}</td><th scope="row">{teamName(row.team)}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.difference}</td>{twoSplits&&<td>{row.wins*3}</td>}
           </tr>)}</tbody></table>
       </div>)}
       <h3>Confrontos da primeira fase</h3>{fixtures(edition.fixtures.filter(game=>game.phase==='regular').sort(scheduled))}
     </>:participants()}
   </section>}
   {tab==='Playoffs'&&(edition.doubleElimination?<CompetitionBracket edition={edition} open={openFixture}/>:
     <section className="panel"><h2>Playoffs</h2>{fixtures(edition.fixtures.filter(game=>game.phase!=='regular').sort(scheduled))}</section>)}
   {tab==='Estatísticas'&&<section className="panel player-table"><h2>Estatísticas por equipe</h2>
     <p>{completed.length} séries concluídas · {completed.reduce((sum,game)=>sum+game.result!.maps.length,0)} jogos ou mapas disputados</p>
     <table><thead><tr><th>Organização</th><th>Séries disputadas</th><th>Vitórias</th><th>Mapas vencidos</th></tr></thead><tbody>
       {edition.participants.map(team=>{
         const played=completed.filter(game=>game.home===team.id||game.away===team.id);
         const wins=played.filter(game=>game.result!.winner===team.id).length;
         const maps=played.reduce((sum,game)=>sum+(game.result!.administrative?0:game.result!.score[game.home===team.id?0:1]),0);
         return <tr key={team.id}><th scope="row">{team.name}</th><td>{played.length}</td><td>{wins}</td><td>{maps}</td></tr>;
       })}
     </tbody></table>
   </section>}
   {tab==='Histórico'&&<><section className="panel"><h2>Retrospectiva por temporada</h2>
     {streak&&streak.length>1&&<p>Maior sequência registrada · {streak.team}, {streak.length} títulos consecutivos.</p>}
     {history.length?<ul className="event-history">{history.map(({season:item,edition:event,history:title})=><li key={event.id}>
       <button onClick={()=>openEdition(event)}>{item.year} · {title.champion.name}</button>
       {title.runnerUp&&<span> Vice · {title.runnerUp.name} </span>}
       {title.finalId&&<button onClick={()=>openFixture(title.finalId!)}>Final · {title.score?.join(' × ')}</button>}
     </li>)}</ul>:<p>Nenhum título registrado nesta carreira.</p>}
     {!!edition.finalOrder.length&&<><h3>Classificação final da edição</h3><ol>{edition.finalOrder.map(id=><li key={id}>{teamName(id)}</li>)}</ol></>}
   </section>{currentTitle&&<><TitleLineup title={currentTitle}/><section className="panel"><h2>Premiações individuais</h2>
     <TitleHonors title={currentTitle} edition={edition}/></section></>}</>}
   {tab==='Regulamento'&&<section className="panel"><h2>Regulamento e premiação</h2>
     <p>{format} · Final MD{edition.finalBestOf} · Reputação +{edition.reputationGain}</p>
     <p>Troféu da competição · <strong>{trophy}</strong></p>
     {edition.qualification&&<p>{edition.qualification}</p>}
     {edition.qualifierSource&&<p>Quatro vagas pela classificatória aberta e quatro por convite. A campeã conquista vaga na Liga Internacional.</p>}
     {edition.key==='cs_regional'&&season.editions.some(event=>event.qualifierSource===edition.key)&&<p>Os quatro semifinalistas avançam para a classificatória fechada.</p>}
     {edition.qualifierTarget&&edition.key!=='cs_closed'&&<p>A campeã conquista vaga em {season.editions.find(event=>event.key===edition.qualifierTarget)?.name}.</p>}
     {edition.doubleElimination&&<p>{edition.doubleElimination.rules.grandFinal==='reset'?'Se a chave inferior vencer a primeira final, haverá uma segunda série.':'A grande final é disputada em série única.'}</p>}
     {(edition.openingStage||edition.format==='league')&&<p>Vitórias, saldo de mapas, {edition.stageRules?.tieBreak==='opponent-wins'?'vitórias dos adversários':'confronto entre empatados'} e ID determinam a ordem.</p>}
     {edition.leagueFormat?.splits===2&&<p>As duas etapas acumulam três pontos por vitória.</p>}
     {edition.format==='league'&&<p>Fase regular em {(edition.leagueFormat?.regularSeries??[1]).map(n=>'MD'+n).join(' e ')}. As quatro primeiras equipes avançam aos playoffs.</p>}
     {season.rosterRegistration&&edition.participants.some(team=>team.id==='career')&&<p>Prazo de inscrição do elenco · {formatCareerDay(registrationDeadline(edition))}. {edition.registration?`Lista fechada com ${edition.registration.players.length} atletas.`:'Titulares e reservas com vínculo ativo no prazo serão inscritos.'}</p>}
     {edition.importRegion&&<p>Limite de dois importados na escalação de MOBA.</p>}
     {edition.internationalSlots&&<ul>{Object.entries(edition.internationalSlots).map(([key,count])=><li key={key}>{season.editions.find(row=>row.key===key)?.region??key} · {count} {count===1?'vaga':'vagas'}</li>)}</ul>}
   </section>}
 </div>;
}
