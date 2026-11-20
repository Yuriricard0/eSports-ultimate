import type {Season} from './competitions.ts';
import {recordCash} from './finance.ts';
import {creditAiPrize} from './ai-finance.ts';
type Bind=(string|number)[];
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Record<string,unknown>|undefined;

export const competitionSchema=`
CREATE TABLE IF NOT EXISTS web_competition_config (
 career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS web_competition_seasons (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,number INTEGER NOT NULL CHECK(number>0),data TEXT NOT NULL,
 PRIMARY KEY(career_id,number)
);
CREATE TABLE IF NOT EXISTS web_competition_awards (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,season INTEGER NOT NULL,competition_id TEXT NOT NULL,
 team_id TEXT NOT NULL,organization TEXT NOT NULL,day INTEGER NOT NULL,name TEXT NOT NULL,mode TEXT NOT NULL,prestige TEXT NOT NULL,
 prize INTEGER NOT NULL CHECK(prize>=0),reputation INTEGER NOT NULL CHECK(reputation>=0),
 PRIMARY KEY(career_id,season,competition_id)
);
`;

export function latestSeason(read:Read,careerId:string):Season|undefined{
 const row=read('SELECT data FROM web_competition_seasons WHERE career_id=? ORDER BY number DESC LIMIT 1',[careerId]);
 return row?JSON.parse(String(row.data)) as Season:undefined;
}
export function nextSeasonStart(previous:Season|undefined,currentDay:number){
 if(!previous)return currentDay;
 const annual=1+(Date.UTC(previous.year+1,2,15)-Date.UTC(2027,2,15))/86400000;
 return Math.max(currentDay,annual);
}
export function storeNewSeason(run:Run,read:Read,careerId:string,season:Season){
 run('BEGIN IMMEDIATE',[]);
 try{
   const old=latestSeason(read,careerId);
   if(old?.editions.some(e=>!e.champion))throw Error('Conclua as competições da temporada atual.');
   if(season.number!==(old?.number??0)+1||season.startDay<nextSeasonStart(old,Number(read('SELECT day FROM careers WHERE id=?',[careerId])?.day)))throw Error('Temporada ou calendário incompatível.');
   if(!season.editions.length)throw Error(season.notices.join(' ')||'Não há participantes suficientes.');
   run('INSERT INTO web_competition_seasons VALUES(?,?,?)',[careerId,season.number,JSON.stringify(season)]);
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}

// Called inside the same transaction as the game/day advance. The award's
// unique key is the receipt for both title and payment, never a repeatable grant.
export function persistSeason(run:Run,read:Read,careerId:string,season:Season,day:number){
 for(const edition of season.editions){
   if(!edition.champion||read('SELECT 1 FROM web_competition_awards WHERE career_id=? AND season=? AND competition_id=?',[careerId,season.number,edition.id]))continue;
   const champion=edition.participants.find(p=>p.id===edition.champion)!;
   run('INSERT INTO web_competition_awards VALUES(?,?,?,?,?,?,?,?,?,?,?)',[careerId,season.number,edition.id,champion.id,champion.organization,day,edition.name,edition.mode,edition.prestige,edition.prize,edition.reputationGain]);
   if(champion.id==='career'){
     run('UPDATE careers SET balance=balance+? WHERE id=?',[edition.prize,careerId]);
     recordCash(run,careerId,'award:'+season.number+':'+edition.id,day,'prize',edition.prize,'Premiação: '+edition.name+'.');
   }else creditAiPrize(run,read,careerId,champion.organization,'award:'+season.number+':'+edition.id,day,edition.prize);
 }
 run('UPDATE web_competition_seasons SET data=? WHERE career_id=? AND number=?',[JSON.stringify(season),careerId,season.number]);
}
