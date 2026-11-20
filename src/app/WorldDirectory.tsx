import {useState} from 'react';
import {filterOrganizations,type Organization,type WorldCatalog,type WorldFilter} from '../game-core/world';
import type {Player} from '../game-core/recruitment';
import type {Career} from '../game-core/career';
import {PlayerPortrait} from './PlayerPortrait';
import {roleNames} from './Players';
import {clubPhilosophy,estimatedStrength} from '../game-core/team-analysis';

const displayCountries=new Intl.DisplayNames(['pt-BR'],{type:'region'});
const countryName=(code:string)=>code==='ZZ'?'País não informado':displayCountries.of(code)??code;
const defaults:WorldFilter={query:'',mode:'',country:'',league:'',tier:0};
const pageSize=18;

function ClubLogo({club}:{club:Organization}) {
  return club.logo ? <img src={club.logo.replace('res://','/')} alt={'Logo '+club.name} loading="lazy"/>
    : <span className="monogram" title="Logo original pendente">{club.code}</span>;
}

export function WorldDirectory({catalog,players,view,onNavigate,career}:{
  catalog:WorldCatalog;players:Player[];view:'organizations'|'leagues';onNavigate:(view:string)=>void;
  career?:Career|null;
}) {
  const [filter,setFilter]=useState(defaults);
  const [page,setPage]=useState(0);
  const [clubId,setClubId]=useState('');
  const [teamId,setTeamId]=useState('');
  const [showStrength,setShowStrength]=useState(false);
  const [strengthMode,setStrengthMode]=useState(career?.mode??'MOBA');
  const leaguesById=new Map(catalog.leagues.map(league=>[league.id,league]));
  const careerLeague=career?.entry&&leaguesById.get(career.entry.leagueId);
  const displaced=catalog.teams.find(team=>team.id===career?.entry?.displacedTeamId);
  const club=catalog.organizations.find(org=>org.id===clubId);
  const teams=catalog.teams.filter(team=>team.organization===clubId);
  const team=teams.find(team=>team.id===teamId)??teams[0];
  const league=team&&leaguesById.get(team.league);
  const teamPlayers=team ? players.filter(player=>player.team===team.id) : [];
  const strength=estimatedStrength(teamPlayers);
  const countries=[...new Set(catalog.organizations.map(org=>org.country))].sort((a,b)=>countryName(a).localeCompare(countryName(b),'pt-BR'));
  const leagues=catalog.leagues.filter(league=>!filter.mode||filter.mode===league.discipline);
  const matches=filterOrganizations(catalog,filter);
  const activePage=Math.min(page,Math.max(0,Math.ceil(matches.length/pageSize)-1));
  const update=(next:Partial<WorldFilter>)=>{setFilter(current=>({...current,...next}));setPage(0);};
  const openClub=(id:string)=>{
    setClubId(id);
    setTeamId(catalog.teams.find(team=>team.organization===id&&team.league===filter.league)?.id??'');
  };

  if(club&&view==='organizations') return <>
    <button onClick={()=>setClubId('')}>← Organizações</button>
    <div className="club-profile-title"><ClubLogo club={club}/><div><h1>{club.name}</h1><p>{countryName(club.country)} · Reputação {club.reputation}</p></div></div>
    <div className="world-filters" aria-label="Equipes da organização">
      {teams.map(row=><button key={row.id} aria-pressed={team?.id===row.id} onClick={()=>setTeamId(row.id)}>
        {row.name} · {leaguesById.get(row.league)?.discipline} · {row.academy?'Academia':'Principal'}
      </button>)}
    </div>
    {team&&league&&<section className="central-panel">
      <h2>{team.name} · {league.name}</h2>
      <p>{league.season}{team.tier>0?' · Tier '+team.tier:''}{team.global_rank>0?' · VRS global #'+team.global_rank:''}</p>
      <p>Filosofia no jogo: {clubPhilosophy(club.reputation,team.academy,teams.some(item=>item.academy))}</p>
      <p>Força estimada: {strength===null?'—':strength.toLocaleString('pt-BR')}</p>
      <ul className="world-roster">{teamPlayers.map(player=><li key={player.id}>
        <PlayerPortrait index={player.portraitIndex}/><div><strong>{player.nickname}</strong><small>{roleNames[player.role]}</small></div><b>OVR {Math.round(player.overall)}</b>
      </li>)}</ul>
      {!teamPlayers.length&&<p>Elenco indisponível no catálogo.</p>}
    </section>}
  </>;

  return <>
    <div className="players-heading"><h1>{view==='leagues'?'Ligas e circuitos':'Organizações'}</h1>
      <button onClick={()=>{setClubId('');onNavigate(view==='leagues'?'organizations':'leagues');}}>
        {view==='leagues'?'Ver organizações':'Ligas e circuitos →'}
      </button>
    </div>
    <div className="panel world-filters">
      {view==='organizations'&&<input aria-label="Pesquisar organização" placeholder="Buscar organização ou sigla" value={filter.query} onChange={event=>update({query:event.target.value})}/>}
      <select aria-label="Modalidade" value={filter.mode} onChange={event=>update({mode:event.target.value,league:''})}>
        <option value="">Todas as modalidades</option><option value="MOBA">League of Legends</option><option value="FPS">Counter-Strike 2</option>
      </select>
      {view==='organizations'&&<>
        <select aria-label="País" value={filter.country} onChange={event=>update({country:event.target.value})}>
          <option value="">Todos os países</option>{countries.map(country=><option key={country} value={country}>{countryName(country)}</option>)}
        </select>
        <select aria-label="Liga ou circuito" value={filter.league} onChange={event=>update({league:event.target.value})}>
          <option value="">Todas as ligas e circuitos</option>{leagues.map(league=><option key={league.id} value={league.id}>{league.name}</option>)}
        </select>
        <select aria-label="Tier" value={filter.tier} onChange={event=>update({tier:Number(event.target.value)})}>
          <option value={0}>Todos os tiers</option><option value={1}>Tier 1</option><option value={2}>Tier 2</option>
        </select>
      </>}
    </div>
    {view==='leagues'&&careerLeague&&<section className="panel">
      <h2>Entrada de {career?.name}</h2>
      <p>{careerLeague.name} · {career?.entry?.kind==='open_circuit'?'Circuito aberto, sem classificação inicial':'Divisão de desenvolvimento'}</p>
      {displaced&&<p>A equipe ocupa a vaga de {displaced.name} nesta carreira. A lista de referência continua disponível abaixo.</p>}
    </section>}
    {view==='leagues'&&<section className="panel">
      <h2>Força estimada dos elencos</h2>
      <p>Estimativa pelos melhores atletas de cada função e pela profundidade do elenco. A classificação oficial permanece na referência de cada liga.</p>
      <button onClick={()=>setShowStrength(open=>!open)}>{showStrength?'Fechar ranking':'Ver ranking estimado'}</button>
      {showStrength&&<>
        <label>Modalidade<select value={strengthMode} onChange={event=>setStrengthMode(event.target.value)}>
          <option value="MOBA">League of Legends</option><option value="FPS">Counter-Strike 2</option>
        </select></label>
        <StrengthRanking catalog={catalog} players={players} mode={strengthMode}/>
      </>}
    </section>}
    {view==='leagues'?<div className="club-grid">{leagues.map(league=><article key={league.id}>
      <h2>{league.name}</h2><p>{league.season}</p>
      <p>{catalog.teams.filter(team=>team.league===league.id).length} equipes</p>
      <button onClick={()=>{setFilter({...defaults,league:league.id,mode:league.discipline});setPage(0);onNavigate('organizations');}}>Ver participantes</button>
      {league.source.startsWith('https://')&&<a className="league-source" href={league.source} target="_blank" rel="noreferrer">Fonte da referência ↗</a>}
    </article>)}</div>:<>
      {!matches.length&&<p>Nenhuma organização encontrada.</p>}
      <div className="club-grid">{matches.slice(activePage*pageSize,(activePage+1)*pageSize).map(org=><article key={org.id}>
        <ClubLogo club={org}/><h3>{org.name}</h3><p>{countryName(org.country)}</p>
        <button aria-label={'Abrir organização '+org.name} onClick={()=>openClub(org.id)}>Ver clube →</button>
      </article>)}</div>
      <footer><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>← Anterior</button>
        <span>{matches.length} organizações · Página {activePage+1}</span>
        <button disabled={(activePage+1)*pageSize>=matches.length} onClick={()=>setPage(activePage+1)}>Próxima →</button></footer>
    </>}
  </>;
}

