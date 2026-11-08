import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import EmbeddedPostgres from 'embedded-postgres';
import { PrismaClient } from '@prisma/client';

let cluster: EmbeddedPostgres, directory: string, db: PrismaClient;
let service: typeof import('./service'), reports: typeof import('./reports'), imports: typeof import('./import-service'), sso: typeof import('./sso'), auth: typeof import('./auth');
let currentStaff: Awaited<ReturnType<PrismaClient['staffAccount']['findFirstOrThrow']>>;
const integration = process.env.CI && process.env.CRM_RUN_INTEGRATION_TESTS !== 'true' ? describe.skip : describe;

beforeAll(async () => {
  if (process.env.CI && process.env.CRM_RUN_INTEGRATION_TESTS !== 'true') return;
  directory = await mkdtemp(join(tmpdir(), 'drw-prime-crm-test-'));
  const port = await new Promise<number>((resolvePort, reject) => { const server = createServer(); server.on('error',reject); server.listen(0,'127.0.0.1',() => { const address=server.address(); if (!address || typeof address === 'string') throw new Error('No port'); server.close(() => resolvePort(address.port)); }); });
  cluster = new EmbeddedPostgres({ databaseDir:join(directory,'data'),port,user:'postgres',password:'isolated-test-only',authMethod:'password',persistent:false,onLog:()=>{},onError:()=>{} });
  await cluster.initialise(); await cluster.start(); await cluster.createDatabase('crm_integration_test');
  const url=`postgresql://postgres:isolated-test-only@127.0.0.1:${port}/crm_integration_test`;
  const pushed=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'db','push','--skip-generate'],{env:{...process.env,DATABASE_URL:url},encoding:'utf8'});
  if (pushed.status !== 0) throw new Error(`Could not prepare isolated schema: ${pushed.stderr}`);
  db=new PrismaClient({datasources:{db:{url}}});
  await db.staffAccount.create({data:{id:'owner',name:'Owner',email:'drwcorpora@gmail.com',googleSub:'google-owner'}});
  await db.staffAccount.create({data:{id:'fo',name:'FO',email:'fo@example.test',googleSub:'google-fo'}});
  const pg=cluster.getPgClient('crm_integration_test'); await pg.connect();
  await pg.query('DROP TABLE "crm_import_files","crm_import_batches","crm_reservation_history","crm_reservation_links","crm_spend_history","crm_spend","crm_follow_ups","crm_lead_events","crm_leads","crm_campaigns","crm_events","crm_sso_tickets","crm_grants" CASCADE');
  await pg.query(await readFile(resolve('prisma/migrations/20261108150000_add_prime_crm/migration.sql'),'utf8'));
  await pg.end();
  expect(await db.crmGrant.findUnique({where:{staffId:'owner'}})).toMatchObject({role:'ADMIN',active:true});
  await db.crmGrant.create({data:{staffId:'fo',role:'FRONT_OFFICE'}});
  vi.doMock('@/lib/prisma',() => ({prisma:db}));
  vi.doMock('@/lib/staff-auth/service',() => ({requireStaff:async()=>currentStaff,StaffAuthError:class extends Error { constructor(public status:number, message:string){super(message);} },STAFF_SESSION_SECONDS:2592000}));
  service=await import('./service'); reports=await import('./reports'); imports=await import('./import-service'); sso=await import('./sso'); auth=await import('./auth');
},120_000);

beforeEach(async () => {
  if (!db) return;
  await db.$executeRaw`TRUNCATE TABLE "crm_events", "crm_campaigns", "crm_leads", "crm_import_batches", "crm_sso_tickets", "reservations", "treatment_categories" CASCADE`;
  currentStaff=await db.staffAccount.findUniqueOrThrow({where:{id:'owner'}});
});
afterAll(async () => { await db?.$disconnect(); await cluster?.stop(); if (directory) await rm(directory,{recursive:true,force:true}); });

