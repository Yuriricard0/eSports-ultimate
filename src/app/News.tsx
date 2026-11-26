import {useEffect,useRef,useState} from 'react';
import {useViewPreference} from './view-preferences';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import type {WorldCatalog} from '../game-core/world';
import {type NewsItem,type NewsPage} from '../game-core/news';
import {formatCareerDay} from '../game-core/calendar';
import {defaultIdentity} from '../game-core/identity';
import {listCareerNews,listCompetitions} from '../persistence/repository';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';

export type NewsProps={career:Career;players:Player[];contracts:Contract[];catalog?:WorldCatalog|null;onPlayer:(id:number)=>void;onFixture:(id:string)=>void;onNavigate:(screen:string)=>void};
const categoryNames:Record<string,string>={Campeonatos:'Competições',Jogadores:'Jogadores e talentos',Organizações:'Organizações'};
const categoryName=(category:string)=>categoryNames[category]??category;
const discipline=(mode?:string)=>mode==='FPS'?'Counter-Strike 2':mode==='MOBA'?'MOBA':mode;

function NewsBadge({item,...props}:NewsProps&{item:NewsItem}){
 const [broken,setBroken]=useState('');
 const org=props.catalog?.organizations.find(org=>org.id===item.organizationId);
 const player=props.players.find(player=>player.id===item.playerId);
 if(item.visual?.kind==='player'&&player)return <PlayerPortrait index={player.portraitIndex}/>;
 if(item.organizationId==='career')return <Emblem identity={props.career.identity??{...defaultIdentity,primary:props.career.color,symbol:props.career.symbol}} code={props.career.code}/>;
 if(org?.logo&&org.logo!==broken)return <img src={org.logo.replace('res://','/')} alt={'Escudo de '+org.name} loading="lazy" onError={()=>setBroken(org.logo)}/>;
 return <span className="news-monogram">{org?.code??(player?'ATLETA':'UEM')}</span>;
}
function NewsVisual({item,...props}:NewsProps&{item:NewsItem}){
 const visual=item.visual;
 return <div className={'news-visual news-visual-'+(visual?.kind??'organization')}>
   <span className="news-visual-label">{visual?.label??discipline(item.mode)??'Mundo competitivo'}</span>
   {visual?.kind==='match'&&visual.score?<div className="news-score"><span>{visual.homeOrganizationId&&<NewsBadge {...props} item={{...item,organizationId:visual.homeOrganizationId}}/>}{visual.home}</span><strong>{visual.score[0]} <i>:</i> {visual.score[1]}</strong><span>{visual.awayOrganizationId&&<NewsBadge {...props} item={{...item,organizationId:visual.awayOrganizationId}}/>}{visual.away}</span></div>:
     <><div className="news-visual-emblem"><NewsBadge {...props} item={item}/></div>
       {visual?.kind==='trophy'&&<span className="news-trophy" aria-hidden="true">★</span>}
       {visual?.kind==='transfer'&&<div className="news-transfer"><span>{visual.source??'Contratação confirmada'}</span><b aria-hidden="true">→</b><strong>{visual.destination??'Saída confirmada'}</strong></div>}
       {visual?.kind==='match'&&<strong className="news-round">RESUMO DA RODADA</strong>}
     </>}
   <span className="news-visual-signature" aria-hidden="true">UEM / NEWS</span>
 </div>;
}
function NewsCard({item,variant='list',onRead,...props}:NewsProps&{item:NewsItem;variant?:'hero'|'secondary'|'list'|'compact';onRead:(item:NewsItem)=>void}){
 return <article className={'uem-story uem-story-'+variant}>
   {variant==='hero'||variant==='secondary'?<NewsVisual {...props} item={item}/>:<div className="news-thumbnail"><NewsBadge {...props} item={item}/></div>}
   <div className="uem-story-copy"><div className="news-meta"><span>{categoryName(item.category)}</span><time>{formatCareerDay(item.day)}</time>{item.mode&&<span>{discipline(item.mode)}</span>}</div>
     <h3><button className="news-title" onClick={()=>onRead(item)}>{item.title}</button></h3>
     {variant!=='compact'&&<p>{item.summary}</p>}
     {variant==='hero'&&<button className="news-read" onClick={()=>onRead(item)}>Ler notícia completa <span aria-hidden="true">→</span></button>}
   </div>
 </article>;
}
function NewsReader({item,onClose,...props}:NewsProps&{item:NewsItem|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [destinations,setDestinations]=useState<{id:string;fixture:boolean;competition:boolean}|null>(null);
 useEffect(()=>{if(item&&!dialog.current?.open)dialog.current?.showModal();else if(!item&&dialog.current?.open)dialog.current.close();},[item]);
 useEffect(()=>{let active=true;if(item&&(item.fixtureId||item.competitionId))listCompetitions(props.career.id).then(state=>{
   if(active)setDestinations({id:item.id,fixture:state.seasons.some(s=>s.editions.some(e=>e.fixtures.some(f=>f.id===item.fixtureId))),competition:state.seasons.some(s=>s.number===item.season&&s.editions.some(e=>e.id===item.competitionId))});
 }).catch(()=>{if(active)setDestinations(null);});return()=>{active=false;};},[item,props.career.id]);
 const player=item&&props.players.find(p=>p.id===item.playerId);
 const orgIds=item?[...new Set([item.organizationId,...(item.relatedOrganizationIds??[])].filter((id):id is string=>!!id))]:[];
 return <dialog ref={dialog} className="news-reader" aria-labelledby="news-reader-title" onCancel={onClose} onClose={onClose}>
   {item&&<><div className="news-reader-top"><span>UEM <b>NEWS</b></span><button autoFocus aria-label="Fechar notícia" onClick={onClose}>Fechar ×</button></div>
     <NewsVisual {...props} item={item}/>
     <div className="news-reader-copy"><div className="news-meta"><span>{categoryName(item.category)}</span><time>{formatCareerDay(item.day)}</time>{item.mode&&<span>{discipline(item.mode)}</span>}</div>
       <h2 id="news-reader-title">{item.title}</h2><p className="news-deck">{item.summary}</p>
       {item.content&&item.content!==item.summary&&item.content.split('\n\n').map((text,i)=><p key={i}>{text}</p>)}
       {!item.content&&<p className="muted">Arquivo da carreira · Este registro contém as informações preservadas do acontecimento.</p>}
       <p className="news-source">Origem: {item.origin?({contract:'Contratação confirmada',departure:'Saída de elenco',renewal:'Renovação confirmada',expiry:'Fim de contrato',ai:'Mercado do cenário',series:'Resultado oficial',round:'Resultados oficiais',champion:'Título oficial',organization:'Infraestrutura',retirement:'Aposentadoria'}[item.origin]??'Registro da simulação'):'Arquivo da carreira'}</p>
       <div className="news-actions" aria-label="Entidades relacionadas">
         {player&&<button onClick={()=>props.onPlayer(player.id)}>Perfil atual de {player.nickname} →</button>}
         {orgIds.map(id=>id==='career'?<button key={id} onClick={()=>props.onNavigate('dashboard')}>Minha organização →</button>:props.catalog?.organizations.some(org=>org.id===id)?<button key={id} onClick={()=>props.onNavigate('organization:'+id)}>{props.catalog.organizations.find(org=>org.id===id)!.name} →</button>:null)}
         {destinations?.id===item.id&&destinations.competition&&<button onClick={()=>props.onNavigate('competition:'+item.season+':'+item.competitionId)}>Ver competição →</button>}
         {destinations?.id===item.id&&destinations.fixture&&<button onClick={()=>props.onFixture(item.fixtureId!)}>Ver confronto →</button>}
         {item.target==='finances'&&<button onClick={()=>props.onNavigate('finances')}>Ver instalações →</button>}
       </div>
     </div></>}
 </dialog>;
}
export function NewsPanel(props:NewsProps){
 const [news,setNews]=useState<NewsPage|null>(null),[error,setError]=useState(''),[selected,setSelected]=useState<NewsItem|null>(null);
 useEffect(()=>{let active=true;setError('');listCareerNews(props.career.id,{pageSize:3,channel:'public',order:'relevance'}).then(rows=>{if(active)setNews(rows);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[props.career]);
 return <section className="central-panel news-dashboard"><div className="news-panel-heading"><h2>UEM <span>NEWS</span></h2><small>DESTAQUES DO CENÁRIO</small></div>
   {error&&<p role="alert">{error}</p>}{!news&&!error&&<p role="status">Carregando notícias…</p>}
   {news&&!news.items.length&&<p className="muted">O cenário ainda não tem notícias públicas. A cobertura acompanha os acontecimentos da carreira.</p>}
   {news?.items.map(item=><NewsCard {...props} item={item} key={item.id} variant="compact" onRead={setSelected}/>)}
   <button className="news-all" onClick={()=>props.onNavigate('news')}>Ver todas as notícias →</button>
   <NewsReader {...props} item={selected} onClose={()=>setSelected(null)}/>
 </section>;
}
export function NewsPageView(props:NewsProps){
 const [category,setCategory]=useViewPreference(`${props.career.id}:news:category`,'');
 const [query,setQuery]=useViewPreference(`${props.career.id}:news:query`,'');
 const [mode,setMode]=useViewPreference(`${props.career.id}:news:mode`,'');
 const [organizationId,setOrganizationId]=useViewPreference(`${props.career.id}:news:organization`,'');
 const [scope,setScope]=useState(false),[channel,setChannel]=useState<'public'|'messages'>('public');
 const [page,setPage]=useState(0),[selected,setSelected]=useState<NewsItem|null>(null);
 const [news,setNews]=useState<NewsPage|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
   let active=true;setError('');setLoading(true);
   const timer=setTimeout(()=>{listCareerNews(props.career.id,{category,query,mode,organizationId,page,pageSize:20,channel,scope:scope?'world':undefined,includeHighlights:page===0&&channel==='public'&&!category&&!query&&!mode&&!organizationId&&!scope}).then(rows=>{if(active){setNews(rows);setLoading(false);}}).catch(reason=>{if(active){setError(String(reason));setLoading(false);}});},180);
   return()=>{active=false;clearTimeout(timer);};
 },[props.career,category,query,mode,organizationId,page,channel,scope]);
 const reset=()=>{setCategory('');setQuery('');setMode('');setOrganizationId('');setScope(false);setPage(0);};
 const available=news?.available;
 const hasFilters=!!(category||query||mode||organizationId||scope);
 const featured=page===0&&channel==='public'&&!hasFilters?news?.highlights??[]:[];
 const rest=(news?.items??[]).filter(item=>!featured.some(story=>story.id===item.id));
 return <div className="uem-news">
   <div className="news-masthead"><div><span className="news-edition">ULTIMATE ESPORTS MANAGER · CENÁRIO COMPETITIVO</span><h1>UEM <span>NEWS</span></h1><p>O jogo acontece. A história fica.</p></div><time>{formatCareerDay(props.career.day)}</time></div>
   <nav className="news-channels" aria-label="Tipo de comunicação"><button aria-pressed={channel==='public'} onClick={()=>{setChannel('public');reset();}}>Notícias</button><button aria-pressed={channel==='messages'} onClick={()=>{setChannel('messages');reset();}}>Mensagens</button><button onClick={()=>props.onNavigate('dashboard')}>Decisões da organização ↗</button></nav>
   {channel==='messages'&&<p className="news-internal">Comunicação interna · Informes de treinamento, observação e moral direcionados à sua organização.</p>}
   <div className="news-topics" aria-label="Categorias de notícias"><button aria-pressed={!category&&!organizationId&&!scope} onClick={()=>{setCategory('');setOrganizationId('');setScope(false);setPage(0);}}>Todas</button>
     {available?.organizations.includes('career')&&<button aria-pressed={organizationId==='career'} onClick={()=>{setOrganizationId(organizationId==='career'?'':'career');setScope(false);setPage(0);}}>Minha organização</button>}
     {available?.categories.map(name=><button key={name} aria-pressed={category===name} onClick={()=>{setCategory(category===name?'':name);setPage(0);}}>{categoryName(name)}</button>)}
     {available?.organizations.some(id=>id!=='career')&&channel==='public'&&<button aria-pressed={scope} onClick={()=>{setScope(!scope);setOrganizationId('');setPage(0);}}>Mundo competitivo</button>}
   </div>
   <div className="news-filters"><label>Pesquisar<input type="search" placeholder="Buscar título e conteúdo…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
     <label>Modalidade<select value={mode} onChange={e=>{setMode(e.target.value);setPage(0);}}><option value="">Todas as modalidades</option>{[...new Set([...(available?.modes??[]),...(mode?[mode]:[])])].map(value=><option key={value} value={value}>{discipline(value)}</option>)}</select></label>
     <label>Organização<select value={organizationId} onChange={e=>{setOrganizationId(e.target.value);setScope(false);setPage(0);}}><option value="">Todas as organizações</option>{[...new Set([...(available?.organizations??[]),...(organizationId?[organizationId]:[])])].map(id=><option key={id} value={id}>{id==='career'?props.career.name:props.catalog?.organizations.find(org=>org.id===id)?.name??id}</option>)}</select></label>
     {hasFilters&&<button onClick={reset}>Limpar filtros</button>}
   </div>
   {loading&&<p role="status">Carregando acontecimentos…</p>}{error&&<p role="alert">{error}</p>}
   {!loading&&!error&&news&&<div aria-live="polite">
     {!news.items.length?<section className="news-empty"><span>UEM / NEWS</span><h2>{hasFilters?'Nenhuma notícia encontrada':'A próxima história ainda vai acontecer'}</h2><p>{hasFilters?'Experimente outros termos ou remova os filtros.':'As publicações aparecem quando há acontecimentos registrados na simulação.'}</p>{hasFilters&&<button onClick={reset}>Limpar filtros</button>}</section>:<>
       {!!featured.length&&<section className="news-front" aria-label="Destaques"><NewsCard {...props} item={featured[0]} variant="hero" onRead={setSelected}/>{featured.length>1&&<div className="news-secondary">{featured.slice(1).map(item=><NewsCard {...props} key={item.id} item={item} variant="secondary" onRead={setSelected}/>)}</div>}</section>}
       <section className="news-latest"><div className="news-section-heading"><h2>{channel==='messages'?'Informes da organização':hasFilters?'Resultados da busca':'Últimas notícias'}</h2><span>{news.total} {news.total===1?'publicação':'publicações'}</span></div>
         {rest.map(item=><NewsCard {...props} key={item.id} item={item} onRead={setSelected}/>)}
         {!rest.length&&!!featured.length&&<p className="muted">Você está em dia. Todas as notícias disponíveis estão nos destaques.</p>}
       </section>
       {news.total>20&&<footer className="news-pagination"><button disabled={page===0} onClick={()=>setPage(page-1)}>← Anterior</button><span>Página {page+1} de {Math.ceil(news.total/20)}</span><button disabled={(page+1)*20>=news.total} onClick={()=>setPage(page+1)}>Próxima →</button></footer>}
     </>}
   </div>}
   <NewsReader {...props} item={selected} onClose={()=>setSelected(null)}/>
 </div>;
}
