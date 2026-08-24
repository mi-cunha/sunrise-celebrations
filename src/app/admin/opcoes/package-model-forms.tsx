"use client";

import { useActionState, useState } from "react";
import type { ReactNode } from "react";
import {
  attachPackageRuleItem,
  createPackageLibraryItem,
  createPackageRule,
  createPackageSubcategory,
  type PackageModelFormState,
} from "./actions";

const initialState: PackageModelFormState = {};

const packageCategories = [
  { value: "buffet", label: "Buffet" },
  { value: "bebida", label: "Bebidas" },
  { value: "servico", label: "Serviço" },
  { value: "estrutura", label: "Estrutura" },
  { value: "decoracao", label: "Decoração" },
  { value: "observacao", label: "Observação" },
  { value: "outro", label: "Outro" },
];

export type PackageSubcategory = {
  id: string;
  category: string;
  name: string;
  description: string | null;
};

export type PackageLibraryItem = {
  id: string;
  name: string;
  proposal_description: string | null;
  operational_description: string | null;
  event_package_subcategories: { id: string; category: string; name: string }[] | { id: string; category: string; name: string } | null;
};

export type PackageRule = {
  id: string;
  package_id: string;
  subcategory_id: string;
  title: string | null;
  selection_min: number;
  selection_max: number;
  is_required: boolean;
  event_package_catalog: { id: string; name: string; event_type: string; event_types: string[] | null }[] | { id: string; name: string; event_type: string; event_types: string[] | null } | null;
  event_package_subcategories: { id: string; category: string; name: string }[] | { id: string; category: string; name: string } | null;
  event_package_rule_items: { id: string; event_package_item_catalog: { id: string; name: string }[] | { id: string; name: string } | null }[];
};

type PackageOption = {
  id: string;
  name: string;
  event_type: string;
  event_types: string[] | null;
};

export function PackageModelPanel({
  items,
  packages,
  rules,
  subcategories,
}: {
  items: PackageLibraryItem[];
  packages: PackageOption[];
  rules: PackageRule[];
  subcategories: PackageSubcategory[];
}) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-[#dcecf6]/60 p-3 text-sm text-[#083653]">
        Nova estrutura: cadastre subcategorias, crie itens reutilizáveis e monte cada pacote por regras de escolha.
      </p>
      <div className="grid gap-4 xl:grid-cols-3">
        <PackageSubcategoryForm />
        <PackageLibraryItemForm subcategories={subcategories} />
        <PackageRuleForm items={items} packages={packages} subcategories={subcategories} />
      </div>
      <PackageRuleItemForm items={items} rules={rules} />
      <PackageModelSummary items={items} rules={rules} subcategories={subcategories} />
    </div>
  );
}

function PackageSubcategoryForm() {
  const [state, action, pending] = useActionState(createPackageSubcategory, initialState);
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">1. Subcategoria</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="subcategory-category">Categoria</label>
          <select id="subcategory-category" name="category" defaultValue={state.category ?? "buffet"}>
            {packageCategories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="subcategory-name">Subcategoria</label>
          <input id="subcategory-name" name="name" defaultValue={state.name ?? ""} placeholder="Ex.: Entradinhas" required />
        </div>
        <div>
          <label htmlFor="subcategory-description">Descrição interna</label>
          <textarea id="subcategory-description" name="description" rows={2} defaultValue={state.description ?? ""} />
        </div>
      </div>
      <FormMessage state={state} />
      <button disabled={pending} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando..." : "Criar subcategoria"}
      </button>
    </form>
  );
}

