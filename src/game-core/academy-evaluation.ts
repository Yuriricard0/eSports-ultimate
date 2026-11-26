import {analyzeRoles} from './player-analysis.ts';
import type {Player} from './recruitment.ts';

export const tryoutDurations=[7,14,21] as const;
export const academyEvaluationSchema=`
CREATE TABLE IF NOT EXISTS web_academy_snapshots(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,day INTEGER NOT NULL,data TEXT NOT NULL,
 PRIMARY KEY(career_id,player_id,day)
);
CREATE TABLE IF NOT EXISTS web_youth_coach(
 career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS web_tryouts(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,start_day INTEGER NOT NULL,end_day INTEGER NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','completed','dismissed','signed','unavailable')),
 opening TEXT NOT NULL,final TEXT,PRIMARY KEY(career_id,player_id,start_day)
);
CREATE UNIQUE INDEX IF NOT EXISTS web_open_tryout ON web_tryouts(career_id,player_id) WHERE state IN ('active','completed');`;

export type AthleteSnapshot={overall:number;attributes:Record<string,number>};
export type AcademySnapshot={player_id:number;day:number;snapshot:AthleteSnapshot};
export type Tryout={player_id:number;start_day:number;end_day:number;state:'active'|'completed'|'dismissed'|'signed'|'unavailable';opening:AthleteSnapshot;final:AthleteSnapshot|null};
export function athleteSnapshot(player:Player):AthleteSnapshot{
 return {overall:player.overall,attributes:player.attributes};
}
export function academyChange(first:AthleteSnapshot,last:AthleteSnapshot){
 const change=Math.round((last.overall-first.overall)*100)/100;
 const attributes=Object.entries(last.attributes).flatMap(([key,value])=>{
   const initial=first.attributes[key];
   const gain=Math.round((value-initial)*100)/100;
   return Number.isFinite(gain)&&gain>0?[{key:key.replace(/^(moba|fps)_/,''),gain}]:[];
 }).sort((a,b)=>b.gain-a.gain);
 return {change,attributes,state:change>=.25?'Em destaque':change<=-.25?'Em queda':'Estável no período'};
}
export function tryoutAvailable(player:Pick<Player,'status'|'organization'|'team'|'mode'>,mode:string){
 return player.mode===mode&&!player.organization&&!player.team&&player.status!=='retired';
}
export function tryoutEvidence(player:Player,snapshot:AthleteSnapshot){
 const mode=player.mode;
 const analysis=mode==='MOBA'||mode==='FPS'?analyzeRoles(snapshot.attributes,mode,player.role):null;
 const adaptation=snapshot.attributes[mode.toLowerCase()+'_adaptation'];
 return {rating:analysis?.rating??null,strengths:analysis?.strengths.map(row=>row.key)??[],
   adaptation:Number.isFinite(adaptation)?adaptation:null};
}
