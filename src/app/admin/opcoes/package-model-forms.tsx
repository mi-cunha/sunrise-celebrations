"use client";

import { useActionState, useId, useState } from "react";
import type { ReactNode } from "react";
import {
  attachPackageRuleItem,
  createPackageLibraryItem,
  createPackageRule,
  createPackageSubcategory,
  removePackageLibraryItem,
  removePackageSubcategory,
  updatePackageLibraryItem,
  updatePackageSubcategory,
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
  show_in_proposal: boolean;
  show_in_operational_brief: boolean;
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

export function PackageLibraryPanel({ items, subcategories }: { items: PackageLibraryItem[]; subcategories: PackageSubcategory[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Organize itens por categoria e subcategoria. Depois, abra um pacote para incluí-los ou oferecer escolhas ao cliente.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <PackageSubcategoryForm />
        <PackageLibraryItemForm subcategories={subcategories} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryCard title="Subcategorias" empty="Nenhuma subcategoria cadastrada.">
          {subcategories.map((subcategory) => <PackageSubcategoryAccordion key={subcategory.id} subcategory={subcategory} />)}
        </SummaryCard>
        <SummaryCard title="Itens da biblioteca" empty="Nenhum item cadastrado.">
          {items.map((item) => <PackageLibraryItemAccordion key={item.id} item={item} subcategories={subcategories} />)}
        </SummaryCard>
      </div>
    </div>
  );
}

function PackageSubcategoryAccordion({ subcategory }: { subcategory: PackageSubcategory }) {
  const [updateState, updateAction, updatePending] = useActionState(updatePackageSubcategory, initialState);
  const [removeState, removeAction, removePending] = useActionState(removePackageSubcategory, initialState);
  const updateMessage = updateState.id === subcategory.id ? updateState.error ?? updateState.success : undefined;
  const removeMessage = removeState.id === subcategory.id ? removeState.error ?? removeState.success : undefined;
  const values = updateState.id === subcategory.id ? updateState : undefined;

  return (
    <li>
      <details className="rounded-lg border border-[#edf1ee] bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm transition hover:bg-[#f6f0e5]">
          <span className="font-semibold">{categoryLabel(subcategory.category)}</span> › {subcategory.name}
          <span className="ml-2 text-xs text-[#5f7180]">Editar ou excluir</span>
        </summary>
        <div className="border-t border-[#edf1ee] p-3">
          <form action={updateAction}>
            <input type="hidden" name="id" value={subcategory.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`subcategory-category-${subcategory.id}`}>Categoria</label>
                <select id={`subcategory-category-${subcategory.id}`} name="category" defaultValue={values?.category ?? subcategory.category}>
                  {packageCategories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`subcategory-name-${subcategory.id}`}>Subcategoria</label>
                <input id={`subcategory-name-${subcategory.id}`} name="name" defaultValue={values?.name ?? subcategory.name} required />
              </div>
            </div>
            <div className="mt-3">
              <label htmlFor={`subcategory-description-${subcategory.id}`}>Descrição interna</label>
              <textarea id={`subcategory-description-${subcategory.id}`} name="description" rows={2} defaultValue={values?.description ?? subcategory.description ?? ""} />
            </div>
            {updateMessage && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${updateState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{updateMessage}</p>}
            <button disabled={updatePending} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{updatePending ? "Salvando..." : "Salvar subcategoria"}</button>
          </form>
          <form action={removeAction} onSubmit={(event) => { if (!window.confirm(`Remover a subcategoria “${subcategory.name}”? Os itens precisam ser removidos antes.`)) event.preventDefault(); }} className="mt-3 border-t border-[#edf1ee] pt-3">
            <input type="hidden" name="id" value={subcategory.id} />
            {removeMessage && <p role="status" className={`mb-3 rounded-lg p-3 text-sm ${removeState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{removeMessage}</p>}
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">{removePending ? "Removendo..." : "Remover subcategoria"}</button>
          </form>
        </div>
      </details>
    </li>
  );
}

function PackageLibraryItemAccordion({ item, subcategories }: { item: PackageLibraryItem; subcategories: PackageSubcategory[] }) {
  const [updateState, updateAction, updatePending] = useActionState(updatePackageLibraryItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(removePackageLibraryItem, initialState);
  const updateMessage = updateState.id === item.id ? updateState.error ?? updateState.success : undefined;
  const removeMessage = removeState.id === item.id ? removeState.error ?? removeState.success : undefined;
  const values = updateState.id === item.id ? updateState : undefined;
  const currentSubcategory = firstRecord(item.event_package_subcategories);

  return (
    <li>
      <details className="rounded-lg border border-[#edf1ee] bg-white">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm transition hover:bg-[#f6f0e5]">
          <span className="font-semibold">{item.name}</span>
          <span className="block text-xs text-[#5f7180]">{packageItemSubcategoryLabel(item) || "Sem subcategoria"}Editar ou excluir</span>
        </summary>
        <div className="border-t border-[#edf1ee] p-3">
          <form action={updateAction}>
            <input type="hidden" name="id" value={item.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`library-item-subcategory-${item.id}`}>Categoria / subcategoria</label>
                <select id={`library-item-subcategory-${item.id}`} name="subcategoryId" defaultValue={values?.subcategoryId ?? currentSubcategory?.id ?? ""} required>
                  {subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{categoryLabel(subcategory.category)} › {subcategory.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`library-item-name-${item.id}`}>Item</label>
                <input id={`library-item-name-${item.id}`} name="name" defaultValue={values?.name ?? item.name} required />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`library-item-proposal-${item.id}`}>Texto para proposta</label>
                <textarea id={`library-item-proposal-${item.id}`} name="proposalDescription" rows={2} defaultValue={values?.proposalDescription ?? item.proposal_description ?? ""} />
              </div>
              <div>
                <label htmlFor={`library-item-operational-${item.id}`}>Texto para ficha operacional</label>
                <textarea id={`library-item-operational-${item.id}`} name="operationalDescription" rows={2} defaultValue={values?.operationalDescription ?? item.operational_description ?? ""} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="!mb-0 !flex items-center gap-2 text-sm"><input type="checkbox" name="showInProposal" defaultChecked={values?.showInProposal ?? item.show_in_proposal} className="!h-4 !w-4" />Proposta</label>
              <label className="!mb-0 !flex items-center gap-2 text-sm"><input type="checkbox" name="showInOperationalBrief" defaultChecked={values?.showInOperationalBrief ?? item.show_in_operational_brief} className="!h-4 !w-4" />Ficha</label>
            </div>
            {updateMessage && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${updateState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{updateMessage}</p>}
            <button disabled={updatePending} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{updatePending ? "Salvando..." : "Salvar item"}</button>
          </form>
          <form action={removeAction} onSubmit={(event) => { if (!window.confirm(`Remover “${item.name}” da biblioteca? Ele deixará de ser usado em novos pacotes, sem alterar orçamentos existentes.`)) event.preventDefault(); }} className="mt-3 border-t border-[#edf1ee] pt-3">
            <input type="hidden" name="id" value={item.id} />
            {removeMessage && <p role="status" className={`mb-3 rounded-lg p-3 text-sm ${removeState.error ? "bg-red-50 text-red-800" : "bg-[#edf5ee] text-[#356451]"}`}>{removeMessage}</p>}
            <button disabled={removePending} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60">{removePending ? "Removendo..." : "Remover item"}</button>
          </form>
        </div>
      </details>
    </li>
  );
}

export function PackageRulesEditor({ packageId, items, rules, subcategories }: { packageId: string; items: PackageLibraryItem[]; rules: PackageRule[]; subcategories: PackageSubcategory[] }) {
  const packageRules = rules.filter((rule) => rule.package_id === packageId);
  return <details className="rounded-lg border border-[#edf1ee] bg-white">
    <summary className="cursor-pointer p-4 font-semibold text-[#18352d]">Itens reutilizáveis e escolhas ({packageRules.length})</summary>
    <div className="space-y-4 border-t border-[#edf1ee] p-4">
      <p className="text-sm text-slate-600">Escolha uma subcategoria, marque os itens e defina quantos o cliente poderá escolher. Mínimo e máximo iguais a zero incluem todos os itens.</p>
      {packageRules.length > 0 && <ul className="grid gap-2 sm:grid-cols-2">{packageRules.map((rule) => <li key={rule.id} className="rounded-lg border border-[#edf1ee] bg-[#fbf8f1] p-3 text-sm"><strong>{rule.title || packageRuleSubcategoryLabel(rule)}</strong><span className="block text-slate-600">{ruleInstruction(rule)} · {rule.event_package_rule_items.length} item(ns)</span></li>)}</ul>}
      {subcategories.length === 0 && <p className="rounded-lg bg-[#fff5e6] p-3 text-sm">Crie uma subcategoria na biblioteca abaixo para começar.</p>}
      <PackageRuleForm items={items} packageId={packageId} subcategories={subcategories} />
      {packageRules.length > 0 && <details className="rounded-lg border border-[#edf1ee] p-3"><summary className="cursor-pointer text-sm font-semibold">Acrescentar item a uma escolha existente</summary><div className="mt-3"><PackageRuleItemForm items={items} rules={packageRules} /></div></details>}
    </div>
  </details>;
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

function PackageRuleForm({ items, packageId, subcategories }: { items: PackageLibraryItem[]; packageId: string; subcategories: PackageSubcategory[] }) {
  const formId = useId();
  const [state, action, pending] = useActionState(createPackageRule, initialState);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState(state.subcategoryId ?? "");
  const availableItems = selectedSubcategoryId ? items.filter((item) => firstRecord(item.event_package_subcategories)?.id === selectedSubcategoryId) : [];
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">Adicionar grupo de itens ao pacote</h3>
      <input type="hidden" name="packageId" value={packageId} />
      <div className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${formId}-subcategory`}>Subcategoria</label>
          <select id={`${formId}-subcategory`} name="subcategoryId" value={selectedSubcategoryId} onChange={(event) => setSelectedSubcategoryId(event.currentTarget.value)} required>
            <option value="">Selecione</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{categoryLabel(subcategory.category)} › {subcategory.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-title`}>Título na proposta</label>
          <input id={`${formId}-title`} name="title" defaultValue={state.title ?? ""} placeholder="Ex.: Escolha os sabores de suco" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-min`}>Mín.</label>
            <input id={`${formId}-min`} name="selectionMin" type="number" min="0" defaultValue={state.selectionMin ?? 0} />
          </div>
          <div>
            <label htmlFor={`${formId}-max`}>Máx.</label>
            <input id={`${formId}-max`} name="selectionMax" type="number" min="0" defaultValue={state.selectionMax ?? 0} />
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
      <button disabled={pending || availableItems.length === 0} className="mt-3 rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Salvando..." : "Adicionar ao pacote"}
      </button>
    </form>
  );
}

function PackageRuleItemForm({ items, rules }: { items: PackageLibraryItem[]; rules: PackageRule[] }) {
  const formId = useId();
  const [state, action, pending] = useActionState(attachPackageRuleItem, initialState);
  const [selectedRuleId, setSelectedRuleId] = useState(state.ruleId ?? "");
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);
  const availableItems = selectedRule ? items.filter((item) => firstRecord(item.event_package_subcategories)?.id === selectedRule.subcategory_id) : [];
  return (
    <form action={action} className="rounded-lg border border-[#d9ded8] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#083653]">Acrescentar item</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor={`${formId}-rule`}>Regra</label>
          <select id={`${formId}-rule`} name="ruleId" value={selectedRuleId} onChange={(event) => setSelectedRuleId(event.currentTarget.value)} required>
            <option value="">Selecione</option>
            {rules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {packageRulePackageName(rule)} › {packageRuleSubcategoryLabel(rule)} · {ruleInstruction(rule)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-item`}>Item</label>
          <select key={selectedRuleId} id={`${formId}-item`} name="itemId" defaultValue="" required disabled={!selectedRule}>
            <option value="">{selectedRule ? "Selecione" : "Escolha primeiro a regra"}</option>
            {availableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {packageItemSubcategoryLabel(item)}{item.name}
              </option>
            ))}
          </select>
        </div>
        <button disabled={pending || !selectedRule || availableItems.length === 0} className="rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Associando..." : "Associar"}
        </button>
      </div>
      <FormMessage state={state} />
    </form>
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
