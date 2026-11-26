import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import {standings,type CompetitionConfig} from '../game-core/competitions';
import {formatCareerDay} from '../game-core/calendar';
import {listCompetitions,saveCompetitionConfig,startCompetitionSeason,type CompetitionState} from '../persistence/repository';
import {money} from './Players';

const phases={regular:'Temporada regular',quarterfinal:'Quartas de final',semifinal:'Semifinais',final:'Final'};
export function Competitions({career,onOpenFixture,initialEditionId='',initialSeason=0}:{career:Career;onOpenFixture:(id:string)=>void;initialEditionId?:string;initialSeason?:number}){
 const [state,setState]=useState<CompetitionState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [year,setYear]=useState(initialSeason),[editionId,setEdition]=useState(initialEditionId);
 useEffect(()=>{let active=true;listCompetitions(career.id).then(data=>{if(active)setState(data);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[career]);
 const season=state?.seasons.find(s=>s.number===year)??state?.seasons[0];
 const edition=season?.editions.find(e=>e.id===editionId)??season?.editions.find(e=>e.participants.some(p=>p.id==='career'))??season?.editions[0];
 const latest=state?.seasons[0],finished=!latest||latest.editions.every(e=>e.champion);
 const name=(id:string)=>edition?.participants.find(p=>p.id===id)?.name??id;
 const perform=async(action:()=>Promise<unknown>)=>{
   if(busy)return;setBusy(true);setError('');setNotice('');
   try{await action();setState(await listCompetitions(career.id));}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}
 };
 return <>
   <div className="players-heading"><h1>Competições</h1><span>{career.mode==='MOBA'?'MOBA · Ligas regionais':'CS2 · Circuito de torneios'}</span></div>
   <p className="muted">{formatCareerDay(career.day)} · Reputação da organização {career.reputation??40} · Caixa {money(career.balance)}</p>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!state&&!error&&<p role="status">Carregando temporadas…</p>}
   {state&&<>
     <section className="panel">
       <div className="players-heading"><h2>{latest?'Temporadas':'Começar a competir'}</h2>
         <button className="primary" disabled={busy||!finished} onClick={()=>void perform(async()=>{
           const next=await startCompetitionSeason(career.id);setYear(next.number);setEdition('');setNotice('Temporada '+next.year+' criada. Os jogos aparecem na Agenda.');
         })}>{latest?'Iniciar próxima temporada':'Iniciar temporada'}</button></div>
       {!latest&&<p>Complete cinco titulares no elenco principal antes de iniciar. A inscrição segue a elegibilidade da sua carreira.</p>}
       {latest&&!finished&&<p>A temporada atual deve terminar antes da próxima edição.</p>}
       {!!state.seasons.length&&<label>Temporada<select value={season?.number} onChange={e=>{setYear(Number(e.target.value));setEdition('');}}>
         {state.seasons.map(s=><option key={s.number} value={s.number}>{s.year} · Temporada {s.number}</option>)}
       </select></label>}
     </section>
     <details className="panel"><summary>Configurar nomes e premiações das próximas edições</summary>
       <CompetitionSettings key={career.id} initial={state.config} busy={busy} save={config=>perform(async()=>{await saveCompetitionConfig(career.id,config);setNotice('Configuração salva para as próximas edições.');})}/>
     </details>
   </>}
   {season&&<>
     {season.fpsRanking&&<section className="panel"><h2>Ranking de acesso ao Major</h2>
       <p>{season.fpsRanking.length?'Classificação por resultados da temporada anterior. O Major tem oito vagas.':'O ranking começa após os primeiros resultados oficiais. Sua organização estreia no circuito regional.'}</p>
       {!!season.fpsRanking.length&&<ol>{season.fpsRanking.slice(0,8).map(row=><li key={row.organization}>{row.organization==='career'?career.name:state?.seasons.flatMap(s=>s.editions).flatMap(e=>e.participants).find(p=>p.organization===row.organization)?.name??row.organization} · {row.points} pts</li>)}</ol>}
       {season.fpsRanking.length>0&&<p>{season.editions.some(e=>e.key==='cs_major'&&e.participants.some(p=>p.id==='career'))?'Sua organização conquistou uma vaga no Major.':'Sua organização ficou fora das vagas do Major nesta temporada.'}</p>}
     </section>}
     {!!season.notices.length&&<section className="panel"><h2>Edições indisponíveis</h2>{season.notices.map(message=><p key={message}>{message}</p>)}</section>}
     <div className="competition-cards">{season.editions.map(e=><button className={edition?.id===e.id?'current':''} key={e.id} onClick={()=>setEdition(e.id)}>
       <strong>{e.name}</strong><span>{e.prestige} · {e.participants.length} equipes</span>
       <span>{formatCareerDay(e.startDay)} – {formatCareerDay(e.endDay)}</span><span>{e.champion?'Campeão: '+e.participants.find(p=>p.id===e.champion)?.name:'Em disputa'} · {money(e.prize)}</span>
     </button>)}</div>
     {edition&&<>
       <section className="panel"><h2>{edition.name} · {season.year}</h2><p>{edition.region} · {edition.prestige} · {money(edition.prize)} para o campeão · Reputação +{edition.reputationGain}</p>
         <p>{edition.format==='league'?'Turno único · quatro melhores nos playoffs · semifinais MD3 · final MD5':'Eliminatória simples · séries MD3 · final MD'+edition.finalBestOf}</p>
         <p>Participantes: {edition.participants.map(p=>p.name).join(', ')}.</p>
         {edition.champion&&<p role="status"><strong>Campeão: {name(edition.champion)}</strong></p>}
       </section>
       {edition.format==='league'&&<section className="panel player-table"><h2>Classificação</h2>
         <p className="muted">Desempate: vitórias, saldo, vitórias entre empatados e ID da equipe.</p>
         <table><thead><tr><th>Pos.</th><th>Organização</th><th>Jogos</th><th>Vitórias</th><th>Derrotas</th><th>Saldo</th></tr></thead><tbody>
           {standings(edition).map((row,index)=><tr className={row.team==='career'?'own-team':''} key={row.team}><td>{index+1}</td><th scope="row">{name(row.team)}{index<4?' · Top 4':''}</th><td>{row.played}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.difference}</td></tr>)}
         </tbody></table>
       </section>}
       {['regular','quarterfinal','semifinal','final'].map(phase=>{
         const games=edition.fixtures.filter(g=>g.phase===phase).sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));if(!games.length)return null;
         return <section className="panel player-table" key={phase}><h2>{phases[phase as keyof typeof phases]}</h2>
           <table><thead><tr><th>Data</th><th>Confronto</th><th>Série</th><th>Resultado</th><th>Ação</th></tr></thead><tbody>{games.map(game=><tr key={game.id} className={game.home==='career'||game.away==='career'?'own-team':''}>
             <td>{formatCareerDay(game.day)}</td><td>{name(game.home)} × {name(game.away)}</td><td>MD{game.bestOf}</td><td>{game.result?game.result.score.join(' × '):game.day<=career.day?'Hoje · pendente':'Agendado'}</td>
             <td>{game.result||game.home==='career'||game.away==='career'?<button onClick={()=>onOpenFixture(game.id)}>{game.result?'Ver série':'Abrir confronto →'}</button>:<span className="muted">IA automática</span>}</td>
           </tr>)}</tbody></table>
         </section>;
       })}
       {!!edition.finalOrder.length&&<section className="panel"><h2>Classificação final</h2><ol>{edition.finalOrder.map(id=><li key={id}>{name(id)}</li>)}</ol></section>}
     </>}
   </>}
   {state&&<section className="panel"><h2>Histórico de títulos</h2>
     {!state.awards.length&&<p>Nenhum campeonato concluído.</p>}
     {!!state.awards.length&&<div className="player-table"><table><thead><tr><th>Temporada</th><th>Campeonato</th><th>Campeão</th><th>Prestígio</th><th>Premiação</th></tr></thead><tbody>{state.awards.map(award=>{
       const old=state.seasons.find(s=>s.number===award.season),competition=old?.editions.find(e=>e.id===award.competition_id);
       return <tr key={award.season+award.competition_id} className={award.team_id==='career'?'own-team':''}><td>{old?.year??award.season}</td><td>{award.name}</td><td>{competition?.participants.find(p=>p.id===award.team_id)?.name??award.team_id}</td><td>{award.prestige}</td><td>{money(award.prize)}</td></tr>;
     })}</tbody></table></div>}
   </section>}
 </>;
}

