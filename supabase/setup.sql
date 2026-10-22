-- 자재청구 관리 전용 설치 · v1
-- 기존 사이트 테이블/Auth 설정을 변경하지 않습니다.
-- Supabase SQL Editor에서 한 번 실행하세요. 이미 설치된 경우 중단합니다.
begin;
do $$ begin
 if to_regclass('public.mm_projects') is not null or to_regclass('public.mm_records') is not null
    or exists(select 1 from storage.buckets where id='mm-files') then
   raise exception 'mm_ 테이블 또는 mm-files 저장소가 이미 있습니다. 기존 설치 여부를 확인하세요. 기존 데이터를 변경하지 않았습니다.';
 end if;
end $$;

create table public.mm_projects(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), created_at timestamptz not null default now());
create table public.mm_members(project_id uuid not null references public.mm_projects(id), user_id uuid not null references auth.users(id), role text not null check(role in ('admin','editor','viewer')), primary key(project_id,user_id));
create table public.mm_records(id uuid not null, project_id uuid not null references public.mm_projects(id), kind text not null check(kind in ('request','vendor','approval','alias','file','batch')), data jsonb not null, version integer not null default 1, deleted boolean not null default false, updated_at timestamptz not null default now(), primary key(project_id,id));
create index mm_records_kind on public.mm_records(project_id,kind);
create table public.mm_audit(id uuid primary key default gen_random_uuid(), project_id uuid not null references public.mm_projects(id), record_id uuid, kind text not null, before jsonb, after jsonb, reason text not null, action text not null, actor_id uuid not null, actor text, created_at timestamptz not null default now());
create index mm_audit_project_time on public.mm_audit(project_id,created_at desc);
create table public.mm_operations(project_id uuid not null references public.mm_projects(id), id uuid not null, created_at timestamptz not null default now(), primary key(project_id,id));

alter table public.mm_projects enable row level security;
alter table public.mm_members enable row level security;
alter table public.mm_records enable row level security;
alter table public.mm_audit enable row level security;
alter table public.mm_operations enable row level security;

create function public.mm_role(p_project uuid) returns text language sql stable security definer set search_path=pg_catalog,public as $$
 select role from public.mm_members where project_id=p_project and user_id=auth.uid();
$$;
create policy mm_project_read on public.mm_projects for select to authenticated using(public.mm_role(id) is not null);
create policy mm_members_read on public.mm_members for select to authenticated using(user_id=auth.uid() or public.mm_role(project_id)='admin');
create policy mm_records_read on public.mm_records for select to authenticated using(public.mm_role(project_id) is not null);
create policy mm_audit_read on public.mm_audit for select to authenticated using(public.mm_role(project_id) is not null);
revoke all on public.mm_projects,public.mm_members,public.mm_records,public.mm_audit,public.mm_operations from anon,authenticated;
grant select on public.mm_projects,public.mm_members,public.mm_records,public.mm_audit to authenticated;

