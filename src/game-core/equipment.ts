const quality=[
 [1,'Básico',15000,0],[2,'Intermediário',36000,.008],[3,'Profissional',78000,.02],
 [4,'Elite',145000,.026],[5,'Exclusivo',0,.03],
] as const;
export const equipmentCategories={
 mouse:'Mouse',keyboard:'Teclado',headset:'Headset',monitor:'Monitor',computer:'Computador',chair:'Cadeira',
} as const;
export type EquipmentCategory=keyof typeof equipmentCategories;
export const equipmentCatalog=quality.flatMap(([tier,label,price,training])=>(['MOBA','FPS'] as const).flatMap(mode=>[{
 id:mode.toLowerCase()+'-'+tier,mode,tier,label,price,training,
 name:mode==='FPS'?'Kit de precisão':'Kit de controle',
 description:mode==='FPS'?'Mouse leve, mousepad de baixa fricção e headset para comunicação.':'Mouse com botões laterais, teclado para atalhos e headset confortável.',
 manufacturer:mode==='FPS'?'ArcForge':'Loom Input',slots:['mouse','keyboard','headset'] as EquipmentCategory[],
},...(['mouse','keyboard','headset','monitor','computer','chair'] as const).filter(()=>tier<5).map((slot,index)=>({
 id:mode.toLowerCase()+'-'+slot+'-'+tier,mode,tier,label,training,
 price:Math.round(price*[.32,.39,.29,2.3,4.8,1.6][index]),
 manufacturer:['ArcForge','Loom Input','Sonara','Lumera','Núcleo Systems','Vértice Seat'][index],
 name:equipmentCategories[slot]+' '+(mode==='FPS'?'Vector':'Tempo')+' '+tier,
 description:(mode==='FPS'?'Setup de precisão e resposta.':'Setup de controle e conforto.')+' Benefício gradual no treinamento.',
 slots:[slot] as EquipmentCategory[],
}))]));

export type EquipmentStock={sku:string;quantity:number};
export type EquipmentAssignment={player_id:number;category:EquipmentCategory;sku:string;unit:number};
export function setupTraining(mode:string,rows:EquipmentAssignment[],playerId:number){
 return Math.min(.03,rows.filter(row=>row.player_id===playerId).reduce((sum,row)=>{
   const item=equipmentCatalog.find(item=>item.id===row.sku&&item.mode===mode);
   return sum+(item?.training??0)/6;
 },0));
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
);
CREATE TABLE IF NOT EXISTS web_equipment_setup(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,category TEXT NOT NULL,
 sku TEXT NOT NULL,unit INTEGER NOT NULL CHECK(unit>0),
 PRIMARY KEY(career_id,player_id,category), UNIQUE(career_id,sku,unit,category),
 FOREIGN KEY(career_id,sku) REFERENCES web_equipment_stock(career_id,sku)
);`;
