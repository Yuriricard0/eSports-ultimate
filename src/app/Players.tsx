import {MarketNegotiations} from './MarketNegotiations';
import {Loans} from './Loans';
import {RankedHistory} from './RankedWatch';
import {ScoutingReports,SoloQueueSeasons} from './SoloQueue';
import type {RankedObservation} from '../game-core/talent-development';
import {isMobaImport,regionalPolicies,type MobaRegion} from '../game-core/moba-eligibility';
import {usageLabel,type MarketUsage} from '../game-core/market-overview';
import {listContractAlerts,listImportRegion,listIncomingApproaches,listRankedWatch,loadMarketOverview,setMarketTarget,setRankedWatch} from '../persistence/repository';
import {squadRoleNames,type ContractAlert} from '../game-core/contract-expectations';
import type {Approach} from '../game-core/market-interest';
import {RosterContracts} from './RosterContracts';
import {transferValue} from '../game-core/market';
import {useEffect,useState} from 'react';
import {PlayerPortrait} from './PlayerPortrait';
import {PlayerProfilePanel} from './PlayerProfilePanel';
import {attributeLabels,roleNames} from './player-labels';
import {personalObjectiveNames} from '../game-core/player-identity';
import {recentTrend} from '../game-core/player-analysis';
import {RosterTools} from './RosterTools';
import {athleteAge} from '../game-core/development';
import {formatCareerDay} from '../game-core/calendar';
import {rankedCountries,rankedStats} from '../game-core/ranked';
import type {Career} from '../game-core/career';
import {type Contract,type Player} from '../game-core/recruitment';
import {currentPlayerSituation} from '../game-core/news';
import {useViewPreference} from './view-preferences';

export const money = (cents:number) => '$ '+(cents/100).toLocaleString('pt-BR');
const regions=new Intl.DisplayNames(['pt-BR'],{type:'region'});
function playerAge(player:Player,day:number){
  return athleteAge(player.birthDay,day);
}
export {roleNames} from './player-labels';

