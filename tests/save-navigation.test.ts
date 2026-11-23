import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';

test('cancelar a exclusão preserva a carreira e Continuar volta à Central',async()=>{
 const career={id:'a',name:'Alpha',code:'A',country:'BR',mode:'MOBA',difficulty:'Normal',balance:25000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:1};
 let deletions=0;
 const app=appHarness({initialize:async()=>{},listCareers:async()=>[career],listContracts:async()=>[],listWorldPlayers:async()=>[],removeCareer:async()=>{deletions++;return [];}});
 app.render();await app.flush();
 app.button('Carreiras salvas').props.onClick();app.render();
 app.button('Excluir').props.onClick();app.render();
 assert.ok(app.button('Confirmar exclusão'));
 app.button('Cancelar').props.onClick();app.render();
 assert.equal(deletions,0);
 app.button('ULTIMATE').props.onClick();app.render();
 app.button('Continuar').props.onClick();await app.flush();
 assert.equal(app.component('CareerDashboard').props.career.id,career.id);
 assert.match(app.text(),/Versão anterior/);
 app.button('Jogadores').props.onClick();app.render();
 assert.ok(app.component('Players'));
 app.button('Central da Carreira').props.onClick();app.render();
 assert.equal(app.component('CareerDashboard').props.career.id,career.id);
});

test('Continuar recupera a última carreira após reabrir e usa a mais recente se ela foi excluída',async()=>{
 const newer={id:'new',name:'Nova',code:'NOV',country:'BR',mode:'FPS',difficulty:'Normal',balance:25000000,color:'#ef123b',symbol:'animals_wolf',created:'2026-11-23',day:1,createdVersion:'1.1.0'};
 const older={...newer,id:'old',name:'Antiga',created:'2026-10-01',createdVersion:undefined};
 let saves=[newer,older];
 const storage=new Map<string,string>();
 const repository={initialize:async()=>{},listCareers:async()=>saves,listContracts:async()=>[],listWorldPlayers:async()=>[],
   removeCareer:async(id:string)=>saves=saves.filter(save=>save.id!==id)};
 const boot=async()=>{
   const app=appHarness(repository,[],'App',{},storage);app.render();await app.flush();return app;
 };
 let app=await boot();
 app.button('Carreiras salvas').props.onClick();app.render();
 app.control('Abrir carreira Antiga').props.onClick();await app.flush();
 app=await boot();app.button('Continuar').props.onClick();await app.flush();
 assert.equal(app.component('CareerDashboard').props.career.id,'old');
 app.button('Carreiras salvas').props.onClick();app.render();
 app.control('Excluir carreira Antiga').props.onClick();app.render();
 await app.button('Confirmar exclusão').props.onClick();await app.flush();
 app=await boot();app.button('Continuar').props.onClick();await app.flush();
 assert.equal(app.component('CareerDashboard').props.career.id,'new');
 assert.match(app.text(),/v1\.1\.0/);
});
