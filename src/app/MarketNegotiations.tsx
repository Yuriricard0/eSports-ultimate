import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Negotiation,Offer} from '../game-core/negotiation';
import type {Approach} from '../game-core/market-interest';
import {terms,type Contract,type Player} from '../game-core/recruitment';
import {formatCareerDay} from '../game-core/calendar';
import {cancelOffer,declineApproach,declineRenewal,leaveRoster,listIncomingApproachHistory,listNegotiations,listRenewalRequests,sendOffer} from '../persistence/repository';
import {listMarketMoves,type MarketMove} from '../persistence/repository';
import {sellerAskingPrice,transferValue} from '../game-core/market';
import {contractCost,squadRoleExpectations,squadRoleNames,type RenewalRequest,type SquadRole} from '../game-core/contract-expectations';
import {RosterContracts} from './RosterContracts';
import {ReinforcementPreview,SigningPresentation} from './Reinforcement';

const money=(cents:number)=>'$ '+(cents/100).toLocaleString('pt-BR',{maximumFractionDigits:2});
const labels:Record<Negotiation['state'],string>={
  accepted:'Aceita',counter:'Contraproposta',rejected:'Recusada',expired:'Expirada',cancelled:'Cancelada',signed:'Assinada',
};
const incomingLabels:Record<Approach['state'],string>={open:'Aguardando sua resposta',declined:'Recusada',signed:'Concluída',expired:'Expirada'};
const filters=['Todas','Recebidas','Enviadas','Aguardando resposta','Contrapropostas','Vencem em até 3 dias','Concluídas','Recusadas ou expiradas'] as const;

