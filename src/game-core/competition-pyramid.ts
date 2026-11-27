import type {Competition,Participant,Season} from './competitions.ts';

export type Pyramid={elite:string;access:string;playIn:string};
export function regionalPyramid(elite:string,access:string):Pyramid{
 return {elite,access,playIn:'permanencia-'+elite};
}
export function eligibleRegionalChallengers(elite:Competition,access:Competition){
 const organizations=new Set(elite.participants.map(team=>team.organization));
 return access.finalOrder.filter(id=>access.participants.some(team=>team.id===id&&!organizations.has(team.organization)));
}
export function exchangeRegionalSlots(elite:Participant[],access:Participant[],previous:Season|undefined,pyramid:Pyramid){
 const table=new Map([...elite,...access].map(team=>[team.id,team]));
 const oldElite=previous?.editions.find(row=>row.key===pyramid.elite);
 const oldAccess=previous?.editions.find(row=>row.key===pyramid.access);
 const rebuild=(edition:Competition|undefined,candidates:Participant[],other:Participant[])=>{
   if(!edition?.champion)return candidates;
   const prior=new Set(edition.participants.map(row=>row.id));
   const foreign=new Set(other.map(row=>row.id));
   const organizations=new Set<string>();
   return [...edition.participants.flatMap(row=>table.has(row.id)?[table.get(row.id)!]:[]),...candidates.filter(row=>!prior.has(row.id)&&!foreign.has(row.id))]
     .filter(team=>{if(organizations.has(team.organization))return false;organizations.add(team.organization);return true;}).slice(0,edition.participants.length);
 };
 if(!previous?.pyramid||!oldElite?.champion||!oldAccess?.champion)
   return {elite,access};
 let upper=rebuild(oldElite,elite,oldAccess.participants);
 let lower=rebuild(oldAccess,access,oldElite.participants);
 const swap=(up:string|undefined,down:string|undefined)=>{
   const promoted=lower.find(team=>team.id===up),relegated=upper.find(team=>team.id===down);
   if(!promoted||!relegated)return;
   if(upper.some(team=>team.organization===promoted.organization))return;
   const affiliate=lower.find(team=>team.organization===relegated.organization&&team.id!==up);
   if(affiliate){
     const occupied=new Set([...upper,...lower].map(team=>team.organization));
     const reserve=access.find(team=>!occupied.has(team.organization));
     if(!reserve)return;
     lower=lower.map(team=>team.id===affiliate.id?reserve:team);
   }
   upper=upper.map(team=>team.id===down?promoted:team);
   lower=lower.map(team=>team.id===up?relegated:team);
 };
 const challengers=eligibleRegionalChallengers(oldElite,oldAccess);
 swap(challengers[0],oldElite.finalOrder.at(-1));
 const survival=previous.editions.find(row=>row.key===pyramid.playIn);
 if(survival?.champion&&survival.champion===challengers[1])swap(survival.champion,oldElite.finalOrder.at(-2));
 return {elite:upper,access:lower};
}

export function schedulePermanence(season:Season,day:number){
 const pyramid=season.pyramid;
 if(!pyramid||season.editions.some(edition=>edition.key===pyramid.playIn))return;
 const elite=season.editions.find(edition=>edition.key===pyramid.elite);
 const access=season.editions.find(edition=>edition.key===pyramid.access);
 if(!elite?.champion||!access?.champion)return;
 const home=elite.participants.find(team=>team.id===elite.finalOrder.at(-2));
 const away=access.participants.find(team=>team.id===eligibleRegionalChallengers(elite,access)[1]);
 if(!home||!away||home.organization===away.organization)return;
 const startDay=Math.max(day,elite.endDay,access.endDay)+7,id='s'+season.number+':'+pyramid.playIn;
 season.editions.push({id,key:pyramid.playIn,name:'Disputa de permanência',region:elite.region,mode:'MOBA',prestige:'Regional',
   season:season.number,prize:0,reputationGain:0,finalBestOf:5,format:'knockout',participants:[home,away],champion:null,finalOrder:[],
   startDay,endDay:startDay,importRegion:elite.importRegion,
   fixtures:[{id:id+':final:0',competitionId:id,season:season.number,day:startDay,home:home.id,away:away.id,phase:'final',round:1,bestOf:5,status:'scheduled',result:null}]});
 season.endDay=Math.max(season.endDay,startDay);
}
