"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

type Preference = { sound_enabled: boolean; browser_enabled: boolean };
type IncomingMessage = { id: string; body: string; conversation_id: string; created_at: string; conversations: { assigned_to: string | null; leads: { name: string | null } | null } | null };

export function InboxNotifications({ userId, enabled, preference }: { userId: string; enabled: boolean; preference: Preference | null }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<Preference>(preference ?? { sound_enabled: true, browser_enabled: false });
  const [unread, setUnread] = useState(0);
  const latest = useRef(new Date().toISOString());
  const audioReady = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();
    const poll = async () => {
      const { data } = await supabase.from("conversation_messages")
        .select("id,body,conversation_id,created_at,conversations!inner(assigned_to,leads(name))")
        .eq("author", "cliente").eq("direction", "inbound").gt("created_at", latest.current).order("created_at", { ascending: true }).limit(25);
      const messages = (data ?? []) as unknown as IncomingMessage[];
      if (messages.length) latest.current = messages[messages.length - 1].created_at;
      for (const message of messages) {
        const conversation = message.conversations;
        const shouldNotify = conversation && (conversation.assigned_to === userId || conversation.assigned_to === null);
        const viewingConversation = pathname === `/atendimentos/${message.conversation_id}`;
        if (!shouldNotify || viewingConversation) continue;
        setUnread((value) => value + 1);
        const contact = conversation.leads?.name || "Novo contato";
        if (settings.sound_enabled && audioReady.current) playNotificationTone();
        if (settings.browser_enabled && document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(`Nova mensagem de ${contact}`, { body: message.body.slice(0, 180), tag: message.conversation_id });
      }
    };
    const interval = window.setInterval(() => void poll(), 20000);
    return () => window.clearInterval(interval);
  }, [enabled, pathname, settings.browser_enabled, settings.sound_enabled, userId]);

  if (!enabled) return null;
  async function save(next: Preference) {
    setSettings(next);
    await createClient().from("user_notification_preferences").upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() });
  }
  async function enableBrowser() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    await save({ ...settings, browser_enabled: permission === "granted" });
  }

  return <details className="relative">
    <summary onClick={() => { audioReady.current = true; }} className="relative cursor-pointer list-none rounded-lg border border-[#dbe3dc] bg-white px-3 py-2 text-sm font-semibold text-[#18352d] hover:bg-[#f6fbf7]" aria-label="Notificações">🔔{unread > 0 && <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">{unread > 9 ? "9+" : unread}</span>}</summary>
    <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#dbe3dc] bg-white p-4 shadow-lg">
      <div className="flex items-center justify-between gap-3"><p className="font-semibold">Alertas da Inbox</p>{unread > 0 && <Link onClick={() => setUnread(0)} href="/atendimentos" className="text-sm font-semibold text-[#0f5f8f] underline">Ver {unread}</Link>}</div>
      <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={settings.sound_enabled} onChange={(event) => void save({ ...settings, sound_enabled: event.currentTarget.checked })} /> Som ao chegar mensagem</label>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={settings.browser_enabled} onChange={(event) => event.currentTarget.checked ? void enableBrowser() : void save({ ...settings, browser_enabled: false })} /> Notificação do navegador</label>
      <p className="mt-3 text-xs text-slate-500">O som é ativado após sua interação nesta página. Alertas do navegador só aparecem com sua permissão.</p>
    </div>
  </details>;
}

function playNotificationTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 740; gain.gain.setValueAtTime(0.04, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.16);
  } catch { /* Browser policy can still deny sound. */ }
}
