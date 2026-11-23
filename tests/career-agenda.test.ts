import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appHarness} from './helpers/component-harness.ts';
import {careerAgenda} from '../src/game-core/career-agenda.ts';
import {seasonBoundaries} from '../src/game-core/renewal.ts';

const career={id:'a',name:'Alpha',code:'A',country:'BR',mode:'MOBA',difficulty:'Normal',balance:25000000,color:'#ef123b',symbol:'animals_wolf',created:'2026',day:360};
const edition=(mode:string,id:string,day:number)=>({mode,name:id,participants:[],fixtures:[{id,home:'career',away:'Rival',day,bestOf:3,result:null}]});
const seasons=[{editions:[edition('MOBA','Liga MOBA',364),edition('FPS','Copa CS2',361)]}];

test('agenda ordena compromissos conhecidos e marca o aniversário no calendário da carreira',()=>{
 const entries=careerAgenda(career,seasons as any,[],[{player_id:7,salary:100,end_day:362} as any],new Map([[7,'Nova']]));
 assert.deepEqual(entries.map(event=>event.day),[361,362,364,367]);
 assert.match(entries[1].label,/Nova/);
 assert.equal(entries[3].mode,null);
 assert.deepEqual(seasonBoundaries(366,367),[367]);
 assert.deepEqual(seasonBoundaries(367,370),[]);
});

test('calendário filtra as duas modalidades sem alterar os compromissos',async()=>{
 const opened:string[]=[];
 const app=appHarness({listPayroll:async()=>[],listMatches:async()=>[],listCompetitions:async()=>({seasons})},[],'CareerCalendar',{
   career,players:[],contracts:[],onOpenFixture:(id:string)=>opened.push(id),
 });
 app.render();await app.flush();
 assert.match(app.text(),/Copa CS2/);assert.match(app.text(),/Liga MOBA/);
 app.control('Modalidade da agenda').props.onChange({target:{value:'FPS'}});app.render();
 assert.match(app.text(),/Copa CS2/);assert.doesNotMatch(app.text(),/Liga MOBA/);
 app.button('Abrir confronto').props.onClick();assert.deepEqual(opened,['Copa CS2']);
});

test('avançar pela data de fundação mostra aviso somente na carreira ativa',async()=>{
 const updated={...career,day:368};
 const app=appHarness({initialize:async()=>{},listCareers:async()=>[career],listWorldPlayers:async()=>[],listContracts:async()=>[],listImportedPlayers:async()=>[],
   advanceDays:async()=>({career:updated,report:{day:368}})});
 app.render();await app.flush();app.button('Continuar').props.onClick();await app.flush();
 assert.doesNotMatch(app.text(),/Feliz aniversário/);
 app.component('CareerDashboard').props.advance();await app.flush();
 assert.match(app.text(),/Feliz aniversário/);
 app.control('Fechar aviso de aniversário').props.onClick();app.render();
 assert.doesNotMatch(app.text(),/Feliz aniversário/);
});
