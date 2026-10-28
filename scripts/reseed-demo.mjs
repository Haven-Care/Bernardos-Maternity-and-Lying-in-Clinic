import { createHash } from 'node:crypto'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { allAuthUsers, projectClient, projectRoot, verifyBackup } from './backup-supabase.mjs'
import { ADMIN_EMAILS, SEED_KEY, buildDemoPlan } from './demo-seed-plan.mjs'
const require = createRequire(resolve(projectRoot, 'backend/package.json'))
const { parse } = require('dotenv')
const { createClient } = require('@supabase/supabase-js')
const operational = ['reschedule_requests','appointment_status_events','appointments','clinical_records','patient_documents','patients','inventory_batch_events','stock_movements','medicine_photos','medicine_batches','medicines','notifications']
const master = ['clinic_info','clinic_settings','operating_hours','services','appointment_slots']
const q = value => value === null || value === undefined ? 'null' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`
const insert = (table, row) => `insert into ${table} (${Object.keys(row).join(',')}) values (${Object.values(row).map(q).join(',')});\n`
function sqlFile(path, ref) {
  const result = spawnSync(resolve(projectRoot, 'node_modules/.bin/supabase'), ['db','query','--linked','--project-ref',ref,'--output','json','--file',path], { cwd: projectRoot, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Database operation failed')
  return JSON.parse(result.stdout).rows
}
export function resetSql(plan, tables, users) {
  const clientId = key => users.find(user => user.email === plan.clients.find(client => client.key === key).email).id
  const actor = users.find(user => user.email === ADMIN_EMAILS[0]).id
  let sql = 'begin;\nset local lock_timeout = \'15s\';\n'
  // Abort if an operational row changed after the saved backup. No intervening work is discarded.
  sql += `lock table ${[...operational, ...master].join(',')} in access exclusive mode;\ncreate temp table reseed_expected (name text, rows jsonb) on commit drop;\n`
  for (const table of [...operational,...master]) sql += insert('reseed_expected', { name: table, rows: JSON.stringify(tables[table]) })
  sql += `do $$ declare r record; changed boolean; begin
    for r in select * from reseed_expected loop
      execute format('select exists((select to_jsonb(t) from public.%I t except select value from jsonb_array_elements($1)) union all (select value from jsonb_array_elements($1) except select to_jsonb(t) from public.%I t))',r.name,r.name) into changed using r.rows;
      if changed then raise exception 'Table % changed after backup; export a new backup before resetting.',r.name; end if;
    end loop;
  end $$;\n`
  sql += `truncate ${operational.join(',')} restart identity;\nalter sequence patient_code_seq restart with 108;\nalter sequence booking_ref_seq restart with 812;\n`
  // Use the current curated catalogue, not prototype services/prices or auth fixtures.
  for (const patient of plan.patients) {
    const { client_key, ...fields } = patient
    sql += insert('patients', { ...fields, account_id: clientId(client_key) })
  }
  sql += 'create temp table reseed_booking_ids (planned uuid primary key, actual uuid) on commit drop;\n'
  for (const booking of plan.reservations) {
    const { client_key, ...fields } = booking
    if (booking.scheduled_date < plan.today) {
      sql += insert('appointments', { ...fields, account_id: clientId(client_key) })
      sql += insert('reseed_booking_ids', { planned: booking.id, actual: booking.id })
    } else {
      sql += `insert into reseed_booking_ids select ${q(booking.id)}, (book_appointment(${[clientId(client_key),booking.service_id,booking.scheduled_date,booking.slot_time,booking.patient_name,booking.contact_number,booking.email,booking.reason_for_visit].map(q).join(',')})).id;\n`
    }
  }
  for (const { sequence, ...event } of plan.statusEvents) sql += insert('appointment_status_events', { ...event, occurred_at: new Date(Date.parse(event.occurred_at)+sequence*30*60_000).toISOString(), actor_id: actor })
  for (const record of plan.clinicalRecords) sql += insert('clinical_records', { ...record, created_by: actor })
  for (const request of plan.rescheduleRequests) {
    const { booking_id, ...fields } = request
    sql += insert('reschedule_requests', { ...fields, decided_by: request.status === 'pending' ? null : actor, booking_id }).replace(q(booking_id), `(select actual from reseed_booking_ids where planned=${q(booking_id)})`)
  }
  // Medicines are taken from the maintained local seed; no original patient fixtures are imported.
  const catalogue = plan.inventoryCatalogue
  sql += catalogue + '\n'
  sql += `do $$ declare m medicines; b medicine_batches; first_actor uuid := ${q(actor)}; n integer:=0; initial integer; expiry date; begin
  for m in select * from medicines order by generic_name loop
    n:=n+1;
    initial:=case n when 1 then 0 when 2 then m.reorder_level when 3 then 20 else greatest(m.reorder_level*2,50) end;
    expiry:=clinic_today()+case n when 3 then 7 when 4 then -3 else 180+n end;
    insert into medicine_batches(medicine_id,batch_no,manufacturer_lot,quantity,expires_at,received_at,closed_reason)
      values(m.id,'DEMO-B-'||n,'DEMO-LOT-'||n,initial,expiry,clinic_today()-30,case when initial=0 then 'depleted' else null end) returning * into b;
    -- Opening receipt/dispensing facts form a reconciled ledger, even for the empty batch.
    insert into stock_movements(batch_id,medicine_id,type,quantity,note,created_by,reason,quantity_before,quantity_after,created_by_name,medicine_snapshot,batch_snapshot,occurred_at)
      select b.id,m.id,'stock_in',greatest(initial,10),'Synthetic opening receipt',first_actor,'received',0,greatest(initial,10),p.full_name,
        jsonb_build_object('genericName',m.generic_name,'brandName',m.brand_name,'dosage',m.dosage,'dosageForm',m.dosage_form,'unit',m.unit),
        jsonb_build_object('batchNo',b.batch_no,'manufacturerLot',b.manufacturer_lot,'expiresAt',b.expires_at),(clinic_today()-30)::timestamptz from profiles p where id=first_actor;
    if initial=0 then
      insert into stock_movements(batch_id,medicine_id,type,quantity,note,created_by,reason,quantity_before,quantity_after,created_by_name,medicine_snapshot,batch_snapshot)
        select batch_id,medicine_id,'stock_out',10,'Synthetic completed dispensing',created_by,'dispensed',10,0,created_by_name,medicine_snapshot,batch_snapshot from stock_movements where batch_id=b.id;
    end if;
    if n=4 then perform move_inventory_stock(b.id,5,'disposed','Synthetic partial disposal history; no real stock transaction',first_actor); end if;
    update medicines set target_stock_level=greatest(reorder_level*3,100) where id=m.id;
  end loop;
  end $$;\n`
  sql += `do $$ begin
    assert (select count(*) from patients)=5;
    assert (select count(*) from appointments)=30;
    assert (select count(*) from clinical_records)=10;
    assert not exists(select 1 from appointments where status='confirmed');
    assert not exists(select 1 from medicine_stock where physical_qty<>qty_on_hand+expired_qty);
    assert not exists(select 1 from medicine_batches b where quantity<>(select coalesce(sum(case type when 'stock_in' then quantity else -quantity end),0) from stock_movements where batch_id=b.id));
    assert not exists(select 1 from appointments a join appointment_slots s on s.weekday=weekday_of(a.scheduled_date) and s.slot_time=a.slot_time where a.status not in ('cancelled','no_show') group by a.scheduled_date,a.slot_time,s.capacity having count(*)>s.capacity);
    assert not exists(select 1 from appointments where status in ('completed','no_show') and scheduled_date>=clinic_today());
  end $$;\nselect public.assert_rls_posture();\ncommit;\nselect 'reseed_complete' as result;\n`
  return sql
}
async function main() {
  const [command, directory, planPath, secretsPath, ref] = process.argv.slice(2)
  if (!['plan','apply','verify'].includes(command) || !directory || !planPath || !ref) throw new Error('Usage: plan|apply|verify BACKUP_DIR PLAN_JSON CREDENTIALS_ENV PROJECT_REF')
  const manifest = await verifyBackup(directory)
  const { url, client } = await projectClient()
  if (manifest.projectHost !== `${ref}.supabase.co` || new URL(url).hostname !== manifest.projectHost) throw new Error('Explicit target, backup, and configured project must agree')
  const snapshot=JSON.parse(await readFile(resolve(directory,'public-snapshot.json'),'utf8'))
  const tables=Object.fromEntries(Object.entries(snapshot.tables).map(([k,v])=>[k.replace('public.',''),v.rows]))
  const digest=createHash('sha256').update(await readFile(resolve(directory,'manifest.json'))).digest('hex')
  const { data: today, error: dateError }=await client.rpc('clinic_today'); if(dateError) throw dateError
  if(command==='plan') {
    const plan=buildDemoPlan({ tables:{...tables,appointments:[]}, projectHost:manifest.projectHost, backupSha256:digest, today })
    const seed=await readFile(resolve(projectRoot,'supabase/seed.sql'),'utf8')
    plan.inventoryCatalogue=seed.slice(seed.indexOf('insert into medicines ('),seed.indexOf('insert into medicine_batches ('))
    await writeFile(planPath,JSON.stringify(plan,null,2)+'\n',{mode:0o600,flag:'wx'})
    const users=await allAuthUsers(client)
    await writeFile(planPath+'.sql',resetSql(plan,tables,users),{mode:0o600,flag:'wx'})
    console.log(JSON.stringify({planned:true,patients:plan.patients.length,bookings:plan.reservations.length,clinicsPreserved:master,otherAuthAccountsPreserved:users.length-7})); return
  }
  const plan=JSON.parse(await readFile(planPath,'utf8'))
  if(plan.sourceBackupSha256!==digest || plan.projectHost!==manifest.projectHost || plan.seedKey!==SEED_KEY || plan.today!==today) throw new Error('Plan provenance/date does not match backup and current target')
  if((await stat(secretsPath)).mode&0o077) throw new Error('Credentials file must be mode 600')
  const secrets=parse(await readFile(secretsPath))
  if(!secrets.SEED_ADMIN_PASSWORD || !secrets.SEED_CLIENT_PASSWORD) throw new Error('Both requested account passwords are required')
  const users=await allAuthUsers(client)
  for(const a of [...plan.admins,...plan.clients]) {
    const u=users.find(x=>x.email===a.email), admin=ADMIN_EMAILS.includes(a.email)
    if(!u || (u.app_metadata.user_type==='staff')!==admin) throw new Error('Account must already exist in its intended realm: '+a.email)
  }
  if(command==='apply') {
    // This operation never deletes Auth users or changes an account outside the seven allowlisted emails.
    for(const a of [...plan.admins,...plan.clients]) {
      const u=users.find(x=>x.email===a.email), admin=ADMIN_EMAILS.includes(a.email)
      const {error}=await client.auth.admin.updateUserById(u.id,{password:admin?secrets.SEED_ADMIN_PASSWORD:secrets.SEED_CLIENT_PASSWORD,email_confirm:true,
        app_metadata:{...u.app_metadata,user_type:admin?'staff':'patient',...(admin?{staff_role:'administrator'}:{havencare_demo_seed:SEED_KEY})}})
      if(error) throw new Error('Provision account: '+error.message)
      if(admin) { const {error}=await client.from('profiles').update({role:'administrator',status:'active'}).eq('id',u.id); if(error) throw error }
    }
    const sql=resetSql(plan,tables,users)
    await writeFile(planPath+'.sql',sql,{mode:0o600})
    console.log(JSON.stringify(sqlFile(planPath+'.sql',ref)))
  }
  // Validate actual deployed authorization, booking isolation, and all seven logins without saving tokens.
  const frontend=parse(await readFile(resolve(projectRoot,'frontend/.env')))
  const publicKey=frontend.VITE_SUPABASE_ANON_KEY || frontend.VITE_SUPABASE_PUBLISHABLE_KEY
  if(!publicKey) throw new Error('Frontend Supabase anon key is required for login verification')
  const report={completedAt:new Date().toISOString(),accounts:[],tables:{}}
  for(const a of [...plan.admins,...plan.clients]) {
    const admin=ADMIN_EMAILS.includes(a.email)
    const auth=createClient(url,publicKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data,error}=await auth.auth.signInWithPassword({email:a.email,password:admin?secrets.SEED_ADMIN_PASSWORD:secrets.SEED_CLIENT_PASSWORD})
    if(error || !data.session) throw new Error('Login failed for '+a.email+': '+error?.message)
    const headers={Authorization:'Bearer '+data.session.access_token}
    const session=await fetch('https://havencare-backend.vercel.app/api/account/session',{headers})
    if(!session.ok) throw new Error('Session routing failed for '+a.email)
    const identity=await session.json()
    if(identity.role!==(admin?'administrator':'patient')) throw new Error('Wrong account realm: '+a.email)
    const bookings=await fetch('https://havencare-backend.vercel.app/api/'+(admin?'bookings':'me/bookings'),{headers})
    if(!bookings.ok) throw new Error('Booking access failed for '+a.email)
    const rows=await bookings.json()
    if(!admin && (rows.length!==6 || rows.some(row=>row.email!==a.email))) throw new Error('Booking isolation failed: '+a.email)
    const denied=await fetch('https://havencare-backend.vercel.app/api/'+(admin?'me/bookings':'inventory/stats'),{headers})
    if(denied.status!==403) throw new Error('Cross-realm access was not rejected: '+a.email)
    report.accounts.push({email:a.email,role:admin?'administrator':'patient',login:true,authorization:true,...(!admin?{bookings:rows.length}:{})})
    await auth.auth.signOut({scope:'local'})
  }
  for(const t of operational) { const {count,error}=await client.from(t).select('*',{count:'exact',head:true}); if(error) throw error; report.tables[t]=count }
  for(const t of master) { const {data,error}=await client.from(t).select('*'); if(error) throw error
    const canonical=rows=>JSON.stringify(rows.map(row=>JSON.stringify(Object.entries(row).sort())).sort())
    if(canonical(data)!==canonical(tables[t])) throw new Error('Clinic master data changed: '+t)
  }
  const currentUsers=await allAuthUsers(client)
  if(currentUsers.length!==users.length) throw new Error('Unexpected Auth account creation/deletion')
  await writeFile(planPath+'.verified.json',JSON.stringify(report,null,2)+'\n',{mode:0o600})
  console.log(JSON.stringify(report))
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(e=>{console.error(e.message);process.exitCode=1})
