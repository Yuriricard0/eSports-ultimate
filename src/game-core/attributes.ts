export type Mode='MOBA'|'FPS';
export const definitions:Record<Mode,string[]>={
MOBA:['mechanics','reflexes','precision','execution','control','vision','positioning','objectives','map','decisions','reading','meta','laning','teamfights','consistency','adaptation','communication','coordination','teamwork','leadership'],
FPS:['aim','reflexes','recoil','movement','reaction','positioning','map','utility','angles','execution','reading','decisions','adaptation','awareness','space','communication','coordination','leadership','consistency','composure']};
export const roles:Record<Mode,string[]>={MOBA:['top','jungle','mid','adc','support_moba'],FPS:['entry','support_fps','awper','igl','lurker']};
const specialties:Record<string,string[]>={top:['laning','mechanics','positioning','decisions','teamfights'],jungle:['objectives','map','vision','decisions','reading'],mid:['mechanics','execution','laning','precision','teamfights'],adc:['precision','mechanics','positioning','control','consistency'],support_moba:['vision','communication','coordination','teamwork','objectives'],entry:['aim','reflexes','reaction','movement','space'],support_fps:['utility','coordination','communication','execution','composure'],awper:['aim','reaction','angles','positioning','consistency'],igl:['leadership','decisions','reading','communication','execution'],lurker:['reading','awareness','map','positioning','decisions']};
export function overall(attributes:Record<string,number>,mode:Mode,role:string):number {
 if(!roles[mode]?.includes(role))return -1;
 let total=0,weights=0;
 for(const key of definitions[mode]) {const value=attributes[mode.toLowerCase()+'_'+key];if(!Number.isFinite(value)||value<1||value>100)return -1;const w=specialties[role].includes(key)?4:1;total+=value*w;weights+=w;}
 return total/weights;
}
