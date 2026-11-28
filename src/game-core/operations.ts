import {isScheduledFixture,type Season} from './competitions.ts';
import type {Career} from './career.ts';
import {countryRegions} from './countries.ts';
import {recordCash} from './finance.ts';

export const travelStandards=['Econômico','Padrão','Confortável'] as const;
export type TravelStandard=typeof travelStandards[number];
export type DelegationMode='manual'|'recommend'|'automatic';
export const operationsAreas={training:'Treinamento',lineup:'Escalação',scouting:'Scouting',market:'Negociações',equipment:'Equipamentos'} as const;
export type OperationsArea=keyof typeof operationsAreas;
export type TravelPolicy={mode:DelegationMode;standard:TravelStandard;budget:number;division:string;recommend?:Partial<Record<OperationsArea,boolean>>};
export type Trip={fixtureId:string;edition:string;destination:string;mode:string;standard:TravelStandard;departure:number;arrival:number;matchDay:number;
 travelers:number;transport:number;lodging:number;meals:number;total:number;fatigue:number};
export type TravelRecord=Trip&{bookedDay:number;automatic:boolean;applied:boolean};
export const operationsSchema=`
CREATE TABLE IF NOT EXISTS web_travel_policy(career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS web_travel_bookings(career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 fixture_id TEXT NOT NULL,booked_day INTEGER NOT NULL,automatic INTEGER NOT NULL,applied INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL,
 PRIMARY KEY(career_id,fixture_id));`;

// Fictional gameplay venues. Competitions without an explicit assignment do not charge travel.
const lanVenues:Record<string,string>={cs_cologne:'Europa',cs_major:'Europa',moba_world:'Europa'};
export const defaultTravelPolicy=(division:string):TravelPolicy=>({mode:'manual',standard:'Padrão',budget:0,division});

export function validateTravelPolicy(input:TravelPolicy,division:string):TravelPolicy{
 if(input?.division!==division||!['manual','recommend','automatic'].includes(input.mode)||!travelStandards.includes(input.standard)||
    !Number.isSafeInteger(input.budget)||input.budget<0||input.budget>1_000_000_000||input.mode==='automatic'&&input.budget===0)throw Error('Revise a modalidade, o padrão e o limite da delegação.');
 const recommend=Object.fromEntries(Object.keys(operationsAreas).map(area=>[area,input.recommend?.[area as OperationsArea]===true]));
 return {mode:input.mode,standard:input.standard,budget:input.budget,division,recommend};
}

export function travelOptions(career:Pick<Career,'country'|'mode'>,season:Season|undefined,day:number,bookings:Trip[]):Trip[]{
 const own=(season?.editions??[]).flatMap(edition=>edition.fixtures.filter(game=>isScheduledFixture(game)&&(game.home==='career'||game.away==='career'))
   .map(game=>({edition,game})));
 return own.flatMap(({edition,game})=>{
   const destination=lanVenues[edition.key];
   if(!destination||edition.mode!==career.mode||bookings.some(trip=>trip.fixtureId===game.id))return [];
   const travelDays=countryRegions[career.country]===destination?1:2,travelers=5;
   return travelStandards.flatMap((standard,index)=>{
     const early=1+index,arrival=game.day-early,departure=arrival-travelDays;
     if(departure<day||own.some(row=>row.game.id!==game.id&&row.game.day>=departure&&row.game.day<=game.day)||
       bookings.some(trip=>departure<=trip.matchDay&&trip.departure<=game.day))return [];
     const transport=travelers*travelDays*[10500,16000,24000][index];
     const lodging=travelers*(early+1)*[4500,7200,11000][index],meals=travelers*(travelDays+early+1)*[2000,3000,4500][index];
     return [{fixtureId:game.id,edition:edition.name,destination,mode:edition.mode,standard,departure,arrival,matchDay:game.day,
       travelers,transport,lodging,meals,total:transport+lodging+meals,fatigue:[7,4,2][index]}];
   });
 }).sort((a,b)=>a.matchDay-b.matchDay||a.total-b.total);
}

export function travelBudgetRemaining(policy:TravelPolicy,bookings:TravelRecord[],day:number){
 const cycle=Math.floor((day-1)/30);
 return Math.max(0,policy.budget-bookings.filter(row=>row.automatic&&row.mode===policy.division&&Math.floor((row.bookedDay-1)/30)===cycle)
   .reduce((sum,row)=>sum+row.total,0));
}

type Run=Parameters<typeof recordCash>[0];
type Read=(sql:string,bind:(string|number)[])=>Record<string,unknown>|undefined;
export function recordTravel(run:Run,read:Read,careerId:string,trip:Trip,day:number,automatic:boolean,limit:number,reserve=0){
 if(trip.departure<day||trip.total>limit)return false;
 if(read('SELECT 1 FROM web_travel_bookings WHERE career_id=? AND fixture_id=?',[careerId,trip.fixtureId]))return false;
 const balance=Number(read('SELECT balance FROM careers WHERE id=?',[careerId])?.balance??0);
 if(balance-trip.total<reserve)return false;
 run('INSERT INTO web_travel_bookings(career_id,fixture_id,booked_day,automatic,data) VALUES(?,?,?,?,?)',[careerId,trip.fixtureId,day,Number(automatic),JSON.stringify(trip)]);
 run('UPDATE careers SET balance=balance-? WHERE id=?',[trip.total,careerId]);
 recordCash(run,careerId,'travel:'+trip.fixtureId,day,'travel',-trip.total,`${automatic?'Reserva automática':'Reserva manual'} · ${trip.edition} · ${trip.standard}`);
 return true;
}
