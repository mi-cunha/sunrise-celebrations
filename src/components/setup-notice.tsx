export function SetupNotice() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f5f8f]">Sunrise OS</p>
      <h1 className="mt-3 text-2xl font-semibold text-[#092f38]">Conecte o Supabase para começar.</h1>
      <p className="mt-3 text-sm leading-6 text-[#5f7180]">
        Copie <code>.env.example</code> para <code>.env.local</code>, preencha as variáveis públicas e aplique as migrations em <code>supabase/migrations</code>.
      </p>
    </main>
  );
}
