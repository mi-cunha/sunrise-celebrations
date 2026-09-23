import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../../supabase/migrations/202609230002_unified_package_catalog.sql", import.meta.url), "utf8");

describe("catálogo unificado de pacotes", () => {
  it("aproveita um item antigo e faz as regras da biblioteca chegarem ao pacote usado na proposta", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        create table public.event_package_subcategories (id uuid primary key, category text, name text);
        create table public.event_package_item_catalog (id uuid primary key, name text, proposal_description text, operational_description text, show_in_proposal boolean, show_in_operational_brief boolean);
        create table public.event_package_rules (id uuid primary key, package_id uuid, subcategory_id uuid, title text, selection_min integer, selection_max integer, is_required boolean, show_in_proposal boolean, show_in_operational_brief boolean);
        create table public.event_package_rule_items (id uuid primary key, package_rule_id uuid, item_catalog_id uuid, sort_order integer);
        create table public.event_package_items (id uuid primary key default gen_random_uuid(), package_id uuid, category text, name text, description text, show_in_proposal boolean, show_in_operational_brief boolean, is_choice boolean, choice_group text, choice_min integer, choice_max integer, sort_order integer, created_at timestamptz default now(), constraint event_package_items_category_check check (category in ('buffet', 'bebida', 'servico', 'estrutura', 'observacao', 'outro')));
        insert into public.event_package_subcategories values ('11111111-1111-1111-1111-111111111111', 'buffet', 'Entradas');
        insert into public.event_package_item_catalog values ('22222222-2222-2222-2222-222222222222', 'Mini quiche', 'Pequenas porções', null, true, true);
        insert into public.event_package_rules values ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Escolha entradas', 0, 2, true, true, true);
        insert into public.event_package_rule_items values ('55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 10);
        insert into public.event_package_items (id,package_id,category,name,show_in_proposal,show_in_operational_brief,is_choice,sort_order) values ('66666666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'buffet', 'Mini quiche', true, true, false, 10);
      `);
      await db.exec(migration);
      const first = await db.query<{ id: string; source_rule_item_id: string; choice_min: number; choice_max: number; is_choice: boolean }>("select id,source_rule_item_id,choice_min,choice_max,is_choice from public.event_package_items");
      expect(first.rows).toEqual([{ id: "66666666-6666-6666-6666-666666666666", source_rule_item_id: "55555555-5555-5555-5555-555555555555", choice_min: 1, choice_max: 2, is_choice: true }]);

      await db.exec("update public.event_package_item_catalog set proposal_description = 'Nova descrição' where name = 'Mini quiche'");
      const updated = await db.query<{ description: string }>("select description from public.event_package_items");
      expect(updated.rows[0]?.description).toBe("Nova descrição");

      await db.exec(`
        insert into public.event_package_subcategories values ('77777777-7777-7777-7777-777777777777', 'decoracao', 'Flores');
        insert into public.event_package_item_catalog values ('88888888-8888-8888-8888-888888888888', 'Arranjo de mesa', 'Flores da estação', null, true, true);
        insert into public.event_package_rules values ('99999999-9999-9999-9999-999999999999', '44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', null, 0, 0, false, true, true);
        insert into public.event_package_rule_items values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', '88888888-8888-8888-8888-888888888888', 20);
      `);
      const fixed = await db.query<{ category: string; is_choice: boolean; name: string }>("select category,is_choice,name from public.event_package_items where source_rule_item_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'");
      expect(fixed.rows).toEqual([{ category: "decoracao", is_choice: false, name: "Arranjo de mesa" }]);
    } finally {
      await db.close();
    }
  }, 30_000);
});
