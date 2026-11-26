import type {Mode} from './attributes.ts';
import type {MatchResult} from './matches.ts';

export const activityNames={individual:'Treino individual',team:'Treino coletivo',scrim:'Scrim',preparation:'Preparação específica',rest:'Recuperação'};
export type Activity=keyof typeof activityNames;
export const intensityNames={light:'Leve',normal:'Moderada',high:'Alta'};
export type Intensity=keyof typeof intensityNames;
export type TrainingSlot={offset:number;kind:Activity;intensity:Intensity;objective:string;opponent?:string;players?:number[]};
export type WeekModel={id:string;name:string;slots:TrainingSlot[]};
export type TrainingEvent=Omit<TrainingSlot,'offset'>&{mode:Mode;day:number;opponentName?:string;result:MatchResult|null;done:boolean};
export const trainingWeekSchema=`
CREATE TABLE IF NOT EXISTS web_training_weeks(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,id TEXT NOT NULL,name TEXT NOT NULL,data TEXT NOT NULL,
 PRIMARY KEY(career_id,id)
);
CREATE TABLE IF NOT EXISTS web_training_events(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,mode TEXT NOT NULL,day INTEGER NOT NULL CHECK(day>0),data TEXT NOT NULL,
 done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),result TEXT,PRIMARY KEY(career_id,mode,day)
);`;

export function validateWeekSlots(values:unknown):TrainingSlot[]{
 if(!Array.isArray(values)||values.length<1||values.length>7)throw Error('Planeje de uma a sete atividades.');
 const used=new Set<number>();
 return values.map(row=>{
   if(!row||!Number.isInteger(row.offset)||row.offset<0||row.offset>6||used.has(row.offset)||
      !Object.hasOwn(activityNames,row.kind)||!Object.hasOwn(intensityNames,row.intensity)||
      typeof row.objective!=='string'||row.objective.length>100)throw Error('Confira os dias e tipos de atividade.');
   used.add(row.offset);
   const slot:TrainingSlot={offset:row.offset,kind:row.kind,intensity:row.kind==='rest'?'light':row.intensity,objective:row.objective.trim()};
   if(slot.kind==='scrim'){
     if(typeof row.opponent!=='string'||!row.opponent||!Array.isArray(row.players)||row.players.length!==5||
       !row.players.every(Number.isSafeInteger)||new Set(row.players).size!==5)throw Error('Selecione um adversário e cinco atletas distintos para a scrim.');
     slot.opponent=row.opponent;slot.players=row.players;
   }
   return slot;
 });
}

export function trainingLoad(events:{day:number;kind:Activity|'official'|'friendly';intensity?:Intensity}[],start:number,fatigue:number){
 const loads=events.filter(event=>event.day>=start&&event.day<start+7).sort((a,b)=>a.day-b.day);
 const heavy=loads.filter(row=>row.kind==='official'||row.kind==='friendly'||row.kind==='scrim'||row.intensity==='high');
 const heavyDays=new Set(heavy.map(row=>row.day));
 const consecutive=[...heavyDays].filter(day=>heavyDays.has(day+1)).length;
 const reasons:string[]=[];
 if(heavy.length>=3)reasons.push(`${heavy.length} compromissos de alta carga nos sete dias.`);
 if(consecutive)reasons.push('Há compromissos de alta carga em dias consecutivos.');
 if(fatigue>=45&&heavy.length)reasons.push('A fadiga média dos atletas disponíveis já está elevada.');
 return {heavy:heavy.length,recovery:loads.filter(row=>row.kind==='rest').length,reasons};
}
