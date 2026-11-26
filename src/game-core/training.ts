import {attributeWeight} from './attributes.ts';

export const trainingNames={balanced:'Equilibrado',mechanics:'Mecânica',strategy:'Estratégia',communication:'Comunicação',
 role:'Aprimoramento da função',consistency:'Consistência',decisions:'Tomada de decisão',maintenance:'Manutenção'} as const;
export const additionalFocuses=['role','consistency','decisions','maintenance'];
export type TrainingFocus=keyof typeof trainingNames;
export type TrainingPlan={focus:TrainingFocus;fromDay:number;toDay:number;efficiency?:number};
export type PlayerTraining={player_id:number;academy:number;focus:TrainingFocus;changed_day:number};

export const trainingSchema=`
CREATE TABLE IF NOT EXISTS web_player_training (
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 player_id INTEGER NOT NULL, academy INTEGER NOT NULL DEFAULT 0 CHECK(academy IN (0,1)),
 focus TEXT NOT NULL DEFAULT 'balanced' CHECK(focus IN ('balanced','mechanics','strategy','communication')),
 changed_day INTEGER NOT NULL CHECK(changed_day>0), PRIMARY KEY(career_id,player_id)
);
CREATE TABLE IF NOT EXISTS web_training_focus_overrides(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,player_id INTEGER NOT NULL,
 focus TEXT NOT NULL CHECK(focus IN ('role','consistency','decisions','maintenance')),PRIMARY KEY(career_id,player_id)
);
`;

const groups:Partial<Record<TrainingFocus,string[]>>={
 mechanics:['mechanics','reflexes','precision','execution','control','laning','aim','recoil','movement','reaction'],
 strategy:['vision','positioning','objectives','map','decisions','reading','meta','utility','angles','awareness','space'],
 communication:['communication','coordination','teamwork','leadership','composure'],
 consistency:['consistency','execution','adaptation','composure'],
 decisions:['decisions','reading','awareness','vision','map'],
};

// Redistribute the existing growth budget; focused training adds no second gain.
export function trainingMultipliers(keys:string[],focus:TrainingFocus,role=''):Record<string,number>{
 const weights=keys.map(key=>{
   const attribute=key.slice(key.indexOf('_')+1);
   const priority=focus==='role'?attributeWeight(role,attribute)>1:groups[focus]?.includes(attribute);
   return priority?1.6:1;
 });
 const mean=weights.reduce((sum,value)=>sum+value,0)/Math.max(1,keys.length);
 return Object.fromEntries(keys.map((key,index)=>[key,weights[index]/mean]));
}
