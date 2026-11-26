import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {workerHarness} from './helpers/worker-harness.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {scoutingConfidence,weeklyClimbers} from '../src/game-core/solo-queue.ts';

test('destaques comparam posições registradas de atletas presentes nas duas semanas',()=>{
 assert.deepEqual(weeklyClimbers({MOBA:[[1,1,1700],[2,2,1600]]},{MOBA:[[2,1,1800],[3,2,1700],[1,3,1650]]}),[
   {id:2,mode:'MOBA',position:1,rise:1},
 ]);
 assert.equal(scoutingConfidence(90,1),'Inicial');
 assert.equal(scoutingConfidence(14,3),'Moderada');
 assert.equal(scoutingConfidence(28,5),'Alta');
});

test('virada arquiva o ranking anterior uma vez, ajusta só os pontos e mantém observações no backup',async()=>{
 const db=new DatabaseSync(':memory:');
 try{
   const request=workerHarness(db,{organizations:[],teams:[],leagues:[]});
   await request('list');
   db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',5000000,'#aabbcc','animals_wolf','2026',6)");
   const player={id:7,nickname:'Alpha',mode:'MOBA',role:'mid',status:'ranked',rankedPerformance:{points:1600,winRate:52},
     overall:50,estimateLow:50,estimateHigh:50,birthDay:-7300,attributes:{},organization:null,team:null};
   db.prepare('INSERT INTO web_career_world VALUES(?,?,?,?)').run('a',10,1,JSON.stringify([player]));
   await request('set-ranked-watch',{careerId:'a',playerId:7,tracked:true});
   assert.equal((await request('solo-queue','a')).seasons.length,0);
   for(const [day,days] of [[6,30],[36,30],[66,30],[96,1]])
     await request('advance',{careerId:'a',expectedDay:day,days});
   const solo=await request('solo-queue','a');
   assert.equal(solo.seasons.length,2);
   assert.equal(solo.seasons[1].start_day,7);
   assert.equal(solo.seasons[1].end_day,90);
   assert.equal(solo.seasons[1].closed,true);
   assert.equal(solo.comparison,null);
   const final=await request('solo-final',{careerId:'a',startDay:7});
   assert.equal(final.MOBA[0][2],1600);
   const stored=JSON.parse(String(db.prepare("SELECT players FROM web_career_world WHERE career_id='a'").get()?.players))[0];
   assert.equal(stored.rankedPerformance.points,1460);
   assert.equal(stored.overall,50);
   const observations=(await request('ranked-watch','a')).history;
   assert.equal(observations[0].day,6);
   assert.equal(observations.at(-1).points,1460);
   restoreWebBackup((sql,bind=[])=>db.prepare(sql).all(...bind),(sql,bind=[])=>{db.prepare(sql).run(...bind);},()=> 'restored');
   assert.equal((await request('solo-final',{careerId:'restored',startDay:7})).MOBA[0][2],1600);
   assert.equal((await request('ranked-watch','restored')).history.length,observations.length);
 }finally{db.close();}
});
