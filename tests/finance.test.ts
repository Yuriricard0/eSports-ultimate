import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {schema} from '../src/game-core/career.ts';
import {contractSchema,hire,type Player} from '../src/game-core/recruitment.ts';
import {migrateCalendar,advanceCareerDay} from '../src/game-core/calendar.ts';
import {phaseOneSchema} from '../src/game-core/identity.ts';
import {negotiationSchema} from '../src/game-core/negotiation.ts';
import {competitionSchema} from '../src/game-core/competition-store.ts';
import {initializeFinance,refreshSponsorOffers,acceptSponsor,rejectSponsor,paySponsors,upgradeFacility,facilityEfficiency} from '../src/game-core/finance.ts';
import {developPlayer} from '../src/game-core/development.ts';
import {definitions} from '../src/game-core/attributes.ts';
import {departPlayer} from '../src/game-core/market.ts';
import {commercialRecognition} from '../src/game-core/finance.ts';

const player:Player={id:7,nickname:'Young',name:'Young Silva',mode:'MOBA',role:'top',overall:50,organization:null,team:null,country:'BR',birthDay:-6900,portraitIndex:0,estimateLow:70,estimateHigh:80,ceiling:80,attributes:Object.fromEntries(definitions.MOBA.map(key=>['moba_'+key,50]))};
function setup(){
 const db=new DatabaseSync(':memory:');db.exec(schema+contractSchema);migrateCalendar(sql=>db.exec(sql),1);db.exec(phaseOneSchema+negotiationSchema+competitionSchema);
 db.exec("INSERT INTO careers VALUES('a','Aurora','AUR','BR','MOBA','Normal',25000000,'#aabbcc','animals_wolf','2026',1)");
 const run=(sql:string,bind:(string|number)[]=[])=>{db.prepare(sql).run(...bind);};
 const read=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).get(...bind);
 const all=(sql:string,bind:(string|number)[]=[])=>db.prepare(sql).all(...bind);
 return {db,run,read,all};
}
test('patrocínio em kits e híbrido entrega estoque uma única vez e só paga a parcela em dinheiro prevista',()=>{
 const {db,run,read,all}=setup();
 initializeFinance(run,read,all,'a');
 refreshSponsorOffers(run,read,'a',1,40,'FPS','América do Sul',20);
 const only=String(read("SELECT id FROM web_sponsors WHERE company='ArcForge Periféricos'")!.id);
 const mixed=read("SELECT id,payment FROM web_sponsors WHERE company='Lumera Monitores'")!;
 acceptSponsor(run,read,'a',only,40);
 acceptSponsor(run,read,'a',String(mixed.id),40);
 assert.throws(()=>acceptSponsor(run,read,'a',only,40),/disponível/);
 assert.equal(read("SELECT quantity FROM web_equipment_stock WHERE sku='fps-5'")!.quantity,7);
 paySponsors(run,read,all,'a',1,30);paySponsors(run,read,all,'a',1,30);
 assert.equal(read("SELECT SUM(amount) total FROM web_cash_events WHERE category='sponsor'")!.total,mixed.payment);
 assert.equal(commercialRecognition(1,0,0),10);
 assert.ok(commercialRecognition(181,40,2)>10);
 db.close();
});
test('extrato recupera valores existentes uma vez sem mexer no saldo',()=>{
 const {db,run,read,all}=setup();hire(run,read,'a',player);
 const balance=read('SELECT balance FROM careers')!.balance;
 initializeFinance(run,read,all,'a');initializeFinance(run,read,all,'a');
 assert.equal(read('SELECT balance FROM careers')!.balance,balance);
 assert.equal(read('SELECT COUNT(*) n FROM web_cash_events')!.n,1);
 const sum=Number(read('SELECT SUM(amount) total FROM web_cash_events')!.total),opening=Number(read('SELECT opening_balance FROM web_finance_state')!.opening_balance);
 assert.equal(opening+sum,balance);db.close();
});
test('dois patrocinadores, recusa e parcelas são persistentes e não duplicam dinheiro',()=>{
 const {db,run,read,all}=setup();initializeFinance(run,read,all,'a');refreshSponsorOffers(run,read,'a',1,40);
 const offers=all('SELECT * FROM web_sponsors ORDER BY id');assert.ok(offers.length>=2);
 acceptSponsor(run,read,'a',String(offers[0].id),40);rejectSponsor(run,read,'a',String(offers[1].id));
 assert.throws(()=>acceptSponsor(run,read,'a',String(offers[1].id),40),/disponível/);
 const before=Number(read('SELECT balance FROM careers')!.balance);
 db.exec('BEGIN');paySponsors(run,read,all,'a',1,30);paySponsors(run,read,all,'a',1,30);db.exec('COMMIT');
 assert.equal(read('SELECT balance FROM careers')!.balance,before+Number(offers[0].payment));
 assert.equal(read("SELECT COUNT(*) n FROM web_cash_events WHERE category='sponsor'")!.n,1);
 refreshSponsorOffers(run,read,'a',31,80);
 const newOffers=all("SELECT * FROM web_sponsors WHERE state='pending' AND expires_day>=31");
 acceptSponsor(run,read,'a',String(newOffers[0].id),80);
 assert.throws(()=>acceptSponsor(run,read,'a',String(newOffers[1].id),80),/dois|2/);db.close();
});
test('parcelas proporcionais de patrocínio encerram sem cobrança extra e baixa reputação bloqueia',()=>{
 const {db,run,read,all}=setup();initializeFinance(run,read,all,'a');refreshSponsorOffers(run,read,'a',1,80);
 const offer=read("SELECT * FROM web_sponsors WHERE min_reputation>=70")!;
 assert.throws(()=>acceptSponsor(run,read,'a',String(offer.id),40),/reputação/i);
 acceptSponsor(run,read,'a',String(offer.id),80);
 const before=Number(read('SELECT balance FROM careers')!.balance);
 db.exec('BEGIN');paySponsors(run,read,all,'a',1,400);paySponsors(run,read,all,'a',365,500);db.exec('COMMIT');
 assert.equal(read('SELECT balance FROM careers')!.balance,before+Number(offer.payment)*12+Math.round(Number(offer.payment)*5/30));db.close();
});
test('melhorias debitam custo, limitam nível e bônus não altera ganho ao clicar',()=>{
 const {db,run,read,all}=setup();initializeFinance(run,read,all,'a');
 const before=Number(read('SELECT balance FROM careers')!.balance);
 upgradeFacility(run,read,'a','training',0);
 assert.equal(read('SELECT balance FROM careers')!.balance,before-2500000);
 assert.throws(()=>upgradeFacility(run,read,'a','training',0),/atualiz|nível/);
 upgradeFacility(run,read,'a','training',1);upgradeFacility(run,read,'a','training',2);
 assert.throws(()=>upgradeFacility(run,read,'a','training',3),/máximo|nível/);
 const efficiency=facilityEfficiency({training:3,academy:3,scouting:3},true);assert.equal(efficiency,1.12);
 assert.equal(facilityEfficiency({training:0,academy:0,scouting:3},true),1);
 const trained=developPlayer(player,1,31,[{focus:'balanced',fromDay:1,toDay:365,efficiency}]);
 const base=developPlayer(player,1,31);assert.ok(trained.overall>base.overall&&trained.overall-base.overall<.1);
 assert.equal(developPlayer(player,1,30,[{focus:'balanced',fromDay:1,toDay:365,efficiency}]),player);
 db.exec('UPDATE careers SET balance=1');assert.throws(()=>upgradeFacility(run,read,'a','academy',0),/Saldo/);db.close();
});
test('salários registram apenas valores pagos e receita do mesmo avanço pode quitar folha',()=>{
 const {db,run,read,all}=setup();initializeFinance(run,read,all,'a');hire(run,read,'a',player);
 refreshSponsorOffers(run,read,'a',1,40);const offer=read('SELECT * FROM web_sponsors LIMIT 1')!;acceptSponsor(run,read,'a',String(offer.id),40);
 db.exec('UPDATE careers SET balance=0');
 advanceCareerDay(run,read,all,'a',1,30,undefined,(from,to)=>paySponsors(run,read,all,'a',from,to));
 const paid=Number(read('SELECT SUM(paid) total FROM web_payroll')!.total);
 assert.equal(read("SELECT -SUM(amount) total FROM web_cash_events WHERE category='salary'")!.total,paid);
 assert.equal(paid,370000);assert.equal(read('SELECT balance FROM careers')!.balance,Number(offer.payment)-paid);db.close();
});

test('duas vendas de importado no mesmo dia mantêm extrato reconciliado',()=>{
 const {db,run,read,all}=setup();const imported={...player,id:-1};initializeFinance(run,read,all,'a');
 run('INSERT INTO web_imported_players VALUES(?,?,?,?,?)',['a',-1,JSON.stringify(imported),1,1]);
 departPlayer(run,read,all,'a',imported,{organization:'rival1',team:'one',fee:1000000});
 hire(run,read,'a',imported);
 departPlayer(run,read,all,'a',imported,{organization:'rival2',team:'two',fee:1000000});
 const cash=Number(read('SELECT SUM(amount) total FROM web_cash_events')!.total);
 assert.equal(read('SELECT balance FROM careers')!.balance,25000000+cash);
 assert.equal(read("SELECT SUM(amount) total FROM web_cash_events WHERE category='sale'")!.total,2000000);db.close();
});