integration('CRM Prime integration', () => {
  it('enforces CRM grants and protects the two primary administrators', async () => {
    expect((await auth.requireCrm(['ADMIN'])).staff.id).toBe('owner');
    currentStaff=await db.staffAccount.findUniqueOrThrow({where:{id:'fo'}});
    await expect(auth.requireCrm(['ADMIN'])).rejects.toMatchObject({status:403});
    await expect(service.setGrant({staffId:'owner',role:'FRONT_OFFICE',active:true},{id:'fo',role:'ADMIN'})).rejects.toThrow('admin utama');
    const originRequest=(origin:string) => new Request('http://crm.prime.localhost:13010/api/crm',{method:'POST',headers:{host:'crm.prime.localhost:13010',origin}});
    expect(() => auth.assertCrmOrigin(originRequest('http://crm.prime.localhost:13010'))).not.toThrow();
    expect(() => auth.assertCrmOrigin(originRequest('http://prime.localhost:13010'))).toThrow();
  });

  it('imports idempotently, preserves duplicates and attributes follow-up to the selected event', async () => {
    const actor={id:'fo',role:'FRONT_OFFICE' as const};
    const first=await service.saveEvent({name:'CFD',eventDate:'2026-11-01'},actor);
    const second=await service.saveEvent({name:'Beauty Class',eventDate:'2026-11-02'},actor);
    const lead=await service.saveLead({name:'Rina Contoh',phone:'081234567890',source:'EVENT',eventId:first.id,assignedTo:'fo'},actor);
    await service.followUp({id:lead.id,revision:1,status:'FOLLOW_UP',note:'Hubungi lagi',nextFollowUp:'2026-11-20',eventId:first.id},actor);
    const batch=await db.crmImportBatch.create({data:{actorId:'fo',context:{source:'EVENT',eventId:second.id,campaignId:null,assignedTo:'fo'},rows:[{name:'Rina',phone:'+6281234567890',interest:'',notes:'',file:'test.csv'},{name:'Budi',phone:'081277771234',interest:'',notes:'',file:'test.csv'}],expiresAt:new Date(Date.now()+60_000)}});
    const rows=[{selected:true,name:'Rina',phone:'+6281234567890'},{selected:true,name:'Budi',phone:'081277771234'}];
    const result=await imports.saveImport({id:batch.id,rows},'fo');
    expect(result).toEqual({created:1,duplicates:1,linked:1});
    expect(await imports.saveImport({id:batch.id,rows},'fo')).toEqual(result);
    expect(await db.crmLead.count()).toBe(2);
    const events=await reports.eventSummary();
    expect(events.find((e)=>e.id===first.id)).toMatchObject({leads:1,contacted:1});
    expect(events.find((e)=>e.id===second.id)).toMatchObject({leads:2,contacted:0});
    await expect(service.followUp({id:lead.id,revision:1,status:'INTERESTED',note:'Stale'},actor)).rejects.toMatchObject({status:409});
  });

  it('prepares a photo for private review and deletes its original after saving', async () => {
    const actor={id:'fo',role:'FRONT_OFFICE' as const};
    const event=await service.saveEvent({name:'Event Foto',eventDate:'2026-11-01'},actor);
    vi.stubEnv('CRM_GEMINI_API_KEY','synthetic-test-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({rows:[{name:'Foto Contoh',phone:'081277771222',interest:'Facial',notes:''}],more_than_limit:false})}]}}]}),{status:200})));
    try {
      const form=new FormData(); form.set('source','EVENT'); form.set('eventId',event.id); form.set('assignedTo','fo');
      form.append('documents',new File([new Uint8Array([137,80,78,71,13,10,26,10,0])],'synthetic.png',{type:'image/png'}));
      const request=new Request('http://localhost/api/crm/import',{method:'POST',headers:{'content-length':'1024'},body:form});
      const batch=await imports.prepareImport(request,'fo');
      expect(batch.rows[0]).toMatchObject({name:'Foto Contoh',phone:'081277771222'});
      expect(batch.files).toHaveLength(1);
      await expect(imports.importFile(batch.id,batch.files[0].id,'owner')).rejects.toMatchObject({status:404});
      expect((await imports.importFile(batch.id,batch.files[0].id,'fo')).mime).toBe('image/png');
      expect(await imports.saveImport({id:batch.id,rows:batch.rows},'fo')).toEqual({created:1,duplicates:0,linked:0});
      expect(await db.crmImportFile.count({where:{batchId:batch.id}})).toBe(0);
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });

  it('keeps event revenue out of ad ROAS and creates reservations only once', async () => {
    const actor={id:'fo',role:'FRONT_OFFICE' as const};
    const event=await service.saveEvent({name:'Event',eventDate:'2026-11-01'},actor);
    const campaign=await service.saveCampaign({name:'Iklan',platform:'META'},actor);
    await service.saveSpend({campaignId:campaign.id,spendDate:service.jakartaToday(),amount:'100000'},actor);
    const [adLead,eventLead]=await Promise.all([
      service.saveLead({name:'Ads',phone:'081277770001',source:'ADS',campaignId:campaign.id},actor),
      service.saveLead({name:'Event',phone:'081277770002',source:'EVENT',eventId:event.id},actor),
    ]);
    const category=await db.treatmentCategory.create({data:{name:'Test',slug:randomUUID()}});
    const treatment=await db.treatment.create({data:{categoryId:category.id,name:'Facial',slug:randomUUID(),price:100000,benefits:[]}});
    const common={treatmentId:treatment.id,email:'synthetic@example.test',date:service.jakartaToday(),time:'09:00'};
    const requestKey=randomUUID();
    const [first,retry]=await Promise.all([service.createReservation({...common,leadId:adLead.id,requestKey},actor),service.createReservation({...common,leadId:adLead.id,requestKey},actor)]);
    expect(retry.id).toBe(first.id);
    const eventBooking=await service.createReservation({...common,leadId:eventLead.id,eventId:event.id,requestKey:randomUUID()},actor);
    const previousDay=new Date(new Date(`${service.jakartaToday()}T00:00:00Z`).getTime()-86400_000).toISOString().slice(0,10);
    await service.updateReservation({id:first.id,operation:'reschedule',newDate:previousDay,newTime:'10:00'},actor);
    expect((await db.reservation.findUniqueOrThrow({where:{id:first.id}})).reservationTime).toBe('10:00');
    await service.updateReservation({id:first.id,operation:'confirm'},actor);
    await service.updateReservation({id:first.id,operation:'complete',visitResult:'TREATMENT',amount:'300000'},actor);
    await service.updateReservation({id:eventBooking.id,operation:'confirm'},actor);
    await service.updateReservation({id:eventBooking.id,operation:'complete',visitResult:'TREATMENT',amount:'500000'},actor);
    const result=await reports.report({from:service.jakartaToday(),to:service.jakartaToday()});
    expect(result.total).toMatchObject({spend:100000,reservations:1,revenue:300000});
    expect((await reports.eventSummary()).find((e)=>e.id===event.id)?.revenue).toBe(500000);
    expect(await db.reservation.count()).toBe(2);
    expect(await db.crmReservationHistory.count({where:{reservationId:first.id}})).toBe(4);
    expect((await service.leadDetail(adLead.id)).reservations[0].history.map((event)=>event.action)).toEqual(expect.arrayContaining(['CREATED','Dijadwalkan ulang','CONFIRMED','COMPLETED']));
  });

  it('binds SSO tickets to the original browser and consumes them once', async () => {
    const binding='a'.repeat(43), other='b'.repeat(43);
    const { tokenHash }=await import('@/lib/member-auth/session');
    const ticket=await sso.issueSsoTicket('owner',tokenHash(binding));
    await expect(sso.consumeSsoTicket(ticket,other)).rejects.toMatchObject({status:403});
    const session=await sso.consumeSsoTicket(ticket,binding);
    expect(await db.staffSession.findUnique({where:{tokenHash:tokenHash(session)}})).toMatchObject({staffId:'owner'});
    await expect(sso.consumeSsoTicket(ticket,binding)).rejects.toMatchObject({status:403});
  });
});
