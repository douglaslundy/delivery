"use client";

import { useState } from "react";

export type Msg = { kind: "ok" | "err"; text: string } | null;

// Envolve um salvamento: trava duplo clique, e mostra sucesso/erro. fn pode devolver um Response para checar res.ok.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function run(fn: () => Promise<Response | void>, okText = "Salvo!"): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fn();
      if (res && !res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg({ kind: "err", text: data.error ?? `Erro ${res.status}` });
        return false;
      }
      setMsg({ kind: "ok", text: okText });
      return true;
    } catch {
      setMsg({ kind: "err", text: "Falha de conexao com o servidor" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, msg, run, setMsg };
}

export function Feedback({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.kind === "err" ? "alert" : "status"} className={msg.kind === "ok" ? "notice-ok" : undefined}>
      {msg.text}
    </p>
  );
}
