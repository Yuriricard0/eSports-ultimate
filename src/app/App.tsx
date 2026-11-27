import {startingEntry} from '../game-core/entry';
import {defaultCompetitionConfig,regionalLeague} from '../game-core/competitions';
import {gameVersion} from '../version';
import {NewsPageView} from './News';
import {Finances} from './Finances';
import {Competitions} from './Competitions';
import {EquipmentStore} from './EquipmentShop';
import {TrophyRoom} from './TrophyRoom';
import {Matches} from './Matches';
import {Academy} from './Academy';
import {CareerTimeline} from './CareerTimeline';
import {countries,countryRegions} from '../game-core/countries';
import {CareerCalendar} from './CareerCalendar';
import {formatCareerDay,type CalendarResult} from '../game-core/calendar';
import {seasonBoundaries} from '../game-core/renewal';
import {WorldDirectory} from './WorldDirectory';
import type {WorldCatalog} from '../game-core/world';
import {CareerDashboard} from './CareerDashboard';
import {Emblem,IdentityEditor} from './IdentityEditor';
import {EmblemDownload} from './EmblemDownload';
import {defaultIdentity,type Identity} from '../game-core/identity';
import {maxBackupBytes} from '../game-core/backup';
import {GameSettings} from './GameSettings';
import {useEffect,useRef,useState} from 'react';
import {budgets,type Career} from '../game-core/career';
import {observeSaveStatus,type SaveStatus} from '../game-core/save-status';
import {initialize,listCareers,createCareer,exportCareers,listContracts,finishOffer,removeCareer,advanceDays,importCareers,exportGodotSource,saveIdentity,renameSave,listImportedPlayers,listWorldPlayers,setStarter} from '../persistence/repository';
import {Players,money} from './Players';
import type {Contract,Player} from '../game-core/recruitment';
const steps=['Organização','Modalidade','Identidade','Dificuldade','Confirmação'];
export function App(){
 const activeCareerId=useRef<string|null>(null);
 const [saveStatus,setSaveStatus]=useState<SaveStatus>();
 useEffect(()=>observeSaveStatus(setSaveStatus),[]);
 const [newsOrganization,setNewsOrganization]=useState('');
 const [newsCompetition,setNewsCompetition]=useState({id:'',season:0});
 const [openRankedScouting,setOpenRankedScouting]=useState(false);
 const navigateNews=(target:string)=>{
   setOpenRankedScouting(target==='ranked:scouting');
   if(target==='ranked:scouting'){setScreen('ranked');return;}
   if(target.startsWith('organization:')){setNewsOrganization(target.slice(13));setScreen('organizations');return;}
   if(target.startsWith('competition:')){const [,season,...id]=target.split(':');setNewsCompetition({id:id.join(':'),season:Number(season)});setScreen('competitions');return;}
   setNewsOrganization('');setNewsCompetition({id:'',season:0});setScreen(target);
 };
 const [newsPlayer,setNewsPlayer]=useState<number|null>(null);
 const openNewsPlayer=(id:number)=>{setNewsPlayer(id);setScreen('players');};
 const [competitionFixture,setCompetitionFixture]=useState('');
 const openCompetitionFixture=(id:string)=>{setCompetitionFixture(id);setScreen('matches');};
 const [renameDraft,setRenameDraft]=useState<{id:string;name:string}|null>(null);
 const [draftIdentity,setDraftIdentity]=useState<Identity>(defaultIdentity);
 const [importing,setImporting]=useState(false);
 const [saveNotice,setSaveNotice]=useState('');
 const [lastId,setLastId]=useState(()=>localStorage.getItem('uem:last-career')??'');
 const [advancing,setAdvancing]=useState(false);
 const [calendarReport,setCalendarReport]=useState<{id:string;report:CalendarResult}|null>(null);
 const [anniversary,setAnniversary]=useState<{id:string;day:number}|null>(null);
 const [pendingDeletion,setPendingDeletion]=useState<Career|null>(null);
 const [deleting,setDeleting]=useState(false);
 const [catalogPlayers,setPlayers]=useState<Player[]>([]);
 const [world,setWorld]=useState<{id:string;rows:Player[]|null}|null>(null);
 const [imported,setImported]=useState<{id:string;rows:Player[]}|null>(null);
 const [contractState,setContractState]=useState<{careerId:string;rows:Contract[]}|null>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[screen,setScreen]=useState('menu'),[saves,setSaves]=useState<Career[]>([]),[career,setCareer]=useState<Career|null>(null),[step,setStep]=useState(0),[catalog,setCatalog]=useState<WorldCatalog|null>(null);
 const worldReady=!career||world?.id===career.id;
 const worldPlayers=career&&world?.id===career.id?world.rows??catalogPlayers:career?[]:catalogPlayers;
 const players=imported&&imported.id===career?.id?[...imported.rows,...worldPlayers]:worldPlayers;
 const contracts=contractState && contractState.careerId===career?.id ? contractState.rows : [];
 const [form,setForm]=useState({name:'',code:'',country:'BR',mode:'MOBA',difficulty:'Normal',color:'#ef123b',symbol:'animals_wolf'});
 let entryPreview='';
 if(step===4&&catalog){
   try{
     const entry=startingEntry(catalog,form.country,form.mode);
     entryPreview=form.mode==='FPS'?defaultCompetitionConfig.cs_regional.name:catalog.leagues.find(league=>league.id===entry.leagueId)?.name??'';
   }catch{entryPreview='';}
 }
 useEffect(()=>{initialize().then(listCareers).then(rows=>{setSaves(rows);setReady(true);}).catch(e=>setError(e.message));fetch('/data/real_teams_2026.json').then(r=>{if(!r.ok)throw Error('Falha ao carregar catálogo');return r.json();}).then(setCatalog).catch(e=>setError(e.message));},[]);
 useEffect(()=>{fetch('/data/players-v1.json').then(response=>{if(!response.ok)throw Error('Catálogo de jogadores indisponível.');return response.json();}).then(setPlayers).catch(error=>setError(error.message));},[]);
 useEffect(()=>{let active=true;if(career)listContracts(career.id).then(rows=>{if(active)setContractState({careerId:career.id,rows});}).catch(error=>{if(active)setError(error.message);});return()=>{active=false;};},[career?.id]);
 useEffect(()=>{let active=true;if(career?.hasGodotSource)listImportedPlayers(career.id).then(rows=>{if(active)setImported({id:career.id,rows});}).catch(error=>{if(active)setError(String(error));});return()=>{active=false;};},[career?.id]);
 useEffect(()=>{let active=true;if(career)listWorldPlayers(career.id).then(rows=>{if(active)setWorld({id:career.id,rows});}).catch(error=>{if(active)setError(String(error));});return()=>{active=false;};},[career?.id]);
 const currentIdentity=(candidate:Career)=>candidate.identity??{...defaultIdentity,primary:candidate.color,symbol:candidate.symbol};
 const openCareer=(candidate:Career)=>{
   activeCareerId.current=candidate.id;
   setNewsPlayer(null);
   setCompetitionFixture('');
   setCareer(candidate);
   setAnniversary(null);
   setScreen('dashboard');
   localStorage.setItem('uem:last-career',candidate.id);
   setLastId(candidate.id);
 };
 const editIdentity=()=>{
   if(!career)return;
   setDraftIdentity(currentIdentity(career));
   setScreen('identity');
 };
 const commitIdentity=async()=>{
   if(!career)return;
   setBusy(true);
   setError('');
   try{
     const updated=await saveIdentity(career.id,draftIdentity);
     if(activeCareerId.current===updated.id){setCareer(updated);setScreen('dashboard');}
     setSaves(await listCareers());
   }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 const restore=async(file:File,kind:'web'|'godot')=>{
   setImporting(true);
   setError('');
   setSaveNotice('');
   try{
     if(file.size>maxBackupBytes)throw Error('Selecione um backup de até 128 MB.');
     setSaves(await importCareers(await file.arrayBuffer(),kind));
     setSaveNotice(kind==='godot'?'Organização importada. O save original está disponível para baixar.':'Backup restaurado como novas carreiras.');
   }catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setImporting(false);}
 };
 const refreshRoster=async(updated:Career)=>{
   const [rows,players,legacy]=await Promise.all([listContracts(updated.id),listWorldPlayers(updated.id),listImportedPlayers(updated.id)]);
   if(activeCareerId.current===updated.id){
     setCareer(updated);setContractState({careerId:updated.id,rows});setWorld({id:updated.id,rows:players});setImported({id:updated.id,rows:legacy});
   }
   setSaves(await listCareers());
 };
 const sign=async(negotiationId:string)=>{if(career)await refreshRoster(await finishOffer(career.id,negotiationId));};
 const changeStarter=async(playerId:number)=>{
   if(!career)return;
   try {
     await setStarter(career.id,playerId);
     const rows=await listContracts(career.id);
     if(activeCareerId.current===career.id)setContractState({careerId:career.id,rows});
   }catch(error){setError(error instanceof Error?error.message:String(error));}
 };
 const advance=async(days:number)=>{
   if(!career||advancing)return;
   setAdvancing(true);
   setCalendarReport(null);
   setError('');
   try{
     const {career:updated,report}=await advanceDays(career.id,career.day,days);
     const [rows,players,legacy]=await Promise.all([listContracts(updated.id),listWorldPlayers(updated.id),listImportedPlayers(updated.id)]);
     if(activeCareerId.current===updated.id){
       setWorld({id:updated.id,rows:players});setImported({id:updated.id,rows:legacy});setCareer(updated);
       setContractState({careerId:updated.id,rows});setCalendarReport({id:updated.id,report});
       const birthday=seasonBoundaries(career.day,updated.day)[0];
       if(birthday!==undefined)setAnniversary({id:updated.id,day:birthday});
     }
     setSaves(await listCareers());
   }catch(error){setError(error instanceof Error?error.message:String(error));}
   finally{setAdvancing(false);}
 };
 const update=(key:string,value:string)=>setForm({...form,[key]:value});
 const start=async()=>{setBusy(true);setError('');try{const c=await createCareer({...form,identity:draftIdentity});openCareer(c);setSaves(await listCareers());}catch(e){setError(String(e));}finally{setBusy(false);}};

 const download=(bytes:Uint8Array,name:string)=>{
   const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.sqlite3'}));
   const link=document.createElement('a');
   link.href=url;
   link.download=name;
   link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 const backup=async()=>{try{download(await exportCareers(),'uem-web-backup.sqlite');}catch(error){setError(String(error));}};
 const sourceBackup=async(id:string)=>{try{download(await exportGodotSource(id),'carreira-original-godot.sqlite');}catch(error){setError(String(error));}};
 const emblem=(c:Career)=><Emblem identity={currentIdentity(c)} code={c.code}/>;
 return <div className={screen==='menu'?'opening':screen==='wizard'?'application career-stage':'application career-hub'}>
 {saveStatus&&<div className="save-status" role="status">{saveStatus}</div>}
 {career&&anniversary?.id===career.id&&!['menu','wizard','saves','settings','credits','editor'].includes(screen)&&
   <div className="career-anniversary" role="status">Feliz aniversário, {career.name}! A organização celebra mais um ano.
     <button aria-label="Fechar aviso de aniversário" onClick={()=>setAnniversary(null)}>×</button>
   </div>}
 {career&&!['menu','wizard','saves','settings','credits','editor'].includes(screen)&&
   <small className="career-version">Save · {career.createdVersion?`v${career.createdVersion}`:'Versão anterior'}</small>}
 {['wizard','saves','settings','credits','editor'].includes(screen)&&<header><button className="brand" onClick={()=>setScreen('menu')}>ULTIMATE <span>ESPORTS MANAGER</span></button><div className="status">{ready?'● Armazenamento local conectado':'Conectando armazenamento…'}</div></header>}
 {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Fechar aviso">×</button></div>}
 {screen==='menu'?<main className="menu"><div className="eyebrow">CONSTRUA SUA ORGANIZAÇÃO. ESCREVA SUA HISTÓRIA.</div><h1>ULTIMATE<br/><span>ESPORTS</span><br/>MANAGER</h1><p>Do primeiro elenco ao cenário mundial.</p><div className="menu-actions"><button className="primary" disabled={!ready} onClick={()=>{setStep(0);setScreen('wizard');}}>Nova carreira <span>↗</span></button><button disabled={!ready||!saves.length} onClick={()=>{openCareer(saves.find(save=>save.id===lastId)??saves[0]);}}>Continuar <span>→</span></button><button disabled={!ready} onClick={()=>setScreen('saves')}>Carreiras salvas <span>{saves.length}</span></button><button onClick={()=>setScreen('organizations')}>Explorar organizações <span>556</span></button><button onClick={()=>setScreen('editor')}>Editor de escudo</button><button onClick={()=>setScreen('settings')}>Configurações</button><button onClick={()=>setScreen('credits')}>Créditos</button></div><small>WEB · {gameVersion}<br/>{ready?'Saves locais em SQLite':'Preparando armazenamento seguro…'}</small></main>:
 screen==='wizard'?<main className="wizard"><h1>Nova carreira</h1><nav className="steps">{steps.map((s,i)=><span key={s} className={i===step?'active':''} aria-current={i===step?'step':undefined}><b>{i+1}</b>{s}</span>)}</nav><section className="panel"><h2>{steps[step]}</h2>
 {step===0&&<div className="fields"><label>Nome da organização<input maxLength={60} value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Como sua organização será conhecida?"/></label><label>Sigla · até 3 letras<input maxLength={3} value={form.code} onChange={e=>update('code',e.target.value.replace(/[^a-z]/gi,'').toUpperCase().slice(0,3))} placeholder="UEM"/></label><label>País<select value={form.country} onChange={e=>update('country',e.target.value)}>{Object.entries(countries).map(([id,n])=><option value={id} key={id}>{n}</option>)}</select></label><label>Região<input readOnly value={countryRegions[form.country]??''}/></label></div>}

 {step===1&&<div className="choices modality-choices">{['MOBA','FPS'].map(mode=><button key={mode} aria-pressed={form.mode===mode} className={form.mode===mode?'selected':''} onClick={()=>update('mode',mode)}>
   <img src={'/assets/backgrounds/'+mode.toLowerCase()+'-final.png'} alt=""/>
   <div className="modality-title"><strong>{mode}</strong><span>{mode==='MOBA'?'Estratégia e controle de mapa':'Mira e execução tática'}</span></div>
   <p>{mode==='MOBA'?'Top · Jungle · Mid · ADC · Support':'Entry · Support · AWPer · IGL · Lurker'}</p>
   <span className="modality-action">{form.mode===mode?'Selecionado ✓':'Escolher '+mode}</span>
 </button>)}</div>}
 {step===2&&<IdentityEditor value={draftIdentity} onChange={setDraftIdentity} code={form.code}/>}
 {step===3&&<div className="choices">{Object.entries(budgets).map(([d,b])=><button key={d} className={form.difficulty===d?'selected':''} onClick={()=>update('difficulty',d)}><h3>{d}</h3><strong>{money(b)}</strong><p>Capital inicial</p></button>)}</div>}
 {step===4&&<div className="identity"><Emblem identity={draftIdentity} code={form.code}/><div><h2>{form.name} · {form.code}</h2><p>{countries[form.country]} · {countryRegions[form.country]} · {form.mode==='FPS'?'Counter-Strike 2':'League of Legends'}</p><p>Dificuldade {form.difficulty} · Caixa inicial {money(budgets[form.difficulty])}</p><p>Fundação em {formatCareerDay(1)}</p>
   {entryPreview?<><p><strong>Competição inicial:</strong> {entryPreview} · {form.mode==='FPS'?'Circuito aberto':'Divisão de desenvolvimento'}</p>
   <p>{form.mode==='FPS'?'Os resultados oficiais definem o ranking. As oito equipes elegíveis mais bem colocadas recebem vaga no Major da temporada seguinte.':'O título da divisão de entrada dá acesso à '+defaultCompetitionConfig[regionalLeague(form.country)].name+' na temporada seguinte.'}</p></>:<p role="status">Competição inicial indisponível para esta seleção.</p>}<p className="muted">Sua organização começa com o elenco vazio. Use o mercado para contratar agentes livres.</p></div></div>}
 </section><footer><button onClick={()=>step?setStep(step-1):setScreen('menu')}>← Voltar</button><button className="primary" disabled={!ready||busy||(step===4&&!entryPreview)||(step===0&&(!form.name.trim()||!form.code.trim()))} onClick={()=>step===4?start():setStep(step+1)}>{busy?'Salvando…':step===4?'Criar carreira':'Próximo →'}</button></footer></main>:


 screen==='editor'?<main className="content"><h1>Editor de escudo</h1><IdentityEditor value={draftIdentity} onChange={setDraftIdentity} code={form.code}/><footer><button onClick={()=>{setStep(0);setScreen('wizard');}}>Usar em nova carreira</button></footer></main>:
 screen==='settings'?<GameSettings/>:
 screen==='credits'?<main className="content"><h1>Créditos</h1><p>Ultimate eSports Manager · Projeto original em Godot, edição web em React.</p><p>Tipografia Barlow. Os escudos reais pertencem às respectivas organizações.</p><a href="/assets/fonts/OFL.txt">Licença da fonte</a></main>:
 screen==='saves'?<main className="content saves-page">
   <h1>Carreiras salvas</h1>{saveNotice&&<p role="status">{saveNotice}</p>}
   {renameDraft&&<form className="panel" aria-label="Renomear save" onSubmit={async event=>{
     event.preventDefault();
     setBusy(true);
     setError('');
     try{setSaves(await renameSave(renameDraft.id,renameDraft.name));setRenameDraft(null);}
     catch(reason){setError(String(reason));}
     finally{setBusy(false);}
   }}>
     <label>Nome do save<input autoFocus maxLength={60} placeholder="Nome da organização" value={renameDraft.name}
       onChange={event=>setRenameDraft({...renameDraft,name:event.target.value})}/></label>
     <button type="button" disabled={busy} onClick={()=>setRenameDraft(null)}>Cancelar</button>
     <button className="primary" disabled={busy}>Salvar nome</button>
   </form>}
   {pendingDeletion&&<section className="panel delete-confirm" aria-label="Confirmar exclusão">
     <h2>Excluir {pendingDeletion.name}?</h2>
     <p>Esta carreira, seus contratos e registros financeiros serão removidos deste navegador.</p>
     <button autoFocus disabled={deleting} onClick={()=>setPendingDeletion(null)}>Cancelar</button>
     <button className="primary" disabled={deleting} onClick={async()=>{
       setDeleting(true);
       try{
         setSaves(await removeCareer(pendingDeletion.id));
         if(activeCareerId.current===pendingDeletion.id)activeCareerId.current=null;
         setCareer(current=>current?.id===pendingDeletion.id?null:current);
         setPendingDeletion(null);
       }catch(error){setError(error instanceof Error?error.message:String(error));}
       finally{setDeleting(false);}
     }}>{deleting?'Excluindo…':'Confirmar exclusão'}</button>
   </section>}
   {!saves.length&&<p>Nenhuma carreira criada ainda.</p>}
   {saves.map(c=><article className="save-card" key={c.id}>
     <button className="save-row" aria-label={'Abrir carreira '+c.name} onClick={()=>{setPendingDeletion(null);openCareer(c);}}>
       {emblem(c)}<div><h2>{c.saveName||c.name}</h2><p>{c.saveName?c.name+' · ':''}{c.mode} · {c.difficulty} · Dia {c.day}</p><small>{c.createdVersion?`Criada na v${c.createdVersion}`:'Versão anterior'}</small></div><strong>{money(c.balance)} →</strong>
     </button>
     <button disabled={busy||deleting} aria-label={'Renomear save '+c.name} onClick={()=>{setPendingDeletion(null);setRenameDraft({id:c.id,name:c.saveName||c.name});}}>Renomear</button>
     <button className="delete-save" aria-label={'Excluir carreira '+c.name} disabled={deleting} onClick={()=>{setRenameDraft(null);setPendingDeletion(c);}}>Excluir</button>
     {Boolean(c.hasGodotSource)&&<button onClick={()=>void sourceBackup(c.id)}>Baixar original Godot</button>}
   </article>)}

   <section className="panel backup-actions">
     <h2>Cópias de segurança</h2>
     <button disabled={!saves.length||importing} onClick={backup}>Exportar backup SQLite</button>
     <label>Restaurar backup web<input type="file" accept=".sqlite,.sqlite3,.db,.bak" disabled={importing||!ready} onChange={event=>{
       const file=event.target.files?.[0];event.target.value='';if(file)void restore(file,'web');
     }}/></label>
     <label>Importar organização do Godot<input type="file" accept=".sqlite,.db,.bak" disabled={importing||!ready} onChange={event=>{
       const file=event.target.files?.[0];event.target.value='';if(file)void restore(file,'godot');
     }}/></label>
     <p className="muted">A importação do Godot traz o clube, seus atletas, contratos ativos e histórico dos atletas importados. O mundo rival continua usando o catálogo web. O original fica disponível para baixar.</p>
     {importing&&<p role="status">Validando e importando…</p>}
   </section>
 </main>:
 <div className="layout"><aside>{career&&emblem(career)}<strong>{career?.name||'Mundo competitivo'}</strong>{[['dashboard','Central da Carreira'],['organizations','Organizações'],['leagues','Ligas e circuitos'],['calendar','Calendário'],['timeline','Linha do tempo'],['roster','Elenco'],['academy','Academy'],['training','Treinamento'],['matches','Partidas'],['competitions','Competições'],['trophies','Sala de Troféus'],['finances','Finanças'],['shop','Loja'],['news','Notícias'],['players','Jogadores'],['ranked','Ranked'],['market','Mercado'],['saves','Carreiras salvas']].map(([key,label])=><button className={screen===key?'current':''} key={key} disabled={['dashboard','calendar','timeline','roster','academy','training','matches','competitions','trophies','finances','shop','news','players','ranked','market'].includes(key)&&!career} onClick={()=>{if(key==='matches')setCompetitionFixture('');if(key==='players')setNewsPlayer(null);navigateNews(key);}}>{label}</button>)}<button disabled={!career} onClick={editIdentity}>Identidade</button><button onClick={()=>setScreen('menu')}>← Menu principal</button></aside><main className="content">{screen==='organizations'||screen==='leagues'?catalog?<WorldDirectory key={(career?.id??'guest')+screen+newsOrganization} catalog={catalog} players={players} view={screen} initialOrganizationId={newsOrganization} onNavigate={setScreen} career={career} contracts={contracts}/>:<p>Catálogo indisponível.</p>:career&&['roster','players','ranked','market'].includes(screen)?!worldReady?<p role="status">Carregando jogadores da carreira…</p>:<Players key={career.id+screen+String(newsPlayer)+String(openRankedScouting)} initialScouting={openRankedScouting} initialPlayerId={newsPlayer} career={career} players={players} contracts={contracts} organizations={Object.fromEntries((catalog?.organizations??[]).map(org=>[org.id,org.name]))} view={screen} onFinish={sign} onStarter={changeStarter} onUpdated={refreshRoster}/>:career&&screen==='news'?!worldReady?<p role="status">Carregando acontecimentos…</p>:<NewsPageView key={career.id} career={career} players={players} contracts={contracts} catalog={catalog} onPlayer={openNewsPlayer} onFixture={openCompetitionFixture} onNavigate={navigateNews}/>:career&&screen==='shop'?<EquipmentStore key={career.id} career={career} players={players} onUpdated={refreshRoster}/>:career&&screen==='finances'?<Finances key={career.id} career={career} players={players} onUpdated={refreshRoster} onCalendar={()=>setScreen('calendar')} onShop={()=>setScreen('shop')}/>:career&&screen==='trophies'?<TrophyRoom key={career.id} career={career} onOpenFixture={openCompetitionFixture}/>:career&&screen==='competitions'?!worldReady?<p role="status">Carregando participantes…</p>:<Competitions key={career.id+newsCompetition.id} career={career} initialEditionId={newsCompetition.id} initialSeason={newsCompetition.season} onOpenFixture={openCompetitionFixture} onOpenOrganization={id=>navigateNews(id==='career'?'dashboard':'organization:'+id)}/>:career&&screen==='matches'?!worldReady||!catalog?<p role="status">Carregando elencos…</p>:<Matches key={career.id+competitionFixture} fixtureId={competitionFixture||undefined} onCompetitions={()=>setScreen('competitions')} career={career} players={players} contracts={contracts} catalog={catalog} onUpdated={refreshRoster} onRoster={()=>setScreen('roster')}/>:career&&(screen==='academy'||screen==='training')?!worldReady?<p role="status">Carregando jogadores da carreira…</p>:<Academy key={career.id+screen} career={career} players={players} contracts={contracts} view={screen} onUpdated={refreshRoster} onMarket={()=>setScreen('market')} onScouting={()=>navigateNews('ranked:scouting')} organizations={Object.fromEntries((catalog?.organizations??[]).map(org=>[org.id,org.name]))}/>:career&&screen==='timeline'?<CareerTimeline key={career.id} career={career} players={players} contracts={contracts}/>:career&&screen==='calendar'?<CareerCalendar key={career.id} onTraining={()=>setScreen('training')} career={career} players={players} contracts={contracts} onRoster={()=>setScreen('roster')} advance={advance} busy={advancing} report={calendarReport?.id===career.id?calendarReport.report:undefined} onMatches={()=>{setCompetitionFixture('');setScreen('matches');}} onCompetitions={()=>setScreen('competitions')} onOpenFixture={openCompetitionFixture}/>:career&&screen==='identity'?<><h1>Identidade da organização</h1><EmblemDownload identity={currentIdentity(career)} code={career.code}/><IdentityEditor value={draftIdentity} code={career.code} onChange={setDraftIdentity}/><footer><button disabled={busy} onClick={()=>setScreen('dashboard')}>Cancelar</button><button className="primary" disabled={busy} onClick={commitIdentity}>Salvar identidade</button></footer></>:career&&<CareerDashboard catalog={catalog} onNewsPlayer={openNewsPlayer} onNewsFixture={openCompetitionFixture} career={career} country={countries[career.country]??career.country} players={players} contracts={contracts} emblem={emblem(career)} leagueName={catalog?.leagues.find(league=>league.id===career.entry?.leagueId)?.name} navigate={screen=>{if(screen==='matches')setCompetitionFixture('');if(screen==='players')setNewsPlayer(null);navigateNews(screen);}} advance={()=>advance(1)} busy={advancing}/>}</main></div>}
 {screen!=='menu'&&<footer className="game-version-footer">{gameVersion}</footer>}
 </div>;
}
