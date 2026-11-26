import {readFileSync} from 'node:fs';
import {marketApproaches,marketLimits,type Approach,type Evidence} from '../src/game-core/market-interest.ts';
import {saleOptions} from '../src/game-core/market.ts';
import {terms,type Player} from '../src/game-core/recruitment.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';

const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8')) as WorldCatalog;
const base=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
const snapshots=[];
for(const seed of [17,42,2026]){
 const managed=base.filter(p=>p.mode==='FPS'&&!p.organization&&!p.status).slice(0,18);
 const owners=new Map(managed.map(p=>[p.id,365]));
 const players=structuredClone(base);
 const cash=new Map(catalog.organizations.map(org=>[org.id,12_000_000]));
 const payroll=new Map<string,number>();
 for(const p of players)if(p.organization)payroll.set(p.organization,(payroll.get(p.organization)??0)+terms(p.overall).salary);
 const initialCash=new Map([...cash].map(([org,balance])=>[org,Math.max(balance,(payroll.get(org)??0)*6)]));
 for(const [org,balance] of initialCash)cash.set(org,balance);
 let rejectedBudget=0;
 const affordable=(org:string,p:Player,fee:number)=> {
   const fits=(cash.get(org)??0)>=fee+(payroll.get(org)??0)+terms(p.overall).salary;
   if(!fits)rejectedBudget++;
   return fits;
 };
 const oldPayroll=new Map(payroll);
 const oldQuotesByPlayer=new Map(managed.map(player=>[player.id,saleOptions(player,catalog,base,(org,fee)=>(initialCash.get(org)??0)>=fee+(oldPayroll.get(org)??0)+terms(player.overall).salary)]));
 const history:Approach[]=[];
 const evidence=new Map<number,Evidence>();
 // Controlled scouting progression: athletes gain official appearances starting on day 31.
 const experienced=new Set(managed.slice(0,9).map(p=>p.id));
 let oldQuotes=0,oldRepeated=0,oldUnknown=0;
 const oldPairs=new Set<string>();
 for(let day=1;day<=365;day++){
   if(day%30===0)for(const [org,balance] of cash)cash.set(org,Math.max(0,balance-(payroll.get(org)??0)));
   if(day%marketLimits.interval===0){
     if(day>=31)for(const id of experienced)evidence.set(id,{games:Math.min(12,Math.floor((day-24)/7)),impact:1.5});
     for(const player of managed)for(const quote of oldQuotesByPlayer.get(player.id)??[]){
       oldQuotes++;if(!evidence.has(player.id))oldUnknown++;
       const key=quote.organization+':'+player.id;if(oldPairs.has(key))oldRepeated++;oldPairs.add(key);
     }
     const bids=marketApproaches(players,catalog,owners,evidence,history,seed,day,affordable);
     for(const bid of bids){
       const p=players.find(p=>p.id===bid.playerId)!;
       const covered=players.some(other=>other.id!==p.id&&other.team===p.team&&other.role===p.role&&!other.status);
       if(bid.seller!=='career'&&covered&&affordable(bid.organization,p,bid.fee)){
         const salary=terms(p.overall).salary;
         cash.set(bid.organization,cash.get(bid.organization)!-bid.fee);
         cash.set(bid.seller,cash.get(bid.seller)!+bid.fee);
         payroll.set(bid.organization,(payroll.get(bid.organization)??0)+salary);
         payroll.set(bid.seller,Math.max(0,(payroll.get(bid.seller)??0)-salary));
         p.organization=bid.organization;p.team=bid.team;bid.state='signed';
       }else if(bid.seller!=='career')bid.state='declined';
       history.push(bid);
     }
   }
   if([30,90,365].includes(day)){
     const managedBids=history.filter(row=>row.seller==='career');
     const counts=Object.fromEntries(managed.map(p=>[p.id,managedBids.filter(row=>row.playerId===p.id).length]));
     const roles:Record<string,number>={};
     for(const row of history)roles[row.role]=(roles[row.role]??0)+1;
     const uniquePairs=new Set(history.map(row=>row.organization+':'+row.playerId));
     snapshots.push({seed,day,oldQuotes,oldRepeated,oldUnknown,approaches:history.length,user:managedBids.length,
       userUnknown:managedBids.filter(row=>row.day<31||!experienced.has(row.playerId)).length,
       repeated:history.length-uniquePairs.size,clubs:new Set(history.map(row=>row.organization)).size,
       signed:history.filter(row=>row.state==='signed').length,rejectedBudget,roles,counts});
   }
 }
}
console.log(JSON.stringify(snapshots,null,2));
