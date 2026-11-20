import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';

test('troca de carreira durante avanço mantém os jogadores da carreira selecionada',async()=>{
 const make=(id:string,name:string)=>({id,name,code:id.toUpperCase(),country:'BR',mode:'MOBA',difficulty:'Normal',balance:25000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:1});
 const a=make('a','Alpha'),b=make('b','Beta');
 let complete:(value:any)=>void=()=>{};const advancing=new Promise(resolve=>{complete=resolve;});
 const repository={initialize:async()=>{},listCareers:async()=>[a,b],listContracts:async()=>[],listImportedPlayers:async()=>[],
   listWorldPlayers:async(id:string)=>[{id:id==='a'?1:2,nickname:id==='a'?'AlphaPlayer':'BetaPlayer'}],advanceDays:async()=>advancing};
 const app=appHarness(repository);app.render();await app.flush();
 app.button('Continuar').props.onClick();await app.flush();assert.equal(app.component('CareerDashboard').props.career.id,'a');
 app.component('CareerDashboard').props.advance();app.render();
 app.button('Carreiras salvas').props.onClick();app.render();app.button('Beta').props.onClick();await app.flush();
 assert.equal(app.component('CareerDashboard').props.players[0].nickname,'BetaPlayer');
 complete({career:{...a,day:31},report:{day:31,balance:25000000,paid:0,outstanding:0,expired:0}});await app.flush();
 const dashboard=app.component('CareerDashboard');assert.equal(dashboard.props.career.id,'b');assert.equal(dashboard.props.players[0]?.nickname,'BetaPlayer');
 app.button('Elenco').props.onClick();app.render();assert.ok(app.component('Players'));assert.ok(!app.text().includes('Carregando jogadores'));
});
