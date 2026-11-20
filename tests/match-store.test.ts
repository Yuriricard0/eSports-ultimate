import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {prepareMatch,completeMatch,matchSchema} from '../src/game-core/match-store.ts';
import {definitions,roles} from '../src/game-core/attributes.ts';
import type {MatchSide} from '../src/game-core/matches.ts';

function side(id:string,offset:number):MatchSide{return {id,name:id,code:'TST',logo:'',lineup:roles.MOBA.map((role,i)=>({role,startDay:1,player:{id:offset+i,nickname:'P'+i,name:'P'+i,mode:'MOBA',role,overall:50,organization:null,team:null,country:'BR',birthDay:-8000,portraitIndex:0,estimateLow:60,estimateHigh:70,attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,50]))}}))};}
test('conclusão é atômica e uma partida não pode ser simulada duas vezes',()=>{
 const db=new DatabaseSync(':memory:');db.exec(schema+matchSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',25000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[])=>db.prepare(sql).get(...bind);
 prepareMatch(run,read,'a','match1','rival',42);
 assert.throws(()=>prepareMatch(run,read,'a','match2','rival',43),/pendente/);
 const teams:[MatchSide,MatchSide]=[side('career:a',1),side('rival',100)];
 assert.throws(()=>completeMatch(run,read,'a','match1',teams,()=>{run('UPDATE careers SET balance=0 WHERE id=?',['a']);throw Error('interrompido');}),/interrompido/);
 assert.equal(read('SELECT result FROM web_matches',[])?.result,'');assert.equal(read('SELECT balance FROM careers',[])?.balance,25000000);
 const result=completeMatch(run,read,'a','match1',teams,()=>{});
 assert.equal(JSON.parse(String(read('SELECT result FROM web_matches',[])?.result)).mvp,result.mvp);
 assert.throws(()=>completeMatch(run,read,'a','match1',teams,()=>{}),/concluída/);
 assert.equal(read('SELECT COUNT(*) n FROM web_matches',[])?.n,1);db.close();
});
