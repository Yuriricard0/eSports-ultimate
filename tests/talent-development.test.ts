import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {definitions} from '../src/game-core/attributes.ts';
import {observeRanked,promotionRecommendation} from '../src/game-core/talent-development.ts';
import type {Player} from '../src/game-core/recruitment.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {workerHarness} from './helpers/worker-harness.ts';

test('uma vaga e dados técnicos ajudam, mas Overall alto sozinho não deixa o atleta pronto',()=>{
 const attributes=Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,72]));
 const player={id:7,mode:'MOBA',role:'mid',overall:72,attributes,developmentHistory:[{day:30,overall:70}]} as Player;
 assert.equal(promotionRecommendation(player,[],80).label,'Pronto para promoção');
 assert.equal(promotionRecommendation({...player,developmentHistory:[]},[],80).label,'Avaliar com o elenco principal');
 assert.equal(promotionRecommendation({...player,overall:95,attributes:{}},[],80).label,'Continuar desenvolvimento');
});
test('histórico usa a posição mundial real na modalidade e só grava observados',()=>{
 const players=[{id:1,mode:'MOBA',status:'ranked',rankedPerformance:{points:1400}},
   {id:2,mode:'MOBA',status:'ranked',rankedPerformance:{points:1600}},
   {id:3,mode:'FPS',status:'ranked',rankedPerformance:{points:2000}}] as Player[];
 assert.deepEqual(observeRanked(players,new Set([1,3]),14),[
   {player_id:1,day:14,position:2,points:1400},{player_id:3,day:14,position:1,points:2000},
 ]);
});
test('watch inicia no dia da carreira, deduplica e restaura mesmo depois de deixar de seguir',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',6)");
   const players=[{id:7,mode:'MOBA',status:'ranked',rankedPerformance:{points:1400,winRate:52},overall:50,birthDay:-7300}];
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify(players));
   const track={careerId:'a',playerId:7,tracked:true};
   await request('set-ranked-watch',track);
   assert.equal((await request('set-ranked-watch',track)).history.length,1);
   await request('advance',{careerId:'a',expectedDay:6,days:1});
   const history=(await request('set-ranked-watch',{...track,tracked:false})).history;
   assert.deepEqual(Array.from(history,(row:{day:number})=>row.day),[6,7]);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   const restored=await request('ranked-watch','restored');
   assert.equal(restored.ids.length,0);
   assert.equal(restored.history.length,2);
 }finally{db.close();}
});
