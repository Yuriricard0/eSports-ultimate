import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {workerHarness} from '../tests/helpers/worker-harness.ts';
import {roles,type Mode} from '../src/game-core/attributes.ts';
import {terms,type Player} from '../src/game-core/recruitment.ts';
import {athleteAge} from '../src/game-core/development.ts';
import {nextUserFixture,type Season} from '../src/game-core/competitions.ts';
import type {Career} from '../src/game-core/career.ts';

// Reproducible QA fixture: uses production worker actions, never fabricated news.
const scratch='.superpowers/sdd/2026-11-25-uem-news';
mkdirSync(scratch,{recursive:true});mkdirSync('docs/qa/uem-news',{recursive:true});
const path=scratch+'/qa-careers-'+Date.now()+'.sqlite',db=new DatabaseSync(path);
const catalog=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8'));
const base=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
const request=workerHarness(db,catalog,{players:base,filePath:path,scratchDirectory:scratch,seed:20261125});
const evidence=[];
try{
 for(const mode of ['MOBA','FPS'] as Mode[]){
  let career=await request('create',{name:'Aurora '+mode,code:mode==='MOBA'?'AUR':'AFS',country:'BR',mode,difficulty:'Fácil',color:'#ef123b',symbol:'animals_wolf'}) as Career;
  const id=career.id,players=await request('world-players',id) as Player[];
  for(const role of roles[mode]){
   const player=players.filter(p=>p.mode===mode&&p.role===role&&!p.organization&&!p.status&&p.overall<=45&&athleteAge(p.birthDay,1)<=24).sort((a,b)=>b.overall-a.overall)[0];
   await request('submit-offer',{careerId:id,playerId:player.id,offer:{...terms(player.overall),days:730,salary:Math.ceil(terms(player.overall).salary*1.12/100)*100}});
   const proposal=(await request('negotiations',id)).find((n:any)=>n.player_id===player.id&&['accepted','counter'].includes(n.state));
   career=await request('confirm-offer',{careerId:id,id:proposal.id});
  }
  let season=await request('start-season',id) as Season,steps=0;
  while(season.editions.some(e=>!e.champion)){
   if(++steps>100)throw Error('Temporada não terminou');
   const next=nextUserFixture(season);
   if(next&&next.day<=career.day){const completed=await request('play-competition',{careerId:id,id:next.id});career=completed.career;season=completed.season;}
   else{career=(await request('advance',{careerId:id,expectedDay:career.day,days:30})).career;season=(await request('competition-state',id)).seasons[0];}
  }
  const start=performance.now();
  const news=await request('news',{careerId:id,filter:{channel:'public',pageSize:50}});
  const firstQueryMs=performance.now()-start;
  const repeat=performance.now();await request('news',{careerId:id,filter:{channel:'public',pageSize:20}});const repeatQueryMs=performance.now()-repeat;
  const categories=news.available;
  const examples=[...news.items.filter((n:any)=>n.id.startsWith('champion:')).slice(0,2),...news.items.filter((n:any)=>n.id.startsWith('series:')).slice(0,2)];
  const market=await request('news',{careerId:id,filter:{channel:'public',category:'Mercado',pageSize:3}});
  const rounds=await request('news',{careerId:id,filter:{channel:'public',query:'rodada',pageSize:2}});
  evidence.push({mode,day:career.day,total:news.total,firstQueryMs,repeatQueryMs,categories,examples:[...examples,...market.items,...rounds.items]});
 }
 await request('create',{name:'Sem notícias',code:'NEW',country:'BR',mode:'MOBA',difficulty:'Fácil',color:'#ef123b',symbol:'animals_wolf'});
 writeFileSync('docs/qa/uem-news/exemplos-simulacao.json',JSON.stringify(evidence,null,2));
 await request('export');
 console.log(JSON.stringify(evidence.map(({examples,...summary})=>summary),null,2));
 console.log('Backup para inspeção: '+path);
}finally{db.close();}
