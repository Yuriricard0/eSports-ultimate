import type {Career} from './career.ts';
import type {Contract,Player} from './recruitment.ts';
import type {WorldCatalog} from './world.ts';
import type {Season} from './competitions.ts';
import {hashSeed} from './competitions.ts';
import {athleteAge,playerCondition} from './development.ts';
import {facilityDefinitions,type FacilityKind} from './finance.ts';

type Bind=(string|number)[];
type Row=Record<string,unknown>;
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Row|undefined;
type All=(sql:string,bind:Bind)=>Row[];
export const newsCategories=['Mercado','Campeonatos','Organizações','Jogadores'] as const;
export type NewsCategory=typeof newsCategories[number];
export type NewsItem={id:string;day:number;category:NewsCategory;title:string;summary:string;playerId?:number;organizationId?:string;fixtureId?:string;target?:'finances'};
export type NewsFilter={category?:string;query?:string;page?:number;pageSize?:number};
export type NewsPage={items:NewsItem[];total:number};
export const newsSchema=`
CREATE TABLE IF NOT EXISTS web_news (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,news_key TEXT NOT NULL,day INTEGER NOT NULL,
 category TEXT NOT NULL,sequence INTEGER NOT NULL,data TEXT NOT NULL,PRIMARY KEY(career_id,news_key)
);
CREATE INDEX IF NOT EXISTS web_news_date ON web_news(career_id,day DESC,sequence DESC);
CREATE TABLE IF NOT EXISTS web_news_marks (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,kind TEXT NOT NULL,entity_id TEXT NOT NULL,
 day INTEGER NOT NULL,value REAL NOT NULL,PRIMARY KEY(career_id,kind,entity_id)
);
CREATE TABLE IF NOT EXISTS web_world_events (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,event_key TEXT NOT NULL,day INTEGER NOT NULL,
 player_id INTEGER NOT NULL,kind TEXT NOT NULL,delta REAL NOT NULL,PRIMARY KEY(career_id,event_key)
);
`;

export function recordNews(run:Run,read:Read,careerId:string,item:NewsItem){
 if(read('SELECT 1 FROM web_news WHERE career_id=? AND news_key=?',[careerId,item.id]))return false;
 const sequence=Number(read('SELECT COALESCE(MAX(sequence),0)+1 next FROM web_news WHERE career_id=?',[careerId])?.next??1);
 run('INSERT INTO web_news VALUES(?,?,?,?,?,?)',[careerId,item.id,item.day,item.category,sequence,JSON.stringify(item)]);return true;
}
export function listNews(read:Read,all:All,careerId:string,filter:NewsFilter):NewsPage{
 const page=filter.page??0,pageSize=filter.pageSize??20;
 if(!Number.isInteger(page)||page<0||page>100000||!Number.isInteger(pageSize)||pageSize<1||pageSize>50||
   (filter.category&&!newsCategories.includes(filter.category as NewsCategory)))throw Error('Filtro de notícias inválido.');
 const bind:Bind=[careerId],where=['career_id=?'];
 if(filter.category){where.push('category=?');bind.push(filter.category);}
 if(filter.query?.trim()){
   where.push("instr(lower(json_extract(data,'$.title')||' '||json_extract(data,'$.summary')),?)>0");bind.push(filter.query.trim().toLowerCase());
 }
 const clause=where.join(' AND '),total=Number(read('SELECT COUNT(*) total FROM web_news WHERE '+clause,bind)?.total??0);
 const items=all('SELECT data FROM web_news WHERE '+clause+' ORDER BY day DESC,sequence DESC LIMIT ? OFFSET ?',[...bind,pageSize,page*pageSize])
   .map(row=>JSON.parse(String(row.data)) as NewsItem);
 return {items,total};
}

export function currentPlayerSituation(player:Player,contracts:Contract[],organizations:Record<string,string>,careerName:string){
 const contract=contracts.find(c=>c.player_id===player.id);
 if(contract)return contract.academy?careerName+' · Academy':careerName;
 if(player.organization)return organizations[player.organization]??player.organization;
 if(player.status==='retired')return 'Aposentado';if(player.status==='ranked')return 'Ranked · amador';return 'Livre no mercado';
}

