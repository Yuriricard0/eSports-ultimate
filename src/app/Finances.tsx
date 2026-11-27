import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Player} from '../game-core/recruitment';
import {facilityDefinitions,sponsorSpecialty,type CashCategory,type FacilityKind} from '../game-core/finance';
import {formatCareerDay} from '../game-core/calendar';
import {acceptSponsorship,buyEquipment,improveFacility,listFinances,rejectSponsorship,type FinanceState} from '../persistence/repository';
import {equipmentCatalog,sponsorKit,sponsorKitCount,sponsorCashOnlyValue} from '../game-core/equipment';
import {money} from './Players';
import {expansionStudy,payrollHealth,type FinanceProjection} from '../game-core/finance-projection';

function Projection({data}:{data:FinanceProjection}){
 const [horizon,setHorizon]=useState(3);
 const rows=data.months.slice(0,horizon),ending=rows.at(-1)!;
 const scale=Math.max(1,Math.abs(data.balance),...rows.map(row=>Math.abs(row.balance)));
 return <section className="panel finance-projection">
   <div className="players-heading"><h2>Projeção de caixa</h2><div className="event-tabs" aria-label="Horizonte da projeção">
     {[3,6,12].map(months=><button key={months} aria-pressed={horizon===months} onClick={()=>setHorizon(months)}>{months} meses</button>)}
   </div></div>
   <p>Considera a folha, os atrasos e os patrocínios assinados. Renovações, vendas e prêmios ficam fora da estimativa. Cada mês equivale a 30 dias de jogo.</p>
   <div className="central-metrics finance-metrics">
     <div><span>Saldo inicial</span><strong>{money(data.balance)}</strong></div>
     <div><span>Receitas contratadas</span><strong>{money(ending.income)}</strong></div>
     <div><span>Despesas previstas</span><strong>{money(ending.expenses)}</strong></div>
     <div><span>Saldo previsto</span><strong>{money(ending.balance)}</strong></div>
   </div>
   {ending.firstShortfall!==null&&<p role="alert">A folha pode deixar o caixa descoberto a partir de {formatCareerDay(ending.firstShortfall)}.</p>}
   <ul className="finance-projection-bars">{rows.map(row=><li key={row.month}>
     <span>{formatCareerDay(row.day)}</span><span className="finance-projection-track" aria-hidden="true">
       <i style={{width:Math.abs(row.balance)/scale*50+'%',left:row.balance<0?'auto':'50%',right:row.balance<0?'50%':'auto'}} className={row.balance<0?'deficit':''}/>
     </span><strong>{money(row.balance)}</strong>
   </li>)}</ul>
 </section>;
}