function PackageLibraryItemForm({ subcategories }: { subcategories: PackageSubcategory[] }) {
  const [state, action, pending] = useActionState(createPackageLibraryItem, initialState);
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">2. Item reutilizável</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="item-subcategory">Categoria / subcategoria</label>
          <select id="item-subcategory" name="subcategoryId" defaultValue={state.subcategoryId ?? ""} required>
            <option value="">Selecione</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{categoryLabel(subcategory.category)} › {subcategory.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="item-name">Item</label>
          <input id="item-name" name="name" defaultValue={state.name ?? ""} placeholder="Ex.: Mini quiche" required />
        </div>
        <div>
          <label htmlFor="item-proposal-description">Texto para proposta</label>
          <textarea id="item-proposal-description" name="proposalDescription" rows={2} defaultValue={state.proposalDescription ?? ""} />
        </div>
        <div>
          <label htmlFor="item-operational-description">Texto para ficha operacional</label>
          <textarea id="item-operational-description" name="operationalDescription" rows={2} defaultValue={state.operationalDescription ?? ""} />
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="!mb-0 !flex items-center gap-2 text-sm">
            <input type="checkbox" name="showInProposal" defaultChecked className="!h-4 !w-4" />
            Proposta
          </label>
          <label className="!mb-0 !flex items-center gap-2 text-sm">
            <input type="checkbox" name="showInOperationalBrief" defaultChecked className="!h-4 !w-4" />
            Ficha
          </label>
        </div>
      </div>
      <FormMessage state={state} />
      <button disabled={pending || subcategories.length === 0} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando..." : "Criar item"}
      </button>
    </form>
  );
}

