import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import {formatCareerDay,type CalendarResult} from '../game-core/calendar';
import type {Player} from '../game-core/recruitment';
import {listPayroll,type PayrollEntry} from '../persistence/repository';
import {money} from './Players';
import {CompetitionAgenda} from './Competitions';

export function CareerCalendar({career,players,advance,busy,report,onMatches,onCompetitions,onOpenFixture}:{
  career:Career;players:Player[];advance:(days:number)=>void;busy:boolean;report?:CalendarResult;onMatches:()=>void;onCompetitions:()=>void;onOpenFixture:(id:string)=>void;
}){
  const [rows,setRows]=useState<PayrollEntry[]|null>(null);
  const [error,setError]=useState('');
  const [page,setPage]=useState(0);
  useEffect(()=>{
    let active=true;
    listPayroll(career.id).then(entries=>{if(active)setRows(entries);})
      .catch(reason=>{if(active)setError(String(reason));});
    return()=>{active=false;};
  },[career.id,career.day]);
  const byId=new Map(players.map(player=>[player.id,player.nickname]));
  const entries=rows??[];
  const outstanding=entries.reduce((total,row)=>total+row.amount-row.paid,0);
  const activePage=Math.min(page,Math.max(0,Math.ceil(entries.length/20)-1));
  return <>
    <h1>Calendário</h1>
    <p>{formatCareerDay(career.day)} · Dia {career.day} · Saldo {money(career.balance)}</p>
    <button onClick={onMatches}>Amistosos e resultados →</button>
    <div className="advance-actions">{[1,7,30].map(days=><button key={days} disabled={busy} onClick={()=>advance(days)}>
      Avançar {days===1?'1 dia':days+' dias'}
    </button>)}</div>
    {report&&<p role="status">Avanço concluído · {money(report.paid)} pagos · {report.expired} contratos encerrados.</p>}
    <CompetitionAgenda career={career} onCompetitions={onCompetitions} onOpenFixture={onOpenFixture}/>
    <section className="panel player-table">
      <h2>Folha salarial</h2>
      <p>Os salários vencem a cada 30 dias de contrato. O último período é proporcional.</p>
      {outstanding>0&&<p role="status">Folha em atraso: {money(outstanding)}. Contratações ficam bloqueadas enquanto houver parcelas em atraso.</p>}
      {error&&<p role="alert">{error}</p>}
      {!rows&&!error&&<p>Carregando folha…</p>}
      {rows&&entries.length===0&&<p>Nenhum salário vencido.</p>}
      {entries.length>0&&<>
        <table><thead><tr><th>Vencimento</th><th>Atleta</th><th>Valor</th><th>Pago</th><th>Em aberto</th></tr></thead>
        <tbody>{entries.slice(activePage*20,(activePage+1)*20).map(row=><tr key={row.player_id+':'+row.due_day}>
          <td>{formatCareerDay(row.due_day)}</td><td>{byId.get(row.player_id)??row.player_id}</td>
          <td>{money(row.amount)}</td><td>{money(row.paid)}</td><td>{money(row.amount-row.paid)}</td>
        </tr>)}</tbody></table>
        <footer><button disabled={activePage===0} onClick={()=>setPage(activePage-1)}>Anterior</button>
        <button disabled={(activePage+1)*20>=entries.length} onClick={()=>setPage(activePage+1)}>Próxima</button></footer>
      </>}
    </section>
  </>;
}
