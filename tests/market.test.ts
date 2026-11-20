import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,hire,terms,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar,advanceCareerDay} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema,submitOffer,confirmOffer} from '../src/game-core/negotiation.ts';
import {renewContract,departPlayer,maintainRosters,saleOptions,transferValue} from '../src/game-core/market.ts';
import type {WorldCatalog} from '../src/game-core/world.ts';
import {restoreWebBackup} from '../src/game-core/backup.ts';
import {readFileSync} from 'node:fs';
import {roles,type Mode} from '../src/game-core/attributes.ts';

const player:Player={id:7,nickname:'Seven',name:'Seven Silva',mode:'MOBA',role:'top',overall:45,organization:null,team:null,country:'BR',birthDay:-7000,portraitIndex:0,estimateLow:50,estimateHigh:60,attributes:{},personality:'balanced'};
const catalog:WorldCatalog={organizations:[{id:'rival',name:'Rival',code:'RIV',country:'BR',logo:'',reputation:50}],teams:[{id:'team',organization:'rival',name:'Rival',league:'league',academy:false,tier:2,global_rank:50}],leagues:[{id:'league',name:'Liga',discipline:'MOBA',tier:2,season:'2027',kind:'league',source:''}]};
function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',100000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
 const all=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).all(...bind);
 return {db,run,read,all};
}

test('compra de rival cobra taxa uma vez e rejeita cotação com vendedor alterado',()=>{
 const {db,run,read}=setup();const rival={...player,organization:'rival',team:'team'};const fee=transferValue(rival);
 submitOffer(run,read,'a','buy',rival,{...terms(45),transferFee:fee},{reputation:50});
 assert.throws(()=>confirmOffer(run,read,'a','buy',{...rival,organization:'other'},false),/clube|vendedor/i);
 confirmOffer(run,read,'a','buy',rival,false);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,100000000-terms(45).bonus-fee);
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,1);
 assert.throws(()=>confirmOffer(run,read,'a','buy',rival,false));
 db.close();
});

test('renovação preserva salário já trabalhado e estende vínculo sem novo débito',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 advanceCareerDay(run,read,all,'a',1,7);
 renewContract(run,read,all,'a',7,440000,180);
 const balance=Number(read('SELECT balance FROM careers',[])?.balance);
 advanceCareerDay(run,read,all,'a',8,30);
 assert.equal(read('SELECT end_day FROM web_current_contracts',[])?.end_day,545);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,balance-Math.round((7*220000+23*440000)/30));
 assert.throws(()=>renewContract(run,read,all,'a',999,440000,180),/contrato/i);
 db.close();
});

test('venda e dispensa retiram vínculo, acertam proporcional e mantêm histórico',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);hire(run,read,'a',{...player,id:8});
 advanceCareerDay(run,read,all,'a',1,7);
 const balance=Number(read('SELECT balance FROM careers',[])?.balance);
 departPlayer(run,read,all,'a',player,{organization:'rival',team:'team',fee:1000000});
 assert.equal(read('SELECT balance FROM careers',[])?.balance,balance+1000000-Math.round(7*220000/30));
 assert.equal(read('SELECT starter FROM web_current_contracts WHERE player_id=8',[])?.starter,1);
 departPlayer(run,read,all,'a',{...player,id:8});
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,0);
 assert.equal(read('SELECT COUNT(*) n FROM web_market_moves',[])?.n,2);
 assert.throws(()=>departPlayer(run,read,all,'a',player),/contrato/i);
 const after=read('SELECT balance FROM careers',[])?.balance;
 advanceCareerDay(run,read,all,'a',8,30);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,after);
 db.close();
});

test('dispensa no mesmo dia é válida; recontratação no mesmo dia falha sem alterar caixa',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);departPlayer(run,read,all,'a',player);
 const before=read('SELECT balance FROM careers',[])?.balance;
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,0);
 assert.throws(()=>hire(run,read,'a',player));
 assert.equal(read('SELECT balance FROM careers',[])?.balance,before);
 advanceCareerDay(run,read,all,'a',1,1);hire(run,read,'a',player);
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,1);db.close();
});

test('IA preenche funções sem duplicar jogadores e nunca utiliza contratados do usuário',()=>{
 const pool=['top','jungle','mid','adc','support_moba'].map((role,index)=>({...player,id:10+index,role}));
 const owned={...player,id:99,overall:90};
 const result=maintainRosters([...pool,owned],catalog,new Set([99]),1);
 assert.equal(result.filter(p=>p.team==='team').length,5);
 assert.equal(result.find(p=>p.id===99)?.organization,null);
 assert.equal(new Set(result.map(p=>p.id)).size,result.length);
 assert.deepEqual(maintainRosters(result,catalog,new Set([99]),2),result);
 assert.ok(saleOptions(player,catalog,[]).length);
});