function PackageRuleForm({ items, packages, subcategories }: { items: PackageLibraryItem[]; packages: PackageOption[]; subcategories: PackageSubcategory[] }) {
  const [state, action, pending] = useActionState(createPackageRule, initialState);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(state.subcategoryId ?? "");
  const availableItems = selectedSubcategoryId ? items.filter((item) => firstRecord(item.event_package_subcategories)?.id === selectedSubcategoryId) : [];
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">3. Regra no pacote</h3>
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor="rule-package">Pacote</label>
          <select id="rule-package" name="packageId" defaultValue={state.packageId ?? ""} required>
            <option value="">Selecione</option>
            {packages.map((eventPackage) => (
              <option key={eventPackage.id} value={eventPackage.id}>{eventPackage.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rule-subcategory">Subcategoria</label>
          <select id="rule-subcategory" name="subcategoryId" value={selectedSubcategoryId} onChange={(event) => setSelectedSubcategoryId(event.currentTarget.value)} required>
            <option value="">Selecione</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{categoryLabel(subcategory.category)} › {subcategory.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rule-title">Título na proposta</label>
          <input id="rule-title" name="title" defaultValue={state.title ?? ""} placeholder="Ex.: Escolha os sabores de suco" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rule-min">Mín.</label>
            <input id="rule-min" name="selectionMin" type="number" min="0" defaultValue={state.selectionMin ?? ""} placeholder="0" />
          </div>
          <div>
            <label htmlFor="rule-max">Máx.</label>
            <input id="rule-max" name="selectionMax" type="number" min="0" defaultValue={state.selectionMax ?? ""} placeholder="Ex.: 3" />
          </div>
        </div>
        <label className="!mb-0 !flex items-center gap-2 text-sm">
          <input type="checkbox" name="isRequired" className="!h-4 !w-4" />
          Obrigatório
        </label>
        <div className="rounded-lg border border-[#edf1ee] bg-[#fbf8f1] p-3">
          <p className="text-sm font-semibold text-[#083653]">Itens que entram nesta regra</p>
          <p className="mt-1 text-xs text-[#5f7180]">Selecione apenas os itens que esse pacote pode oferecer dentro da subcategoria escolhida.</p>
          <div className="mt-3 max-h-52 overflow-auto rounded-lg bg-white p-2">
            {!selectedSubcategoryId && <p className="text-sm text-[#5f7180]">Selecione uma subcategoria para ver os itens disponíveis.</p>}
            {selectedSubcategoryId && availableItems.length === 0 && <p className="text-sm text-[#5f7180]">Nenhum item cadastrado nessa subcategoria.</p>}
            {availableItems.length > 0 && (
              <div className="grid gap-2">
                {availableItems.map((item) => (
                  <label key={item.id} className="!mb-0 !flex items-start gap-2 text-sm font-medium">
                    <input type="checkbox" name="itemIds" value={item.id} className="mt-0.5 !h-4 !w-4" />
                    <span>{item.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <FormMessage state={state} />
      <button disabled={pending || packages.length === 0 || subcategories.length === 0} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando..." : "Criar regra"}
      </button>
    </form>
  );
}

function PackageRuleItemForm({ items, rules }: { items: PackageLibraryItem[]; rules: PackageRule[] }) {
  const [state, action, pending] = useActionState(attachPackageRuleItem, initialState);
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">4. Associar item à regra do pacote</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor="rule-item-rule">Regra</label>
          <select id="rule-item-rule" name="ruleId" defaultValue={state.ruleId ?? ""} required>
            <option value="">Selecione</option>
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {packageRulePackageName(rule)} › {packageRuleSubcategoryLabel(rule)} · {ruleInstruction(rule)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rule-item-item">Item</label>
          <select id="rule-item-item" name="itemId" defaultValue={state.itemId ?? ""} required>
            <option value="">Selecione</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {packageItemSubcategoryLabel(item)}{item.name}
              </option>
            ))}
          </select>
        </div>
        <button disabled={pending || rules.length === 0 || items.length === 0} className="rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Associando..." : "Associar"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

function PackageModelSummary({ items, rules, subcategories }: { items: PackageLibraryItem[]; rules: PackageRule[]; subcategories: PackageSubcategory[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SummaryCard title="Subcategorias" empty="Nenhuma subcategoria cadastrada.">
        {subcategories.map((subcategory) => (
          <li key={subcategory.id} className="rounded-lg border border-[#edf1ee] bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{categoryLabel(subcategory.category)}</span> › {subcategory.name}
          </li>
        ))}
      </SummaryCard>
      <SummaryCard title="Itens" empty="Nenhum item cadastrado.">
        {items.map((item) => (
          <li key={item.id} className="rounded-lg border border-[#edf1ee] bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{item.name}</span>
            <span className="block text-xs text-[#5f7180]">{packageItemSubcategoryLabel(item) || "Sem subcategoria"}</span>
          </li>
        ))}
      </SummaryCard>
      <SummaryCard title="Regras por pacote" empty="Nenhuma regra cadastrada.">
        {rules.map((rule) => (
          <li key={rule.id} className="rounded-lg border border-[#edf1ee] bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{packageRulePackageName(rule)}</span>
            <span className="block text-xs text-[#5f7180]">{packageRuleSubcategoryLabel(rule)} · {ruleInstruction(rule)}</span>
            <span className="mt-1 block text-xs text-[#5f7180]">{rule.event_package_rule_items.length} item(ns) associado(s)</span>
          </li>
        ))}
      </SummaryCard>
    </div>
  );
}

function SummaryCard({ children, empty, title }: { children: ReactNode[]; empty: string; title: string }) {
  return (
    <section className="rounded-lg border border-[#d9ded8] bg-[#fbf8f1] p-3">
      <h3 className="text-sm font-semibold text-[#083653]">{title}</h3>
      {children.length ? <ul className="mt-3 max-h-80 space-y-2 overflow-auto">{children}</ul> : <p className="mt-3 text-sm text-[#5f7180]">{empty}</p>}
    </section>
  );
}

function FormMessage({ state }: { state: PackageModelFormState }) {
  if (state.error) return <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>;
  if (state.success) return <p role="status" className="mt-3 rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>;
  return null;
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    buffet: "Buffet",
    bebida: "Bebidas",
    servico: "Serviço",
    estrutura: "Estrutura",
    decoracao: "Decoração",
    observacao: "Observação",
    outro: "Outro",
  };
  return labels[category] ?? category;
}

function ruleInstruction(rule: Pick<PackageRule, "selection_min" | "selection_max">) {
  if (rule.selection_min && rule.selection_max && rule.selection_min === rule.selection_max) return `Escolha ${rule.selection_max}`;
  if (rule.selection_min && rule.selection_max) return `Escolha de ${rule.selection_min} a ${rule.selection_max}`;
  if (rule.selection_max) return `Escolha até ${rule.selection_max}`;
  if (rule.selection_min) return `Escolha ao menos ${rule.selection_min}`;
  return "Incluso fixo";
}

function firstRecord<T>(value: T[] | T | null | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function packageItemSubcategoryLabel(item: PackageLibraryItem) {
  const subcategory = firstRecord(item.event_package_subcategories);
  return subcategory ? `${categoryLabel(subcategory.category)} › ${subcategory.name} · ` : "";
}

function packageRulePackageName(rule: PackageRule) {
  return firstRecord(rule.event_package_catalog)?.name ?? "Pacote";
}

function packageRuleSubcategoryLabel(rule: PackageRule) {
  const subcategory = firstRecord(rule.event_package_subcategories);
  return subcategory ? `${categoryLabel(subcategory.category)} › ${subcategory.name}` : "Subcategoria";
}
