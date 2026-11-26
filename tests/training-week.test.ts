import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {workerHarness} from './helpers/worker-harness.ts';
import {definitions,roles} from '../src/game-core/attributes.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {trainingLoad,validateWeekSlots} from '../src/game-core/training-week.ts';

test('carga explica sequência, fadiga atual e possibilidade de descanso',()=>{
 const load=trainingLoad([{day:7,kind:'official'},{day:8,kind:'scrim'},{day:9,kind:'team',intensity:'high'},{day:10,kind:'rest'}],7,55);
 assert.equal(load.heavy,3);
 assert.equal(load.recovery,1);
 assert.equal(load.reasons.length,3);
 assert.throws(()=>validateWeekSlots([{offset:0,kind:'scrim',intensity:'high',objective:'Treino',players:[1,1,2,3,4],opponent:'x'}]),/distintos/);
});

for(const mode of ['MOBA','FPS'] as const)test('scrim '+mode+' usa alternativa, mantém titulares e arquiva resultado separado',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const catalog={organizations:[{id:'org',name:'Rival',code:'RIV',logo:'',reputation:50}],
     teams:[{id:'rival',organization:'org',name:'Rival',league:'league',academy:false}],
     leagues:[{id:'league',discipline:mode}]};
   const request=workerHarness(db,catalog);
   await request('list');
   db.prepare('INSERT INTO careers VALUES(?,?,?,?,?,?,?,?,?,?,?)')
     .run('a','Aurora','AUR','BR',mode,'Normal',5000000,'#aabbcc','animals_wolf','2026',7);
   const attributes=Object.fromEntries(definitions[mode].map(key=>[mode.toLowerCase()+'_'+key,55]));
   const players=roles[mode].flatMap((role,index)=>[
     {id:index+1,nickname:'Titular '+index,mode,role,overall:55,attributes,organization:null,team:null,birthDay:-7500},
     {id:index+20,nickname:'Rival '+index,mode,role,overall:55,attributes,organization:'org',team:'rival',birthDay:-7500},
   ]);
   players.push({...players[0],id:10,nickname:'Reserva'});
   const insert=db.prepare('INSERT INTO web_contracts VALUES(?,?,?,?,?,?,?,?)');
   for(const player of players.filter(row=>!row.team))insert.run('a',player.id,player.role,Number(player.id!==10),10000,0,1,90);
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify(players));
   await request('set-training',{careerId:'a',playerId:10,focus:'role'});
   assert.equal((await request('training','a'))[0].focus,'role');
   const scrim={offset:0,kind:'scrim',intensity:'normal',objective:'Testar reserva',opponent:'rival',players:[10,2,3,4,5]};
   await request('training-event-plan',{careerId:'a',start:7,slot:scrim});
   await assert.rejects(()=>request('prepare-match',{careerId:'a',opponentId:'rival'}),/treinamento/);
   await request('training-event-complete',{careerId:'a',day:7});
   await assert.rejects(()=>request('training-event-complete',{careerId:'a',day:7}),/já está encerrada/);
   const result=(await request('training-week','a')).events[0].result;
   assert.ok(result.stats.some((row:{playerId:number})=>row.playerId===10));
   assert.ok(!result.stats.some((row:{playerId:number})=>row.playerId===1));
   assert.equal((await request('contracts','a')).find((row:{player_id:number})=>row.player_id===1).starter,1);
   assert.equal((await request('matches','a')).length,0);
   assert.equal(db.prepare("SELECT balance FROM careers WHERE id='a'").get()?.balance,5000000);
   const event={offset:1,kind:'rest',intensity:'light',objective:'Recuperação'};
   await request('training-model-save',{careerId:'a',name:'Base',slots:[event]});
   const modelId=(await request('training-week','a')).models[0].id;
   await request('training-week-apply',{careerId:'a',start:7,modelId});
   await assert.rejects(()=>request('training-week-apply',{careerId:'a',start:7,modelId}),/Já existe/);
   await request('training-model-rename',{careerId:'a',id:modelId,name:'Semana leve'});
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   const restored=await request('training-week','restored');
   assert.equal(restored.models[0].name,'Semana leve');
   assert.equal(restored.events[0].result.mode,mode);
   assert.equal((await request('training-agenda','restored'))[0].day,8);
 }finally{db.close();}
});