export function synchronizeNews(run:Run,read:Read,all:All,career:Career,players:Player[],catalog:WorldCatalog){
 const byId=new Map(players.map(p=>[p.id,p])),organizations=new Map(catalog.organizations.map(org=>[org.id,org.name]));
 const nickname=(id:number)=>byId.get(id)?.nickname??'Atleta '+id;
 const post=(item:NewsItem)=>recordNews(run,read,career.id,item);
 for(const contract of all('SELECT * FROM web_contracts WHERE career_id=? AND start_day<=? ORDER BY start_day,player_id',[career.id,career.day])){
   const id=Number(contract.player_id),day=Number(contract.start_day);
   const transfer=read(`SELECT q.organization FROM web_negotiations n JOIN web_transfer_quotes q ON q.negotiation_id=n.id
     JOIN web_ai_cash_events a ON a.career_id=n.career_id AND a.organization=q.organization AND a.amount=q.fee
       AND a.event_key LIKE 'transfer:%' AND (n.id=substr(a.event_key,10) OR n.id LIKE '%:'||substr(a.event_key,10))
     WHERE n.career_id=? AND n.player_id=? AND n.state='signed' AND a.day=? ORDER BY n.opened_day DESC LIMIT 1`,[career.id,id,day]);
   const source=String(transfer?.organization??'');
   post({id:'contract:'+id+':'+day,day,category:'Mercado',title:nickname(id)+(source?' é transferido para ':' assina com ')+career.name,
     summary:source?'Transferência confirmada de '+(organizations.get(source)??source)+' para '+career.name+'.':'A contratação foi concluída e o vínculo está registrado na carreira.',playerId:id,organizationId:'career'});
 }
 const closures=all('SELECT * FROM web_contract_closures WHERE career_id=? AND day<=? ORDER BY day,player_id,start_day',[career.id,career.day]);
 const departure=(id:number,day:number,start:number,reason:string)=>post({id:'departure:'+id+':'+day+':'+start,day,category:'Mercado',
   title:nickname(id)+(reason==='sold'?' é vendido por ':' é dispensado por ')+career.name,
   summary:reason==='sold'?'A transferência foi concluída. Consulte o perfil para ver a organização atual.':'O vínculo foi encerrado. A situação atual do atleta está disponível no perfil.',playerId:id,organizationId:'career'});
 for(const closure of closures)departure(Number(closure.player_id),Number(closure.day),Number(closure.start_day),String(closure.reason));
 for(const row of all("SELECT player_id,day,kind,COUNT(*) total FROM web_market_moves WHERE career_id=? AND kind IN ('sold','released') GROUP BY player_id,day,kind ORDER BY day",[career.id])){
   const known=closures.filter(c=>c.player_id===row.player_id&&c.day===row.day&&c.reason===row.kind).length;
   if(Number(row.total)>known)departure(Number(row.player_id),Number(row.day),0,String(row.kind));
 }
 for(const row of all("SELECT player_id,day FROM web_market_moves WHERE career_id=? AND kind='renewed' ORDER BY day,player_id",[career.id])){
   const id=Number(row.player_id),day=Number(row.day);
   post({id:'renewal:'+id+':'+day,day,category:'Mercado',title:nickname(id)+' renova com '+career.name,summary:'A renovação do contrato foi confirmada pela organização.',playerId:id,organizationId:'career'});
 }
 for(const row of all(`SELECT c.player_id,c.start_day,c.end_day FROM web_contracts c WHERE career_id=? AND end_day<?
   AND NOT EXISTS(SELECT 1 FROM web_contract_closures x WHERE x.career_id=c.career_id AND x.player_id=c.player_id AND x.start_day=c.start_day) ORDER BY end_day`,[career.id,career.day])){
   const id=Number(row.player_id);
   post({id:'expiry:'+id+':'+row.start_day,day:Number(row.end_day)+1,category:'Mercado',title:nickname(id)+' encerra vínculo com '+career.name,
     summary:'O contrato chegou ao fim. Consulte o perfil para confirmar a disponibilidade e o vínculo atuais.',playerId:id,organizationId:'career'});
 }
 for(const row of all("SELECT * FROM web_ai_cash_events WHERE career_id=? AND event_key LIKE 'hire:%' ORDER BY day,event_key",[career.id])){
   const id=Number(String(row.event_key).split(':').at(-2)),org=String(row.organization);
   post({id:'ai:'+row.event_key,day:Number(row.day),category:'Mercado',title:nickname(id)+' assina com '+(organizations.get(org)??org),
     summary:'A organização concluiu a contratação para compor seu elenco.',playerId:id,organizationId:org});
 }
 const seasons=all('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number',[career.id]).map(row=>JSON.parse(String(row.data)) as Season);
 for(const season of seasons)for(const edition of season.editions){
   for(const game of edition.fixtures){
     if(!game.result||(game.phase==='regular'&&game.home!=='career'&&game.away!=='career'))continue;
     const home=edition.participants.find(p=>p.id===game.home)!,away=edition.participants.find(p=>p.id===game.away)!,winner=edition.participants.find(p=>p.id===game.result!.winner)!;
     post({id:'series:'+game.id,day:game.result.completedDay,category:'Campeonatos',title:winner.name+' vence em '+edition.name,
       summary:home.name+' '+game.result.score[0]+' × '+game.result.score[1]+' '+away.name+' · MD'+game.bestOf+'.',organizationId:winner.organization,fixtureId:game.id});
   }
 }
 for(const award of all('SELECT * FROM web_competition_awards WHERE career_id=? ORDER BY day,competition_id',[career.id])){
   const edition=seasons.flatMap(s=>s.editions).find(e=>e.id===award.competition_id),champion=edition?.participants.find(p=>p.id===award.team_id);
   const name=champion?.name??(award.organization==='career'?career.name:organizations.get(String(award.organization))??String(award.organization));
   post({id:'champion:'+award.season+':'+award.competition_id,day:Number(award.day),category:'Campeonatos',title:name+' é campeão de '+award.name,
     summary:'Título de prestígio '+award.prestige+' registrado no histórico da organização.',organizationId:String(award.organization),fixtureId:edition?.fixtures.find(g=>g.phase==='final')?.id});
 }
 for(const row of all("SELECT event_key,day,description FROM web_cash_events WHERE career_id=? AND category='facility' ORDER BY day,event_key",[career.id])){
   const [,kind,level]=String(row.event_key).split(':'),definition=facilityDefinitions[kind as FacilityKind];if(!definition)continue;
   post({id:'organization:'+row.event_key,day:Number(row.day),category:'Organizações',title:career.name+' melhora '+definition.name,
     summary:'A instalação chegou ao nível '+level+'. '+definition.description,organizationId:'career',target:'finances'});
 }
}

