import {test} from 'node:test';
import assert from 'node:assert/strict';
import {marketInterest} from '../src/game-core/market-interest.ts';

test('histórico oficial aumenta interesse e potencial oculto não altera a avaliação',()=>{
 const player={id:7,mode:'MOBA',role:'top',overall:70,estimateLow:null,estimateHigh:null,birthDay:-7000,organization:'career'};
 const buyer={reputation:65,academy:false};
 const unknown=marketInterest(player,buyer,60,7);
 const observed=marketInterest(player,buyer,60,7,{games:4,impact:2});
 assert.ok(observed>unknown);
 const hiddenTalent={...player,ceiling:100};
 assert.equal(marketInterest(hiddenTalent,buyer,60,7),unknown);
 assert.ok(marketInterest({...player,rankedPerformance:{points:2000,winRate:.6}},buyer,60,7)>unknown);
 assert.ok(marketInterest(player,buyer,60,7,{games:0,impact:0,priorGames:2})>unknown);
 assert.equal(marketInterest(player,buyer,80,7,{games:4,impact:2}),0);
});
import {marketApproaches,marketLimits,type Approach} from '../src/game-core/market-interest.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';

test('limites valem para atleta da IA e do usuário e respeitam recusa e orçamento',()=>{
 const player={id:7,mode:'MOBA',role:'top',overall:70,estimateLow:70,birthDay:-7000,organization:'seller',team:'origin'} as Player;
 const catalog:WorldCatalog={
  leagues:[{id:'league',name:'Liga',discipline:'MOBA',tier:2,season:'2027',kind:'league',source:''}],
  organizations:[{id:'buyer',name:'Buyer',code:'BUY',country:'BR',logo:'',reputation:65}],
  teams:[{id:'target',name:'Buyer',organization:'buyer',league:'league',academy:false,tier:2,global_rank:0}],
 };
 const evidence=new Map([[7,{games:8,impact:2}]]);
 const simulate=(seed:number,owners:Map<number,number>,history:Approach[]=[],funded=true,day=70)=>
   marketApproaches([player],catalog,owners,evidence,history,seed,day,()=>funded,marketLimits);
 const seed=Array.from({length:10000},(_,i)=>i).find(i=>simulate(i,new Map()).length)!;
 assert.ok(Number.isInteger(seed));
 const ai=simulate(seed,new Map())[0],user=simulate(seed,new Map([[7,365]]))[0];
 assert.equal(ai.fee,user.fee);assert.equal(ai.seller,'seller');assert.equal(user.seller,'career');
 assert.equal(ai.expires-ai.day,7);
 assert.equal(simulate(seed,new Map(),[],false).length,0);
 assert.equal(simulate(seed,new Map(),[{...ai,day:20,state:'declined'}]).length,0);
 assert.equal(simulate(seed,new Map(),[{...ai,day:20,state:'expired'}]).length,1);
 assert.equal(simulate(seed,new Map(),[{...ai,day:68,state:'open',expires:82}]).length,0);
});
