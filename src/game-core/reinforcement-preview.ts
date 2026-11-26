import {roles,type Mode} from './attributes.ts';
import {contractCost} from './contract-expectations.ts';
import {teamChemistry} from './development.ts';
import {careerLineup,type MatchStarter} from './matches.ts';
import type {Offer} from './negotiation.ts';
import type {Contract,Player} from './recruitment.ts';
import {estimatedStrength} from './team-analysis.ts';

export function reinforcementPreview(mode:Mode,day:number,players:Player[],contracts:Contract[],candidate:Player,offer:Offer){
 const active=contracts.filter(contract=>!contract.end_day||(contract.start_day<=day&&contract.end_day>=day));
 if(candidate.mode!==mode||candidate.status||!roles[mode]?.includes(candidate.role)||active.some(contract=>contract.player_id===candidate.id))return null;
 const eligible=players.filter(player=>player.mode===mode&&!player.status);
 const main=active.filter(contract=>!contract.academy);
 const signed=new Set(main.map(contract=>contract.player_id));
 const squad=eligible.filter(player=>signed.has(player.id));
 const starters=careerLineup(eligible,main);
 const incumbent=starters.find(slot=>slot.role===candidate.role)?.player;
 // The new teammate starts with zero shared days. Incumbents keep their existing tenure.
 const projected=[...starters.filter(slot=>slot.role!==candidate.role),{player:candidate,role:candidate.role,startDay:day}];
 const chemistry=(lineup:MatchStarter[])=>lineup.length>=2&&lineup.every(({player})=>Object.keys(player.attributes).length>0)
   ?teamChemistry(lineup,day):null;
 const currentPayroll=active.reduce((sum,contract)=>sum+contract.salary,0);
 return {
   incumbent,currentSlots:starters.length,projectedSlots:projected.length,totalSlots:roles[mode].length,
   currentOverall:estimatedStrength(squad,starters.map(slot=>slot.player)),
   projectedOverall:estimatedStrength([...squad,candidate],projected.map(slot=>slot.player)),
   currentChemistry:chemistry(starters),projectedChemistry:chemistry(projected),
   currentPayroll,projectedPayroll:currentPayroll+offer.salary,fee:offer.transferFee??0,cost:contractCost(offer),
 };
}
