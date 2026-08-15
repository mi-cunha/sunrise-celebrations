"use client";

import { useActionState } from "react";
import { permissions } from "@/lib/domain/lead";
import { updateUserAccess, type UserAccessFormState } from "./actions";

const initialState: UserAccessFormState = {};

const permissionLabels: Record<string, { label: string; description: string }> = {
  atendimento: { label: "Atendimento", description: "Pode criar contatos, atender conversas e movimentar a jornada." },
  financeiro: { label: "Financeiro", description: "Reservado para rotinas financeiras futuras." },
  gerencia: { label: "Gerência", description: "Reservado para supervisão e relatórios futuros." },
  admin_owner: { label: "Admin owner", description: "Pode administrar opções e usuários." },
};

type UserValue = { id: string; display_name: string | null; is_active: boolean; permissions: string[] };

export function UserAccessForm({ user, mode = "edit" }: { user?: UserValue; mode?: "create" | "edit" }) {
  const [state, action, pending] = useActionState(updateUserAccess, initialState);
  const selectedPermissions = user?.permissions ?? [];
  const values = state.values;
  const fieldErrors = state.fieldErrors ?? {};
  const formId = user?.id ?? "new";
  const isCreate = mode === "create";

  const form = (
    <form key={state.version ?? user?.id ?? "new-user"} action={action} className={isCreate ? "space-y-5" : "mt-5 space-y-5 border-t border-slate-100 pt-5"}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`user-id-${formId}`}>UUID do usuário Auth</label>
          <input
            id={`user-id-${formId}`}
            name="userId"
            required
            readOnly={Boolean(user)}
            placeholder="Ex.: 8b62eaa0-..."
            defaultValue={values?.userId ?? user?.id ?? ""}
            className={fieldErrors.userId ? "border-red-500 bg-red-50" : ""}
          />
          {fieldErrors.userId?.[0] ? <p className="mt-1 text-sm text-red-700">{fieldErrors.userId[0]}</p> : <p className="mt-1 text-xs text-slate-500">Copie do painel Authentication → Users no Supabase.</p>}
        </div>
        <div>
          <label htmlFor={`display-name-${formId}`}>Nome exibido</label>
          <input
            id={`display-name-${formId}`}
            name="displayName"
            required
            placeholder="Ex.: Noemi"
            defaultValue={values?.displayName ?? user?.display_name ?? ""}
            className={fieldErrors.displayName ? "border-red-500 bg-red-50" : ""}
          />
          {fieldErrors.displayName?.[0] && <p className="mt-1 text-sm text-red-700">{fieldErrors.displayName[0]}</p>}
        </div>
      </div>

      <fieldset>
        <legend className="font-semibold text-[#18352d]">Permissões</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {permissions.map((permission) => {
            const label = permissionLabels[permission];
            return (
              <label key={permission} className="flex cursor-pointer gap-3 rounded-xl border border-[#dbe3dc] p-3 transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7]">
                <input type="checkbox" name="permissions" value={permission} defaultChecked={selectedPermissions.includes(permission)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block text-sm font-semibold text-[#18352d]">{label.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{label.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {fieldErrors.permissions?.[0] && <p className="mt-2 text-sm text-red-700">{fieldErrors.permissions[0]}</p>}
      </fieldset>

      <label className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#dbe3dc] px-3 py-2 text-sm font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7]">
        <input type="checkbox" name="isActive" defaultChecked={user?.is_active ?? true} className="h-4 w-4 shrink-0" />
        Usuário ativo
      </label>

      {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
      {state.success && <p role="status" className="rounded-lg bg-[#edf5ee] p-3 text-sm text-[#356451]">{state.success}</p>}
      <button disabled={pending} className="rounded-lg bg-[#18352d] px-5 py-3 font-semibold text-white transition hover:bg-[#23483d] active:scale-[0.99] disabled:opacity-60">
        {pending ? "Salvando..." : user ? "Salvar alterações" : "Adicionar usuário"}
      </button>
    </form>
  );

  if (isCreate) return form;

  return (
    <article className="rounded-xl border border-[#dbe3dc] bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[#18352d]">{user?.display_name ?? "Usuário sem nome"}</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user?.is_active ? "bg-[#edf5ee] text-[#356451]" : "bg-red-50 text-red-700"}`}>
              {user?.is_active ? "ativo" : "inativo"}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-slate-500">{user?.id}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedPermissions.length ? (
              selectedPermissions.map((permission) => (
                <span key={permission} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                  {permissionLabels[permission]?.label ?? permission}
                </span>
              ))
            ) : (
              <span className="rounded-full bg-[#fff5e6] px-2 py-0.5 text-xs font-semibold text-[#744c15]">sem permissões</span>
            )}
          </div>
        </div>
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer rounded-lg border border-[#dbe3dc] px-4 py-2 text-center text-sm font-semibold text-[#18352d] transition hover:border-[#b7c8bb] hover:bg-[#f6fbf7]">
          Editar acesso
        </summary>
        {form}
      </details>
    </article>
  );
}