create function public.mm_validate(p_kind text,p_data jsonb) returns void language plpgsql set search_path=pg_catalog,public as $$
declare v_date date;
begin
 if jsonb_typeof(p_data)<>'object' then raise exception '데이터 형식을 확인하세요.';end if;
 if p_kind not in ('request','vendor','approval','alias','file','batch') then raise exception '지원하지 않는 데이터 종류';end if;
 if p_kind in ('request','vendor','approval') and coalesce(trim(p_data->>'name'),'')='' then raise exception '이름/품명이 필요합니다.';end if;
 if p_kind in ('request','approval') and coalesce(p_data->>'trade','') not in ('기계','소방') then raise exception '공종을 확인하세요.';end if;
 if p_kind='request' then
  if coalesce(p_data->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception '날짜를 확인하세요.';end if;
  v_date:=(p_data->>'date')::date;
  if not coalesce((p_data->'quantity'='null'::jsonb and p_data->'quantityUnconfirmed'='true'::jsonb and p_data->'original'->'quantity'='null'::jsonb and coalesce(p_data->'source'->>'file','')<>''),false) then
   if coalesce(jsonb_typeof(p_data->'quantity'),'')<>'number' then raise exception '수량은 숫자여야 합니다.';end if;
  end if;
  if (p_data->>'quantity')::numeric<0 and not coalesce((p_data->'quantityOriginalAdjustment'='true'::jsonb and p_data->'quantity'=p_data->'original'->'quantity' and coalesce(p_data->'source'->>'file','')<>''),false) then raise exception '새 음수 수량을 허용하지 않습니다.';end if;
 end if;
 if p_kind='vendor' and coalesce(p_data->>'email','')<>'' and p_data->>'email' !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception '이메일 형식을 확인하세요.';end if;
 if p_kind='approval' and coalesce(jsonb_typeof(p_data->'options'),'')<>'array' then raise exception '승인 후보 목록을 확인하세요.';end if;
 if p_kind='alias' and (coalesce(trim(p_data->>'alias'),'')='' or coalesce(p_data->>'vendorId','')='') then raise exception '별칭과 연결 업체가 필요합니다.';end if;
end $$;

create function public.mm_check_links(p_project uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.mm_records r cross join lateral (values (r.data->>'manufacturerId'),(r.data->>'dealerId')) l(id)
  where r.project_id=p_project and r.kind='request' and not r.deleted and coalesce(l.id,'')<>'' and not exists(select 1 from public.mm_records v where v.project_id=p_project and v.id::text=l.id and v.kind='vendor' and not v.deleted)) then raise exception '청구내역의 업체 연결을 확인하세요.';end if;
 if exists(select 1 from public.mm_records r where r.project_id=p_project and r.kind='request' and not r.deleted and coalesce(r.data->>'approvalId','')<>'' and not exists(select 1 from public.mm_records a where a.project_id=p_project and a.id::text=r.data->>'approvalId' and a.kind='approval' and not a.deleted and a.data->>'trade'=r.data->>'trade')) then raise exception '청구내역의 승인 품목·공종 연결을 확인하세요.';end if;
 if exists(select 1 from public.mm_records a cross join lateral jsonb_array_elements(a.data->'options') o where a.project_id=p_project and a.kind='approval' and not a.deleted and coalesce(o->>'vendorId','')<>'' and not exists(select 1 from public.mm_records v where v.project_id=p_project and v.id::text=o->>'vendorId' and v.kind='vendor' and not v.deleted)) then raise exception '승인 제조사 연결을 확인하세요.';end if;
 if exists(select 1 from public.mm_records a where a.project_id=p_project and a.kind='alias' and not a.deleted and not exists(select 1 from public.mm_records v where v.project_id=p_project and v.id::text=a.data->>'vendorId' and v.kind='vendor' and not v.deleted)) then raise exception '별칭 업체 연결을 확인하세요.';end if;
 if exists(select 1 from public.mm_records a where a.project_id=p_project and a.kind='alias' and not a.deleted group by a.data->>'alias',a.data->>'role' having count(*)>1) then raise exception '같은 역할의 별칭이 중복됩니다.';end if;
 if exists(select 1 from public.mm_records a where a.project_id=p_project and a.kind='file' and not a.deleted and split_part(a.data->>'path','/',1)<>p_project::text) then raise exception '다른 현장의 파일 경로는 연결할 수 없습니다.';end if;
end $$;

create function public.mm_snapshot(p_project uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if public.mm_role(p_project) is null then raise exception '현장 조회 권한이 필요합니다.';end if;
 return jsonb_build_object('records',coalesce((select jsonb_agg(to_jsonb(r)) from public.mm_records r where r.project_id=p_project),'[]'::jsonb),'history',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.mm_audit a where a.project_id=p_project),'[]'::jsonb));
end $$;

create function public.mm_create_project(p_name text) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception '로그인이 필요합니다.';end if;
 insert into public.mm_projects(name) values(trim(p_name)) returning id into v_id;
 insert into public.mm_members values(v_id,auth.uid(),'admin');return v_id;
end $$;

