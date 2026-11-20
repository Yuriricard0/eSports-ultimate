import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Negotiation,Offer} from '../game-core/negotiation';
import {terms,type Player} from '../game-core/recruitment';
import {formatCareerDay} from '../game-core/calendar';
import {cancelOffer,listNegotiations,sendOffer} from '../persistence/repository';
import {listMarketMoves,type MarketMove} from '../persistence/repository';
import {transferValue} from '../game-core/market';

const money=(cents:number)=>'$ '+(cents/100).toLocaleString('pt-BR',{maximumFractionDigits:2});
const labels:Record<Negotiation['state'],string>={
  accepted:'Aceita',counter:'Contraproposta',rejected:'Recusada',expired:'Expirada',cancelled:'Cancelada',signed:'Assinada',
};

export function MarketNegotiations({career,players,draft,onClearDraft,onFinish}:{
  career:Career;players:Player[];draft:Player|null;onClearDraft:()=>void;onFinish:(id:string)=>Promise<void>;
}){
  const [negotiations,setNegotiations]=useState<Negotiation[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [showHistory,setShowHistory]=useState(false);
  const [moves,setMoves]=useState<MarketMove[]>([]);
  useEffect(()=>{
    let active=true;
    listNegotiations(career.id).then(rows=>{if(active)setNegotiations(rows);}).catch(reason=>{if(active)setError(String(reason));});
    listMarketMoves(career.id).then(rows=>{if(active)setMoves(rows);}).catch(reason=>{if(active)setError(String(reason));});
    return()=>{active=false;};
  },[career]);
  const nicknames=new Map(players.map(player=>[player.id,player.nickname]));
  const open=(row:Negotiation)=>row.state==='accepted'||row.state==='counter';
  const rows=showHistory?negotiations:negotiations.filter(open);
  const run=async(action:()=>Promise<unknown>)=>{
    setBusy(true);
    setError('');
    try{await action();setNegotiations(await listNegotiations(career.id));}
    catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
    finally{setBusy(false);}
  };
  return <>
    {error&&<p role="alert">{error}</p>}
    {draft&&<OfferForm key={draft.id} player={draft} busy={busy} balance={career.balance}
      cancel={onClearDraft} submit={offer=>run(async()=>{
        await sendOffer(career.id,draft.id,offer);
        setShowHistory(true);
        onClearDraft();
      })}/>}
    <section className="panel">
      <div className="players-heading"><h2>Negociações</h2>
        <button onClick={()=>setShowHistory(!showHistory)}>{showHistory?'Só abertas':'Ver histórico'}</button></div>
      {!rows.length&&<p className="muted">Nenhuma negociação {showHistory?'registrada':'aberta'}.</p>}
      <div className="market-offers">{rows.slice(0,30).map(row=>{
        const bonus=row.state==='counter'?row.counter_bonus:row.bonus;
        const salary=row.state==='counter'?row.counter_salary:row.salary;
        return <article key={row.id}>
          <h3>{nicknames.get(row.player_id)??'Atleta '+row.player_id} · {labels[row.state]}</h3>
          <p>{row.reason}</p>
          <p>Luvas {money(bonus)} · Salário {money(salary)} a cada 30 dias · {row.days} dias</p>
          {!!row.transfer_fee&&<p>Transferência: {money(row.transfer_fee)}</p>}
          <p>Custo nominal do vínculo {money(bonus+(row.transfer_fee??0)+Math.round(salary*row.days/30))}</p>
          {open(row)&&<>
            <p>Válida até {formatCareerDay(row.expires_day)}</p>
            <button className="primary" disabled={busy||career.day>row.expires_day} onClick={()=>void run(()=>onFinish(row.id))}>
              {row.state==='counter'?'Aceitar contraproposta e assinar':'Assinar contrato'}
            </button>
            <button disabled={busy} onClick={()=>void run(()=>cancelOffer(career.id,row.id))}>Cancelar negociação</button>
          </>}
        </article>;
      })}</div>
    </section>
    {!!moves.length&&<section className="panel"><h2>Movimentações concluídas</h2><ul>{moves.slice(0,20).map((move,index)=><li key={index}>
      {formatCareerDay(move.day)} · {nicknames.get(move.player_id)??move.player_id} · {move.description}
      {move.amount!==0?' · '+money(move.amount):''}
    </li>)}</ul></section>}
  </>;
}

function OfferForm({player,busy,balance,cancel,submit}:{
  player:Player;busy:boolean;balance:number;cancel:()=>void;submit:(offer:Offer)=>Promise<void>;
}){
  const base=terms(player.overall);
  const [bonus,setBonus]=useState(String(base.bonus/100));
  const [salary,setSalary]=useState(String(base.salary/100));
  const [days,setDays]=useState(365);
  const [fee,setFee]=useState(String(player.organization?transferValue(player)/100:0));
  const offer={bonus:Math.round(Number(bonus)*100),salary:Math.round(Number(salary)*100),days,transferFee:Math.round(Number(fee)*100)};
  const required=offer.bonus+offer.salary+offer.transferFee;
  const exceeds=required>balance;
  return <form className="panel" aria-label="Proposta de contrato" onSubmit={event=>{event.preventDefault();if(!busy&&!exceeds)void submit(offer);}}>
    <h2>Proposta para {player.nickname}</h2>
    <div className="world-filters">
      {player.organization&&<label>Transferência para o clube ($)<input type="number" required min={0} max={10000000} step=".01" value={fee} onChange={event=>setFee(event.target.value)}/></label>}
      <label>Luvas ($)<input type="number" required min={1} max={10000000} step=".01" value={bonus} onChange={event=>setBonus(event.target.value)}/></label>
      <label>Salário a cada 30 dias ($)<input type="number" required min={1} max={10000000} step=".01" value={salary} onChange={event=>setSalary(event.target.value)}/></label>
      <label>Duração<select value={days} onChange={event=>setDays(Number(event.target.value))}>
        <option value={180}>180 dias</option><option value={365}>365 dias</option><option value={730}>730 dias</option>
      </select></label>
    </div>
    <p>Transferência e luvas são debitadas na assinatura. É preciso reservar o próximo salário do elenco. A proposta vence em 7 dias.</p>
    {exceeds&&<p role="alert">O saldo não cobre a transferência, as luvas e o primeiro salário.</p>}
    <button type="button" disabled={busy} onClick={cancel}>Cancelar proposta</button>
    <button className="primary" disabled={busy||exceeds}>Enviar proposta</button>
  </form>;
}
