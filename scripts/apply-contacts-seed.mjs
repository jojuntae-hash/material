import fs from 'node:fs/promises';import {rebuildContactOps} from '../src/contacts.js';
const dir=new URL('../private-data/',import.meta.url);const seed=JSON.parse(await fs.readFile(new URL('seed.json',dir),'utf8')),update=JSON.parse(await fs.readFile(new URL('contacts-v2.json',dir),'utf8'));
if(!seed.records.some(r=>r.id===update.id)){
 await fs.writeFile(new URL('seed-before-contacts-v2.json',dir),JSON.stringify(seed));
 const replacement=new Map(rebuildContactOps(seed.records,update.contacts).map(r=>[r.id,{...r,version:r.version+1}]));seed.records=seed.records.map(r=>replacement.get(r.id)||r);
 seed.records.push({id:update.id,kind:'batch',data:{filename:update.filename,contactRebuild:true,applied:update.contacts.length,pending:[],unresolvedSourceRows:update.pending,at:new Date().toISOString()},version:1});
 await fs.writeFile(new URL('seed.json',dir),JSON.stringify(seed));
}console.log('Contact list rebuilt:',update.contacts.length,'source rows');
