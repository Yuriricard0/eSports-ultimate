import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import {formatCareerDay,type CalendarResult} from '../game-core/calendar';
import type {Contract,Player} from '../game-core/recruitment';
import type {StoredMatch} from '../game-core/match-store';
import type {Season} from '../game-core/competitions';
import {careerAgenda} from '../game-core/career-agenda';
import {listPayroll,listMatches,listCompetitions,type PayrollEntry} from '../persistence/repository';
import {money} from './Players';
import {useViewPreference} from './view-preferences';

export function CareerCalendar({career,players,contracts,advance,busy,report,onMatches,onCompetitions,onOpenFixture,onRoster}:{
  career:Career;players:Player[];contracts:Contract[];advance:(days:number)=>void;busy:boolean;report?:CalendarResult;onMatches:()=>void;onCompetitions:()=>void;onOpenFixture:(id:string)=>void;onRoster:()=>void;
}){
  const [rows,setRows]=useState<PayrollEntry[]|null>(null);
  const [error,setError]=useState('');
  const [page,setPage]=useState(0);
  const [schedule,setSchedule]=useState<{seasons:Season[];matches:StoredMatch[]}|null>(null);
  const [scheduleError,setScheduleError]=useState('');
  const [mode,setMode]=useViewPreference(`${career.id}:calendar:mode`,'');
  const [onlyOwn,setOnlyOwn]=useViewPreference(`${career.id}:calendar:own`,true);
  const [agendaPage,setAgendaPage]=useState(0);
  useEffect(()=>{
    let active=true;
    setScheduleError('');
    void Promise.all([listCompetitions(career.id),listMatches(career.id)]).then(([state,matches])=>{if(active)setSchedule({seasons:state.seasons,matches});})
      .catch(reason=>{if(active)setScheduleError(String(reason));});
    return()=>{active=false;};
  },[career]);
  useEffect(()=>{
    let active=true;
    listPayroll(career.id).then(entries=>{if(active)setRows(entries);})
      .catch(reason=>{if(active)setError(String(reason));});
    return()=>{active=false;};
  },[career.id,career.day]);
  const byId=new Map(players.map(player=>[player.id,player.nickname]));
  const agenda=schedule?careerAgenda(career,schedule.seasons,schedule.matches,contracts,byId).filter(event=>(!onlyOwn||event.own)&&(!mode||event.mode===mode)):[];
  const agendaIndex=Math.min(agendaPage,Math.max(0,Math.ceil(agenda.length/12)-1));
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
    <section className="panel"><div className="players-heading"><h2>Agenda multigaming</h2><button onClick={onCompetitions}>Ver competições →</button></div>
      <div className="world-filters"><select aria-label="Modalidade da agenda" value={mode} onChange={event=>{setMode(event.target.value);setAgendaPage(0);}}>
        <option value="">Todas as modalidades</option><option value="MOBA">MOBA</option><option value="FPS">CS2</option>
      </select><label className="compare-choice"><input type="checkbox" checked={onlyOwn} onChange={event=>{setOnlyOwn(event.target.checked);setAgendaPage(0);}}/> Apenas minha organização</label></div>
      {scheduleError&&<p role="alert">{scheduleError}</p>}
      {!schedule&&!scheduleError&&<p role="status">Carregando agenda…</p>}
      {schedule&&!agenda.length&&<p>Nenhum compromisso para estes filtros.</p>}
      {agenda.slice(agendaIndex*12,(agendaIndex+1)*12).map(event=><p key={event.id}>{formatCareerDay(event.day)} · {event.mode==='FPS'?'CS2':event.mode??'Organização'} · {event.label}{' '}
        {event.target==='fixture'&&event.fixtureId&&<button onClick={()=>onOpenFixture(event.fixtureId!)}>Abrir confronto →</button>}
        {event.target==='matches'&&<button onClick={onMatches}>Ver amistoso →</button>}
        {event.target==='roster'&&<button onClick={onRoster}>Ver elenco →</button>}
      </p>)}
      {agenda.length>12&&<footer><button disabled={!agendaIndex} onClick={()=>setAgendaPage(agendaIndex-1)}>Anterior</button><button disabled={(agendaIndex+1)*12>=agenda.length} onClick={()=>setAgendaPage(agendaIndex+1)}>Próxima</button></footer>}
    </section>
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
