import {useState} from 'react';
import {formatCareerDay} from '../game-core/calendar';
import type {FinanceState} from '../persistence/repository';
import {money} from './Players';

export function FinanceCashChart({data,horizon,setHorizon}:{data:FinanceState;horizon:number;setHorizon:(value:number)=>void}){
 const [selected,setSelected]=useState('current');
 const realized=data.realized??[];
 const rows=data.projection.months.slice(0,horizon),ending=rows.at(-1)!;
 const series=[
   ...realized.map((row,index)=>({...row,id:index===realized.length-1?'current':`actual-${row.day}`,label:'Realizado'})),
   ...(!realized.length?[{id:'current',label:'Saldo atual',day:rows[0].day-30,income:0,expenses:0,balance:data.balance}]:[]),
   ...rows.map((row,index)=>({...row,id:`forecast-${row.month}`,label:'Projetado',
     income:row.income-(rows[index-1]?.income??0),expenses:row.expenses-(rows[index-1]?.expenses??0)})),
 ];
 const pivot=series.findIndex(row=>row.id==='current');
 const focus=series.find(row=>row.id===selected)??series[pivot];
 const min=Math.min(0,...series.map(row=>row.balance)),max=Math.max(1,...series.map(row=>row.balance));
 const x=(index:number)=>15+index/(series.length-1)*570;
 const y=(balance:number)=>12+(max-balance)/(max-min)*126;
 const points=(start:number,end:number)=>series.slice(start,end).map((row,index)=>`${x(index+start)},${y(row.balance)}`).join(' ');
 const selectedIndex=series.indexOf(focus);
 return <section className="panel finance-projection">
   <div className="players-heading"><h2>Fluxo de caixa</h2><div className="event-tabs" aria-label="Horizonte da projeção">
     {[3,6,12].map(months=><button key={months} aria-pressed={horizon===months} onClick={()=>{setHorizon(months);setSelected('current');}}>{months} meses</button>)}
   </div></div>
   <p className="muted">O realizado vem do extrato em períodos de 30 dias. A projeção inclui folha, atrasos e patrocínios assinados. Prêmios, vendas, renovações e gastos ainda não contratados ficam de fora.</p>
   <div className="finance-chart-key"><span>━ Realizado</span><span>┄ Projetado</span></div>
   <div className="finance-plot">
     <div className="finance-plot-axis" aria-hidden="true"><span>{money(max)}</span><span>{money(min)}</span></div>
     <svg className="finance-chart-svg" viewBox="0 0 600 150" preserveAspectRatio="none" role="img" aria-label="Linha contínua para caixa realizado e linha tracejada para caixa projetado">
       <line x1="15" x2="585" y1={y(0)} y2={y(0)} stroke="#4c5363" vectorEffect="non-scaling-stroke"/>
       <line x1={x(pivot)} x2={x(pivot)} y1="12" y2="138" stroke="#687184" strokeDasharray="3 4" vectorEffect="non-scaling-stroke"/>
       <polyline points={points(0,pivot+1)} fill="none" stroke="#d4dced" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
       <polyline points={points(pivot,series.length)} fill="none" stroke="#f35a7c" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke"/>
       <circle cx={x(selectedIndex)} cy={y(focus.balance)} r="4" fill="#fff" stroke="#75253c" strokeWidth="2"/>
     </svg>
   </div>
   <label className="finance-chart-period">Consultar período<select aria-label="Período do gráfico" value={focus.id} onChange={event=>setSelected(event.target.value)}>
     {series.map(row=><option key={row.id} value={row.id}>{row.label} · {formatCareerDay(row.day)}{row.id==='current'?' (atual)':''}</option>)}
   </select></label>
   <dl className="finance-period-values" aria-live="polite">
     <div><dt>Receitas no período</dt><dd>{money(focus.income)}</dd></div>
     <div><dt>Despesas no período</dt><dd>{money(focus.expenses)}</dd></div>
     <div><dt>Saldo no fim do período</dt><dd className={focus.balance<0?'cash-out':''}>{money(focus.balance)}</dd></div>
   </dl>
   <p>Saldo previsto em {horizon} meses <strong>{money(ending.balance)}</strong></p>
   {ending.firstShortfall!==null&&<p role="alert">Falta de caixa prevista a partir de {formatCareerDay(ending.firstShortfall)}.</p>}
 </section>;
}
