import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import type {SaleOption} from '../game-core/market';
import {formatCareerDay} from '../game-core/calendar';
import {leaveRoster,listSaleOptions,renewPlayerContract} from '../persistence/repository';

const money=(value:number)=>'$ '+(value/100).toLocaleString('pt-BR');
export function RosterContracts({career,player,contract,action,onClose,onUpdated}:{
 career:Career;player:Player;contract:Contract;action:'renew'|'sell'|'release';onClose:()=>void;onUpdated:(career:Career)=>Promise<void>;
}){
 const [salary,setSalary]=useState(String(contract.salary/100));
 const [days,setDays]=useState(365);
 const [offers,setOffers]=useState<SaleOption[]|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   if(action==='sell')listSaleOptions(career.id,player.id).then(rows=>{if(active)setOffers(rows);}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[action,career.id,player.id]);
 const execute=async(operation:()=>Promise<Career>)=>{
   if(busy)return;
   setBusy(true);setError('');
   try{await onUpdated(await operation());onClose();}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 return <section className="panel" aria-label="Gerenciar contrato">
   <div className="players-heading"><h2>{action==='renew'?'Renovar contrato':action==='sell'?'Propostas de compra':'Dispensar jogador'} · {player.nickname}</h2>
     <button disabled={busy} onClick={onClose}>{action==='sell'?'Recusar propostas e fechar':'Cancelar'}</button></div>
   {error&&<p role="alert">{error}</p>}
   {action==='renew'&&<form onSubmit={event=>{event.preventDefault();void execute(()=>renewPlayerContract(career.id,player.id,Math.round(Number(salary)*100),days));}}>
     <p>Vínculo atual até {formatCareerDay(contract.end_day)}. A renovação acrescenta dias a esse prazo.</p>
     <div className="world-filters">
       <label>Salário a cada 30 dias ($)<input type="number" required step=".01" min={contract.salary/100} max={10000000} value={salary} onChange={e=>setSalary(e.target.value)}/></label>
       <label>Prorrogação<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={180}>180 dias</option><option value={365}>365 dias</option><option value={730}>730 dias</option></select></label>
     </div>
     <p>Novo término: {formatCareerDay(contract.end_day+days)}. Sem luvas de renovação. O novo salário vale a partir de hoje.</p>
     <button className="primary" disabled={busy}>Confirmar renovação</button>
   </form>}
   {action==='sell'&&<>
     <p>Aceite uma proposta para concluir a venda. O valor entra no caixa e o salário trabalhado é acertado na saída.</p>
     {offers===null&&!error&&<p role="status">Buscando clubes interessados…</p>}
     {offers?.length===0&&<p>Nenhum clube interessado neste momento.</p>}
     <div className="market-offers">{offers?.map(offer=><article key={offer.team}><h3>{offer.name}</h3><p>Oferta: {money(offer.fee)}</p>
       <button className="primary" disabled={busy} onClick={()=>void execute(()=>leaveRoster(career.id,player.id,offer.team))}>Aceitar e vender</button>
     </article>)}</div>
   </>}
   {action==='release'&&<>
     <p>{player.nickname} sairá do elenco e ficará livre. O salário pelos dias já trabalhados será acertado; valores em atraso continuam registrados.</p>
     <button className="primary" disabled={busy} onClick={()=>void execute(()=>leaveRoster(career.id,player.id))}>Confirmar dispensa</button>
   </>}
 </section>;
}