export function Players({career,players,contracts,organizations,view,onFinish,onStarter,onUpdated,initialPlayerId,initialScouting=false}:{
  career:Career;
  players:Player[];
  contracts:Contract[];
  organizations:Record<string,string>;
  view:string;
  onFinish:(id:string)=>Promise<void>;
  onStarter:(id:number)=>Promise<void>;
  onUpdated:(career:Career)=>Promise<void>;
  initialPlayerId?:number|null;
  initialScouting?:boolean;
}) {
  const scope=`${career.id}:${view}:`;
  const [search,setSearch]=useViewPreference(scope+'search','');
  const [page,setPage]=useState(0);
  const [offer,setOffer]=useState<Player|null>(null);
  const [busy,setBusy]=useState(false);
  const [incoming,setIncoming]=useState<Approach[]>([]);
  const [alerts,setAlerts]=useState<ContractAlert[]>([]);
  const [importRegion,setImportRegion]=useState<MobaRegion|null>(null);
  const [incomingRevision,setIncomingRevision]=useState(0);
  useEffect(()=>{
    if(view!=='roster')return;
    let active=true;
    listIncomingApproaches(career.id).then(rows=>{if(active)setIncoming(rows);}).catch(()=>{if(active)setIncoming([]);});
    listContractAlerts(career.id).then(rows=>{if(active)setAlerts(rows);}).catch(()=>{if(active)setAlerts([]);});
    if(career.mode==='MOBA')listImportRegion(career.id).then(region=>{if(active)setImportRegion(region);}).catch(()=>{if(active)setImportRegion(null);});
    return()=>{active=false;};
  },[view,career,incomingRevision]);
  const rankedView=view==='ranked';
  const [watch,setWatch]=useState<{ids:number[];history:RankedObservation[]}|null>(null);
  const [watchOnly,setWatchOnly]=useState(false);
  const [scouting,setScouting]=useState(initialScouting);
  const [watchBusy,setWatchBusy]=useState(false);
  const [watchError,setWatchError]=useState('');
  useEffect(()=>{
    if(!rankedView)return;
    let active=true;
    listRankedWatch(career.id).then(value=>{if(active)setWatch(value);}).catch(reason=>{if(active)setWatchError(String(reason));});
    return()=>{active=false;};
  },[career,rankedView]);
  const watchedIds=new Set(watch?.ids);
  const [mode,setMode]=useViewPreference(scope+'mode',rankedView||view==='market'?career.mode:'');
  const [contractAction,setContractAction]=useState<{player:Player;action:'renew'|'sell'|'release'}|null>(null);
  const [availability,setAvailability]=useViewPreference(scope+'availability','');
  const [country,setCountry]=useViewPreference(scope+'country','');
  const [role,setRole]=useViewPreference(scope+'role','');
  const [rankedOnly,setRankedOnly]=useViewPreference(scope+'rankedOnly',false);
  const [rising,setRising]=useViewPreference(scope+'rising',false);
  const [sort,setSort]=useViewPreference(scope+'sort',rankedView?'points':'overall');
  const [ascending,setAscending]=useViewPreference(scope+'ascending',false);
  const [profileId,setProfileId]=useState<number|null>(initialPlayerId??null);
  const profile=players.find(player=>player.id===profileId)??null;
  const setProfile=(player:Player|null)=>setProfileId(player?.id??null);
  const profilePanel=profile&&<PlayerProfilePanel key={profile.id} player={profile} players={players} career={career} contracts={contracts} organizations={organizations} startFull={profile.id===initialPlayerId} onClose={()=>setProfile(null)}/>;
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
  const gains=new Map<number,number>();
  const risingView=rankedView&&!watchOnly&&rising;
  const filtered=players.filter(player=>{
    if(view==='roster' && player.mode!==career.mode) return false;
    if((view==='players'||rankedView||view==='market') && mode && player.mode!==mode) return false;
    if(rankedView&&(watchOnly?!watchedIds.has(player.id):player.status!=='ranked'||(country&&player.country!==country)))return false;
    if(view==='players' && rankedOnly && player.status!=='ranked') return false;
    if(role && player.role!==role) return false;
    if(view==='roster' && (!byPlayer.has(player.id)||byPlayer.get(player.id)?.academy)) return false;
    if(view==='market' && (byPlayer.has(player.id) || player.status || player.onLoan || (availability==='free'&&player.organization) || (availability==='club'&&!player.organization))) return false;
    const organization=player.organization ? organizations[player.organization] : '';
    if(![player.nickname,player.name,roleNames[player.role],organization].join(' ').toLowerCase().includes(search.trim().toLowerCase()))return false;
    if(!risingView)return true;
    const trend=recentTrend(player.developmentHistory,player.overall,career.day);
    if(!trend||trend.change<0.5)return false;
    gains.set(player.id,trend.change);
    return true;
  }).sort((a,b)=>risingView?gains.get(b.id)!-gains.get(a.id)!||b.overall-a.overall||b.birthDay-a.birthDay||a.id-b.id:
    (ascending?1:-1)*(sortValue(a)-sortValue(b))||a.id-b.id);
  const rankById=new Map<number,number>();
  if(rankedView){
    const leaders=players.filter(player=>player.status==='ranked'&&player.mode===mode&&(watchOnly||!country||player.country===country))
      .sort((a,b)=>rankedStats(b).points-rankedStats(a).points||a.id-b.id);
    leaders.forEach((player,index)=>rankById.set(player.id,index+1));
  }
  const market=view==='market';
  const [overview,setOverview]=useState<{targets:number[];usage:Array<[number,MarketUsage]>}|null>(null);
  const [marketError,setMarketError]=useState('');
  const [targetsOnly,setTargetsOnly]=useState(false);
  const [showNegotiations,setShowNegotiations]=useState(false);
  const [showLoans,setShowLoans]=useState(false);
  const [quickId,setQuickId]=useState<number|null>(null);
  const [savingTarget,setSavingTarget]=useState(false);
  useEffect(()=>{
    if(!market)return;
    let active=true;
    loadMarketOverview(career.id).then(data=>{if(active){setOverview(data);setMarketError('');}})
      .catch(()=>{if(active)setMarketError('Não foi possível carregar os dados do mercado.');});
    return()=>{active=false;};
  },[market,career.id,career.day]);
  const targets=new Set(overview?.targets??[]);
  const usage=new Map(overview?.usage??[]);
  const marketRows=market&&targetsOnly?players.filter(player=>targets.has(player.id)):filtered;
  const toggleTarget=async(player:Player)=>{
    if(savingTarget||!overview)return;
    setSavingTarget(true);setMarketError('');
    try{
      const ids=await setMarketTarget(career.id,player.id,!targets.has(player.id));
      setOverview(current=>current?{...current,targets:ids}:current);
    }catch(reason){setMarketError(String(reason));}
    finally{setSavingTarget(false);}
  };
  const targetButton=(player:Player)=><button type="button" className="market-target" aria-pressed={targets.has(player.id)}
    aria-label={(targets.has(player.id)?'Remover alvo ':'Adicionar alvo ')+player.nickname}
    disabled={!overview||savingTarget} onClick={()=>void toggleTarget(player)}>{targets.has(player.id)?'★':'☆'}</button>;
  const opportunities=market&&!targetsOnly?filtered.filter(player=>player.mode===career.mode).flatMap(player=>{
    const record=usage.get(player.id);
    const lowUsage=usageLabel(record);
    const fee=player.organization?transferValue(player):0;
    if(fee>career.balance)return [];
    const age=playerAge(player,career.day);
    const reason=!player.organization?'Agente livre · sem taxa de transferência':
      record&&record.played>=3&&record.impact>=2?'Boa fase · participação e desempenho recentes':
      lowUsage?lowUsage+' · '+record!.played+' de '+record!.available+' séries':
      age<=22&&fee<=career.balance/4?'Jovem com taxa estimada de até 25% do caixa':'';
    return reason?[{player,reason}]:[];
  }):[];
  const featured=opportunities.filter((item,index)=>opportunities.findIndex(candidate=>candidate.reason.split(' · ')[0]===item.reason.split(' · ')[0])===index).slice(0,3);
  const quick=market?marketRows.find(player=>player.id===quickId)??marketRows[0]:undefined;
  const quickContract=quick?byPlayer.get(quick.id):undefined;
  const pageSize=8;
  const activePage=Math.min(page,Math.max(0,Math.ceil(marketRows.length/pageSize)-1));
  const marketToolbar=<div className="market-toolbar">
    <button aria-pressed={!showLoans&&!showNegotiations&&!offer&&!targetsOnly} onClick={()=>{setShowLoans(false);setOffer(null);setShowNegotiations(false);setTargetsOnly(false);setPage(0);}}>Visão geral</button>
    <button aria-pressed={!showLoans&&!showNegotiations&&!offer&&targetsOnly} onClick={()=>{setShowLoans(false);setOffer(null);setShowNegotiations(false);setTargetsOnly(true);setPage(0);}}>Alvos ({targets.size})</button>
    <button aria-pressed={!showLoans&&(showNegotiations||!!offer)} onClick={()=>{setShowLoans(false);setShowNegotiations(true);}}>Negociações</button>
    <button aria-pressed={showLoans} onClick={()=>{setOffer(null);setShowLoans(true);}}>Empréstimos</button>
    <strong>Caixa disponível {money(career.balance)}</strong>
  </div>;
  if(market&&showLoans)return <div className="market-negotiations-page">
    <h1>Mercado de transferências</h1>{marketToolbar}<Loans career={career} players={players} contracts={contracts} onUpdated={onUpdated}/>
  </div>;
  if(market&&(showNegotiations||offer))return <div className="market-negotiations-page">
    <h1>Mercado de transferências</h1>
    {marketToolbar}
    <MarketNegotiations career={career} players={players} contracts={contracts} draft={offer} onClearDraft={()=>setOffer(null)} onFinish={onFinish}
      onUpdated={onUpdated} onSent={()=>setShowNegotiations(true)}/>
  </div>;
  return <div className={market?'market-workspace':undefined}>
    <div className="players-heading market-heading">
      <h1>{rankedView?'Ranked mundial':view==='roster'?'Elenco':view==='market'?'Mercado de transferências':'Jogadores'}</h1>
      {view==='players'&&<button className="primary" disabled={selected.length!==2} onClick={()=>{setProfile(null);setComparing(true);}}>
        Comparar ({selected.length}/2)
      </button>}
    </div>
    {market&&marketToolbar}
    {marketError&&market&&<p className="market-error" role="alert">{marketError}</p>}
    {rankedView&&<p className="muted">Pontos e taxa de vitória simulados nesta carreira.</p>}
    {rankedView&&<div className="market-toolbar">
      <button aria-pressed={!scouting&&!watchOnly} onClick={()=>{setScouting(false);setWatchOnly(false);setPage(0);}}>Classificação</button>
      <button aria-pressed={!scouting&&watchOnly} onClick={()=>{setScouting(false);setWatchOnly(true);setPage(0);}}>Observados ({watchedIds.size})</button>
      <button aria-pressed={scouting} onClick={()=>setScouting(true)}>Scouting</button>
    </div>}
    {watchError&&rankedView&&<p role="alert">{watchError}</p>}
    {rankedView&&scouting?<>{profilePanel}<ScoutingReports players={players} history={watch?.history??[]} onPlayer={setProfile}/></>:<>
    {rankedView&&!watchOnly&&<SoloQueueSeasons careerId={career.id} day={career.day} players={players} mode={mode} onPlayer={setProfile}/>}
    {view==='roster'&&<RosterTools career={career} players={players} contracts={contracts} roleNames={roleNames} attributeLabels={attributeLabels} onUpdated={onUpdated}/>}
    {view==='roster'&&importRegion&&<p>Vagas de importados nos titulares · {players.filter(player=>byPlayer.get(player.id)?.starter&&isMobaImport(player,importRegion)).length}/{regionalPolicies[importRegion].limit}</p>}
    {view==='roster'&&alerts.length>0&&<section className="panel" aria-label="Vencimentos contratuais">
      <h2>Vencimentos contratuais</h2>
      <ul>{alerts.map(alert=>{
        const athlete=players.find(player=>player.id===alert.player_id);
        return <li key={alert.player_id+':'+alert.start_day}>{alert.level} · {athlete?.nickname??'Atleta '+alert.player_id} · {formatCareerDay(alert.end_day)}
          {athlete&&byPlayer.has(athlete.id)&&<button onClick={()=>setContractAction({player:athlete,action:'renew'})}>Revisar contrato</button>}
        </li>;
      })}</ul>
    </section>}
    <div className="panel player-filters market-filters">
      {market&&<h2>Buscar e filtrar</h2>
      }
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
      {rankedView&&!watchOnly&&<label className="compare-choice"><input type="checkbox" aria-label="Em ascensão" checked={rising} onChange={event=>{setRising(event.target.checked);setPage(0);}}/> Em ascensão</label>}
      {!risingView&&<><select aria-label="Ordenar jogadores" value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}>
        {rankedView&&<option value="points">Pontos da ranked</option>}
        <option value="overall">Overall</option><option value="age">Idade</option>
        {view==='roster'&&<option value="salary">Salário</option>}
        {view==='market'&&<option value="value">Valor estimado</option>}
      </select>
      <button onClick={()=>{setAscending(!ascending);setPage(0);}}>{ascending?'Menor primeiro ↑':'Maior primeiro ↓'}</button></>}
      {market&&<button onClick={()=>{setSearch('');setMode('');setRole('');setAvailability('');setSort('overall');setAscending(false);setPage(0);}}>Limpar filtros</button>}
    </div>
    <div className={market?'market-center':undefined}>
    {market&&!targetsOnly&&<section className="panel market-opportunities"><h2>Oportunidades de mercado</h2>
      {featured.length===0&&<p className="muted">Nenhuma oportunidade para os filtros atuais.</p>}
      <div className="market-opportunity-grid">{featured.map(({player,reason})=><button key={player.id} onClick={()=>setQuickId(player.id)}>
        <PlayerPortrait index={player.portraitIndex}/><span><strong>{player.nickname}</strong><small>{roleNames[player.role]} · OVR {Math.round(player.overall)}</small><small>{reason}</small></span>
      </button>)}</div>
    </section>}
    {profilePanel}
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
    {view==='roster'&&incoming.length>0&&<section className="panel" aria-label="Propostas recebidas">
      <h2>Propostas recebidas</h2>
      {incoming.map(row=>{
        const athlete=players.find(player=>player.id===row.playerId);
        return athlete&&byPlayer.has(athlete.id)?<button key={row.organization+':'+row.playerId} onClick={()=>setContractAction({player:athlete,action:'sell'})}>
          {row.name} quer contratar {athlete.nickname} · {money(row.fee)}
        </button>:null;
      })}
    </section>}
    {view==='roster'&&contractAction&&byPlayer.has(contractAction.player.id)&&<RosterContracts key={contractAction.player.id+contractAction.action}
      career={career} player={contractAction.player} contract={byPlayer.get(contractAction.player.id)!} action={contractAction.action}
      onClose={()=>{setContractAction(null);setIncomingRevision(value=>value+1);}} onUpdated={onUpdated}/>}
    <p className="muted">{marketRows.length} {market&&targetsOnly?'alvos acompanhados':'jogadores encontrados'}</p>
    <div className="player-list">
      {marketRows.slice(activePage*pageSize,activePage*pageSize+pageSize).map(player=>{
        const contract=byPlayer.get(player.id);
        const club=contract ? `${contract.academy?'Academy':contract.starter?'Titular':'Reserva'} · ${contract.salary?money(contract.salary)+'/mês':'Sem contrato no save original'}` : player.organization ? organizations[player.organization] : player.status==='ranked'?'Ranked · amador':player.status==='retired'?'Aposentado':'Livre';
        const age=playerAge(player,career.day);
        return <article className="player-row" key={player.id} data-selected={market&&quick?.id===player.id}>
          {market&&targetButton(player)}
          {market&&<button onClick={()=>setQuickId(player.id)} aria-label={'Prévia de '+player.nickname}>Ver</button>}
          <PlayerPortrait index={player.portraitIndex}/>
          <div><strong>{rankedView&&!watchOnly?'#'+rankById.get(player.id)+' · ':''}{player.nickname} · {roleNames[player.role]}</strong><small>{player.name} · {age} anos · {regions.of(player.country)} · {club}</small>{market&&usageLabel(usage.get(player.id))&&<small>{usageLabel(usage.get(player.id))}</small>}</div>
          {rankedView&&player.status==='ranked'&&<span>{rankedStats(player).points.toLocaleString('pt-BR')} {player.mode==='MOBA'?'PdL':'pts'} · {rankedStats(player).winRate.toLocaleString('pt-BR')}% vitórias</span>}
          {rankedView&&<button disabled={watchBusy||!watch} onClick={async()=>{
            setWatchBusy(true);setWatchError('');
            try{setWatch(await setRankedWatch(career.id,player.id,!watchedIds.has(player.id)));}
            catch(reason){setWatchError(String(reason));}
            finally{setWatchBusy(false);}
          }}>{watchedIds.has(player.id)?'Parar de observar':'Observar talento'}</button>}
          {rankedView&&watchedIds.has(player.id)&&<details className="ranked-watch-details"><summary>Histórico de scouting</summary>
            <RankedHistory history={watch?.history.filter(row=>row.player_id===player.id)??[]} currentPosition={watchOnly||!country?rankById.get(player.id):undefined}/>
          </details>}
          <span className="muted">{player.mode}</span><strong>OVR {Math.round(player.overall)}</strong>
          {risingView&&<span>+{gains.get(player.id)!.toLocaleString('pt-BR')} OVR recente</span>}
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
          <button aria-label={'Perfil de '+player.nickname} onClick={()=>{setComparing(false);if(market)setQuickId(player.id);setProfile(player);}}>Perfil →</button>
          {view==='roster'&&contract&&!contract.starter&&<button disabled={busy} onClick={async()=>{
            setBusy(true);
            try{await onStarter(player.id);}finally{setBusy(false);}
          }}>Escalar titular</button>}
          {view==='roster'&&contract&&<div className="contract-actions">
            {contract.loan&&<small>Emprestado até {formatCareerDay(contract.end_day)}</small>}
            {importRegion&&player.mode==='MOBA'&&<small>{isMobaImport(player,importRegion)?'Importado':'Residente competitivo'}</small>}
            {contract.salary>0&&<><small>Contrato até {formatCareerDay(contract.end_day)}{contract.squad_role?' · Papel prometido: '+squadRoleNames[contract.squad_role]:''}</small><button onClick={()=>setContractAction({player,action:'renew'})}>Renovar</button></>}
            {!contract.loan&&<><button onClick={()=>setContractAction({player,action:'sell'})}>Vender</button><button onClick={()=>setContractAction({player,action:'release'})}>Dispensar</button></>}
          </div>}
          {view==='market'&&<div><small>Valor estimado: {player.organization?money(transferValue(player)):'Livre · sem taxa'}</small>
            <button disabled={player.mode!==career.mode||player.onLoan||!!player.status||byPlayer.has(player.id)} onClick={()=>setOffer(player)}>{player.onLoan?'Em empréstimo':player.mode===career.mode?'Negociar':'Outra modalidade'}</button></div>}
        </article>;
      })}
    {!marketRows.length&&<p>{risingView?'Nenhum atleta com histórico suficiente e ganho de pelo menos 0,5 Overall nos últimos 30 a 90 dias para estes filtros.':'Nenhum jogador encontrado.'}</p>}</div>
    <footer><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>← Anterior</button>
      <span>{marketRows.length} jogadores · Página {activePage+1}</span>
      <button disabled={(activePage+1)*pageSize>=marketRows.length} onClick={()=>setPage(activePage+1)}>Próxima →</button></footer>
    </div>
    {market&&<section className="panel market-quick">
      <h2>Perfil do jogador</h2>
      {quick?<><div className="market-quick-portrait"><PlayerPortrait index={quick.portraitIndex}/></div>
        <h3>{quick.nickname}</h3><p>{quick.mode} · {roleNames[quick.role]} · OVR {Math.round(quick.overall)}</p>
        <p>{quickContract?'Sua organização':quick.organization?organizations[quick.organization]??quick.organization:quick.status==='retired'?'Aposentado':quick.status==='ranked'?'Ranked · amador':'Agente livre'}</p>
        {!quickContract&&!quick.status&&<p>{quick.organization?'Valor estimado '+money(transferValue(quick)):'Sem taxa de transferência'}</p>}
        <p>{quickContract?.end_day?'Contrato até '+formatCareerDay(quickContract.end_day):quickContract||quick.organization?'Vencimento contratual indisponível':'Sem vínculo ativo conhecido'}</p>
        {usage.get(quick.id)&&<p>{usageLabel(usage.get(quick.id))||'Participação recente'} · {usage.get(quick.id)!.played} de {usage.get(quick.id)!.available} séries</p>}
        {targetButton(quick)} <button onClick={()=>setProfile(quick)}>Ver perfil</button>
        <button className="primary" disabled={quick.mode!==career.mode||!!quick.status||quick.onLoan||byPlayer.has(quick.id)} onClick={()=>setOffer(quick)}>Negociar</button>
      </>:<p className="muted">Selecione um atleta para ver os detalhes.</p>}
    </section>}
    </>}
  </div>;
}
