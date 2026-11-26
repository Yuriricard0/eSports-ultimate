import type {Contract,Player} from './recruitment.ts';

export const loanPeriods=[30,60,90] as const;
export type Loan={player_id:number;origin:string;destination:string;club:string;start_day:number;end_day:number;starter:number};
export const loanSchema=`
CREATE TABLE IF NOT EXISTS web_loans (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 player_id INTEGER NOT NULL, origin TEXT NOT NULL, destination TEXT NOT NULL, club TEXT NOT NULL,
 start_day INTEGER NOT NULL,end_day INTEGER NOT NULL CHECK(end_day>=start_day),
 starter INTEGER NOT NULL DEFAULT 0 CHECK(starter IN (0,1)),
 CHECK(origin<>destination AND (origin='career' OR destination='career')),
 PRIMARY KEY(career_id,player_id,start_day)
);
CREATE INDEX IF NOT EXISTS web_active_loans ON web_loans(career_id,end_day,start_day);
`;

export function activeLoans(loans:readonly Loan[],day:number){
 return loans.filter(loan=>loan.start_day<=day&&loan.end_day>=day);
}
export function loanPlayers(players:Player[],loans:readonly Loan[],day:number){
 const assignments=new Map(activeLoans(loans,day).map(loan=>[loan.player_id,loan]));
 if(!assignments.size)return players;
 return players.map(player=>{
   const assignment=assignments.get(player.id);
   return assignment?{...player,team:assignment.destination==='career'?null:assignment.destination}:player;
 });
}
export function loanContracts(players:Player[],contracts:Contract[],loans:readonly Loan[],day:number):Contract[]{
 const active=activeLoans(loans,day);
 const outgoing=new Set(active.filter(loan=>loan.origin==='career').map(loan=>loan.player_id));
 const athletes=new Map(players.map(player=>[player.id,player]));
 const incoming=active.flatMap(loan=>loan.destination==='career'&&athletes.has(loan.player_id)?[{
   player_id:loan.player_id,salary:0,bonus:0,starter:loan.starter,start_day:loan.start_day,end_day:loan.end_day,loan:true,
 }]:[]);
 const occupied=new Set(incoming.filter(row=>row.starter).map(row=>athletes.get(row.player_id)?.role));
 return [...contracts.filter(row=>!outgoing.has(row.player_id)).map(row=>occupied.has(athletes.get(row.player_id)?.role)?{...row,starter:0}:row),...incoming];
}
