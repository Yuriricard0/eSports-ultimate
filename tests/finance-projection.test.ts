import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cashProjection,expansionStudy,paymentPeriods,payrollHealth} from '../src/game-core/finance-projection.ts';
import {refreshSponsorOffers} from '../src/game-core/finance.ts';

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
