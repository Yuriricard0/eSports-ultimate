import {useEffect,useState} from 'react';
import {equipmentCatalog,equipmentCategories,setupTraining,type EquipmentCategory} from '../game-core/equipment';
import type {Career} from '../game-core/career';
import type {Player} from '../game-core/recruitment';
import {assignEquipment,buyEquipment,listFinances,type FinanceState} from '../persistence/repository';
import {money} from './Players';
import {PlayerPortrait} from './PlayerPortrait';

const sections=['Loja','Inventário','Setups'] as const;
const categories=Object.entries(equipmentCategories) as [EquipmentCategory,string][];
const percent=(value:number)=>(100*value).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
const labelMode=(mode:string)=>mode==='FPS'?'CS2':'MOBA';

export function EquipmentStore({career,players,onUpdated}:{career:Career;players:Player[];onUpdated:(career:Career)=>Promise<void>}){
 const [data,setData]=useState<FinanceState|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;listFinances(career.id).then(value=>{if(active)setData(value);}).catch(reason=>{if(active)setError(String(reason));});return()=>{active=false;};},[career]);
 const perform=async(action:()=>Promise<Career>,success:string)=>{
   if(busy)return;
   setBusy(true);setError('');setMessage('');
   try{await onUpdated(await action());setData(await listFinances(career.id));setMessage(success);}
   catch(reason){setError(reason instanceof Error?reason.message:String(reason));}
   finally{setBusy(false);}
 };
 return <>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
   {data?<EquipmentShop data={data} career={career} players={players} busy={busy}
     buy={sku=>{
       const product=equipmentCatalog.find(item=>item.id===sku);
       if(product&&window.confirm(`Comprar ${product.name} por ${money(product.price)}?`))
         void perform(()=>buyEquipment(career.id,sku,1),'Equipamento adicionado ao inventário.');
     }}
     assign={(player,category,sku)=>void perform(()=>assignEquipment(career.id,player,category,sku),'Setup atualizado.')}/>
   :!error&&<p role="status">Carregando loja…</p>}
 </>;
}

