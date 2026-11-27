import {simulateMatch,type MatchOptions,type MatchResult,type MatchSide} from './matches.ts';
import type {Mode} from './attributes.ts';
type Bind=(string|number)[];
type Run=(sql:string,bind:Bind)=>void;
type Read=(sql:string,bind:Bind)=>Record<string,unknown>|undefined;
export type StoredMatch={id:string;opponent_team_id:string;mode:Mode;day:number;result:MatchResult|null};

export const matchSchema=`
CREATE TABLE IF NOT EXISTS web_matches (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 id TEXT PRIMARY KEY, opponent_team_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('MOBA','FPS')),
 day INTEGER NOT NULL CHECK(day>0), seed INTEGER NOT NULL, result TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS web_one_pending_match ON web_matches(career_id) WHERE result='';
`;

export function prepareMatch(run:Run,read:Read,careerId:string,id:string,opponentId:string,seed:number){
 if(!id||!opponentId||!Number.isSafeInteger(seed))throw Error('Partida inválida.');
 run('BEGIN IMMEDIATE',[]);
 try{
   const career=read('SELECT day,mode FROM careers WHERE id=?',[careerId]);
   if(!career)throw Error('Carreira não encontrada.');
   if(read("SELECT 1 FROM web_matches WHERE career_id=? AND result=''",[careerId]))throw Error('Já há uma partida pendente.');
   run('INSERT INTO web_matches(career_id,id,opponent_team_id,mode,day,seed) VALUES(?,?,?,?,?,?)',[careerId,id,opponentId,String(career.mode),Number(career.day),seed]);
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}

export function completeMatch(run:Run,read:Read,careerId:string,id:string,teams:[MatchSide,MatchSide],onComplete:(result:MatchResult)=>void,options:MatchOptions={}){
 run('BEGIN IMMEDIATE',[]);
 try{
   const match=read('SELECT * FROM web_matches WHERE career_id=? AND id=?',[careerId,id]);
   const career=read('SELECT day,mode FROM careers WHERE id=?',[careerId]);
   if(!match||!career)throw Error('Partida não encontrada.');
   if(match.result!=='')throw Error('Esta partida já foi concluída.');
   if(match.mode!==career.mode||teams[0].id!=='career:'+careerId||teams[1].id!==match.opponent_team_id)throw Error('Equipes ou modalidade incompatíveis.');
   const result=simulateMatch(career.mode as Mode,Number(career.day),teams,Number(match.seed),options);
   onComplete(result);
   run('UPDATE web_matches SET day=?,result=? WHERE career_id=? AND id=?',[result.day,JSON.stringify(result),careerId,id]);
   run('COMMIT',[]);
   return result;
 }catch(error){run('ROLLBACK',[]);throw error;}
}