export function processMoodEvent(run:Run,read:Read,careerId:string,players:Player[],owned:Set<number>,day:number,seed:number){
 if(day%7!==0||hashSeed(seed+':mood:'+day)%100>=15||read('SELECT 1 FROM web_world_events WHERE career_id=? AND day>?',[careerId,day-30]))return players;
 const eligible=players.filter(p=>owned.has(p.id)&&p.status!=='retired').sort((a,b)=>a.id-b.id);if(!eligible.length)return players;
 const roll=hashSeed(seed+':athlete:'+day),player=eligible[roll%eligible.length],before=playerCondition(player,day);
 const morale=Math.max(0,Math.min(100,before.morale+(roll%2?3:-3))),delta=Math.round((morale-before.morale)*100)/100;
 if(!delta)return players;
 const key='mood:'+day;
 run('INSERT INTO web_world_events VALUES(?,?,?,?,?,?)',[careerId,key,day,player.id,'morale',delta]);
 recordNews(run,read,careerId,{id:key,day,category:'Jogadores',title:player.nickname+(delta>0?' demonstra motivação':' passa por queda de motivação'),
   summary:'Pequena variação de moral ('+(delta>0?'+':'')+delta.toLocaleString('pt-BR')+'). A recuperação segue o sistema normal da carreira.',playerId:player.id,organizationId:'career'});
 return players.map(p=>p.id===player.id?{...p,condition:{...before,morale,day}}:p);
}

export function recordDevelopmentNews(run:Run,read:Read,career:Career,before:Player[],after:Player[],day:number,owned:Set<number>){
 const old=new Map(before.map(p=>[p.id,p]));
 for(const player of after.filter(p=>owned.has(p.id)&&p.status!=='retired')){
   const previous=old.get(player.id);if(!previous)continue;
   const mark=read("SELECT day,value FROM web_news_marks WHERE career_id=? AND kind='growth' AND entity_id=?",[career.id,String(player.id)]);
   const baseline=Number(mark?.value??previous.overall);
   if(!mark)run("INSERT INTO web_news_marks VALUES(?,'growth',?,?,?)",[career.id,String(player.id),Math.max(1,day-1),baseline]);
   if(player.overall<baseline+1)continue;
   recordNews(run,read,career.id,{id:'growth:'+player.id+':'+day,day,category:'Jogadores',title:player.nickname+' registra evolução no treinamento',
     summary:'Overall passou de '+baseline.toLocaleString('pt-BR',{maximumFractionDigits:2})+' para '+player.overall.toLocaleString('pt-BR',{maximumFractionDigits:2})+' nos ciclos de desenvolvimento.',playerId:player.id,organizationId:'career'});
   run("UPDATE web_news_marks SET day=?,value=? WHERE career_id=? AND kind='growth' AND entity_id=?",[day,player.overall,career.id,String(player.id)]);
 }
 const newcomers=after.filter(p=>!old.has(p.id)&&p.status==='ranked'&&(p.estimateLow??0)>=85&&athleteAge(p.birthDay,day)<=21)
   .sort((a,b)=>(b.estimateLow??0)-(a.estimateLow??0)||a.id-b.id).slice(0,3);
 for(const player of newcomers)recordNews(run,read,career.id,{id:'prospect:'+player.id,day,category:'Jogadores',title:player.nickname+' aparece entre as promessas da ranked',
   summary:'Jovem de '+athleteAge(player.birthDay,day)+' anos com potencial publicamente estimado em '+player.estimateLow+'–'+player.estimateHigh+'.',playerId:player.id});
 for(const player of after.filter(p=>p.status==='retired'&&old.get(p.id)?.status!=='retired'&&p.retiredDay===day))recordNews(run,read,career.id,{id:'retired:'+player.id,day,category:'Jogadores',
   title:player.nickname+' encerra a carreira',summary:'A aposentadoria foi registrada no mundo competitivo.',playerId:player.id});
}