function CompetitionSettings({initial,busy,save}:{initial:CompetitionConfig;busy:boolean;save:(config:CompetitionConfig)=>Promise<void>}){
 const [config,setConfig]=useState(initial),[key,setKey]=useState(Object.keys(initial)[0]);
 const selected=config[key];if(!selected)return null;
 const change=(field:string,value:string|number)=>setConfig(current=>({...current,[key]:{...current[key],[field]:value}}));
 return <form onSubmit={e=>{e.preventDefault();void save(config);}}>
   <div className="world-filters"><label>Competição<select value={key} onChange={e=>setKey(e.target.value)}>{Object.entries(config).map(([id,value])=><option value={id} key={id}>{value.name}</option>)}</select></label>
     <label>Nome<input required maxLength={80} value={selected.name} onChange={e=>change('name',e.target.value)}/></label>
     <label>Premiação ($)<input type="number" required min={0} max={1000000} step=".01" value={selected.prize/100} onChange={e=>change('prize',Math.round(Number(e.target.value)*100))}/></label>
     <label>Reputação do título<input type="number" required min={0} max={15} value={selected.reputationGain} onChange={e=>change('reputationGain',Number(e.target.value))}/></label>
     <label>Final<select value={selected.finalBestOf} disabled={!key.startsWith('cs_')} onChange={e=>change('finalBestOf',Number(e.target.value))}><option value={3}>MD3</option><option value={5}>MD5</option></select></label>
   </div><button disabled={busy}>Salvar para próximas edições</button>
 </form>;
}
