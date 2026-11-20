import {contractSupportSchema} from './recruitment.ts';

// SQLite cannot relax a CHECK in place. Preserve the eight contract columns and
// dependent finance rows atomically; only allow the valid zero signing bonus.
export function migrateZeroSigningBonus(exec:(sql:string)=>void){
 exec('BEGIN IMMEDIATE');
 try{
   exec(`DROP VIEW IF EXISTS web_current_contracts;
     ALTER TABLE web_finances RENAME TO previous_finances;
     ALTER TABLE web_contracts RENAME TO previous_contracts;
     CREATE TABLE web_contracts (
       career_id TEXT NOT NULL REFERENCES careers(id),player_id INTEGER NOT NULL,role TEXT NOT NULL,
       starter INTEGER NOT NULL CHECK(starter IN (0,1)),salary INTEGER NOT NULL CHECK(salary>0),
       bonus INTEGER NOT NULL CHECK(bonus>=0),start_day INTEGER NOT NULL,end_day INTEGER NOT NULL CHECK(end_day>=start_day),
       PRIMARY KEY(career_id,player_id,start_day)
     );
     CREATE TABLE web_finances (
       career_id TEXT NOT NULL,player_id INTEGER NOT NULL,day INTEGER NOT NULL,amount INTEGER NOT NULL,
       PRIMARY KEY(career_id,player_id,day),
       FOREIGN KEY(career_id,player_id,day) REFERENCES web_contracts(career_id,player_id,start_day)
     );
     INSERT INTO web_contracts SELECT * FROM previous_contracts;
     INSERT INTO web_finances SELECT * FROM previous_finances;
     DROP TABLE previous_finances;DROP TABLE previous_contracts;
     CREATE UNIQUE INDEX web_starter_role ON web_contracts(career_id,role) WHERE starter=1;
   `);
   exec(contractSupportSchema);exec('COMMIT');
 }catch(error){exec('ROLLBACK');throw error;}
}