export function MarketNegotiations({career,players,contracts,draft,onClearDraft,onFinish,onUpdated,onSent}:{
  career:Career;players:Player[];contracts:Contract[];draft:Player|null;onClearDraft:()=>void;onFinish:(id:string)=>Promise<void>;
  onUpdated:(career:Career)=>Promise<void>;onSent:()=>void;
}){
  const [negotiations,setNegotiations]=useState<Negotiation[]>([]);
  const [incoming,setIncoming]=useState<Approach[]>([]);
  const [filter,setFilter]=useState<typeof filters[number]>('Todas');
  const [reply,setReply]=useState<Negotiation|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [moves,setMoves]=useState<MarketMove[]>([]);
  const [renewals,setRenewals]=useState<RenewalRequest[]>([]);
  const [renewing,setRenewing]=useState<RenewalRequest|null>(null);
  const [signedPlayerId,setSignedPlayerId]=useState<number|null>(null);
  const [showPresentation,setShowPresentation]=useState(false);
  useEffect(()=>{
    let active=true;
    listNegotiations(career.id).then(rows=>{if(active)setNegotiations(rows);}).catch(reason=>{if(active)setError(String(reason));});
    listIncomingApproachHistory(career.id).then(rows=>{if(active)setIncoming(rows);}).catch(reason=>{if(active)setError(String(reason));});
    listMarketMoves(career.id).then(rows=>{if(active)setMoves(rows);}).catch(reason=>{if(active)setError(String(reason));});
    listRenewalRequests(career.id).then(rows=>{if(active)setRenewals(rows);}).catch(reason=>{if(active)setError(String(reason));});
    return()=>{active=false;};
  },[career]);
  const nicknames=new Map(players.map(player=>[player.id,player.nickname]));
  const signedPlayer=players.find(player=>player.id===signedPlayerId);
  const open=(row:Negotiation)=>row.state==='accepted'||row.state==='counter';
  const matches=(direction:'Recebidas'|'Enviadas',pending:boolean,counter:boolean,expires:number,state:string)=>{
    switch(filter){
      case 'Recebidas':case 'Enviadas':return filter===direction;
      case 'Aguardando resposta':return pending;
      case 'Contrapropostas':return counter;
      case 'Vencem em até 3 dias':return pending&&expires-career.day<=3;
      case 'Concluídas':return state==='signed';
      case 'Recusadas ou expiradas':return ['declined','rejected','expired'].includes(state);
      default:return true;
    }
  };
  const rows=negotiations.map(row=>open(row)&&row.expires_day<career.day?{...row,state:'expired' as const}:row)
    .filter(row=>matches('Enviadas',open(row),row.state==='counter',row.expires_day,row.state));
  const received=incoming.filter(row=>matches('Recebidas',row.state==='open',false,row.expires,row.state));
  const formPlayer=draft??players.find(player=>player.id===reply?.player_id);
  const renewalPlayer=renewing?players.find(player=>player.id===renewing.player_id):undefined;
  const renewalContract=renewing?contracts.find(contract=>contract.player_id===renewing.player_id&&contract.start_day===renewing.start_day):undefined;
  const closeForm=()=>{setReply(null);onClearDraft();};
  const run=async(action:()=>Promise<unknown>,message:string)=>{
    setBusy(true);
    setError('');
    setNotice('');
    try{
      await action();
      const [sent,received,completed,requests]=await Promise.all([listNegotiations(career.id),listIncomingApproachHistory(career.id),listMarketMoves(career.id),listRenewalRequests(career.id)]);
      setNegotiations(sent);setIncoming(received);setMoves(completed);setRenewals(requests);setNotice(message);
    }
    catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setBusy(false);}
  };
  return <>
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {signedPlayer&&(showPresentation
      ?<SigningPresentation career={career} player={signedPlayer} onClose={()=>{setSignedPlayerId(null);setShowPresentation(false);}}/>
      :<button className="signing-open" onClick={()=>setShowPresentation(true)}>Ver apresentação de {signedPlayer.nickname}</button>)}
    {renewing&&renewalPlayer&&renewalContract&&<RosterContracts key={renewing.player_id+':'+renewing.day}
      career={career} player={renewalPlayer} contract={renewalContract} action="renew" suggestedSalary={renewing.suggested_salary}
      onClose={()=>setRenewing(null)} onUpdated={async updated=>{
        await onUpdated(updated);
        setRenewals(await listRenewalRequests(career.id));
      }}/>}
    {!!renewals.length&&<section className="panel market-offers">
      <h2>Pedidos de renovação</h2>
      {renewals.map(row=><details key={row.player_id+':'+row.start_day+':'+row.day}>
        <summary>{nicknames.get(row.player_id)??'Atleta '+row.player_id} · {formatCareerDay(row.day)}</summary>
        <p>Evoluiu {row.gain.toLocaleString('pt-BR')} pontos de Overall e disputou {row.played} de {row.available} séries oficiais avaliadas.</p>
        <p>Salário de referência {money(row.suggested_salary)} a cada 30 dias.</p>
        <button disabled={busy} onClick={()=>setRenewing(row)}>Revisar contrato</button>
        <button disabled={busy} onClick={()=>void run(()=>declineRenewal(career.id,row),'Pedido de renovação recusado.')}>Recusar pedido</button>
      </details>)}
    </section>}
    {formPlayer&&<OfferForm key={reply?.id??formPlayer.id} player={formPlayer} busy={busy} balance={career.balance} reply={reply} askingFee={sellerAskingPrice(formPlayer,players)}
      preview={offer=><ReinforcementPreview career={career} players={players} contracts={contracts} player={formPlayer} offer={offer}/>}
      cancel={closeForm} submit={offer=>run(async()=>{
        await sendOffer(career.id,formPlayer.id,offer,reply?.id);
        setFilter('Enviadas');
        onSent();
        closeForm();
      },'Proposta registrada. Confira a resposta nas negociações.')}/>}
    <section className="panel">
      <div className="players-heading"><h2>Central de negociações</h2>
        <label>Mostrar <select aria-label="Filtrar negociações" value={filter} onChange={event=>setFilter(event.target.value as typeof filter)}>
          {filters.map(option=><option key={option}>{option}</option>)}
        </select></label></div>
      {!rows.length&&!received.length&&<p className="muted">Nenhuma negociação neste filtro.</p>}
      <div className="market-offers">
      {received.map(row=><details key={row.team+':'+row.playerId+':'+row.day}>
        <summary>{nicknames.get(row.playerId)??'Atleta '+row.playerId} · Recebida · {incomingLabels[row.state]}</summary>
        <p>{row.name} · {row.state==='signed'?'Valor efetivo':'Preço oferecido'} {money(row.fee)}</p>
        <p>Prazo {formatCareerDay(row.expires)}</p>
        {row.state==='open'&&row.expires>=career.day&&<>
          <button className="primary" disabled={busy} onClick={()=>void run(async()=>onUpdated(await leaveRoster(career.id,row.playerId,row.team,row.day)),'Transferência concluída.')}>Aceitar e vender</button>
          <button disabled={busy} onClick={()=>void run(()=>declineApproach(career.id,row.playerId,row.team,row.day),'Proposta recusada.')}>Recusar proposta</button>
        </>}
      </details>)}
      {rows.map(row=>{
        const counterTerms=row.state==='counter'||(row.state==='signed'&&row.counter_salary>0);
        const bonus=counterTerms?row.counter_bonus:row.bonus;
        const salary=counterTerms?row.counter_salary:row.salary;
        const candidate=open(row)?players.find(player=>player.id===row.player_id):undefined;
        const offer={bonus,salary,days:row.days,transferFee:row.transfer_fee};
        return <details key={row.id}>
          <summary>{nicknames.get(row.player_id)??'Atleta '+row.player_id} · Enviada · {labels[row.state]}</summary>
          <p>{row.reason}</p>
          <p>Luvas {money(bonus)} · Salário {money(salary)} a cada 30 dias · {row.days} dias</p>
          {row.squad_role&&<p>Papel prometido: {squadRoleNames[row.squad_role]}</p>}
          {!!row.estimated_fee&&<p>Valor estimado na proposta {money(row.estimated_fee)} · Preço solicitado {money(row.asking_fee??row.estimated_fee)}</p>}
          {!!row.transfer_fee&&row.state!=='rejected'&&<p>{row.state==='signed'?'Valor efetivo':'Taxa a pagar na assinatura'} {money(row.transfer_fee)}</p>}
          {(open(row)||row.state==='signed')&&<CostSummary offer={offer}/>}
          {candidate&&<ReinforcementPreview career={career} players={players} contracts={contracts} player={candidate} offer={offer}/>}
          <p>Prazo {formatCareerDay(row.expires_day)}</p>
          {open(row)&&<>
            <button className="primary" disabled={busy||career.day>row.expires_day} onClick={()=>void run(async()=>{
              await onFinish(row.id);
              setSignedPlayerId(row.player_id);
              setShowPresentation(false);
            },'Contrato assinado. O atleta já está no elenco.')}>
              {row.state==='counter'?'Aceitar contraproposta e assinar':'Assinar contrato'}
            </button>
            {row.state==='counter'&&<button disabled={busy||!nicknames.has(row.player_id)} onClick={()=>{onSent();onClearDraft();setReply(row);}}>Responder com novos valores</button>}
            <button disabled={busy} onClick={()=>void run(()=>cancelOffer(career.id,row.id),'Negociação cancelada.')}>Cancelar negociação</button>
          </>}
        </details>;
      })}</div>
    </section>
    {!!moves.length&&<section className="panel"><h2>Movimentações concluídas</h2><ul>{moves.slice(0,20).map((move,index)=><li key={index}>
      {formatCareerDay(move.day)} · {nicknames.get(move.player_id)??move.player_id} · {move.description}
      {move.amount!==0?' · Valor efetivo '+money(Math.abs(move.amount)):''}
    </li>)}</ul></section>}
  </>;
}

