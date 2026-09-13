import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const actor = "00000000-0000-4000-8000-000000000001";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$ select '${actor}'::uuid $$;
    grant usage on schema public,auth to authenticated,anon,service_role;`);
  for (const file of ["202608110001_initial_sunrise.sql", "202608120002_conversation_triage.sql", "202608250007_whatsapp_cloud.sql", "202608270001_whatsapp_coexistence_foundation.sql", "202608270003_whatsapp_history.sql", "202609130001_coexistence_validation.sql"]) {
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.exec(`insert into auth.users values('${actor}'); insert into public.profiles(id) values('${actor}');
    insert into public.user_permissions values('${actor}','admin_owner');
    insert into public.whatsapp_connections(phone_number_id) values('10001'),('10002');
    grant select,insert,update on public.conversations,public.conversation_messages to authenticated;
    grant select on public.profiles,public.user_permissions to authenticated;`);
}, 30000);
afterAll(async () => { await db?.close(); });

async function ingest(id: string, phone = "10001", echo = false) {
  return db.query("select public.ingest_whatsapp_message($1::jsonb,$2::uuid)", [JSON.stringify({ id, phone, contact: "550000000001", body: "Fixture", timestamp: "1787680000", echo }), actor]);
}

describe("actual WhatsApp migrations in isolated PostgreSQL", () => {
  it("makes webhook retries idempotent, starts paused and separates phone numbers", async () => {
    await ingest("wamid.fixture1"); await ingest("wamid.fixture1"); await ingest("wamid.fixture2", "10002");
    const { rows } = await db.query("select external_phone_number_id,ai_paused,status from public.conversations order by external_phone_number_id");
    expect(rows).toEqual([{ external_phone_number_id: "10001", ai_paused: true, status: "aguardando_humano" }, { external_phone_number_id: "10002", ai_paused: true, status: "aguardando_humano" }]);
    expect((await db.query("select count(*)::int as n from public.conversation_messages")).rows).toEqual([{ n: 2 }]);
    expect((await db.query("select count(*)::int as n from public.leads")).rows).toEqual([{ n: 1 }]);
  });
  it("mirrors app replies without creating automated responses", async () => {
    await ingest("wamid.fixture-echo", "10001", true);
    expect((await db.query("select author,message_origin,direction from public.conversation_messages where external_message_id='wamid.fixture-echo'")).rows).toEqual([{ author: "humano", message_origin: "whatsapp_business_app", direction: "outbound" }]);
  });
  it("retains early statuses and never regresses a read receipt", async () => {
    await db.query("select public.apply_whatsapp_status($1,$2,$3,now())", ["wamid.early", "10001", "read"]);
    await ingest("wamid.early", "10001", true);
    for (const status of ["sent", "delivered", "failed"]) await db.query("select public.apply_whatsapp_status($1,$2,$3,now())", ["wamid.early", "10001", status]);
    expect((await db.query("select delivery_status from public.conversation_messages where external_message_id='wamid.early'")).rows).toEqual([{ delivery_status: "read" }]);
  });
  it("does not apply another phone's delivery receipt", async () => {
    await db.query("select public.apply_whatsapp_status($1,$2,$3,now())", ["wamid.fixture-echo", "10002", "read"]);
    expect((await db.query("select delivery_status from public.conversation_messages where external_message_id='wamid.fixture-echo'")).rows).toEqual([{ delivery_status: "sent" }]);
  });
  it("keeps completed history completed with out-of-order chunks", async () => {
    await db.exec("select public.advance_whatsapp_history(id,3,100) from public.whatsapp_connections; select public.advance_whatsapp_history(id,1,25) from public.whatsapp_connections;");
    expect((await db.query("select distinct history_sync_status,history_sync_progress from public.whatsapp_connections")).rows).toEqual([{ history_sync_status: "completed", history_sync_progress: 100 }]);
  });
  it("denies credential reads and backend RPC calls to logged-in users", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select * from public.whatsapp_connection_credentials")).rejects.toThrow(/permission denied/i);
      await expect(ingest("wamid.forged")).rejects.toThrow(/permission denied/i);
      await expect(db.exec("update public.conversations set external_phone_number_id='fake'")).rejects.toThrow(/server managed/i);
      await expect(db.exec("insert into public.conversation_messages(conversation_id,author,body,direction,external_message_id) select id,'cliente','forged','inbound','wamid.forged' from public.conversations limit 1")).rejects.toThrow(/row-level security/i);
    } finally { await db.exec("reset role"); }
  });
  it("preserves legacy production human sends and internal handoffs", async () => {
    await db.exec("set role authenticated");
    try {
      await db.query("insert into public.conversation_messages(conversation_id,author,actor_id,body,external_message_id,delivery_status) select id,'humano',$1,'Legacy fixture','wamid.legacy','sent' from public.conversations limit 1", [actor]);
      await db.exec("insert into public.conversation_messages(conversation_id,author,body) select id,'sistema','Legacy handoff' from public.conversations limit 1");
      await db.exec("update public.conversations set status='humano_assumiu',ai_paused=true");
      expect((await db.query("select delivery_status from public.conversation_messages where external_message_id='wamid.legacy'")).rows).toEqual([{ delivery_status: "sent" }]);
    } finally { await db.exec("reset role"); }
  });
});
