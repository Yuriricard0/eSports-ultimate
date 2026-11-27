import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import {optionalEventConflicts,optionalEventDays,regionalLeague,standings,type CompetitionConfig,type Season,type StageRules} from '../game-core/competitions';
import {formatCareerDay} from '../game-core/calendar';
import {enrollCompetition,getTrainingAgenda,listCompetitions,saveCompetitionConfig,startCompetitionSeason,type CompetitionState,type TrainingAgendaItem} from '../persistence/repository';
import {money} from './Players';
import {CompetitionEdition,EventMark,eventStatus} from './CompetitionEdition';
import {useViewPreference} from './view-preferences';

const sections=['Todas','Em andamento','Em breve','Minha organização','Internacionais','Favoritas','Resultados'] as const;
export function Competitions({career,onOpenFixture,onOpenOrganization,initialEditionId='',initialSeason=0}:{career:Career;onOpenFixture:(id:string)=>void;onOpenOrganization?:(id:string)=>void;initialEditionId?:string;initialSeason?:number}){
 const [state,setState]=useState<CompetitionState|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const prefix=career.id+':competitions:';
 const [year,setYear]=useViewPreference(prefix+'season',initialSeason);
 const [selected,setEdition]=useViewPreference(prefix+'edition',initialEditionId);
 const [section,setSection]=useViewPreference<typeof sections[number]>(prefix+'section','Todas');
 const [mode,setMode]=useViewPreference(prefix+'mode',''),[region,setRegion]=useViewPreference(prefix+'region','');
 const [favorites,setFavorites]=useState<string[]>(()=>{
   try{const stored:unknown=JSON.parse(localStorage.getItem(prefix+'favorites')??'[]');return Array.isArray(stored)?stored.filter((item):item is string=>typeof item==='string'):[];}
   catch{return [];}
 });
 const [training,setTraining]=useState<TrainingAgendaItem[]>([]);
 useEffect(()=>{if(initialEditionId)setEdition(initialEditionId);},[initialEditionId]);
 useEffect(()=>{let active=true;listCompetitions(career.id).then(data=>{if(active)setState(data);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[career]);
 useEffect(()=>{
   if(!state?.seasons[0]?.editions.some(e=>e.entryWindow))return;
   let active=true;
   void getTrainingAgenda(career.id).then(rows=>{if(active)setTraining(rows);}).catch(()=>{if(active)setTraining([]);});
   return()=>{active=false;};
 },[career,state]);
 const season=state?.seasons.find(s=>s.number===year)??state?.seasons[0];
 const detailSeason=state?.seasons.find(item=>item.editions.some(event=>event.id===selected));
 const edition=detailSeason?.editions.find(event=>event.id===selected);
 const latest=state?.seasons[0],finished=!latest||latest.editions.every(e=>e.champion);
 const toggleFavorite=(key:string)=>{
   const next=favorites.includes(key)?favorites.filter(item=>item!==key):[...favorites,key];
   setFavorites(next);try{localStorage.setItem(prefix+'favorites',JSON.stringify(next));}catch{}
 };
 const regions=[...new Set(state?.seasons.flatMap(item=>item.editions.map(event=>event.region))??[])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const visible=(season?.editions??[]).filter(event=>(!mode||event.mode===mode)&&(!region||event.region===region)&&(
   section==='Todas'||section==='Minha organização'&&event.participants.some(team=>team.id==='career')||
   section==='Internacionais'&&event.prestige!=='Regional'||section==='Favoritas'&&favorites.includes(event.key)||
   section==='Resultados'&&eventStatus(event,career.day)==='Concluída'||section===eventStatus(event,career.day)
 )).sort((a,b)=>a.startDay-b.startDay||a.name.localeCompare(b.name,'pt-BR'));
 const perform=async(action:()=>Promise<unknown>)=>{
   if(busy)return;setBusy(true);setError('');setNotice('');
   try{await action();setState(await listCompetitions(career.id));}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}finally{setBusy(false);}
 };
 if(state&&edition&&detailSeason)return <CompetitionEdition key={edition.id} edition={edition} season={detailSeason} seasons={state.seasons} preferenceKey={prefix}
   day={career.day} back={()=>setEdition('')} openEdition={event=>setEdition(event.id)} openFixture={onOpenFixture} openOrganization={onOpenOrganization}
   favorite={favorites.includes(edition.key)} toggleFavorite={()=>toggleFavorite(edition.key)}/>;
 return <>
   <header className="event-hero event-portal-hero"><div><span className="event-kicker">{formatCareerDay(career.day)}</span><h1>Portal de Competições</h1>
     <p>{season?'Temporada '+season.year+' · '+season.editions.length+' competições':'Ligas regionais e circuitos internacionais'}</p></div></header>
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
       {!!state.seasons.length&&<div className="world-filters"><label>Temporada<select value={season?.number} onChange={e=>{setYear(Number(e.target.value));setEdition('');}}>
         {state.seasons.map(s=><option key={s.number} value={s.number}>{s.year} · Temporada {s.number}</option>)}
       </select></label>
       <label>Modalidade<select value={mode} onChange={e=>setMode(e.target.value)}><option value="">Todas</option><option value="MOBA">MOBA</option><option value="FPS">CS2</option></select></label>
       <label>Região<select value={region} onChange={e=>setRegion(e.target.value)}><option value="">Todas</option>{regions.map(item=><option key={item}>{item}</option>)}</select></label>
       </div>}
     </section>
     {season&&<section className="event-directory" aria-label="Campeonatos da temporada">
       <nav className="event-tabs" aria-label="Filtros de competições">{sections.map(item=>
         <button key={item} aria-pressed={section===item} onClick={()=>setSection(item)}>{item}</button>)}</nav>
       <div className="event-cards">{visible.map(event=><article key={event.id} className="event-card">
         <button className="event-card-main" onClick={()=>setEdition(event.id)}><EventMark event={event}/>
           <span><small>{event.mode==='FPS'?'CS2':'MOBA'} · {event.prestige} · {event.region}</small><strong>{event.name}</strong>
             <small>{eventStatus(event,career.day)} · {formatCareerDay(event.startDay)}</small>
             {event.champion&&<small>Campeã · {event.participants.find(team=>team.id===event.champion)?.name??event.champion}</small>}
           </span></button>
         <button className="event-card-star" aria-label={'Favoritar '+event.name} aria-pressed={favorites.includes(event.key)} onClick={()=>toggleFavorite(event.key)}>
           {favorites.includes(event.key)?'★':'☆'}
         </button>
       </article>)}</div>
       {!visible.length&&<p className="panel">Nenhuma competição para os filtros selecionados.</p>}
     </section>}
     <details className="panel"><summary>Caminho para a elite e rankings</summary>
       <CareerPath career={career} season={latest}/>
       {state.rankings&&<RankingPanel rankings={state.rankings} mode={career.mode}/>}
     </details>
     <details className="panel"><summary>Configurar próximas edições</summary>
       <CompetitionSettings key={career.id} initial={state.config} busy={busy} save={config=>perform(async()=>{await saveCompetitionConfig(career.id,config);setNotice('Configuração salva para as próximas edições.');})}/>
     </details>
   </>}
   {season&&<>
     {season.editions.some(e=>e.entryWindow)&&<section className="panel">
       <h2>Inscrições em torneios opcionais</h2>
       <div className="competition-cards">{season.editions.flatMap(event=>{
         const window=event.entryWindow;if(!window)return [];
         const conflicts=optionalEventConflicts(season,event);
         const trainingConflicts=training.filter(row=>row.mode===event.mode&&optionalEventDays(event).includes(row.day));
         const enrolled=event.participants.some(team=>team.id==='career');
         const open=career.day>=window.opens&&career.day<=window.closes;
         return [<article key={event.id} className="panel">
           <h3>{event.name}</h3>
           <p>{event.prestige} · {money(event.prize)} para o campeão</p>
           <p>Torneio de {formatCareerDay(event.startDay)} a {formatCareerDay(event.endDay)}.</p>
           <p>Inscrições de {formatCareerDay(window.opens)} a {formatCareerDay(window.closes)}.</p>
           <p>{window.requirement}</p>
           {event.qualifierTarget&&<p>O campeão conquista vaga em {season.editions.find(edition=>edition.key===event.qualifierTarget)?.name}.</p>}
           <p>{enrolled?'Inscrição confirmada.':!window.eligible?'Organização inelegível nesta temporada.':career.day<window.opens?'Inscrições em breve.':open?'Inscrições abertas.':'Inscrições encerradas.'}</p>
           {!!conflicts.length&&<p>Conflito com {conflicts.map(item=>item.name).join(', ')}.</p>}
           {!!trainingConflicts.length&&<p>Treinamento marcado em {trainingConflicts.map(item=>formatCareerDay(item.day)).join(', ')}.</p>}
           {!enrolled&&<p className="muted">A inscrição adiciona até três séries ao calendário. Se vencer, a equipe joga novamente sete dias depois.</p>}
           {!enrolled&&open&&window.eligible&&season===latest&&<button className="primary" disabled={busy||!!conflicts.length||!!trainingConflicts.length} onClick={()=>void perform(async()=>{
             await enrollCompetition(career.id,event.id);setNotice('Inscrição confirmada. O primeiro confronto aparece no calendário.');
           })}>Inscrever organização</button>}
         </article>];
       })}</div>
     </section>}
     {season.fpsRanking&&<section className="panel"><h2>Ranking de acesso ao Major</h2>
       <p>{season.fpsRanking.length?'Classificação por resultados da temporada anterior. O Major tem oito vagas.':'O ranking começa após os primeiros resultados oficiais. Sua organização estreia no circuito regional.'}</p>
       {!!season.fpsRanking.length&&<ol>{season.fpsRanking.slice(0,8).map(row=><li key={row.organization}>{row.organization==='career'?career.name:state?.seasons.flatMap(s=>s.editions).flatMap(e=>e.participants).find(p=>p.organization===row.organization)?.name??row.organization} · {row.points} pts</li>)}</ol>}
       {season.fpsRanking.length>0&&<p>{season.editions.some(e=>e.key==='cs_major'&&e.participants.some(p=>p.id==='career'))?'Sua organização conquistou uma vaga no Major.':'Sua organização ficou fora das vagas do Major nesta temporada.'}</p>}
     </section>}
     {!!season.notices.length&&<section className="panel"><h2>Edições indisponíveis</h2>{season.notices.map(message=><p key={message}>{message}</p>)}</section>}
   </>}
   {state&&<section className="panel"><h2>Histórico de títulos</h2>
     {!state.awards.length&&<p>Nenhum campeonato concluído.</p>}
     {!!state.awards.length&&<div className="player-table"><table><thead><tr><th>Temporada</th><th>Campeonato</th><th>Campeão</th><th>Prestígio</th><th>Premiação</th></tr></thead><tbody>{state.awards.map(award=>{
       const old=state.seasons.find(s=>s.number===award.season),competition=old?.editions.find(e=>e.id===award.competition_id);
       return <tr key={award.season+award.competition_id} className={award.team_id==='career'?'own-team':''}><td>{old?.year??award.season}</td><td>{competition?<button onClick={()=>setEdition(competition.id)}>{award.name}</button>:award.name}</td><td>{competition?.participants.find(p=>p.id===award.team_id)?.name??award.team_id}</td><td>{award.prestige}</td><td>{money(award.prize)}</td></tr>;
     })}</tbody></table></div>}
   </section>}
 </>;
}

function RankingPanel({rankings,mode}:{rankings:NonNullable<CompetitionState['rankings']>;mode:string}){
 const [scope,setScope]=useState<'regional'|'world'>('regional');
 const board=rankings[scope],own=board.rows.find(row=>row.organization==='career');
 const rows=board.rows.slice(0,10);
 if(own&&own.position>10)rows.push(own);
 const variation=(position:number,previous:number|null)=>{
   if(previous===null)return 'Nova entrada';
   const gain=previous-position;
   return gain===0?'—':gain>0?'↑ '+gain:'↓ '+Math.abs(gain);
 };
 return <section className="panel">
   <h2>Ranking competitivo · {mode==='FPS'?'CS2':'MOBA'}</h2>
   <p className="muted">Pontos por colocação em campeonatos concluídos, com peso pelo nível e tamanho do torneio e redução com o tempo.</p>
   <p className="muted">O ranking mede resultados esportivos. A força estimada mede a capacidade atual do elenco. A posição anterior usa o fechamento da temporada anterior, ou 30 dias atrás na primeira temporada.</p>
   <label>Abrangência<select value={scope} onChange={e=>setScope(e.target.value==='world'?'world':'regional')}>
     <option value="regional">Regional · {rankings.region}</option><option value="world">Mundial</option>
   </select></label>
   {rows.length?<div className="player-table"><table><thead><tr><th>Pos.</th><th>Organização</th><th>Pontos</th><th>Posição anterior</th><th>Variação</th></tr></thead>
     <tbody>{rows.map(row=><tr key={row.organization} className={row.organization==='career'?'own-team':''}>
       <td>{row.position}</td><th scope="row">{row.team}</th><td>{row.points}</td><td>{row.previous??'—'}</td><td>{variation(row.position,row.previous)}</td>
     </tr>)}</tbody></table></div>:<p>O ranking começa após os primeiros campeonatos concluídos.</p>}
   {own&&<details><summary>Resultados que mais contribuíram para sua posição</summary>
     <ul>{own.results.map(result=><li key={result.id}>{result.name} · {result.place}º lugar · {result.points} pts · {formatCareerDay(result.day)}</li>)}</ul>
   </details>}
   {!!board.history.length&&<details><summary>Sua evolução por temporada</summary>
     <ul>{board.history.map(row=><li key={row.season}>{row.year} · {row.position===null?'Sem posição':row.position+'º lugar · '+row.points+' pts'}</li>)}</ul>
   </details>}
   <details><summary>Prestígio regional por resultados internacionais</summary>
     <ul>{rankings.prestige.map(region=><li key={region.id}><strong>{region.name}</strong> · {region.value}/100
       {region.history.length>1&&<small> · {region.history.map(row=>row.year+' '+row.value).join(' → ')}</small>}</li>)}</ul>
   </details>
 </section>;
}

function CareerPath({career,season}:{career:Career;season?:Season}){
 const fps=career.mode==='FPS';
 const elite=season?.pyramid?.elite??regionalLeague(career.country);
 const access=season?.pyramid?.access??career.entry?.leagueId;
 const home=season?.editions.find(row=>row.key!==season.pyramid?.playIn&&row.participants.some(team=>team.id==='career'));
 const survival=season?.editions.find(row=>row.key===season.pyramid?.playIn&&row.participants.some(team=>team.id==='career'));
 const ranking=season?.fpsRanking?.findIndex(row=>row.organization==='career')??-1;
 const finalPlace=home?.finalOrder.indexOf('career')??-1;
 const regularPlace=home?.format==='league'?standings(home).findIndex(row=>row.team==='career')??-1:-1;
 const major=season?.editions.some(row=>row.key==='cs_major'&&row.participants.some(team=>team.id==='career'));
 const world=season?.editions.find(row=>row.key==='moba_world');
 const stage=fps?(major?'Major':home?'Circuito regional':'Classificatória regional'):
   home?.key===elite||!career.entry&&!home?'Divisão principal':home?'Divisão de acesso':'Inscrição na divisão de acesso';
 return <section className="panel competition-path">
   <h2>Caminho para a elite</h2>
   <p>Patamar atual <strong>{stage}</strong>{home?' · '+home.name:''}</p>
   <ol>
     {fps?<><li><strong>Entrada regional</strong><small>Oito equipes. Inscrição pela região com cinco titulares elegíveis.</small></li>
       <li><strong>Ranking competitivo</strong><small>{ranking<0?'Primeiros pontos após concluir um torneio válido.':'Posição registrada: #'+(ranking+1)+'.'}</small></li>
       <li><strong>Circuito internacional</strong><small>Convites conforme resultados e vagas do torneio.</small></li>
       <li><strong>Major</strong><small>Oito vagas definidas pelo ranking de acesso.</small></li></>:
       <><li><strong>Entrada regional</strong><small>{access??'Configuração da carreira original'} · cinco titulares elegíveis.</small></li>
       <li><strong>Divisão de acesso</strong><small>O melhor colocado elegível sobe. O segundo elegível disputa a vaga adicional. Uma organização já presente na elite não pode ocupar outra vaga.</small></li>
       <li><strong>Divisão principal</strong><small>O último cai. O penúltimo disputa a permanência quando houver desafiante.</small></li>
       <li><strong>Mundial</strong><small>{world?.participants.some(team=>team.id==='career')?'Sua organização se classificou.':world?.internationalSlots?'As melhores de cada liga principal avançam conforme as vagas regionais publicadas.':'Campeã e vice de cada liga principal avançam à fase de grupos.'}</small></li></>}
   </ol>
   {finalPlace>=0?<p>Resultado final da temporada · {finalPlace+1}º lugar.</p>:regularPlace>=0&&<p>Posição na fase regular · {regularPlace+1}º de {home?.participants.length}.</p>}
   {survival&&<p>Disputa de permanência · {survival.champion?(survival.champion==='career'?'vaga na elite conquistada':'vaga na elite ficou com o adversário'):formatCareerDay(survival.startDay)+' · MD5'}.</p>}
 </section>;
}

function CompetitionSettings({initial,busy,save}:{initial:CompetitionConfig;busy:boolean;save:(config:CompetitionConfig)=>Promise<void>}){
 const [config,setConfig]=useState(initial),[key,setKey]=useState(Object.keys(initial)[0]);
 const selected=config[key];if(!selected)return null;
 const change=(field:string,value:string|number)=>setConfig(current=>({...current,[key]:{...current[key],[field]:value}}));
 const stage=selected.stageRules;
 const stageField=<K extends keyof StageRules>(field:K,label:string,options:[StageRules[K],string][])=>stage&&<label>{label}
   <select value={stage[field]} onChange={e=>{
     const value=options.find(([value])=>String(value)===e.target.value)?.[0];
     if(value!==undefined)setConfig(current=>({...current,[key]:{...current[key],stageRules:{...stage,[field]:value}}}));
   }}>{options.map(([value,name])=><option key={String(value)} value={value}>{name}</option>)}</select>
 </label>;
 const series:[[1,'MD1'],[3,'MD3'],[5,'MD5']]=[[1,'MD1'],[3,'MD3'],[5,'MD5']];
 return <form onSubmit={e=>{e.preventDefault();void save(config);}}>
   <div className="world-filters"><label>Competição<select value={key} onChange={e=>setKey(e.target.value)}>{Object.entries(config).map(([id,value])=><option value={id} key={id}>{value.name}</option>)}</select></label>
     <label>Nome<input required maxLength={80} value={selected.name} onChange={e=>change('name',e.target.value)}/></label>
     <label>Premiação ($)<input type="number" required min={0} max={1000000} step=".01" value={selected.prize/100} onChange={e=>change('prize',Math.round(Number(e.target.value)*100))}/></label>
     <label>Reputação do título<input type="number" required min={0} max={15} value={selected.reputationGain} onChange={e=>change('reputationGain',Number(e.target.value))}/></label>
     <label>Final<select value={selected.finalBestOf} disabled={!key.startsWith('cs_')&&!stage} onChange={e=>change('finalBestOf',Number(e.target.value))}><option value={3}>MD3</option><option value={5}>MD5</option></select></label>
   </div>
   {stage&&<div className="world-filters">
     {key!=='cs_major'&&stageField('opening','Série da primeira fase',series)}
     {stageField('upper','Séries da chave superior',series)}
     {stageField('lower','Séries da chave inferior',series)}
     {stageField('grandFinal','Grande final',[['reset','Reset se a chave inferior vencer'],['single','Série única']])}
     {stageField('seeding','Cabeças de chave',[['ranked','Classificação esportiva'],['draw','Sorteio']])}
     {key!=='cs_major'&&stageField('tieBreak','Desempate após saldo',[['head-to-head','Confronto direto'],['opponent-wins','Vitórias dos adversários']])}
     {key==='moba_world'&&stageField('groups','Número de grupos',[[2,'2 grupos'],[4,'4 grupos']])}
     {key==='moba_world'&&stageField('groupAdvance','Classificados por grupo',[[1,'1 por grupo'],[2,'2 por grupo']])}
     {key==='moba_world'&&stageField('regionalSlots','Vagas por região',[['fixed','Duas por liga'],['prestige','Por prestígio · mínimo 1 e máximo 3']])}
     {key==='cs_interregional'&&stageField('swissRounds','Rodadas suíças',[[3,'3 rodadas'],[4,'4 rodadas'],[5,'5 rodadas']])}
     {key==='cs_interregional'&&stageField('swissAdvance','Classificados no suíço',[[4,'4 equipes'],[8,'8 equipes']])}
   </div>}
   <button disabled={busy}>Salvar para próximas edições</button>
 </form>;
}
