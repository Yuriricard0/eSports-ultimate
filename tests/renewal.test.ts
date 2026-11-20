import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyAdaptation,renewWorld,seasonBoundaries} from '../src/game-core/renewal.ts';
import {developPlayer} from '../src/game-core/development.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import {rankedCountries} from '../src/game-core/ranked.ts';
import {applyPerkEvent} from '../src/game-core/perk-events.ts';
const base:Player[]=JSON.parse(readFileSync(new URL('../public/data/players-v1.json',import.meta.url),'utf8'));
test('cinco temporadas mantêm IDs, protegem contratos e limitam atributos',()=>{
 const boundaries=seasonBoundaries(1,1830);
 assert.equal(boundaries.length,5);
 assert.equal(boundaries[0],367);
 const elder={...base.find(player=>!player.team)!,birthDay:-14000};
 const protectedElder={...elder,id:9000};
 let world=[...base.map(player=>player.id===elder.id?elder:player),protectedElder];
 let day=1;
 for(const boundary of boundaries){
   world=world.map(player=>developPlayer(player,day,boundary));
   world=renewWorld(world,42,boundary,[{player_id:9000,start_day:1,end_day:2000}]);
   day=boundary;
 }
 assert.ok(world.length>=base.length+1+3*2*rankedCountries.length);
 assert.equal(new Set(world.map(player=>player.id)).size,world.length);
 assert.equal(world.find(player=>player.id===elder.id)?.status,'retired');
 assert.equal(world.find(player=>player.id===9000)?.status,undefined);
 assert.ok(world.every(player=>player.overall>=1&&player.overall<=100&&(player.developmentHistory?.length??0)<=24));
 const ranked=world.filter(player=>player.status==='ranked');
 for(const country of rankedCountries)for(const mode of ['MOBA','FPS']){
   assert.ok(ranked.filter(player=>player.country===country&&player.mode===mode).length>=3,country+' '+mode);
 }
});
test('adaptação registra uma única perda ou aquisição por marco',()=>{
 const player={...base[0],attributes:{...base[0].attributes,moba_adaptation:100},perks:[{id:'change_resistant',known:true,intensity:0.8}]};
 const tenure={player_id:player.id,start_day:1,end_day:365};
 const removed=applyAdaptation(player,tenure,31,player.id^31);
 assert.equal(removed.perks?.length,0);
 assert.deepEqual(applyAdaptation(removed,tenure,31,player.id^31),removed);
 const gained=applyAdaptation(removed,tenure,61,player.id^61);
 assert.deepEqual(gained.perkHistory?.map(event=>event.action),['removed','acquired']);
 assert.equal(gained.perks?.[0].id,'versatile');
});

test('rival repõe aposentado sem perder vaga, atleta ou histórico',()=>{
 const veteran={...base.find(player=>player.team)!,birthDay:-14000};
 const rookie:Player={...veteran,id:9999,team:null,organization:null,birthDay:-7200,status:'ranked'};
 const world=renewWorld([...base.map(player=>player.id===veteran.id?veteran:player),rookie],1,367,[]);
 const retired=world.find(player=>player.id===veteran.id);
 assert.equal(retired?.status,'retired');
 assert.equal(retired?.team,null);
 assert.equal(world.find(player=>player.id===rookie.id)?.team,veteran.team);
 assert.equal(world.filter(player=>player.team===veteran.team).length,base.filter(player=>player.team===veteran.team).length);
});

test('sequência de derrotas respeita limiar, cooldown e idempotência',()=>{
 const player:Player={...base[0],personality:'balanced',perks:[],temperament:{discipline:55,professionalism:65,ambition:60}};
 const event={kind:'defeats' as const,id:'streak-5',day:42,metrics:{streak:5}};
 const seed=player.id^event.day;
 assert.equal(applyPerkEvent(player,{...event,metrics:{streak:4}},seed),player);
 const changed=applyPerkEvent(player,event,seed);
 assert.equal(changed.perks?.[0].id,'tilted');
 assert.equal(applyPerkEvent(changed,event,seed),changed);
 const finals={kind:'finals' as const,id:'third-final',day:48,metrics:{appearances:3}};
 assert.equal(applyPerkEvent(changed,finals,player.id^finals.day).perkHistory?.length,1);
});