export function EquipmentShop({data,career,players,busy,buy,assign}:{data:FinanceState;career:Career;players:Player[];busy:boolean;
 buy:(sku:string)=>void;assign:(player:number,category:EquipmentCategory,sku:string)=>void}){
 const [view,setView]=useState<typeof sections[number]>('Loja');
 const [category,setCategory]=useState<EquipmentCategory|''>(''),[tier,setTier]=useState(''),[selected,setSelected]=useState(0);
 const [mode,setMode]=useState(career.mode),[productId,setProduct]=useState('');
 const owned=new Set(data.equipmentPlayers??[]);
 const roster=players.filter(player=>owned.has(player.id)&&!player.status);
 const athlete=roster.find(player=>player.id===selected)??roster[0];
 const items=equipmentCatalog.filter(item=>item.mode===career.mode);
 const taken=data.setups??[];
 const count=(id:string)=>data.equipment?.find(row=>row.sku===id)?.quantity??0;
 const available=(sku:string,slot:EquipmentCategory)=>count(sku)-taken.filter(row=>row.sku===sku&&row.category===slot).length;
 const visible=(view==='Loja'?equipmentCatalog.filter(item=>!mode||item.mode===mode):items)
   .filter(item=>(!category||item.slots.includes(category))&&(!tier||String(item.tier)===tier)&&(view==='Inventário'?count(item.id)>0:true));
 const selectedProduct=visible.find(item=>item.id===productId)??visible[0];
 const art=(item:typeof equipmentCatalog[number])=><img className="equipment-product-art" src={`${import.meta.env.BASE_URL}assets/equipment/${item.slots[0]}.jpg`} alt="" width={508} height={508} loading="lazy" decoding="async"/>;
 const detail=(item:typeof equipmentCatalog[number],layout:string)=><aside className={'shop-detail '+layout} aria-label="Detalhes do produto">
   {art(item)}<div><span className="shop-quality" data-tier={item.tier}>{item.label}</span>
   <h3>{item.name}</h3><p>{item.manufacturer} · {labelMode(item.mode)}</p><p>{item.description}</p>
   <dl><div><dt>Eficiência de treino por peça atribuída</dt><dd>+{percent(item.training/6)}</dd></div>
     <div><dt>No inventário da organização</dt><dd>{count(item.id)}</dd></div></dl>
   {item.price>0?<><strong>{money(item.price)}</strong><button className="primary" disabled={busy||item.mode!==career.mode||data.balance<item.price||count(item.id)>=10} onClick={()=>buy(item.id)}>Comprar equipamento</button>
   {item.mode!==career.mode&&<p>Compra disponível para a divisão ativa de {labelMode(career.mode)}.</p>}</>:<p>Disponível por patrocínio.</p>}</div>
 </aside>;
 return <section className="panel equipment-shop">
   <header className="equipment-heading"><div><h1>Loja de Equipamentos</h1><p>Divisão ativa · {labelMode(career.mode)}</p></div><strong>Caixa disponível · {money(data.balance)}</strong></header>
   <nav className="event-tabs" aria-label="Seções de equipamentos">{sections.map(item=><button key={item} aria-pressed={item===view} onClick={()=>setView(item)}>{item}</button>)}</nav>
   {view==='Setups'?athlete?<div className="setup-board">
     <div className="setup-player"><PlayerPortrait index={athlete.portraitIndex}/><label>Atleta<select value={athlete.id} onChange={event=>setSelected(Number(event.target.value))}>
       {roster.map(player=><option key={player.id} value={player.id}>{player.nickname}</option>)}
     </select></label><strong>+{percent(setupTraining(athlete.mode,taken,athlete.id))} de eficiência de treino</strong></div>
     <div className="setup-slots">{categories.map(([slot,label])=>{
       const assigned=taken.find(row=>row.player_id===athlete.id&&row.category===slot);
       const product=items.find(item=>item.id===assigned?.sku);
       const choices=items.filter(item=>item.slots.includes(slot)&&(available(item.id,slot)>0||item.id===assigned?.sku));
       return <label key={slot}>{label}<select disabled={busy} value={assigned?.sku??''} onChange={event=>assign(athlete.id,slot,event.target.value)}>
         <option value="">Padrão do clube</option>{choices.map(item=><option key={item.id} value={item.id}>{item.name} · {item.label} ({available(item.id,slot)} livre)</option>)}
       </select><small>{product?product.manufacturer+' · '+product.label+' · +'+percent(product.training/6):'Nenhum bônus de equipamento'}</small></label>;
     })}</div>
   </div>:<p>Contrate um atleta para montar o primeiro setup.</p>:<>
     <nav className="shop-categories" aria-label="Categorias de equipamentos">
       <button aria-pressed={!category} onClick={()=>setCategory('')}>Todos</button>
       {categories.map(([slot,label])=><button key={slot} aria-pressed={category===slot} onClick={()=>setCategory(slot)}>{label}</button>)}
     </nav>
     <div className="world-filters">{view==='Loja'&&<label>Modalidade<select value={mode} onChange={event=>setMode(event.target.value)}><option value="">Todas</option><option value="MOBA">MOBA</option><option value="FPS">CS2</option></select></label>}
       <label>Qualidade<select value={tier} onChange={event=>setTier(event.target.value)}><option value="">Todas</option>{items.filter(item=>item.slots.length>1).map(item=><option key={item.tier} value={item.tier}>{item.label}</option>)}</select></label></div>
     {!visible.length&&<p>Nenhum equipamento para estes filtros.</p>}
     {view==='Loja'?<div className="shop-catalog"><div className="shop-product-list">{visible.map(item=><div key={item.id}>
       <button className="shop-product" aria-pressed={item.id===selectedProduct?.id} onClick={()=>setProduct(item.id)}>
         <span className="shop-quality" data-tier={item.tier}>{item.label}</span>{art(item)}
         <strong>{item.name}</strong><small>{labelMode(item.mode)} · {item.manufacturer}</small>
         <b>{item.price?money(item.price):'Patrocínio'}</b>
       </button>
       {item.id===selectedProduct?.id&&item.id===productId&&detail(item,'shop-detail-mobile')}
     </div>)}</div>{selectedProduct&&detail(selectedProduct,'shop-detail-desktop')}</div>:
     <div className="finance-cards equipment-products">{visible.map(item=><article key={item.id} data-tier={item.tier}>
       {item.slots.length===1&&<img className="equipment-product-art" src={`${import.meta.env.BASE_URL}assets/equipment/${item.slots[0]}.jpg`} alt="" width={508} height={508} loading="lazy" decoding="async"/>}
       <span className="equipment-tag">{item.slots.map(slot=>equipmentCategories[slot]).join(' · ')}</span>
       <h3>{item.name}</h3><p>{item.manufacturer} · {item.label}</p>
       <p>{item.description} +{percent(item.training/6)} por item atribuído.</p>
       <p>{count(item.id)} em estoque{view==='Inventário'?' · '+(item.tier===5?'Patrocínio':'Compra'):''}</p>
       <p>{item.slots.map(slot=>equipmentCategories[slot]+': '+available(item.id,slot)+' livres').join(' · ')}</p>
     </article>)}</div>}
   </>}
   <section className="shop-coverage"><div className="players-heading"><h2>Equipe equipada</h2><button onClick={()=>setView('Setups')}>Ver setups</button></div>
     {roster.length?<ul>{categories.map(([slot,label])=>{
       const equipped=roster.filter(player=>taken.some(row=>row.player_id===player.id&&row.category===slot)).length;
       return <li key={slot}><span>{label}</span><progress aria-label={label+' atribuído'} value={equipped} max={roster.length}/><strong>{equipped}/{roster.length}</strong></li>;
     })}</ul>:<p>Sem atletas no elenco.</p>}
   </section>
 </section>;
}
