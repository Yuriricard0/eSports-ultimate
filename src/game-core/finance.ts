import {equipmentSchema,sponsorKit,sponsorKitCount,sponsorCashOnlyValue} from './equipment.ts';
type Bind=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Row|undefined;
type All=(sql:string,bind:Bind)=>Row[];
export type CashCategory='signing'|'salary'|'sale'|'prize'|'sponsor'|'facility'|'equipment';
export type FacilityKind='training'|'academy'|'scouting';
export type FacilityLevels=Record<FacilityKind,number>;
export const facilityDefinitions={
 training:{name:'Centro de treinamento',costs:[2500000,6000000,12000000],description:'Eficiência do treinamento +2% por nível para atletas da organização.'},
 academy:{name:'Academy',costs:[2000000,5000000,10000000],description:'Eficiência do desenvolvimento +2% por nível apenas para atletas da base.'},
 scouting:{name:'Departamento de scouting',costs:[1500000,4000000,8000000],description:'Benefício reservado para versões futuras. Não altera a descoberta de talentos na V1.'},
} as const;
export const financeSchema=`
CREATE TABLE IF NOT EXISTS web_cash_events (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,event_key TEXT NOT NULL,day INTEGER NOT NULL,
 category TEXT NOT NULL,amount INTEGER NOT NULL,description TEXT NOT NULL,PRIMARY KEY(career_id,event_key)
);
CREATE TABLE IF NOT EXISTS web_finance_state (
 career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,opened_day INTEGER NOT NULL,opening_balance INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS web_sponsors (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,id TEXT NOT NULL,company TEXT NOT NULL,
 payment INTEGER NOT NULL CHECK(payment>0),duration INTEGER NOT NULL CHECK(duration IN (180,365)),min_reputation INTEGER NOT NULL,
 offered_day INTEGER NOT NULL,expires_day INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('pending','accepted','rejected','expired')),
 accepted_day INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(career_id,id)
);
CREATE TABLE IF NOT EXISTS web_facilities (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('training','academy','scouting')),
 level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),upgraded_day INTEGER NOT NULL,PRIMARY KEY(career_id,kind)
);
CREATE TABLE IF NOT EXISTS web_ai_finances (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,organization TEXT NOT NULL,balance INTEGER NOT NULL CHECK(balance>=0),
 arrears INTEGER NOT NULL DEFAULT 0 CHECK(arrears>=0),last_day INTEGER NOT NULL,payroll INTEGER NOT NULL CHECK(payroll>=0),
 PRIMARY KEY(career_id,organization)
);
CREATE TABLE IF NOT EXISTS web_ai_cash_events (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,event_key TEXT NOT NULL,organization TEXT NOT NULL,day INTEGER NOT NULL,
 amount INTEGER NOT NULL,description TEXT NOT NULL,PRIMARY KEY(career_id,event_key)
);
`+equipmentSchema;

// Receipt only: the existing source operation remains responsible for balance.
export function recordCash(run:Run,careerId:string,key:string,day:number,category:CashCategory,amount:number,description:string){
 if(!Number.isSafeInteger(amount)||!Number.isInteger(day)||day<1||!key)throw Error('Movimentação financeira inválida.');
 if(amount===0)return;
 run('INSERT OR IGNORE INTO web_cash_events VALUES(?,?,?,?,?,?)',[careerId,key,day,category,amount,description]);
}

export function initializeFinance(run:Run,read:Read,all:All,careerId:string){
 if(read('SELECT 1 FROM web_finance_state WHERE career_id=?',[careerId]))return;
 const career=read('SELECT day,balance FROM careers WHERE id=?',[careerId]);if(!career)throw Error('Carreira não encontrada.');
 for(const row of all('SELECT player_id,day,amount FROM web_finances WHERE career_id=?',[careerId])){
   recordCash(run,careerId,'sign:'+row.player_id+':'+row.day,Number(row.day),'signing',Number(row.amount),'Assinatura/transferência do atleta '+row.player_id+'.');
 }
 for(const row of all('SELECT * FROM web_payroll WHERE career_id=? AND paid>0',[careerId])){
   const prefix='salary:'+row.player_id+':'+row.start_day+':'+row.due_day+':';
   const known=-Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE career_id=? AND event_key LIKE ?',[careerId,prefix+'%'])?.total??0);
   const missing=Number(row.paid)-known;
   if(missing>0)recordCash(run,careerId,prefix+'legacy',Number(row.due_day),'salary',-missing,'Pagamento antigo recuperado; referência pelo vencimento, atleta '+row.player_id+'.');
 }
 for(const row of all("SELECT player_id,day,SUM(amount) amount FROM web_market_moves WHERE career_id=? AND kind='sold' GROUP BY player_id,day",[careerId])){
   const key='sale:'+row.player_id+':'+row.day;
   const known=Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE career_id=? AND (event_key=? OR event_key LIKE ?)',[careerId,key,key+':%'])?.total??0);
   const missing=Number(row.amount)-known;
   if(missing>0)recordCash(run,careerId,key+':legacy',Number(row.day),'sale',missing,'Venda do atleta '+row.player_id+'.');
 }
 for(const row of all("SELECT * FROM web_competition_awards WHERE career_id=? AND team_id='career'",[careerId])){
   recordCash(run,careerId,'award:'+row.season+':'+row.competition_id,Number(row.day),'prize',Number(row.prize),'Premiação: '+row.name+'.');
 }
 const total=Number(read('SELECT COALESCE(SUM(amount),0) total FROM web_cash_events WHERE career_id=?',[careerId])?.total??0);
 run('INSERT INTO web_finance_state VALUES(?,?,?)',[careerId,Number(career.day),Number(career.balance)-total]);
}