create function public.mm_set_member(p_project uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if public.mm_role(p_project) is distinct from 'admin' then raise exception '관리자 권한이 필요합니다.';end if;
 if p_user=auth.uid() and p_role<>'admin' then raise exception '자신의 관리자 권한은 해제할 수 없습니다.';end if;
 insert into public.mm_members(project_id,user_id,role) values(p_project,p_user,p_role) on conflict(project_id,user_id) do update set role=excluded.role;
 insert into public.mm_audit(project_id,record_id,kind,reason,action,actor_id,actor,after) values(p_project,p_user,'member','현장 사용자 권한 등록','권한 변경',auth.uid(),auth.jwt()->>'email',jsonb_build_object('user',p_user,'role',p_role));
end $$;

create function public.mm_apply(p_project uuid,p_ops jsonb,p_reason text,p_action text,p_operation uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare op jsonb;old public.mm_records;next public.mm_records;v_role text;v_id uuid;v_kind text;v_data jsonb;
begin
 v_role:=public.mm_role(p_project);
 if v_role is null or v_role='viewer' then raise exception '편집 권한이 필요합니다.';end if;
 if coalesce(trim(p_reason),'')='' then raise exception '변경 사유가 필요합니다.';end if;
 if jsonb_typeof(p_ops)<>'array' or jsonb_array_length(p_ops)>5000 then raise exception '한 번에 5,000건 이하만 저장할 수 있습니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if exists(select 1 from public.mm_operations where project_id=p_project and id=p_operation) then return;end if;
 for op in select value from jsonb_array_elements(p_ops) loop
  v_id:=(op->>'id')::uuid;v_kind:=op->>'kind';v_data:=op->'data';
  select * into old from public.mm_records where project_id=p_project and id=v_id for update;
  if coalesce(old.version,0)<>coalesce((op->>'version')::int,0) then raise exception '다른 사용자가 수정했습니다. 새로고침 후 다시 확인하세요.';end if;
  if old.id is not null and old.kind<>v_kind then raise exception '데이터 종류를 바꿀 수 없습니다.';end if;
  if coalesce((op->>'deleted')::boolean,false) and v_role<>'admin' then raise exception '보관 처리는 관리자만 가능합니다.';end if;
  perform public.mm_validate(v_kind,v_data);
  if v_kind='request' and old.id is not null and (old.data->'original' is distinct from v_data->'original' or old.data->'source' is distinct from v_data->'source') then raise exception '원본 값과 원본 위치는 수정할 수 없습니다.';end if;
  if v_kind='approval' and old.id is not null and v_role<>'admin' and (old.data->'options' is distinct from v_data->'options' or old.data->'trade' is distinct from v_data->'trade' or old.data->'attachmentId' is distinct from v_data->'attachmentId' or old.data->'revision' is distinct from v_data->'revision' or old.data->'previousRevisions' is distinct from v_data->'previousRevisions') then raise exception '승인 내용 변경은 관리자만 가능합니다.';end if;
  insert into public.mm_records(id,project_id,kind,data,version,deleted,updated_at) values(v_id,p_project,v_kind,v_data,coalesce(old.version,0)+1,coalesce((op->>'deleted')::boolean,false),now()) on conflict(project_id,id) do update set data=excluded.data,version=excluded.version,deleted=excluded.deleted,updated_at=excluded.updated_at returning * into next;
  insert into public.mm_audit(project_id,record_id,kind,before,after,reason,action,actor_id,actor) values(p_project,v_id,v_kind,case when old.id is null then null else to_jsonb(old) end,to_jsonb(next),p_reason,p_action,auth.uid(),auth.jwt()->>'email');
 end loop;
 perform public.mm_check_links(p_project);
 insert into public.mm_operations values(p_project,p_operation,now());
end $$;

create function public.mm_restore(p_project uuid,p_records jsonb,p_reason text,p_operation uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare r jsonb;v_id uuid;v_count int;
begin
 if public.mm_role(p_project) is distinct from 'admin' then raise exception '복원은 관리자만 가능합니다.';end if;
 if jsonb_typeof(p_records)<>'array' or jsonb_array_length(p_records)>50000 then raise exception '지원하는 복원 범위를 초과했습니다.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_project::text,0));
 if exists(select 1 from public.mm_operations where project_id=p_project and id=p_operation) then return;end if;
 select count(distinct value->>'id') into v_count from jsonb_array_elements(p_records);
 if v_count<>jsonb_array_length(p_records) then raise exception '중복 데이터 ID가 있습니다.';end if;
 update public.mm_records set deleted=true,version=version+1,updated_at=now() where project_id=p_project;
 for r in select value from jsonb_array_elements(p_records) loop
  perform public.mm_validate(r->>'kind',r->'data');v_id:=(r->>'id')::uuid;
  insert into public.mm_records(id,project_id,kind,data,version,deleted,updated_at) values(v_id,p_project,r->>'kind',r->'data',1,coalesce((r->>'deleted')::boolean,false),now()) on conflict(project_id,id) do update set kind=excluded.kind,data=excluded.data,version=public.mm_records.version+1,deleted=excluded.deleted,updated_at=now();
 end loop;
 perform public.mm_check_links(p_project);
 insert into public.mm_audit(project_id,kind,reason,action,actor_id,actor,after) values(p_project,'system',p_reason,'전체 복원',auth.uid(),auth.jwt()->>'email',jsonb_build_object('count',jsonb_array_length(p_records),'backupNote','복원 전 전체 ZIP은 mm-files의 현장/backups 경로에 저장됨'));
 insert into public.mm_operations values(p_project,p_operation,now());
end $$;

insert into storage.buckets(id,name,public,file_size_limit) values('mm-files','mm-files',false,104857600);
create policy mm_storage_read on storage.objects for select to authenticated using(bucket_id='mm-files' and exists(select 1 from public.mm_members m where m.user_id=auth.uid() and m.project_id::text=split_part(name,'/',1)));
create policy mm_storage_insert on storage.objects for insert to authenticated with check(bucket_id='mm-files' and exists(select 1 from public.mm_members m where m.user_id=auth.uid() and m.role in ('admin','editor') and m.project_id::text=split_part(name,'/',1)));
-- 원본 보존: 클라이언트의 파일 덮어쓰기 및 삭제 정책은 추가하지 않습니다.

revoke all on function public.mm_role(uuid),public.mm_validate(text,jsonb),public.mm_check_links(uuid),public.mm_snapshot(uuid),public.mm_create_project(text),public.mm_set_member(uuid,uuid,text),public.mm_apply(uuid,jsonb,text,text,uuid),public.mm_restore(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.mm_role(uuid),public.mm_snapshot(uuid),public.mm_create_project(text),public.mm_set_member(uuid,uuid,text),public.mm_apply(uuid,jsonb,text,text,uuid),public.mm_restore(uuid,jsonb,text,uuid) to authenticated;
commit;
