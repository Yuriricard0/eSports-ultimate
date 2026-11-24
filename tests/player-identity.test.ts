import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withPersonalObjective,publicPerkInfluences} from '../src/game-core/player-identity.ts';
import {applyMatchConditions,type MatchResult} from '../src/game-core/matches.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import {definitions} from '../src/game-core/attributes.ts';

const athlete={id:7,birthDay:-7000,personality:'ambitious',team:null,organization:null,condition:{morale:55,form:50,fatigue:0,day:1},mode:'MOBA',role:'top',overall:60,
 attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,60]))} as Player;

test('objetivo usa o perfil observado e permanece após mudança de clube e idade',()=>{
 const young=withPersonalObjective(athlete,1);
 assert.equal(young.personalObjective,'recognition');
 assert.equal(withPersonalObjective({...young,team:'first-team'},4000).personalObjective,'recognition');
 assert.equal(withPersonalObjective({...athlete,team:'first-team'},1).personalObjective,'titles');
 assert.equal(withPersonalObjective({...athlete,personality:'balanced'},4000).personalObjective,'stability');
});

test('histórico registra apenas efeitos aplicados em partidas e protege o perk oculto',()=>{
 const result={day:1,mode:'MOBA',winner:0,durationMinutes:25,stats:[{playerId:7,team:0,role:'top'}]} as MatchResult;
 const withPerks={...athlete,perks:[{id:'natural_leader',known:true,intensity:1},{id:'hypercompetitive',known:false,intensity:1},
   {id:'cold_blood',known:true,intensity:1}]};
 const [played,reserve]=applyMatchConditions([withPerks,{...withPerks,id:8}],result);
 assert.equal(reserve.perkInfluences,undefined);
 assert.deepEqual(played.perkInfluences?.map(effect=>effect.perkId),['natural_leader','hypercompetitive','cold_blood']);
 assert.deepEqual(publicPerkInfluences(played.perkInfluences,withPerks.perks.filter(perk=>perk.known)).map(effect=>effect.perkId),['natural_leader','cold_blood']);
 const [capped]=applyMatchConditions([{...withPerks,condition:{morale:100,form:50,fatigue:0,day:1}}],result);
 assert.deepEqual(capped.perkInfluences?.map(effect=>effect.metric),['strength']);
});