const brands=[
 {key:'pulse',name:'PulseByte',minimum:0,base:1000000,rate:15000,duration:180},
 {key:'hexa',name:'HexaFuel',minimum:0,base:1200000,rate:16000,duration:180},
 {key:'vertex',name:'Vértice Gear',minimum:50,base:1500000,rate:22000,duration:365},
 {key:'nova',name:'NovaLink',minimum:70,base:2000000,rate:30000,duration:365},
];
const specialistBrands=[
 {key:'nexo',name:'Nexo Fibra',minimum:0,base:650000,rate:9000,duration:180,sector:'Internet regional',region:'América do Sul'},
 {key:'maple',name:'Mapa Café',minimum:0,base:680000,rate:8500,duration:180,sector:'Alimentação regional',region:'América do Norte'},
 {key:'orio',name:'Ório Mobilidade',minimum:0,base:690000,rate:8700,duration:180,sector:'Mobilidade regional',region:'Europa'},
 {key:'pluma',name:'Pluma Studio',minimum:0,base:640000,rate:9200,duration:180,sector:'Design regional',region:'Ásia'},
 {key:'lumera-hybrid',name:'Lumera Monitores',minimum:30,base:850000,rate:10000,duration:180,sector:'Monitores',mode:'FPS'},
 {key:'riftline',name:'Riftline Telecom',minimum:30,base:880000,rate:9700,duration:180,sector:'Telecomunicações',mode:'MOBA'},
 {key:'arcgear',name:'ArcForge Periféricos',minimum:25,base:1,rate:0,duration:180,sector:'Periféricos',mode:'FPS'},
 {key:'loomgear',name:'Loom Input',minimum:25,base:1,rate:0,duration:180,sector:'Periféricos',mode:'MOBA'},
 ];
