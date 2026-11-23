import {MarketNegotiations} from './MarketNegotiations';
import {RosterContracts} from './RosterContracts';
import {transferValue} from '../game-core/market';
import {useState} from 'react';
import {PlayerPortrait} from './PlayerPortrait';
import {perkById,personalityNames,prospect} from '../game-core/traits';
import {playerCondition,athleteAge} from '../game-core/development';
import {formatCareerDay} from '../game-core/calendar';
import {rankedCountries,rankedStats} from '../game-core/ranked';
import {styleOf} from '../game-core/team-analysis';
import type {Career} from '../game-core/career';
import {type Contract,type Player} from '../game-core/recruitment';
import {currentPlayerSituation} from '../game-core/news';
import {useViewPreference} from './view-preferences';

export const money = (cents:number) => '$ '+(cents/100).toLocaleString('pt-BR');
const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});
function playerAge(player:Player,day:number){
  return athleteAge(player.birthDay,day);
}
export const roleNames: Record<string,string> = {
  top:'Top',jungle:'Jungle',mid:'Mid',adc:'ADC',support_moba:'Support',
  entry:'Entry Fragger',support_fps:'Support',awper:'AWPer',igl:'IGL',lurker:'Lurker',
};

export function Players({career,players,contracts,organizations,view,onFinish,onStarter,onUpdated,initialPlayerId}:{
  career:Career;
  players:Player[];
  contracts:Contract[];
  organizations:Record<string,string>;
  view:string;
  onFinish:(id:string)=>Promise<void>;
  onStarter:(id:number)=>Promise<void>;
  onUpdated:(career:Career)=>Promise<void>;
  initialPlayerId?:number|null;
}) {
  const scope=`${career.id}:${view}:`;
  const [search,setSearch]=useViewPreference(scope+'search','');
  const [page,setPage]=useState(0);
  const [offer,setOffer]=useState<Player|null>(null);
  const [busy,setBusy]=useState(false);
  const rankedView=view==='ranked';
  const [mode,setMode]=useViewPreference(scope+'mode',rankedView||view==='market'?career.mode:'');
  const [contractAction,setContractAction]=useState<{player:Player;action:'renew'|'sell'|'release'}|null>(null);
  const [availability,setAvailability]=useViewPreference(scope+'availability','');
  const [country,setCountry]=useViewPreference(scope+'country','');
  const [role,setRole]=useViewPreference(scope+'role','');
  const [rankedOnly,setRankedOnly]=useViewPreference(scope+'rankedOnly',false);
  const [sort,setSort]=useViewPreference(scope+'sort',rankedView?'points':'overall');
  const [ascending,setAscending]=useViewPreference(scope+'ascending',false);
  const [profileId,setProfileId]=useState<number|null>(initialPlayerId??null);
  const profile=players.find(player=>player.id===profileId)??null;
  const setProfile=(player:Player|null)=>setProfileId(player?.id??null);
  const [selected,setSelected]=useState<Player[]>([]);
  const [comparing,setComparing]=useState(false);
  const byPlayer=new Map(contracts.map(contract=>[contract.player_id,contract]));
  const sortValue=(player:Player)=>{
    switch(sort){
      case 'points':return rankedStats(player).points;
      case 'age':return playerAge(player,career.day);
      case 'salary':return byPlayer.get(player.id)?.salary??0;
      case 'value':return player.organization?transferValue(player):0;
      default:return player.overall;
    }
  };
  const filtered=players.filter(player=>{
    if(view==='roster' && player.mode!==career.mode) return false;
    if((view==='players'||rankedView||view==='market') && mode && player.mode!==mode) return false;
    if(rankedView&&(player.status!=='ranked'||(country&&player.country!==country)))return false;
    if(view==='players' && rankedOnly && player.status!=='ranked') return false;
    if(role && player.role!==role) return false;
    if(view==='roster' && (!byPlayer.has(player.id)||byPlayer.get(player.id)?.academy)) return false;
    if(view==='market' && (byPlayer.has(player.id) || player.status || (availability==='free'&&player.organization) || (availability==='club'&&!player.organization))) return false;
    const organization=player.organization ? organizations[player.organization] : '';
    return [player.nickname,player.name,roleNames[player.role],organization].join(' ').toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b)=>(ascending?1:-1)*(sortValue(a)-sortValue(b))||a.id-b.id);
  const rankById=new Map<number,number>();
  if(rankedView){
    const leaders=players.filter(player=>player.status==='ranked'&&player.mode===mode&&(!country||player.country===country))
      .sort((a,b)=>rankedStats(b).points-rankedStats(a).points||a.id-b.id);
    leaders.forEach((player,index)=>rankById.set(player.id,index+1));
  }
  const pageSize=8;
  const activePage=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));
  const condition=profile&&playerCondition(profile,career.day);
  return <>
    <div className="players-heading">
      <h1>{rankedView?'Ranked mundial':view==='roster'?'Elenco':view==='market'?'Mercado de transferências':'Jogadores'}</h1>
      {view==='players'&&<button className="primary" disabled={selected.length!==2} onClick={()=>{setProfile(null);setComparing(true);}}>
        Comparar ({selected.length}/2)
      </button>}
    </div>
    {view==='market'&&<p className="muted">Agentes livres e atletas de outros clubes · caixa disponível {money(career.balance)} · Sua modalidade: {career.mode}</p>}
    {rankedView&&<p className="muted">Pontos e taxa de vitória simulados nesta carreira.</p>}
    <div className="panel player-filters">
      <input aria-label="Buscar jogador" placeholder="Buscar nome, nickname ou organização…" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/>
      {(view==='players'||rankedView||view==='market')&&<select aria-label="Modalidade" value={mode} onChange={event=>{setMode(event.target.value);setRole('');setPage(0);}}>
        {!rankedView&&<option value="">Todas as modalidades</option>}<option value="MOBA">League of Legends</option><option value="FPS">Counter-Strike 2</option>
      </select>}
      {view==='market'&&<select aria-label="Situação contratual" value={availability} onChange={e=>{setAvailability(e.target.value);setPage(0);}}><option value="">Livres e contratados</option><option value="free">Agentes livres</option><option value="club">Contratados por clubes</option></select>}
      {rankedView&&<select aria-label="País da ranked" value={country} onChange={event=>{setCountry(event.target.value);setPage(0);}}>
        <option value="">Todos os países</option>
        {[...rankedCountries].sort((a,b)=>(regions.of(a)??a).localeCompare(regions.of(b)??b,'pt-BR')).map(code=><option key={code} value={code}>{regions.of(code)}</option>)}
      </select>}
      <select aria-label="Função" value={role} onChange={event=>{setRole(event.target.value);setPage(0);}}>
        <option value="">Todas as funções</option>
        {Object.entries(roleNames).filter(([key])=>players.some(player=>player.role===key&&(!mode||player.mode===mode)&&(view==='players'||rankedView||view==='market'||player.mode===career.mode)))
          .map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
      {view==='players'&&<label className="compare-choice"><input type="checkbox" checked={rankedOnly}
        onChange={event=>{setRankedOnly(event.target.checked);setPage(0);}}/> Apenas jovens da ranked</label>}
      <select aria-label="Ordenar jogadores" value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}>
        {rankedView&&<option value="points">Pontos da ranked</option>}
        <option value="overall">Overall</option><option value="age">Idade</option>
        {view==='roster'&&<option value="salary">Salário</option>}
        {view==='market'&&<option value="value">Valor estimado</option>}
      </select>
      <button onClick={()=>{setAscending(!ascending);setPage(0);}}>{ascending?'Menor primeiro ↑':'Maior primeiro ↓'}</button>
    </div>
    {profile&&<section className="panel profile-panel" aria-label="Perfil do jogador">
      <div className="profile-heading"><PlayerPortrait index={profile.portraitIndex}/><div><h2>{profile.nickname}</h2><p>{profile.name} · {roleNames[profile.role]} · {regions.of(profile.country)}</p></div><button onClick={()=>setProfile(null)}>Fechar perfil</button></div>
      <p>Organização/situação atual: {currentPlayerSituation(profile,contracts,organizations,career.name)}</p>
      <p>Overall {Math.round(profile.overall)} · Potencial estimado {profile.estimateLow??'—'}–{profile.estimateHigh??'—'}</p>
      <p>{prospect(playerAge(profile,career.day),profile.estimateLow,profile.estimateHigh,profile.overall)}
        {profile.personality?' · '+personalityNames[profile.personality]:''}</p>
      <p>Estilo de jogo · {styleOf(profile)}</p>
      {condition&&<p>Moral {Math.round(condition.morale)} · Forma {Math.round(condition.form)} · Fadiga {Math.round(condition.fatigue)}</p>}
      {!!profile.developmentHistory?.length&&<><h3>Evolução do Overall</h3>
        <ul>{profile.developmentHistory.slice(-6).reverse().map(point=><li key={point.day}>{formatCareerDay(point.day)} · {point.overall.toLocaleString('pt-BR')}</li>)}</ul>
      </>}
      <h3>Traços conhecidos</h3>
      {profile.perks?.length?<ul>{profile.perks.map(instance=>{
        const perk=perkById.get(instance.id);
        return perk?<li key={perk.id}><strong>{perk.name}</strong> · {perk.description}</li>:null;
      })}</ul>:<p className="muted">Nenhum traço conhecido.</p>}
      {!!profile.perkHistory?.length&&<><h3>Histórico de traços</h3><ul>{profile.perkHistory.map(entry=><li key={entry.day+entry.id}>
        {formatCareerDay(entry.day)} · {entry.action==='acquired'?'Ganhou':entry.action==='intensified'?'Intensificou':'Perdeu'} {perkById.get(entry.id)?.name??entry.id}
      </li>)}</ul></>}
      <dl className="profile-attributes">{Object.entries(profile.attributes).map(([key,value])=><div key={key}><dt>{attributeLabels[key.slice(key.indexOf('_')+1)]??key}</dt><dd>{Math.round(value)}</dd></div>)}</dl>
      {!!profile.history?.length&&<><h3>Histórico do atleta</h3><ul>{profile.history.map((entry,index)=><li key={index}>Dia {entry.day} · {entry.description}</li>)}</ul></>}
    </section>}
    {comparing&&selected.length===2&&<section className="panel profile-panel" aria-label="Comparação de jogadores">
      <div className="profile-heading"><h2>Comparação</h2><button onClick={()=>setComparing(false)}>Fechar comparação</button></div>
      <div className="player-table"><table>
        <thead><tr><th>Atributo</th>{selected.map(player=><th key={player.id}><PlayerPortrait index={player.portraitIndex}/><br/>{player.nickname} · {player.mode}</th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Overall</th>{selected.map(player=><td key={player.id}>{Math.round(player.overall)}</td>)}</tr>
          <tr><th scope="row">Potencial estimado</th>{selected.map(player=><td key={player.id}>{player.estimateLow===null?'—':`${player.estimateLow}–${player.estimateHigh}`}</td>)}</tr>
          {[...new Set(selected.flatMap(player=>Object.keys(player.attributes)))].map(key=><tr key={key}>
            <th scope="row">{attributeLabels[key.split('_').slice(1).join('_')]??key}{selected[0].mode!==selected[1].mode?' · '+key.split('_')[0].toUpperCase():''}</th>
            {selected.map(player=><td key={player.id}>{key in player.attributes?Math.round(player.attributes[key]):'—'}</td>)}
          </tr>)}
        </tbody>
      </table></div>
    </section>}
    {view==='market'&&<MarketNegotiations career={career} players={players} draft={offer} onClearDraft={()=>setOffer(null)} onFinish={onFinish}/>}
    {view==='roster'&&contractAction&&byPlayer.has(contractAction.player.id)&&<RosterContracts key={contractAction.player.id+contractAction.action}
      career={career} player={contractAction.player} contract={byPlayer.get(contractAction.player.id)!} action={contractAction.action}
      onClose={()=>setContractAction(null)} onUpdated={onUpdated}/>}
    <p className="muted">{filtered.length} jogadores encontrados</p>
    <div className="player-list">
      {filtered.slice(activePage*pageSize,activePage*pageSize+pageSize).map(player=>{
        const contract=byPlayer.get(player.id);
        const club=contract ? `${contract.academy?'Academy':contract.starter?'Titular':'Reserva'} · ${contract.salary?money(contract.salary)+'/mês':'Sem contrato no save original'}` : player.organization ? organizations[player.organization] : player.status==='ranked'?'Ranked · amador':player.status==='retired'?'Aposentado':'Livre';
        const age=playerAge(player,career.day);
        return <article className="player-row" key={player.id}>
          <PlayerPortrait index={player.portraitIndex}/>
          <div><strong>{rankedView?'#'+rankById.get(player.id)+' · ':''}{player.nickname} · {roleNames[player.role]}</strong><small>{player.name} · {age} anos · {regions.of(player.country)} · {club}</small></div>
          {rankedView&&<span>{rankedStats(player).points.toLocaleString('pt-BR')} {player.mode==='MOBA'?'PdL':'pts'} · {rankedStats(player).winRate.toLocaleString('pt-BR')}% vitórias</span>}
          <span className="muted">{player.mode}</span><strong>OVR {Math.round(player.overall)}</strong>
          <span className="muted">{player.estimateLow!==null?`POT. ${player.estimateLow}–${player.estimateHigh}`:'POT. —'}</span>
          {view==='players'&&<label className="compare-choice">
            <input type="checkbox" aria-label={'Selecionar '+player.nickname+' para comparação'}
              checked={selected.some(item=>item.id===player.id)}
              disabled={selected.length===2&&!selected.some(item=>item.id===player.id)}
              onChange={event=>{
                const add=event.target.checked;
                setComparing(false);
                setSelected(current=>add?[...current,player]:current.filter(item=>item.id!==player.id));
              }}/>
          </label>}
          <button aria-label={'Perfil de '+player.nickname} onClick={()=>{setComparing(false);setProfile(player);}}>Perfil →</button>
          {view==='roster'&&contract&&!contract.starter&&<button disabled={busy} onClick={async()=>{
            setBusy(true);
            try{await onStarter(player.id);}finally{setBusy(false);}
          }}>Escalar titular</button>}
          {view==='roster'&&contract&&<div className="contract-actions">
            {contract.salary>0&&<><small>Contrato até {formatCareerDay(contract.end_day)}</small><button onClick={()=>setContractAction({player,action:'renew'})}>Renovar</button></>}
            <button onClick={()=>setContractAction({player,action:'sell'})}>Vender</button><button onClick={()=>setContractAction({player,action:'release'})}>Dispensar</button>
          </div>}
          {view==='market'&&<div><small>Valor estimado: {player.organization?money(transferValue(player)):'Livre · sem taxa'}</small>
            <button disabled={player.mode!==career.mode} onClick={()=>setOffer(player)}>{player.mode===career.mode?'Negociar':'Outra modalidade'}</button></div>}
        </article>;
      })}
    {!filtered.length&&<p>Nenhum jogador encontrado.</p>}</div>
    <footer><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>← Anterior</button>
      <span>{filtered.length} jogadores · Página {activePage+1}</span>
      <button disabled={(activePage+1)*pageSize>=filtered.length} onClick={()=>setPage(activePage+1)}>Próxima →</button></footer>
  </>;
}

const attributeLabels:Record<string,string>={
  mechanics:'Mecânica',reflexes:'Reflexos',precision:'Precisão',execution:'Execução',control:'Controle',
  vision:'Visão',positioning:'Posicionamento',objectives:'Objetivos',map:'Mapa',decisions:'Decisões',
  reading:'Leitura de jogo',meta:'Meta',laning:'Fase de rotas',teamfights:'Confrontos coletivos',
  consistency:'Consistência',adaptation:'Adaptação',communication:'Comunicação',coordination:'Coordenação',
  teamwork:'Trabalho em equipe',leadership:'Liderança',aim:'Mira',recoil:'Recuo',movement:'Movimentação',
  reaction:'Reação',utility:'Utilitários',angles:'Ângulos',awareness:'Consciência situacional',
  space:'Controle de espaço',composure:'Compostura',
};
