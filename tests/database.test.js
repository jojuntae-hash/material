import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('PostgreSQL 설치·다중현장 격리·수정 이력·조회 권한·충돌·복원',async()=>{
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email','test@example.test') $$;
 grant usage on schema auth,public to authenticated;
 grant execute on function auth.uid(),auth.jwt() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
 create table storage.objects(id uuid primary key,name text,bucket_id text);alter table storage.objects enable row level security;
 `);
 await db.exec(await fs.readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8'));
 const admin='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
 await db.query('insert into auth.users values ($1),($2),($3)',[admin,viewer,other]);
 async function as(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
 await as(admin);const project=(await db.query("select mm_create_project('테스트 현장') id")).rows[0].id;
 await db.query('select mm_set_member($1,$2,$3)',[project,viewer,'viewer']);
 const id=crypto.randomUUID(),data={name:'백강관',trade:'소방',date:'2026-10-16',quantity:100,unit:'본',manufacturerId:'',dealerId:'',original:{quantity:100},source:{row:2}};
 async function apply(p,ops,operation=crypto.randomUUID()){return db.query('select mm_apply($1,$2::jsonb,$3,$4,$5)',[p,JSON.stringify(ops),'테스트','수정',operation]);}
 const op=crypto.randomUUID();await apply(project,[{id,kind:'request',data,version:0}],op);await apply(project,[{id,kind:'request',data,version:0}],op);
 assert.equal((await db.query('select * from mm_records')).rows.length,1);assert.equal((await db.query('select * from mm_audit where record_id=$1',[id])).rows.length,1);
 await apply(project,[{id,kind:'request',data:{...data,quantity:123},version:1}]);
 await assert.rejects(()=>apply(project,[{id,kind:'request',data,version:1}]),/다른 사용자가 수정/);
 await assert.rejects(()=>apply(project,[{id,kind:'request',data:{...data,original:{quantity:999}},version:2}]),/원본 값/);
 await as(viewer);assert.equal((await db.query('select * from mm_records')).rows.length,1);
 await assert.rejects(()=>apply(project,[{id,kind:'request',data,version:2}]),/편집 권한/);
 await assert.rejects(()=>db.query('update mm_records set deleted=true'),/permission denied/);
 await as(other);assert.equal((await db.query('select * from mm_records')).rows.length,0);assert.equal((await db.query('select * from mm_projects')).rows.length,0);
 await assert.rejects(()=>apply(project,[{id,kind:'request',data,version:2}]),/편집 권한/);
 await as(admin);await assert.rejects(()=>apply(project,[{id:crypto.randomUUID(),kind:'request',data:{...data,manufacturerId:crypto.randomUUID()},version:0}]),/업체 연결/);
 assert.equal((await db.query('select * from mm_records')).rows.length,1);
 await db.query('select mm_restore($1,$2::jsonb,$3,$4)',[project,JSON.stringify([{id,kind:'request',data,version:1}]),'복원 테스트',crypto.randomUUID()]);assert.equal((await db.query('select data from mm_records where not deleted')).rows[0].data.quantity,100);
 await db.close();
});
