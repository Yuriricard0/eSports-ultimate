import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import {formatCareerDay} from '../game-core/calendar';
import {activeLoans,loanPeriods,type Loan} from '../game-core/loans';
import {createLoan,listLoanClubs,listLoans} from '../persistence/repository';

export function Loans({career,players,contracts,onUpdated}:{career:Career;players:Player[];contracts:Contract[];onUpdated:(career:Career)=>Promise<void>}){
 const [loans,setLoans]=useState<Loan[]>([]);
 const [clubs,setClubs]=useState<{id:string;name:string}[]>([]);
 const [outgoing,setOutgoing]=useState(false);
 const [team,setTeam]=useState('');
 const [player,setPlayer]=useState(0);
 const [days,setDays]=useState<number>(loanPeriods[0]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
   let mounted=true;
   Promise.all([listLoans(career.id),listLoanClubs(career.id)]).then(([rows,teams])=>{if(mounted){setLoans(rows);setClubs(teams);}})
     .catch(reason=>{if(mounted)setError(String(reason));});
   return()=>{mounted=false;};
 },[career]);
 const active=new Set(activeLoans(loans,career.day).map(row=>row.player_id));
 const reserves=new Set(contracts.filter(row=>!row.starter&&!row.academy&&!row.loan&&row.end_day>=career.day+days-1).map(row=>row.player_id));
 const candidates=players.filter(row=>!row.status&&row.mode===career.mode&&!active.has(row.id)&&(outgoing?reserves.has(row.id):row.team===team));
 const names=new Map(players.map(row=>[row.id,row.nickname]));
 return <section className="panel">
   <h2>Empréstimos</h2>
   <form onSubmit={async event=>{
     event.preventDefault();
     if(busy||!team||!candidates.some(row=>row.id===player))return;
     setBusy(true);setError('');
     try{await onUpdated(await createLoan(career.id,player,team,days));setLoans(await listLoans(career.id));setPlayer(0);}
     catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
     finally{setBusy(false);}
   }}>
     <div className="world-filters">
       <label>Tipo<select value={outgoing?'out':'in'} onChange={event=>{setOutgoing(event.target.value==='out');setPlayer(0);}}>
         <option value="in">Receber jogador</option><option value="out">Emprestar jogador</option>
       </select></label>
       <label>Clube<select required value={team} onChange={event=>{setTeam(event.target.value);setPlayer(0);}}>
         <option value="">Selecione</option>{clubs.map(club=><option key={club.id} value={club.id}>{club.name}</option>)}
       </select></label>
       <label>Jogador<select required value={player||''} onChange={event=>setPlayer(Number(event.target.value))}>
         <option value="">Selecione</option>{candidates.map(row=><option key={row.id} value={row.id}>{row.nickname}</option>)}
       </select></label>
       <label>Duração<select value={days} onChange={event=>setDays(Number(event.target.value))}>
         {loanPeriods.map(period=><option key={period} value={period}>{period} dias</option>)}
       </select></label>
     </div>
     <p>O clube de origem mantém o contrato e paga o salário. Início {formatCareerDay(career.day)} · término {formatCareerDay(career.day+days-1)}.</p>
     {error&&<p role="alert">{error}</p>}
     <button className="primary" disabled={busy||!team||!candidates.some(row=>row.id===player)}>Confirmar empréstimo</button>
   </form>
   {loans.length>0&&<ul>{loans.map(loan=><li key={loan.player_id+':'+loan.start_day}>
     {names.get(loan.player_id)??loan.player_id} · {loan.origin==='career'?career.name:loan.club} → {loan.destination==='career'?career.name:loan.club} · {formatCareerDay(loan.start_day)} a {formatCareerDay(loan.end_day)} · {loan.start_day<=career.day&&loan.end_day>=career.day?'Ativo':'Encerrado'}
   </li>)}</ul>}
 </section>;
}
