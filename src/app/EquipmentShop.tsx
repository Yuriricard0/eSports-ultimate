import {useState} from 'react';
import {equipmentCatalog,equipmentCategories,setupTraining,type EquipmentCategory} from '../game-core/equipment';
import type {Career} from '../game-core/career';
import type {Player} from '../game-core/recruitment';
import type {FinanceState} from '../persistence/repository';
import {money} from './Players';
import {PlayerPortrait} from './PlayerPortrait';

const sections=['Loja','Inventário','Setups'] as const;
const categories=Object.entries(equipmentCategories) as [EquipmentCategory,string][];
const percent=(value:number)=>(100*value).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';

export function EquipmentShop({data,career,players,busy,buy,assign}:{data:FinanceState;career:Career;players:Player[];busy:boolean;
 buy:(sku:string)=>void;assign:(player:number,category:EquipmentCategory,sku:string)=>void}){
 const [view,setView]=useState<typeof sections[number]>('Loja');
 const [category,setCategory]=useState<EquipmentCategory|''>('mouse'),[tier,setTier]=useState(''),[selected,setSelected]=useState(0);
 const owned=new Set(data.equipmentPlayers??[]);
 const roster=players.filter(player=>owned.has(player.id)&&!player.status);
 const athlete=roster.find(player=>player.id===selected)??roster[0];
 const items=equipmentCatalog.filter(item=>item.mode===career.mode);
 const taken=data.setups??[];
 const count=(id:string)=>data.equipment?.find(row=>row.sku===id)?.quantity??0;
 const available=(sku:string,slot:EquipmentCategory)=>count(sku)-taken.filter(row=>row.sku===sku&&row.category===slot).length;
 const visible=items.filter(item=>(!category||item.slots.some(slot=>slot===category))&&(!tier||String(item.tier)===tier)&&(view==='Inventário'?count(item.id)>0:true));
 return <section className="panel equipment-shop">
   <header className="equipment-heading"><div><h2>Equipamentos</h2><p>{career.mode==='FPS'?'CS2 · Precisão e resposta':'MOBA · Controle e conforto'}</p></div><strong>{money(data.balance)}</strong></header>
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
     <div className="world-filters"><label>Categoria<select value={category} onChange={event=>setCategory(event.target.value as EquipmentCategory|'')}><option value="">Todas</option>{categories.map(([slot,label])=><option value={slot} key={slot}>{label}</option>)}</select></label>
       <label>Qualidade<select value={tier} onChange={event=>setTier(event.target.value)}><option value="">Todas</option>{items.filter(item=>item.slots.length>1).map(item=><option key={item.tier} value={item.tier}>{item.label}</option>)}</select></label></div>
     {!visible.length&&<p>Nenhum equipamento para estes filtros.</p>}
     <div className="finance-cards equipment-products">{visible.map(item=><article key={item.id} data-tier={item.tier}>
       {item.slots.length===1&&<img className="equipment-product-art" src={`${import.meta.env.BASE_URL}assets/equipment/${item.slots[0]}.jpg`} alt="" width={508} height={508} loading="lazy" decoding="async"/>}
       <span className="equipment-tag">{item.slots.map(slot=>equipmentCategories[slot]).join(' · ')}</span>
       <h3>{item.name}</h3><p>{item.manufacturer} · {item.label}</p>
       <p>{item.description} +{percent(item.training/6)} por item atribuído.</p>
       <p>{count(item.id)} em estoque{view==='Inventário'?' · '+(item.tier===5?'Patrocínio':'Compra'):''}</p>
       {view==='Inventário'?<p>{item.slots.map(slot=>equipmentCategories[slot]+': '+available(item.id,slot)+' livres').join(' · ')}</p>:
         item.price?<button disabled={busy||data.balance<item.price||count(item.id)>=10} onClick={()=>buy(item.id)}>Comprar · {money(item.price)}</button>:<p>Disponível por patrocínio.</p>}
     </article>)}</div>
   </>}
 </section>;
}
