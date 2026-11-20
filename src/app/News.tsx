import {useEffect,useState} from 'react';
import type {Career} from '../game-core/career';
import type {Contract,Player} from '../game-core/recruitment';
import type {WorldCatalog} from '../game-core/world';
import {currentPlayerSituation,newsCategories,type NewsItem,type NewsPage} from '../game-core/news';
import {formatCareerDay} from '../game-core/calendar';
import {defaultIdentity} from '../game-core/identity';
import {listCareerNews} from '../persistence/repository';
import {Emblem} from './IdentityEditor';
import {PlayerPortrait} from './PlayerPortrait';

export type NewsProps={career:Career;players:Player[];contracts:Contract[];catalog?:WorldCatalog|null;onPlayer:(id:number)=>void;onFixture:(id:string)=>void;onNavigate:(screen:string)=>void};

function NewsStory({item,compact=false,...props}:NewsProps&{item:NewsItem;compact?:boolean}){
 const player=props.players.find(p=>p.id===item.playerId),own=item.organizationId==='career';
 const organization=props.catalog?.organizations.find(org=>org.id===item.organizationId);
 const organizations=Object.fromEntries((props.catalog?.organizations??[]).map(org=>[org.id,org.name]));
 return <article className={'news-story'+(compact?' compact-news':'')}>
   <div className="news-icon">{own?<Emblem identity={props.career.identity??{...defaultIdentity,primary:props.career.color,symbol:props.career.symbol}} code={props.career.code}/>:
     organization?.logo?<img src={organization.logo.replace('res://','/')} alt={'Escudo de '+organization.name} loading="lazy"/>:
     organization?<span className="news-monogram">{organization.code}</span>:player?<PlayerPortrait index={player.portraitIndex}/>:<span aria-hidden="true">◇</span>}
   </div>
   <div><small className="muted">{formatCareerDay(item.day)} · {item.category}</small><h3>{item.title}</h3><p>{item.summary}</p>
     {player&&<p className="muted">Situação atual: {currentPlayerSituation(player,props.contracts,organizations,props.career.name)}</p>}
     <div className="news-actions">
       {player&&<button onClick={()=>props.onPlayer(player.id)}>Perfil atual →</button>}
       {item.fixtureId&&<button onClick={()=>props.onFixture(item.fixtureId!)}>Ver confronto →</button>}
       {item.target==='finances'&&<button onClick={()=>props.onNavigate('finances')}>Ver instalações →</button>}
     </div>
   </div>
 </article>;
}

export function NewsPanel(props:NewsProps){
 const [news,setNews]=useState<NewsPage|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;listCareerNews(props.career.id,{pageSize:3}).then(rows=>{if(active)setNews(rows);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[props.career]);
 return <section className="central-panel"><h2>Notícias e Atualizações</h2>
   {error&&<p role="alert">{error}</p>}{!news&&!error&&<p role="status">Carregando notícias…</p>}
   {news&&!news.items.length&&<p>Novidades aparecerão aqui conforme os acontecimentos da carreira.</p>}
   {news?.items.map(item=><NewsStory {...props} item={item} key={item.id} compact/>)}
   <button onClick={()=>props.onNavigate('news')}>Todas as notícias →</button>
 </section>;
}

export function NewsPageView(props:NewsProps){
 const [category,setCategory]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0);
 const [news,setNews]=useState<NewsPage|null>(null),[error,setError]=useState('');
 useEffect(()=>{
   let active=true;listCareerNews(props.career.id,{category,query,page,pageSize:20}).then(rows=>{if(active)setNews(rows);}).catch(reason=>{if(active)setError(String(reason));});
   return()=>{active=false;};
 },[props.career,category,query,page]);
 return <>
   <h1>Notícias</h1><p className="muted">Acontecimentos registrados na carreira. Os vínculos dos atletas são consultados pelo estado atual.</p>
   <div className="panel player-filters"><input aria-label="Buscar notícias" placeholder="Buscar título ou resumo…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/>
     <select aria-label="Categoria da notícia" value={category} onChange={e=>{setCategory(e.target.value);setPage(0);}}><option value="">Todas as categorias</option>{newsCategories.map(name=><option key={name} value={name}>{name}</option>)}</select>
   </div>
   {error&&<p role="alert">{error}</p>}{!news&&!error&&<p role="status">Carregando notícias…</p>}
   {news&&<section className="panel"><p className="muted">{news.total} acontecimentos</p>
     {!news.items.length&&<p>Nenhuma notícia encontrada.</p>}
     {news.items.map(item=><NewsStory {...props} item={item} key={item.id}/>)}
     <footer><button disabled={page===0} onClick={()=>setPage(page-1)}>← Anterior</button><span>Página {page+1}</span><button disabled={(page+1)*20>=news.total} onClick={()=>setPage(page+1)}>Próxima →</button></footer>
   </section>}
 </>;
}
