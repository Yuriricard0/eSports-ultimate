import type {ReactNode} from 'react';
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

export function CareerDashboard({career,country,players,contracts,emblem,navigate,advance,busy,leagueName,catalog,onNewsPlayer,onNewsFixture}:{
  career:Career;country:string;players:Player[];contracts:Contract[];
  emblem:ReactNode;navigate:(screen:string)=>void;
  advance:()=>void;busy:boolean;
  leagueName?:string;
  catalog?:WorldCatalog|null;onNewsPlayer:(id:number)=>void;onNewsFixture:(id:string)=>void;
}) {
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
    <div className="players-heading"><h1>Central da Organização</h1><button className="primary" disabled={busy} onClick={advance}>{busy?'Avançando…':'Avançar dia →'}</button></div>
    <p className="central-subtitle">{date} · {career.mode} · {country}</p>
    <div className="central-metrics">
      <div><span>Saldo</span><strong>{money(career.balance)}</strong></div>
      <div><span>Reputação</span><strong>Iniciante</strong></div>
      <div><span>Moral do elenco</span><strong>{morale===null?'—':morale+'%'}</strong></div>
      <div><span>{career.entry?.kind==='open_circuit'?'Circuito aberto':'Divisão inicial'}</span><strong>{career.entry?.kind==='open_circuit'?'Sem ranking':leagueName??'—'}</strong></div>
    </div>
    <div className="central-columns">
      <div>
        <section className="central-panel">
          <h2>Próxima partida</h2>
          <div className="fixture-preview"><div>{emblem}<strong>{career.name}</strong></div>
            <span aria-hidden="true">×</span><div><span className="fixture-placeholder" aria-hidden="true">◇</span>Adversário a definir</div>
          </div>
          <p>Sem partida agendada.</p>
          <button className="primary" onClick={()=>navigate('matches')}>Disputar amistoso →</button>
          <button className="primary" onClick={()=>navigate('roster')}>Ver meu elenco →</button>
        </section>
        <section className="central-panel"><h2>Nosso elenco</h2>
          <div className="starter-grid">{roles[career.mode==='FPS'?'FPS':'MOBA'].map(role=>{
            const contract=starters.find(row=>playerIndex.get(row.player_id)?.role===role);
            const player=contract&&playerIndex.get(contract.player_id);
            return <article key={role}>
              {player?<PlayerPortrait index={player.portraitIndex}/>:<span className="empty-portrait">—</span>}
              <strong>{player?.nickname??'Vaga aberta'}</strong>
              <small>{roleNames[role]}</small><b>{player?Math.round(player.overall):'—'}</b>
            </article>;
          })}</div>
        </section>
      </div>
      <div>
        <section className="central-panel"><h2>Calendário</h2><p>Dia {career.day}{leagueName?' · '+leagueName:''}</p><button onClick={()=>navigate('calendar')}>Ver calendário e folha →</button></section>
        <NewsPanel career={career} players={players} contracts={contracts} catalog={catalog} onPlayer={onNewsPlayer} onFixture={onNewsFixture} onNavigate={navigate}/>
        <section className="central-panel"><h2>Situação do elenco</h2>
          <strong>{starters.length} / 5 titulares</strong><p>{mainContracts.length-starters.length} reservas · {contracts.length-mainContracts.length} na Academy · {career.mode}</p>
          <button onClick={()=>navigate('academy')}>Gerenciar Academy →</button><button onClick={()=>navigate('training')}>Treinamento →</button>
          <p>Entrosamento {chemistry===null?'—':chemistry+'%'}</p>
          <p>Força estimada {strength===null?'—':strength.toLocaleString('pt-BR')}</p>
          {!!relationships.length&&<details><summary>Afinidades entre titulares</summary>
            <ul>{relationships.map(pair=><li key={pair.left.id+':'+pair.right.id}>{pair.left.nickname} e {pair.right.nickname} · {pair.score}% · {pair.days} dias no clube</li>)}</ul>
          </details>}
        </section>
      </div>
    </div>
  </div>;
}
