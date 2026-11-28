import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cashProjection,expansionStudy,paymentPeriods,payrollHealth,realizedCash,sponsorReliance} from '../src/game-core/finance-projection.ts';
import {refreshSponsorOffers} from '../src/game-core/finance.ts';

test('caixa realizado concilia o saldo atual e agrupa o extrato em períodos de 30 dias',()=>{
 const entries=[{day:1,income:10,expenses:0},{day:30,income:60,expenses:20},{day:31,income:0,expenses:25,operating:-25},{day:60,income:100,expenses:50,operating:20},
   {day:61,income:1000,expenses:0}];
 assert.deepEqual(realizedCash(60,165,entries),[
   {day:30,from:1,income:70,expenses:20,operating:0,balance:140},
   {day:60,from:31,income:100,expenses:75,operating:-5,balance:165},
 ]);
 assert.deepEqual(realizedCash(4,25,[]),[{day:4,from:1,income:0,expenses:0,operating:0,balance:25}]);
 assert.equal(sponsorReliance([0,750,250]),75);
 assert.equal(sponsorReliance([0]),null);
});

test('a projeção usa vencimentos proporcionais e inclui atraso apenas uma vez',()=>{
 assert.deepEqual(paymentPeriods(1,36,20,90),[{start:1,day:30},{start:31,day:36}]);
 const result=cashProjection(10,200,35,[{day:5,expense:990},{day:11,expense:170},{day:25,income:25},{day:110,income:140},{day:500,expense:300}]);
 assert.equal(result.months.length,12);
 assert.deepEqual(result.months[2],{month:3,day:100,income:25,expenses:205,balance:20,firstShortfall:11});
 assert.equal(result.months[5].balance,160);
 assert.equal(result.months[11].balance,160);
});
test('alertas são consultivos e o estudo reserva três folhas adicionais',()=>{
 assert.equal(payrollHealth(cashProjection(1,100,0,[{day:40,expense:200}]),30).level,'Risco elevado');
 assert.equal(payrollHealth(cashProjection(1,1000,0,[]),30).level,'Sustentável');
 const study=expansionStudy('FPS',0,0);
 assert.equal(study.viable,false);
 assert.equal(study.reserve,study.payroll*3);
 assert.equal(expansionStudy('FPS',study.initial+study.reserve,0).viable,true);
});

test('patrocinadores especialistas respeitam modalidade e região',()=>{
 const offers=(mode:string,region:string,reputation=40)=>{
   const names:string[]=[];
   refreshSponsorOffers((sql,bind)=>{if(sql.startsWith('INSERT'))names.push(String(bind[2]));},()=>undefined,'career',1,reputation,mode,region);
   return names;
 };
 assert.ok(offers('MOBA','América do Sul').includes('Nexo Fibra'));
 assert.ok(offers('MOBA','América do Sul').includes('Riftline Telecom'));
 assert.ok(!offers('MOBA','América do Sul').includes('Lumera Monitores'));
 assert.ok(offers('FPS','Europa').includes('Lumera Monitores'));
 assert.ok(!offers('FPS','Europa',60).includes('Ório Mobilidade'));
});