const categories:Record<CashCategory,string>={signing:'Contratação',salary:'Salário',sale:'Venda',prize:'Premiação',sponsor:'Patrocínio',facility:'Instalação',equipment:'Equipamento'};
const sponsorValue=(offer:FinanceState['sponsors'][number])=>{
 const item=equipmentCatalog.find(row=>row.id===sponsorKit(offer.id));
 const cash=sponsorCashOnlyValue(offer.id,offer.payment);
 return [cash?money(cash)+' por período':'',item?sponsorKitCount(offer.id)+' × '+item.name.toLowerCase()+' exclusivo':''].filter(Boolean).join(' + ');
};
function SponsorName({offer}:{offer:FinanceState['sponsors'][number]}){
 const hue=[...offer.company].reduce((sum,char)=>sum+char.charCodeAt(0),0)%360;
 return <h3 className="sponsor-name"><span aria-hidden="true" style={{background:`hsl(${hue} 47% 28%)`}}>{offer.company.slice(0,2).toUpperCase()}</span>{offer.company}</h3>;
}
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
 const health=data?.projection?payrollHealth(data.projection,data.payroll):undefined;
 const target=career.mode==='FPS'?'MOBA':'FPS';
 const study=data?expansionStudy(target,data.balance-data.outstanding,data.facilities.find(item=>item.kind==='training')?.level??0):undefined;
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
     {data.projection&&<Projection data={data.projection}/>}
     {health&&<section className="panel"><h2>Sustentabilidade da folha</h2>
       <p><strong>{health.level}</strong> · {health.reason}</p>
       <p>Folha atual {money(data.payroll)} por período · Receita contratada em 30 dias {money(data.projection.months[0].income)} · Saldo projetado em 6 meses {money(data.projection.months[5].balance)}</p>
     </section>}
     {study&&<details className="panel"><summary>Viabilidade de expansão para {target==='FPS'?'CS2':'MOBA'}</summary>
       <p><strong>{study.viable?'Há margem inicial para estudar a expansão.':'Adie a expansão e reforce o caixa.'}</strong></p>
       <p>Custo inicial estimado {money(study.initial)} · Equipamentos {money(study.equipment)} · Instalações {money(study.infrastructure)}</p>
       <p>Folha adicional de cinco atletas {money(study.payroll)} por mês · Reserva de três meses {money(study.reserve)}.</p>
       <p>Premissas de entrada · cinco atletas de Overall 50 e kits intermediários. O cálculo desconta salários atrasados do caixa. Viagens e outras despesas sem valores registrados ficam fora da estimativa.</p>
     </details>}
     <section className="panel"><h2>Patrocínios · {active.length}/2 ativos</h2>
       <p>Reconhecimento comercial <strong>{data.recognition}/100</strong> · Reputação competitiva <strong>{data.reputation}/100</strong>. A exposição em partidas e o histórico de parcerias fazem a marca crescer ao longo da carreira.</p>
       <p>Valores pagos a cada 30 dias de contrato. A primeira parcela vence após 30 dias; o último período pode ser proporcional.</p>
       <h3>Contratos ativos</h3>{!active.length&&<p>Nenhum patrocinador ativo.</p>}
       <div className="finance-cards">{active.map(s=><article key={s.id}><SponsorName offer={s}/><p><strong>{sponsorValue(s)}</strong></p>
         <p>{formatCareerDay(s.accepted_day)} – {formatCareerDay(s.accepted_day+s.duration-1)}</p>
         {sponsorKit(s.id)?<p>Equipamentos entregues na assinatura.</p>:career.day>=s.accepted_day+s.duration-1?<p>Última parcela processada.</p>:<p>Próximo vencimento: {formatCareerDay(Math.min(s.accepted_day+Math.floor((career.day-s.accepted_day+1)/30)*30+29,s.accepted_day+s.duration-1))}</p>}
       </article>)}</div>
       <h3>Propostas disponíveis</h3>{!offers.length&&<p>Nenhuma proposta disponível neste momento. Novas oportunidades são verificadas a cada ciclo de 30 dias.</p>}
       <div className="finance-cards">{offers.map(s=><article key={s.id}><SponsorName offer={s}/><p><strong>{sponsorValue(s)}</strong> · {s.duration} dias</p>
         {sponsorKit(s.id)&&<p>Equipamentos entregues na assinatura. Valor de referência de {money(sponsorKitCount(s.id)*(equipmentCatalog.find(item=>item.mode===career.mode&&item.tier===4)?.price??0))}, calculado com kits Elite.</p>}
         {sponsorSpecialty(s.id)&&<p>{sponsorSpecialty(s.id)?.sector} · {sponsorSpecialty(s.id)?.mode==='FPS'?'CS2':sponsorSpecialty(s.id)?.mode??sponsorSpecialty(s.id)?.region}</p>}
         <p>Reputação mínima {s.min_reputation} · Proposta até {formatCareerDay(s.expires_day)}</p>
         <button className="primary" disabled={busy||active.length>=2||data.reputation<s.min_reputation} onClick={()=>{
           if(!window.confirm(`Assinar com ${s.company} por ${s.duration} dias? O contrato ocupa uma vaga de patrocínio.`))return;
           void perform(async()=>{
             await onUpdated(await acceptSponsorship(career.id,s.id));
           },'Patrocínio de '+s.company+' aceito.');
         }}>Aceitar</button>
         <button disabled={busy} onClick={()=>void perform(async()=>{await rejectSponsorship(career.id,s.id);},'Proposta recusada.')}>Recusar</button>
       </article>)}</div>
       {!!history.length&&<details><summary>Histórico de propostas e contratos</summary><ul>{history.map(s=><li key={s.id}>{s.company} · {s.state==='accepted'?'Encerrado':s.state==='rejected'?'Recusada':'Expirada'} · {sponsorValue(s)} · {s.duration} dias</li>)}</ul></details>}
     </section>
     <section className="panel"><h2>Loja e inventário</h2>
       <p>Os melhores kits disponíveis cobrem primeiro o elenco principal. O efeito depende de quantos atletas têm acesso ao equipamento e atua na eficiência dos treinos.</p>
       <div className="finance-cards">{equipmentCatalog.filter(item=>item.mode===career.mode).map(item=>{
         const quantity=data.equipment?.find(row=>row.sku===item.id)?.quantity??0;
         return <article key={item.id}><h3>{item.name} · {item.label}</h3><p>{item.description}</p>
           <p>{quantity} no inventário · {item.training?(item.training*100).toLocaleString('pt-BR')+'% por atleta coberto':'Treino padrão'}</p>
           {item.price?<button disabled={busy||data.balance<item.price||quantity>=10} onClick={()=>{
             if(window.confirm(`Comprar um kit ${item.label} por ${money(item.price)}?`))
               void perform(async()=>{await onUpdated(await buyEquipment(career.id,item.id,1));},'Equipamento adicionado ao inventário.');
           }}>Comprar · {money(item.price)}</button>:<p>Disponível por patrocínio.</p>}
         </article>;
       })}</div>
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
