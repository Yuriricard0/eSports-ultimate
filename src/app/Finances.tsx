import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Player} from '../game-core/recruitment';
import {facilityDefinitions,type CashCategory,type FacilityKind} from '../game-core/finance';
import {formatCareerDay} from '../game-core/calendar';
import {acceptSponsorship,improveFacility,listFinances,rejectSponsorship,type FinanceState} from '../persistence/repository';
import {money} from './Players';

const categories:Record<CashCategory,string>={signing:'Contratação',salary:'Salário',sale:'Venda',prize:'Premiação',sponsor:'Patrocínio',facility:'Instalação'};
export function Finances({career,players,onUpdated,onCalendar}:{career:Career;players:Player[];onUpdated:(career:Career)=>Promise<void>;onCalendar:()=>void}){
 const [data,setData]=useState<FinanceState|null>(null),[season,setSeason]=useState(0),[page,setPage]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{
   let active=true;listFinances(career.id,season).then(state=>{if(active)setData(state);}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[career,season]);
 const perform=async(action:()=>Promise<void>,message:string)=>{
   if(busy)return;setBusy(true);setError('');setNotice('');
   try{await action();setData(await listFinances(career.id,season));setNotice(message);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}
 };
 const names=new Map(players.map(p=>[p.id,p.nickname]));
 const active=data?.sponsors.filter(s=>s.state==='accepted'&&s.accepted_day+s.duration-1>=career.day)??[];
 const offers=data?.sponsors.filter(s=>s.state==='pending'&&s.expires_day>=career.day)??[];
 const history=data?.sponsors.filter(s=>!active.includes(s)&&!offers.includes(s))??[];
 const currentPage=Math.min(page,Math.max(0,Math.ceil((data?.transactions.length??0)/20)-1));
 return <>
   <div className="players-heading"><h1>Finanças</h1><span>{formatCareerDay(career.day)} · Reputação {data?.reputation??career.reputation??40}</span></div>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!data&&!error&&<p role="status">Carregando finanças…</p>}
   {data&&<>
     <section className="panel"><div className="players-heading"><h2>Resumo financeiro</h2><label>Período<select value={season} onChange={e=>{setSeason(Number(e.target.value));setPage(0);}}>
       <option value={0}>Temporada atual</option>{data.seasons.map(s=><option key={s.number} value={s.number}>{s.year} · Temporada {s.number}</option>)}
     </select></label></div>
       <p className="muted">Movimentações de {formatCareerDay(data.periodStart)} até {formatCareerDay(data.periodEnd)}. O saldo e a folha abaixo são os atuais.</p>
       <div className="central-metrics finance-metrics">
         <div><span>Saldo disponível</span><strong>{money(data.balance)}</strong></div>
         <div><span>Receitas do período</span><strong>{money(data.income)}</strong></div>
         <div><span>Despesas do período</span><strong>{money(data.expenses)}</strong></div>
         <div><span>Resultado financeiro</span><strong>{money(data.result)}</strong></div>
       </div>
       <p>Folha contratada: <strong>{money(data.payroll)} a cada 30 dias</strong>. Inclui o elenco principal e a Academy.</p>
       {data.outstanding>0&&<p role="alert">Salários em atraso: {money(data.outstanding)}. Contratações permanecem bloqueadas até regularizar a folha.</p>}
       <button onClick={onCalendar}>Consultar pagamentos de salários →</button>
     </section>
     <section className="panel"><h2>Patrocínios · {active.length}/2 ativos</h2>
       <p>Valores pagos a cada 30 dias de contrato. A primeira parcela vence após 30 dias; o último período pode ser proporcional.</p>
       <h3>Contratos ativos</h3>{!active.length&&<p>Nenhum patrocinador ativo.</p>}
       <div className="finance-cards">{active.map(s=><article key={s.id}><h3>{s.company}</h3><p><strong>{money(s.payment)} por período</strong></p>
         <p>{formatCareerDay(s.accepted_day)} – {formatCareerDay(s.accepted_day+s.duration-1)}</p>
         {career.day>=s.accepted_day+s.duration-1?<p>Última parcela processada.</p>:<p>Próximo vencimento: {formatCareerDay(Math.min(s.accepted_day+Math.floor((career.day-s.accepted_day+1)/30)*30+29,s.accepted_day+s.duration-1))}</p>}
       </article>)}</div>
       <h3>Propostas disponíveis</h3>{!offers.length&&<p>Nenhuma proposta disponível neste momento. Novas oportunidades são verificadas a cada ciclo de 30 dias.</p>}
       <div className="finance-cards">{offers.map(s=><article key={s.id}><h3>{s.company}</h3><p><strong>{money(s.payment)} por período</strong> · {s.duration} dias</p>
         <p>Reputação mínima {s.min_reputation} · Proposta até {formatCareerDay(s.expires_day)}</p>
         <button className="primary" disabled={busy||active.length>=2||data.reputation<s.min_reputation} onClick={()=>{
           if(!window.confirm(`Assinar com ${s.company} por ${s.duration} dias? O contrato ocupa uma vaga de patrocínio.`))return;
           void perform(async()=>{
             await onUpdated(await acceptSponsorship(career.id,s.id));
           },'Patrocínio de '+s.company+' aceito. Os pagamentos seguirão o contrato.');
         }}>Aceitar</button>
         <button disabled={busy} onClick={()=>void perform(async()=>{await rejectSponsorship(career.id,s.id);},'Proposta recusada.')}>Recusar</button>
       </article>)}</div>
       {!!history.length&&<details><summary>Histórico de propostas e contratos</summary><ul>{history.map(s=><li key={s.id}>{s.company} · {s.state==='accepted'?'Encerrado':s.state==='rejected'?'Recusada':'Expirada'} · {money(s.payment)} por período · {s.duration} dias</li>)}</ul></details>}
     </section>
     <section className="panel"><h2>Instalações</h2><p>Melhorias permanentes na carreira. Os bônus atuam nos ciclos de treinamento e não geram evolução imediata.</p>
       <div className="finance-cards">{(Object.keys(facilityDefinitions) as FacilityKind[]).map(kind=>{
         const definition=facilityDefinitions[kind],level=data.facilities.find(f=>f.kind===kind)?.level??0,cost=definition.costs[level];
         return <article key={kind}><h3>{definition.name}</h3><p><strong>Nível {level}/3</strong></p><p>{definition.description}</p>
           {level<3?<><p>Próximo nível: {money(cost)}</p><button disabled={busy||data.balance<cost} onClick={()=>{
             if(!window.confirm(`Melhorar ${definition.name} para o nível ${level+1} por ${money(cost)}? O valor será debitado do caixa.`))return;
             void perform(async()=>{
               await onUpdated(await improveFacility(career.id,kind,level));
             },definition.name+' melhorado para o nível '+(level+1)+'.');
           }}>Melhorar para nível {level+1}</button>{data.balance<cost&&<p className="muted">Saldo insuficiente.</p>}</>:<p>Nível máximo atingido.</p>}
         </article>;
       })}</div>
     </section>
     <section className="panel player-table"><h2>Histórico de movimentações</h2>
       <p className="muted">Valores efetivamente recebidos ou pagos. Salários antigos recuperados usam o vencimento como referência.</p>
       {!data.transactions.length&&<p>Nenhuma movimentação neste período.</p>}
       {!!data.transactions.length&&<><table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
         {data.transactions.slice(currentPage*20,(currentPage+1)*20).map(row=><tr key={row.event_key}><td>{formatCareerDay(row.day)}</td><td>{categories[row.category]}</td><td>{row.description.replace(/atleta (-?\d+)/g,(_match,id)=>names.get(Number(id))??'atleta '+id)}</td><td className={row.amount>0?'cash-in':'cash-out'}>{row.amount>0?'+':''}{money(row.amount)}</td></tr>)}
       </tbody></table><footer><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>← Anterior</button><span>Página {currentPage+1} · até 200 movimentações recentes do período</span><button disabled={(currentPage+1)*20>=data.transactions.length} onClick={()=>setPage(currentPage+1)}>Próxima →</button></footer></>}
     </section>
   </>}
 </>;
}
