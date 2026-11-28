import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {travelOptions,travelBudgetRemaining,type TravelRecord} from '../src/game-core/operations.ts';
import type {Season} from '../src/game-core/competitions.ts';
import {workerHarness} from './helpers/worker-harness.ts';
import {definitions,roles} from '../src/game-core/attributes.ts';
import {generationVersion} from '../src/game-core/generation.ts';
import {hire,type Player} from '../src/game-core/recruitment.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';

const career={country:'BR',mode:'FPS'};
const fixture=(id:string,day:number)=>({id,day,home:'career',away:'rival',status:'scheduled',result:null});
const season=(key='cs_major',games=[fixture('lan',11)])=>({number:1,year:2027,startDay:1,endDay:100,notices:[],editions:[
 {id:key,key,name:'Evento de teste',mode:'FPS',fixtures:games,participants:[],region:'Global'},
]}) as Season;

test('viagem só aparece para LAN, tem três padrões e evita choque de agenda',()=>{
 const options=travelOptions(career,season(),1,[]);
 assert.equal(options.length,3);
 assert.equal(options[0].departure,8);
 assert.ok(options[0].total<options[2].total&&options[0].fatigue>options[2].fatigue);
 assert.equal(options[0].total,options[0].transport+options[0].lodging+options[0].meals);
 assert.equal(travelOptions(career,season('cs_regional'),1,[]).length,0);
 assert.equal(travelOptions(career,season('cs_major',[fixture('lan',11),fixture('other',10)]),1,[]).some(row=>row.fixtureId==='lan'),false);
});

test('limite de 30 dias considera somente reservas automáticas da modalidade',()=>{
 const trip=travelOptions(career,season(),1,[])[0];
 const record={...trip,bookedDay:8,automatic:true,applied:false} satisfies TravelRecord;
 const policy={mode:'automatic',standard:trip.standard,division:'FPS',budget:trip.total+123} as const;
 assert.equal(travelBudgetRemaining(policy,[record,{...record,automatic:false},{...record,mode:'MOBA'}],30),123);
 assert.equal(travelBudgetRemaining(policy,[record],31),policy.budget);
});

test('Worker valida cotação, persiste permissões e impede duplicar o débito',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Alpha','ALP','BR','FPS','Normal',25000000,'#ef123b','animals_wolf','2026',1)");
   db.prepare('INSERT INTO web_competition_seasons VALUES(?,?,?)').run('a',1,JSON.stringify(season()));
   const state=await request('travel-state',{careerId:'a'}),trip=state.options[0];
   assert.equal(state.policy.mode,'manual');
   await assert.rejects(()=>request('travel-policy',{careerId:'a',policy:{mode:'automatic',standard:trip.standard,budget:trip.total,division:'FPS'}}),/centro/);
   await request('travel-policy',{careerId:'a',policy:{mode:'recommend',standard:trip.standard,budget:0,division:'FPS'}});
   await assert.rejects(()=>request('travel-book',{careerId:'a',fixtureId:trip.fixtureId,standard:trip.standard,total:1}),/custo mudou/);
   const input={careerId:'a',fixtureId:trip.fixtureId,standard:trip.standard,total:trip.total};
   await request('travel-book',input);
   await assert.rejects(()=>request('travel-book',input),/já reservada/);
   const saved=await workerHarness(db,{organizations:[],teams:[],leagues:[]})('travel-state',{careerId:'a'});
   assert.equal(saved.bookings.length,1);
   assert.equal(saved.policy.mode,'recommend');
   assert.equal(db.prepare("SELECT balance FROM careers WHERE id='a'").get()!.balance,25000000-trip.total);
   assert.equal(db.prepare("SELECT COUNT(*) n FROM web_cash_events WHERE category='travel'").get()!.n,1);
 }finally{db.close();}
});

test('avanço respeita limite, reserva automática reabre sem repetir o débito',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Alpha','ALP','BR','FPS','Normal',25000000,'#ef123b','animals_wolf','2026',1)");
   db.exec("INSERT INTO web_facilities VALUES('a','training',1,1)");
   const players=roles.FPS.map((role,index)=>({id:index+1,nickname:'P'+index,mode:'FPS',role,overall:50,birthDay:-8000,organization:null,team:null,
     country:'BR',attributes:Object.fromEntries(definitions.FPS.map(key=>['fps_'+key,50]))})) as Player[];
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',1,generationVersion,JSON.stringify(players));
   const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
   const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
   for(const player of players)hire(run,read,'a',player);
   db.prepare('INSERT INTO web_competition_seasons VALUES(?,?,?)').run('a',1,JSON.stringify(season()));
   const {options:[trip],balance}=await request('travel-state',{careerId:'a'});
   await request('travel-policy',{careerId:'a',policy:{mode:'automatic',standard:trip.standard,budget:trip.total,division:'FPS'}});
   await request('advance',{careerId:'a',expectedDay:1,days:7});
   const saved=await workerHarness(db,{organizations:[],teams:[],leagues:[]})('travel-state',{careerId:'a'});
   assert.equal(saved.bookings.length,1);
   assert.equal(saved.bookings[0].automatic,true);
   assert.equal(saved.balance,balance-trip.total);
   await request('advance',{careerId:'a',expectedDay:8,days:1});
   assert.equal(db.prepare("SELECT COUNT(*) n FROM web_cash_events WHERE category='travel'").get()!.n,1);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=>'copy');
   const copy=await request('travel-state',{careerId:'copy'});
   assert.equal(copy.bookings.length,1);
   assert.equal(copy.bookings[0].fixtureId,trip.fixtureId);
   assert.equal(copy.policy.budget,trip.total);
   assert.equal(copy.balance,saved.balance);
 }finally{db.close();}
});