export function sponsorSpecialty(id:string){
 const key=id.split(':').at(-1);
 return specialistBrands.find(brand=>brand.key===key);
}
export function commercialRecognition(day:number,exposure:number,partners:number){
 return Math.min(100,10+Math.min(30,Math.floor((day-1)/45))+Math.min(40,Math.floor(exposure/4))+Math.min(20,partners*2));
}
export function refreshSponsorOffers(run:Run,read:Read,careerId:string,day:number,reputation:number,mode?:string,region?:string,recognition=reputation){
 run("UPDATE web_sponsors SET state='expired' WHERE career_id=? AND state='pending' AND expires_day<?",[careerId,day]);
 const cycle=Math.floor((day-1)/30);
 for(const brand of [...brands,...specialistBrands.filter(brand=>(brand.mode&&brand.mode===mode)||(brand.region&&brand.region===region&&recognition<55))]){
   if(brand.key==='nova'&&recognition<45)continue;
   if(reputation<brand.minimum||read("SELECT 1 FROM web_sponsors WHERE career_id=? AND company=? AND state='accepted' AND accepted_day+duration-1>=?",[careerId,brand.name,day]))continue;
   run("INSERT OR IGNORE INTO web_sponsors(career_id,id,company,payment,duration,min_reputation,offered_day,expires_day,state) VALUES(?,?,?,?,?,?,?,?,'pending')",
     [careerId,'s'+cycle+':'+brand.key,brand.name,brand.base+Math.min(100,Math.round(reputation*.65+recognition*.35))*brand.rate,brand.duration,brand.minimum,day,(cycle+1)*30]);
 }
}
export function acceptSponsor(run:Run,read:Read,careerId:string,id:string,reputation:number){
 run('BEGIN IMMEDIATE',[]);
 try{
   const day=Number(read('SELECT day FROM careers WHERE id=?',[careerId])?.day),offer=read('SELECT * FROM web_sponsors WHERE career_id=? AND id=?',[careerId,id]);
   if(!offer||offer.state!=='pending'||Number(offer.expires_day)<day)throw Error('A proposta não está mais disponível.');
   if(reputation<Number(offer.min_reputation))throw Error('Reputação insuficiente para este patrocinador.');
   const active=Number(read("SELECT COUNT(*) total FROM web_sponsors WHERE career_id=? AND state='accepted' AND accepted_day+duration-1>=?",[careerId,day])?.total??0);
   if(active>=2)throw Error('O limite é de dois patrocinadores ativos.');
   if(read("SELECT 1 FROM web_sponsors WHERE career_id=? AND company=? AND state='accepted' AND accepted_day+duration-1>=?",[careerId,String(offer.company),day]))throw Error('Esta empresa já patrocina a organização.');
   run("UPDATE web_sponsors SET state='accepted',accepted_day=? WHERE career_id=? AND id=?",[day,careerId,id]);
   const kit=sponsorKit(id);
   if(kit)run('INSERT INTO web_equipment_stock VALUES(?,?,?) ON CONFLICT(career_id,sku) DO UPDATE SET quantity=quantity+excluded.quantity',[careerId,kit,sponsorKitCount(id)]);
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}
export function rejectSponsor(run:Run,read:Read,careerId:string,id:string){
 const day=Number(read('SELECT day FROM careers WHERE id=?',[careerId])?.day);
 run("UPDATE web_sponsors SET state='rejected' WHERE career_id=? AND id=? AND state='pending' AND expires_day>=?",[careerId,id,day]);
}

export function paySponsors(run:Run,read:Read,all:All,careerId:string,from:number,to:number){
 for(const offer of all("SELECT * FROM web_sponsors WHERE career_id=? AND state='accepted'",[careerId])){
   const payment=sponsorCashOnlyValue(String(offer.id),Number(offer.payment));
   if(!payment)continue;
   const start=Number(offer.accepted_day),end=start+Number(offer.duration)-1;
   for(let cursor=start;cursor<=end;cursor+=30){
     const due=Math.min(cursor+29,end);if(due<=from||due>to)continue;
     const key='sponsor:'+offer.id+':'+due;
     if(read('SELECT 1 FROM web_cash_events WHERE career_id=? AND event_key=?',[careerId,key]))continue;
     const amount=Math.round(payment*(due-cursor+1)/30);
     recordCash(run,careerId,key,due,'sponsor',amount,'Parcela de patrocínio: '+offer.company+'.');
     run('UPDATE careers SET balance=balance+? WHERE id=?',[amount,careerId]);
   }
 }
}
export function facilityEfficiency(levels:Partial<FacilityLevels>,academy:boolean){
 return Math.round((1+(levels.training??0)*.02+(academy?(levels.academy??0)*.02:0))*100)/100;
}
export function upgradeFacility(run:Run,read:Read,careerId:string,kind:string,expectedLevel:number){
 if(!Object.hasOwn(facilityDefinitions,kind))throw Error('Instalação inválida.');
 run('BEGIN IMMEDIATE',[]);
 try{
   const level=Number(read('SELECT level FROM web_facilities WHERE career_id=? AND kind=?',[careerId,kind])?.level??0);
   if(level!==expectedLevel)throw Error('O nível foi atualizado. Confira a instalação.');
   if(level>=3)throw Error('A instalação já está no nível máximo.');
   const career=read('SELECT day,balance FROM careers WHERE id=?',[careerId]);
   if(!career)throw Error('Carreira não encontrada.');
   const definition=facilityDefinitions[kind as FacilityKind],cost=definition.costs[level];
   if(Number(career.balance)<cost)throw Error('Saldo insuficiente para esta melhoria.');
   run('UPDATE careers SET balance=balance-? WHERE id=?',[cost,careerId]);
   run('INSERT INTO web_facilities VALUES(?,?,?,?) ON CONFLICT(career_id,kind) DO UPDATE SET level=excluded.level,upgraded_day=excluded.upgraded_day',[careerId,kind,level+1,Number(career.day)]);
   recordCash(run,careerId,'facility:'+kind+':'+(level+1),Number(career.day),'facility',-cost,definition.name+' — nível '+(level+1)+'.');
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}
