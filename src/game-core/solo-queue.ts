import {rankedStats} from './ranked.ts';
import type {Player} from './recruitment.ts';

export const soloSeasonDays=84;
export const soloQueueSchema=`
CREATE TABLE IF NOT EXISTS web_solo_seasons(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,start_day INTEGER NOT NULL,end_day INTEGER NOT NULL,
 final TEXT NOT NULL DEFAULT '',PRIMARY KEY(career_id,start_day)
);
CREATE TABLE IF NOT EXISTS web_solo_weeks(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,day INTEGER NOT NULL,standings TEXT NOT NULL,
 PRIMARY KEY(career_id,day)
);`;
export type RankedStanding=[id:number,position:number,points:number];
export type SoloSeason={start_day:number;end_day:number;closed:boolean};
export type WeeklyClimber={id:number;mode:string;position:number;rise:number};
export type WeeklyRankings=Record<string,RankedStanding[]>;

export function soloStandings(players:Player[]):WeeklyRankings{
 const result:WeeklyRankings={};
 for(const mode of ['MOBA','FPS']){
   result[mode]=players.filter(player=>player.mode===mode&&player.status==='ranked')
     .map(player=>({id:player.id,points:rankedStats(player).points}))
     .sort((a,b)=>b.points-a.points||a.id-b.id)
     .map(({id,points},index)=>[id,index+1,points]);
 }
 return result;
}

export function resetSoloPoints(players:Player[]){
 return players.map(player=>{
   if(player.status!=='ranked')return player;
   const performance=rankedStats(player);
   return {...player,rankedPerformance:{...performance,points:Math.round(1200+(performance.points-1200)*.65)}};
 });
}

export function weeklyClimbers(previous:WeeklyRankings,current:WeeklyRankings):WeeklyClimber[]{
 return Object.entries(current).flatMap(([mode,standings])=>{
   const older=new Map((previous[mode]??[]).map(([id,position])=>[id,position]));
   return standings.flatMap(([id,position])=>{
     const earlier=older.get(id);
     return earlier!==undefined&&earlier>position?[{id,mode,position,rise:earlier-position}]:[];
   });
 }).sort((a,b)=>b.rise-a.rise||a.position-b.position||a.id-b.id);
}

export function scoutingConfidence(days:number,observations:number){
 if(days>=28&&observations>=5)return 'Alta';
 if(days>=14&&observations>=3)return 'Moderada';
 return 'Inicial';
}