function StrengthRanking({catalog,players,mode}:{catalog:WorldCatalog;players:Player[];mode:string}){
  const [page,setPage]=useState(0);
  const byTeam=new Map<string,Player[]>();
  for(const player of players){
    if(player.mode!==mode||!player.team)continue;
    const roster=byTeam.get(player.team)??[];
    roster.push(player);
    byTeam.set(player.team,roster);
  }
  const leagueNames=new Map(catalog.leagues.map(league=>[league.id,league.name]));
  const ranks=catalog.teams.flatMap(team=>{
    const score=estimatedStrength(byTeam.get(team.id)??[]);
    return score===null?[]:[{team,score}];
  }).sort((a,b)=>b.score-a.score||a.team.name.localeCompare(b.team.name,'pt-BR'));
  const current=Math.min(page,Math.max(0,Math.ceil(ranks.length/20)-1));
  return <div className="player-table">
    <table><thead><tr><th>Posição</th><th>Equipe</th><th>Liga</th><th>Força</th></tr></thead><tbody>
      {ranks.slice(current*20,current*20+20).map(({team,score},index)=><tr key={team.id}>
        <td>{current*20+index+1}</td><td>{team.name}</td><td>{leagueNames.get(team.league)}</td><td>{score.toLocaleString('pt-BR')}</td>
      </tr>)}
    </tbody></table>
    {!ranks.length&&<p>Elencos indisponíveis para avaliação.</p>}
    <footer><button disabled={current===0} onClick={()=>setPage(current-1)}>Anterior</button>
      <button disabled={(current+1)*20>=ranks.length} onClick={()=>setPage(current+1)}>Próxima</button></footer>
  </div>;
}
