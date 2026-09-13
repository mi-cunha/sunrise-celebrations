"use client";

import { useEffect, useRef, useState } from "react";
import { whatsappSdkOptions, whatsappSignupOptions } from "@/lib/whatsapp-sdk";

type Connection = {
  id: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  status: string;
  business_app_state: string | null;
  history_sync_status: string;
  history_sync_progress: number | null;
  connected_at: string | null;
};

type FacebookLoginResponse = { authResponse?: { code?: string }; status?: string };
type FacebookSdk = {
  init(options: ReturnType<typeof whatsappSdkOptions>): void;
  login(callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppConnectionPanel({ appId, configId, connection, graphVersion }: { appId: string; configId: string; connection: Connection | null; graphVersion: string }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [preflightReady, setPreflightReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const configurationReady = Boolean(appId && configId && graphVersion);

  useEffect(() => {
    if (!configurationReady) return;
    let active = true;
    void fetch("/api/whatsapp/connect", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.ready || result.appId !== appId || result.configId !== configId) throw new Error(result.error ?? "Configuração do navegador diferente do servidor. Faça um novo deploy.");
      if (active) setPreflightReady(true);
    }).catch((error) => { if (active) setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível verificar a configuração." }); });
    const handleMessage = (event: MessageEvent) => {
      let hostname: string;
      try { const url = new URL(event.origin); if (url.protocol !== "https:") return; hostname = url.hostname; } catch { return; }
      if (hostname !== "facebook.com" && !hostname.endsWith(".facebook.com")) return;
      let payload: unknown = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      if (!payload || typeof payload !== "object") return;
      const message = payload as { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string } };
      const completedEvents = ["FINISH", "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"];
      if (message.type !== "WA_EMBEDDED_SIGNUP" || !message.event || !completedEvents.includes(message.event)) return;
      if (!/^\d+$/.test(message.data?.waba_id ?? "")) return;
      signupData.current = { wabaId: message.data?.waba_id, phoneNumberId: message.data?.phone_number_id };
    };
    window.addEventListener("message", handleMessage);
    window.fbAsyncInit = () => {
      window.FB?.init(whatsappSdkOptions(appId, graphVersion));
      setSdkReady(true);
    };
    if (window.FB) window.fbAsyncInit();
    else if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/pt_BR/sdk.js";
      document.body.appendChild(script);
    }
    return () => { active = false; window.removeEventListener("message", handleMessage); };
  }, [appId, configId, configurationReady, graphVersion]);

  function startConnection() {
    if (!window.FB || !sdkReady || !preflightReady) {
      setFeedback({ type: "error", message: "A conexão com a Meta ainda está carregando. Aguarde alguns segundos e tente novamente." });
      return;
    }
    setConnecting(true);
    setFeedback(null);
    signupData.current = {};
    window.FB.login((response) => {
      void finishConnection(response);
    }, whatsappSignupOptions(configId));
  }

  async function finishConnection(response: FacebookLoginResponse) {
    const code = response.authResponse?.code;
    if (!code) {
      setConnecting(false);
      setFeedback({ type: "error", message: "O cadastro foi cancelado ou a Meta não autorizou a conexão. Nenhum código foi enviado ao servidor." });
      return;
    }
    const { wabaId, phoneNumberId } = await waitForSignupData(signupData);
    if (!code || !wabaId) {
      setConnecting(false);
      const missing = !code && !wabaId ? "o código e os identificadores" : !code ? "o código de autorização" : "os identificadores do WhatsApp";
      setFeedback({ type: "error", message: `A Meta não retornou ${missing}. Finalize todas as etapas e leia o QR Code no WhatsApp Business.` });
      return;
    }
    try {
      const result = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wabaId, phoneNumberId }),
      });
      const data = await result.json() as { connected?: boolean; error?: string };
      if (!result.ok || !data.connected) throw new Error(data.error ?? "Não foi possível confirmar a conexão.");
      setFeedback({ type: "success", message: "WhatsApp Business conectado. Atualizando os dados…" });
      window.location.reload();
    } catch (error) {
      setConnecting(false);
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível concluir a conexão." });
    }
  }

  const connected = connection?.status === "connected";
  async function startSync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/whatsapp/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Não foi possível sincronizar.");
      setFeedback({ type: "success", message: "Solicitações aceitas. Mantenha o WhatsApp Business aberto; os dados chegarão por webhook." });
    } catch (error) { setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha na sincronização." }); }
    finally { setSyncing(false); }
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Status label="Situação" value={connected ? "Conectado" : connection?.status === "error" ? "Com erro" : "Não conectado"} tone={connected ? "success" : "neutral"} />
        <Status label="Número" value={connection?.display_phone_number ?? "Será identificado pela Meta"} />
        <Status label="Aplicativo" value={connection?.business_app_state ?? (connected ? "Coexistence" : "—")} />
        <Status label="Histórico" value={historyLabel(connection)} />
      </div>

      {connected && (
        <dl className="grid gap-x-5 gap-y-2 rounded-lg border border-[#d9ded8] bg-white p-3 text-xs sm:grid-cols-2">
          <div><dt className="text-[#5f7180]">WABA ID</dt><dd className="mt-0.5 break-all font-medium text-[#092f38]">{connection.waba_id ?? "Não informado"}</dd></div>
          <div><dt className="text-[#5f7180]">Phone Number ID</dt><dd className="mt-0.5 break-all font-medium text-[#092f38]">{connection.phone_number_id ?? "Não informado"}</dd></div>
        </dl>
      )}

      {!configurationReady && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Faltam as configurações públicas do Embedded Signup na Vercel. O botão será liberado depois do próximo passo na Meta.</p>}
      {feedback && <p className={`rounded-lg p-3 text-sm ${feedback.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{feedback.message}</p>}

      {configurationReady && !connected && (
        <p className="text-xs text-[#5f7180]">
          Meta App ID: <span className="font-medium text-[#092f38]">{appId}</span> · Configuration ID: <span className="font-medium text-[#092f38]">{configId}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={startConnection} disabled={!configurationReady || connecting || !sdkReady || !preflightReady} className="rounded-lg bg-[#083653] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {connecting ? "Conectando…" : connected ? "Reconectar WhatsApp" : "Conectar WhatsApp"}
        </button>
        <p className="text-xs text-[#5f7180]">O QR Code será exibido pela Meta. Nenhuma senha do WhatsApp será armazenada no Sunrise OS.</p>
      </div>
      <p className="text-xs text-amber-800">Antes de finalizar na Meta: a coexistência pode desconectar dispositivos vinculados e alterar recursos como listas de transmissão. Confirme essas mudanças com o responsável pelo número; não desinstale o WhatsApp Business.</p>
      <p className="text-xs text-[#5f7180]">MVP de validação: nenhuma resposta automática. “Conectado” confirma Business App + Cloud API e inscrição da WABA; envio, recebimento e espelhamento ainda precisam de teste real.</p>
      {connected && <div className="rounded-lg border border-[#d9ded8] p-3 text-sm">
        <p>Importar contatos e histórico autorizado no cadastro (até 180 dias). Inicie até 24 horas após o onboarding e mantenha o WhatsApp Business aberto. A solicitação não será repetida automaticamente.</p>
        <button type="button" disabled={syncing} onClick={startSync} className="mt-2 rounded-lg border px-3 py-2 disabled:opacity-50">{syncing ? "Solicitando…" : "Solicitar importação de contatos e histórico"}</button>
      </div>}
    </div>
  );
}

async function waitForSignupData(reference: { current: { wabaId?: string; phoneNumberId?: string } }) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (reference.current.wabaId) return reference.current;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return reference.current;
}

function Status({ label, tone = "neutral", value }: { label: string; tone?: "neutral" | "success"; value: string }) {
  return <div className={`rounded-lg border p-3 ${tone === "success" ? "border-emerald-200 bg-emerald-50" : "border-[#d9ded8] bg-white"}`}><p className="text-xs text-[#5f7180]">{label}</p><p className="mt-1 text-sm font-semibold text-[#092f38]">{value}</p></div>;
}

function historyLabel(connection: Connection | null) {
  if (!connection) return "Não iniciado";
  if (connection.history_sync_status === "completed") return "Importado";
  if (connection.history_sync_status === "declined") return "Não autorizado";
  if (connection.history_sync_status === "in_progress") return `${connection.history_sync_progress ?? 0}%`;
  return "Pendente";
}
