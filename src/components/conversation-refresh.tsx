"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ConversationRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !pending) startTransition(() => router.refresh()); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [router, pending]);
  return <span className="text-xs text-slate-500">{pending ? "Atualizando mensagens…" : "Atualização automática a cada 5 segundos"}</span>;
}