function OfferForm({player,busy,balance,reply,askingFee,preview,cancel,submit}:{
  player:Player;busy:boolean;balance:number;cancel:()=>void;submit:(offer:Offer)=>Promise<void>;
  reply:Negotiation|null;askingFee:number;
  preview:(offer:Offer)=>React.ReactNode;
}){
  const base=terms(player.overall);
  const [bonus,setBonus]=useState(String((reply?.bonus??base.bonus)/100));
  const [salary,setSalary]=useState(String((reply?.salary??base.salary)/100));
  const [days,setDays]=useState(reply?.days??365);
  const [fee,setFee]=useState(String((reply?.transfer_fee??askingFee)/100));
  const [squadRole,setSquadRole]=useState<SquadRole>(reply?.squad_role??'rotation');
  const offer={bonus:Math.round(Number(bonus)*100),salary:Math.round(Number(salary)*100),days,transferFee:Math.round(Number(fee)*100),squadRole};
  const required=offer.bonus+offer.salary+offer.transferFee;
  const exceeds=required>balance;
  return <form className="panel" aria-label="Proposta de contrato" onSubmit={event=>{event.preventDefault();if(!busy&&!exceeds)void submit(offer);}}>
    <h2>Proposta para {player.nickname}</h2>
    {player.organization&&<p>Valor estimado de mercado {money(transferValue(player))} · Preço solicitado {money(askingFee)}</p>}
    <div className="world-filters">
      {player.organization&&<label>Transferência para o clube ($)<input type="number" required min={0} max={10000000} step=".01" value={fee} onChange={event=>setFee(event.target.value)}/></label>}
      <label>Luvas ($)<input type="number" required min={1} max={10000000} step=".01" value={bonus} onChange={event=>setBonus(event.target.value)}/></label>
      <label>Salário a cada 30 dias ($)<input type="number" required min={1} max={10000000} step=".01" value={salary} onChange={event=>setSalary(event.target.value)}/></label>
      <label>Duração<select value={days} onChange={event=>setDays(Number(event.target.value))}>
        <option value={180}>180 dias</option><option value={365}>365 dias</option><option value={730}>730 dias</option>
      </select></label>
      <label>Papel prometido<select value={squadRole} onChange={event=>setSquadRole(event.target.value as SquadRole)}>
        {Object.entries(squadRoleNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <p className="muted">{squadRoleExpectations[squadRole]} O cumprimento da promessa afeta a moral ao longo da carreira.</p>
    <CostSummary offer={offer}/>
    {[offer.bonus,offer.salary,offer.transferFee].every(value=>Number.isSafeInteger(value)&&value>=0)&&preview(offer)}
    <p>Transferência e luvas são debitadas na assinatura. É preciso reservar o próximo salário do elenco. O prazo aparece após a resposta.</p>
    {exceeds&&<p role="alert">O saldo não cobre a transferência, as luvas e o primeiro salário.</p>}
    <button type="button" disabled={busy} onClick={cancel}>Cancelar proposta</button>
    <button className="primary" disabled={busy||exceeds}>Enviar proposta</button>
  </form>;
}

function CostSummary({offer}:{offer:Offer}){
  const cost=contractCost(offer);
  return <p>Pagamento imediato <strong>{money(cost.immediate)}</strong> · Custo a cada 30 dias <strong>{money(cost.monthly)}</strong> · Total estimado <strong>{money(cost.total)}</strong></p>;
}
