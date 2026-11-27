import {countries} from './countries.ts';
import {symbols} from './symbols.ts';
import type {Identity} from './identity.ts';
import type {CareerEntry} from './entry.ts';
export const budgets:Record<string,number>={'Fácil':50000000,'Normal':25000000,'Difícil':12500000,'Realista':7500000};
export type Career={id:string;name:string;code:string;country:string;mode:string;difficulty:string;balance:number;color:string;symbol:string;created:string;day:number;identity?:Identity;uniforms?:import('./uniform.ts').Uniforms;hasGodotSource?:boolean;saveName?:string;entry?:CareerEntry;reputation?:number;createdVersion?:string|null};
export function validateSaveName(value:unknown){
 if(typeof value!=='string'||value.trim().length>60)throw Error('O nome do save deve ter até 60 caracteres.');
 return value.trim();
}
export const saveVersionSchema=`CREATE TABLE IF NOT EXISTS web_save_versions(
 career_id TEXT PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,
 created_version TEXT NOT NULL CHECK(length(created_version) BETWEEN 1 AND 32)
);`;
export function careerInput(input:Record<string,unknown>){
 const name=String(input.name??'').trim(),code=String(input.code??'').trim().toUpperCase();
 if(!name||name.length>60||!/^[A-Z]{1,3}$/.test(code)||!['MOBA','FPS'].includes(String(input.mode))||!Object.hasOwn(budgets,String(input.difficulty))||!Object.hasOwn(countries,String(input.country))||!/^#[0-9a-f]{6}$/i.test(String(input.color))||!Object.hasOwn(symbols,String(input.symbol)))throw new Error('Confira nome, sigla, país, modalidade e identidade.');
 return {name,code,country:String(input.country),mode:String(input.mode),difficulty:String(input.difficulty),color:String(input.color),symbol:String(input.symbol),balance:budgets[String(input.difficulty)]};
}
export const schema=`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS careers(id TEXT PRIMARY KEY,name TEXT NOT NULL,code TEXT NOT NULL,country TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('MOBA','FPS')),difficulty TEXT NOT NULL,balance INTEGER NOT NULL CHECK(balance>=0),color TEXT NOT NULL,symbol TEXT NOT NULL,created TEXT NOT NULL,day INTEGER NOT NULL DEFAULT 1 CHECK(day>0));
PRAGMA user_version=1;`;

export function deleteCareer(run: (sql:string, values:string[])=>void,id:string) {
 run('BEGIN IMMEDIATE',[]);
 try {
  run('DELETE FROM web_payroll WHERE career_id=?',[id]);
  run('DELETE FROM web_finances WHERE career_id=?',[id]);
  run('DELETE FROM web_contracts WHERE career_id=?',[id]);
  run('DELETE FROM careers WHERE id=?',[id]);
  run('COMMIT',[]);
 } catch(error) {
  run('ROLLBACK',[]);
  throw error;
 }
}