test('falha ao atualizar elenco reverte saída, saldo e encerramento',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 const before=read('SELECT balance FROM careers',[])?.balance;
 assert.throws(()=>departPlayer(run,read,all,'a',player,undefined,()=>{throw Error('falha');}),/falha/);
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,1);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,before);db.close();
});

test('backup V4 preserva mercado, contratos encerrados, faixas salariais e propostas',()=>{
 const source=setup(),target=setup();
 source.db.exec('PRAGMA user_version=4');
 hire(source.run,source.read,'a',player);
 renewContract(source.run,source.read,source.all,'a',7,250000,180);
 departPlayer(source.run,source.read,source.all,'a',player);
 submitOffer(source.run,source.read,'a','buy',{...player,id:8,organization:'rival',team:'team'},{...terms(45),transferFee:transferValue(player)});
 restoreWebBackup((sql,bind=[])=>source.db.prepare(sql).all(...bind),(sql,bind=[])=>{target.db.prepare(sql).run(...bind);},()=>'restored');
 assert.equal(target.read('SELECT COUNT(*) n FROM web_current_contracts WHERE career_id=?',['restored'])?.n,0);
 assert.equal(target.read('SELECT COUNT(*) n FROM web_salary_rates WHERE career_id=?',['restored'])?.n,1);
 assert.equal(target.read('SELECT COUNT(*) n FROM web_market_moves WHERE career_id=?',['restored'])?.n,2);
 assert.equal(target.read('SELECT fee FROM web_transfer_quotes WHERE career_id=?',['restored'])?.fee,transferValue(player));
 assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(),[]);
 source.db.close();target.db.close();
});

test('saída no dia do pagamento não cobra novamente o salário liquidado',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 advanceCareerDay(run,read,all,'a',1,7);advanceCareerDay(run,read,all,'a',8,7);advanceCareerDay(run,read,all,'a',15,7);advanceCareerDay(run,read,all,'a',22,7);advanceCareerDay(run,read,all,'a',29,1);
 const balance=read('SELECT balance FROM careers',[])?.balance;
 departPlayer(run,read,all,'a',player);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,balance);
 assert.equal(all('SELECT * FROM web_payroll',[]).length,1);db.close();
});

test('renovar no último dia preserva parcela final já lançada sem duplicar cobrança',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 let day=1;for(let i=0;i<12;i++){advanceCareerDay(run,read,all,'a',day,30);day+=30;}
 for(let i=0;i<4;i++){advanceCareerDay(run,read,all,'a',day,1);day++;}
 assert.equal(day,365);
 renewContract(run,read,all,'a',7,220000,180);
 const before=Number(read('SELECT balance FROM careers',[])?.balance);
 advanceCareerDay(run,read,all,'a',365,30);
 assert.equal(read('SELECT balance FROM careers',[])?.balance,before-Math.round(25*220000/30));
 departPlayer(run,read,all,'a',player);
 assert.equal(read('SELECT COUNT(*) n FROM web_current_contracts',[])?.n,0);db.close();
});

test('dispensar reserva importado preserva titular e substitui apenas vaga realmente aberta',()=>{
 const {db,run,read,all}=setup();
 run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',['a',-1,JSON.stringify({...player,id:-1}),1,1]);
 run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',['a',-2,JSON.stringify({...player,id:-2}),1,0]);
 hire(run,read,'a',player,true);
 departPlayer(run,read,all,'a',{...player,id:-2});
 assert.equal(read('SELECT starter FROM web_current_contracts',[])?.starter,0);
 assert.equal(read('SELECT starter FROM web_imported_players WHERE player_id=-1',[])?.starter,1);
 departPlayer(run,read,all,'a',{...player,id:-1});
 assert.equal(read('SELECT starter FROM web_current_contracts',[])?.starter,1);db.close();
});

test('catálogo completo repõe jogador comprado mantendo funções e IDs dos rivais',()=>{
 const world=JSON.parse(readFileSync('public/data/real_teams_2026.json','utf8')) as WorldCatalog;
 const source=JSON.parse(readFileSync('public/data/players-v1.json','utf8')) as Player[];
 const bought=source.find(p=>p.organization&&p.team)!;
 const players=source.map(p=>p.id===bought.id?{...p,team:null,organization:null}:p);
 const result=maintainRosters(players,world,new Set([bought.id]),1);
 const modes=new Map(world.leagues.map(l=>[l.id,l.discipline]));
 assert.equal(result.find(p=>p.id===bought.id)?.team,null);
 assert.equal(new Set(result.map(p=>p.id)).size,result.length);
 for(const team of world.teams)for(const role of roles[modes.get(team.league) as Mode]){
   assert.ok(result.some(p=>p.team===team.id&&p.role===role),team.id+' precisa de '+role);
 }
});
