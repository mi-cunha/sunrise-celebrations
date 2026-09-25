// Keep OAuth codes in memory only; do not log or retry one-use exchanges.
export async function finalizeWhatsApp(
  input: { code: string; wabaId?: string; phoneNumberId?: string },
  importHistory: boolean,
  request: typeof fetch = fetch,
) {
  const response = await request("/api/whatsapp/connect", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  });
  const result = await response.json() as { connected?: boolean; error?: string };
  if (!response.ok || !result.connected) throw new Error(result.error ?? "Não foi possível confirmar a conexão.");
  if (!importHistory) return { connected: true, syncAccepted: false };
  try {
    const sync = await request("/api/whatsapp/sync", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }),
    });
    const data = await sync.json() as { accepted?: boolean; error?: string };
    if (!sync.ok || !data.accepted) throw new Error(data.error ?? "A importação não foi confirmada.");
    return { connected: true, syncAccepted: true };
  } catch (error) {
    return { connected: true, syncAccepted: false, syncError: error instanceof Error ? error.message : "Importação sem confirmação. Verifique antes de repetir." };
  }
}
