import {useEffect,useState,type ReactNode} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {roles} from '../game-core/attributes';
import {money,roleNames} from './Players';
import {PlayerPortrait} from './PlayerPortrait';
import {formatCareerDay} from '../game-core/calendar';
import {playerCondition,teamChemistry} from '../game-core/development';
import {affinity,estimatedStrength} from '../game-core/team-analysis';
import type {WorldCatalog} from '../game-core/world';
import {NewsPanel} from './News';
import {ClubDna} from './ClubDna';
import {ChemistryMap} from './ChemistryMap';
import {fixtureStageName,nextUserFixture,pendingUserFixtures,type Season} from '../game-core/competitions';
import type {StoredMatch} from '../game-core/match-store';
import {careerAgenda} from '../game-core/career-agenda';
import {listCompetitions,listFinances,listMatches,listNegotiations} from '../persistence/repository';

export function CareerDashboard({career,country,players,contracts,emblem,navigate,advance,busy,leagueName,catalog,onNewsPlayer,onNewsFixture}:{
  career:Career;country:string;players:Player[];contracts:Contract[];
  emblem:ReactNode;navigate:(screen:string)=>void;
  advance:()=>void;busy:boolean;
  leagueName?:string;
  catalog?:WorldCatalog|null;onNewsPlayer:(id:number)=>void;onNewsFixture:(id:string)=>void;
}) {
  const [pending,setPending]=useState<{careerId:string;day:number;match:boolean;market:number;sponsors:number}|null>(null);
  const [schedule,setSchedule]=useState<{careerId:string;seasons:Season[];matches:StoredMatch[]}|null>(null);
  const [scheduleError,setScheduleError]=useState('');
  useEffect(()=>{
    let active=true;
    setScheduleError('');
    const competitionsRequest=listCompetitions(career.id);
    void Promise.all([competitionsRequest,listMatches(career.id).catch(()=>[])]).then(([state,matches])=>{
      if(active)setSchedule({careerId:career.id,seasons:state.seasons,matches});
    }).catch(()=>{if(active){setSchedule(null);setScheduleError('Não foi possível consultar a agenda oficial.');}});
    void Promise.all([competitionsRequest,listNegotiations(career.id),listFinances(career.id)]).then(([competitions,negotiations,finances])=>{
      if(!active)return;
      const day=career.day;
      const match=nextUserFixture(competitions.seasons[0]);
      const occupied=finances.sponsors.filter(s=>s.state==='accepted'&&s.accepted_day+s.duration-1>=day).length;
      setPending({careerId:career.id,day,match:!!match&&match.day<=day,
        market:negotiations.filter(n=>(n.state==='accepted'||n.state==='counter')&&n.expires_day>=day).length,
        sponsors:occupied>=2?0:finances.sponsors.filter(s=>s.state==='pending'&&s.expires_day>=day&&s.min_reputation<=finances.reputation).length});
    }).catch(()=>{if(active)setPending(null);});
    return ()=>{active=false;};
  },[career]);
  const scheduleReady=schedule?.careerId===career.id;
  const official=pendingUserFixtures(scheduleReady?schedule?.seasons[0]:undefined);
  const due=official.filter(({fixture})=>fixture.day<=career.day);
  const preview=due.length?due:official.slice(0,1);
  const decisions=pending?.careerId===career.id&&pending.day===career.day?pending:null;
  const count=decisions?Number(decisions.match)+decisions.market+decisions.sponsors:0;
  const upcoming=careerAgenda(career,schedule?.careerId===career.id?schedule.seasons:[],schedule?.careerId===career.id?schedule.matches:[],contracts,
    new Map(players.map(player=>[player.id,player.nickname]))).filter(event=>event.own).slice(0,3);
  const mainContracts=contracts.filter(contract=>!contract.academy);
  const starters=mainContracts.filter(contract=>contract.starter);
  const playerIndex=new Map(players.map(player=>[player.id,player]));
  const lineup=starters.flatMap(contract=>{
    const player=playerIndex.get(contract.player_id);
    return player?[{player,startDay:Math.max(1,contract.start_day)}]:[];
  });
  const chemistry=teamChemistry(lineup,career.day);
  const squad=mainContracts.flatMap(contract=>{const player=playerIndex.get(contract.player_id);return player?[player]:[];});
  const morale=squad.length?Math.round(squad.reduce((sum,player)=>sum+playerCondition(player,career.day).morale,0)/squad.length):null;
  const strength=estimatedStrength(squad,lineup.map(member=>member.player));
  const relationships=lineup.flatMap((a,index)=>lineup.slice(index+1).map(b=>{
    const days=Math.max(0,career.day-Math.max(a.startDay,b.startDay));
    return {left:a.player,right:b.player,days,score:affinity(a.player,b.player,days)};
  })).sort((a,b)=>b.score-a.score);
  const date=formatCareerDay(career.day);
  return <div className="career-dashboard">
    <div className="players-heading"><h1>Central da Organização</h1><button className="primary" disabled={busy||due.length>0} onClick={advance}>{busy?'Avançando…':'Avançar dia →'}</button></div>
    <p className="central-subtitle">{date} · {career.mode} · {country}</p>
    {!!count&&decisions&&<details className="career-decisions"><summary>{count} {count===1?'decisão pendente':'decisões pendentes'}</summary>
      {decisions.match&&<button onClick={()=>{if(due[0])onNewsFixture(due[0].fixture.id);else navigate('competitions');}}>Confronto oficial disponível</button>}
      {!!decisions.market&&<button onClick={()=>navigate('market')}>Negociações ({decisions.market})</button>}
      {!!decisions.sponsors&&<button onClick={()=>navigate('finances')}>Propostas de patrocínio ({decisions.sponsors})</button>}
    </details>}
    <div className="central-metrics">
      <div><span>Saldo</span><strong>{money(career.balance)}</strong></div>
      <div><span>Reputação</span><strong>Iniciante</strong></div>
      <div><span><abbr title="Média da confiança e do ânimo dos jogadores do elenco principal.">Moral do elenco</abbr></span><strong>{morale===null?'—':morale+'%'}</strong></div>
      <div><span>{career.entry?.kind==='open_circuit'?'Circuito aberto':'Divisão inicial'}</span><strong>{career.entry?.kind==='open_circuit'?'Sem ranking':leagueName??'—'}</strong></div>
    </div>
    <div className="central-columns">
      <div>
        <section className="central-panel">
          <h2>Próxima partida</h2>
          {scheduleError&&<p role="alert">{scheduleError}</p>}
          {!scheduleReady&&!scheduleError&&<p role="status">Consultando a agenda oficial…</p>}
          {scheduleReady&&preview.length===0&&<>
            <p>Sem partida oficial agendada.</p>
            <button className="primary" onClick={()=>navigate('matches')}>Disputar amistoso →</button>
          </>}
          {preview.map(({edition,fixture})=>{
            const opponentId=fixture.home==='career'?fixture.away:fixture.home;
            const opponent=edition.participants.find(team=>team.id===opponentId);
            const status=fixture.day<career.day?'Partida atrasada':fixture.day===career.day?'Dia de jogo':'Partida futura';
            return <article key={fixture.id}>
              <div className="fixture-preview"><div>{emblem}<strong>{career.name}</strong></div>
                <span aria-hidden="true">×</span><div>{opponent?.logo?<img width={64} height={64} style={{objectFit:'contain'}} src={opponent.logo.replace('res://','/')} alt=""/>:<span className="fixture-placeholder">{opponent?.code??'◇'}</span>}
                <strong>{opponent?.name??'Adversário indisponível'}</strong></div>
              </div>
              <p><strong>{status}</strong> · {formatCareerDay(fixture.day)} · {edition.mode==='FPS'?'CS2':'MOBA'} · {edition.name} · {fixtureStageName(edition,fixture)} · MD{fixture.bestOf}</p>
              {!opponent&&<p role="alert">O participante {opponentId} não está registrado nesta edição.</p>}
              <button className="primary" onClick={()=>onNewsFixture(fixture.id)}>{fixture.day<=career.day?'Disputar partida':'Ver confronto'} →</button>
            </article>;
          })}
          <button className="primary" onClick={()=>navigate('roster')}>Ver meu elenco →</button>
        </section>
        <section className="central-panel"><h2>Nosso elenco</h2>
          <div className="starter-grid">{roles[career.mode==='FPS'?'FPS':'MOBA'].map(role=>{
            const contract=starters.find(row=>playerIndex.get(row.player_id)?.role===role);
            const player=contract&&playerIndex.get(contract.player_id);
            return <article key={role}>
              {player?<PlayerPortrait index={player.portraitIndex}/>:<span className="empty-portrait">—</span>}
              <strong>{player?.nickname??'Vaga aberta'}</strong>
              <small>{roleNames[role]}</small><b><abbr title="Overall: nível geral calculado pelos atributos da função.">{player?Math.round(player.overall):'—'}</abbr></b>
            </article>;
          })}</div>
          {!!squad.length&&<details><summary>Detalhes do elenco</summary>
            <ul>{squad.map(player=><li key={player.id}>{player.nickname} · {roleNames[player.role]} · OVR {Math.round(player.overall)} · {money(mainContracts.find(c=>c.player_id===player.id)!.salary)}/mês</li>)}</ul>
          </details>}
        </section>
      </div>
      <div>
        <section className="central-panel"><h2>Calendário</h2><p>Dia {career.day}{leagueName?' · '+leagueName:''}</p>
          <ul aria-label="Próximos acontecimentos">{upcoming.map(event=><li key={event.id}>{formatCareerDay(event.day)} · {event.label}</li>)}</ul>
          <button onClick={()=>navigate('calendar')}>Ver calendário e folha →</button>
        </section>
        <NewsPanel career={career} players={players} contracts={contracts} catalog={catalog} onPlayer={onNewsPlayer} onFixture={onNewsFixture} onNavigate={navigate}/>
        <section className="central-panel"><h2>Situação do elenco</h2>
          <strong>{starters.length} / 5 titulares</strong><p>{mainContracts.length-starters.length} reservas · {contracts.length-mainContracts.length} na Academy · {career.mode}</p>
          <button onClick={()=>navigate('academy')}>Gerenciar Academy →</button><button onClick={()=>navigate('training')}>Treinamento →</button>
          <p><abbr title="Quanto os titulares estão acostumados a jogar juntos.">Entrosamento</abbr> {chemistry===null?'—':chemistry+'%'}</p>
          <p><abbr title="Estimativa da qualidade da equipe que considera titulares, atributos e vagas abertas.">Força estimada</abbr> {strength===null?'—':strength.toLocaleString('pt-BR')}</p>
          <ClubDna players={squad} day={career.day} reputation={career.reputation??40} hasAcademy={contracts.some(contract=>!!contract.academy)} contracts={contracts}/>
          <details><summary>Como o entrosamento é calculado</summary>
            <p>A média das afinidades entre pares de titulares forma o entrosamento. Cada par considera o tempo de vínculo em comum, atributos sociais, estilos e funções complementares. Mudanças na escalação mudam os pares usados na média.</p>
            {relationships.length?<ChemistryMap players={lineup.map(member=>member.player)} relationships={relationships}/>:<p>São necessários pelo menos dois titulares para calcular afinidade.</p>}
          </details>
        </section>
      </div>
    </div>
  </div>;
}
