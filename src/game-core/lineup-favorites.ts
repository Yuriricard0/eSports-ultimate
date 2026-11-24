import {roles,overall,type Mode} from './attributes.ts';
import {updateStarter,type Contract,type Player} from './recruitment.ts';

export type FavoriteLineup={id:string;name:string;playerIds:number[]};
export const favoriteLineupSchema=`CREATE TABLE IF NOT EXISTS web_lineup_favorites(
 career_id TEXT NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
 id TEXT NOT NULL,name TEXT NOT NULL,players TEXT NOT NULL,
 PRIMARY KEY(career_id,id)
);`;

export function favoriteIds(ids:unknown):number[]{
 if(!Array.isArray(ids)||ids.length!==5||!ids.every(Number.isSafeInteger)||new Set(ids).size!==ids.length)
   throw Error('Escolha cinco atletas distintos, um por função.');
 return ids;
}

export function validateFavoritePlayers(ids:number[],mode:Mode,players:Player[],contracts:Contract[]){
 const positions=roles[mode];
 favoriteIds(ids);
 if(!positions)throw Error('Modalidade inválida.');
 const allowed=new Set(contracts.filter(contract=>!contract.academy).map(contract=>contract.player_id));
 const selected=ids.map(id=>players.find(player=>player.id===id&&allowed.has(id)&&player.mode===mode&&!player.status));
 if(selected.some(player=>!player||overall(player.attributes,mode,player.role)<1)||!positions.every(role=>selected.some(player=>player?.role===role)))
   throw Error('A escalação precisa de um atleta elegível do elenco principal em cada função. Revise contratos e Academy.');
}

export function applyFavorite(run:Parameters<typeof updateStarter>[0],read:Parameters<typeof updateStarter>[1],careerId:string,ids:number[],contracts:()=>Contract[]){
 run('BEGIN IMMEDIATE',[]);
 try{
   const current=new Set(contracts().filter(contract=>contract.starter&&!contract.academy).map(contract=>contract.player_id));
   for(const id of ids)if(!current.has(id))updateStarter(run,read,careerId,id);
   const starters=contracts().filter(contract=>contract.starter&&!contract.academy);
   if(starters.length!==ids.length||!starters.every(contract=>ids.includes(contract.player_id)))throw Error('As funções dos vínculos atuais não correspondem à escalação.');
   run('COMMIT',[]);
 }catch(error){run('ROLLBACK',[]);throw error;}
}

export function favoriteName(name:unknown){
 if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('Informe um nome de 1 a 40 caracteres.');
 return name.trim();
}
