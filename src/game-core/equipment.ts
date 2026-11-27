import type {Mode} from './attributes.ts';

export const equipmentCatalog=([
 [1,'Básico',15000,0],[2,'Intermediário',36000,.008],[3,'Profissional',78000,.02],
 [4,'Elite',145000,.026],[5,'Exclusivo',0,.03],
] as const).flatMap(([tier,label,price,training])=>(['MOBA','FPS'] as const).map(mode=>({
 id:mode.toLowerCase()+'-'+tier,mode,tier,label,price,training,
 name:mode==='FPS'?'Kit de precisão':'Kit de controle',
 description:mode==='FPS'?'Mouse leve, mousepad de baixa fricção e headset para comunicação.':'Mouse com botões laterais, teclado para atalhos e headset confortável.',
})));

export type EquipmentStock={sku:string;quantity:number};
export function equipmentTraining(mode:Mode,stock:EquipmentStock[],players:number){
 if(players<=0)return 0;
 let covered=0,bonus=0;
 for(const item of [...equipmentCatalog].reverse()){
   if(item.mode!==mode)continue;
   const units=Math.min(players-covered,stock.find(row=>row.sku===item.id)?.quantity??0);
   bonus+=units*item.training;
   covered+=units;
   if(covered===players)break;
 }
 return bonus/players;
}

export function sponsorKit(id:string){
 const key=id.split(':').at(-1);
 return key==='arcgear'||key==='lumera-hybrid'?'fps-5':key==='loomgear'?'moba-5':undefined;
}
export const sponsorKitCount=(id:string)=>id.endsWith(':lumera-hybrid')?2:5;
export const sponsorCashOnlyValue=(id:string,payment:number)=>sponsorKit(id)&&!id.endsWith(':lumera-hybrid')?0:payment;

export const equipmentSchema=`
CREATE TABLE IF NOT EXISTS web_equipment_stock(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,sku TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0),PRIMARY KEY(career_id,sku)
);`;
