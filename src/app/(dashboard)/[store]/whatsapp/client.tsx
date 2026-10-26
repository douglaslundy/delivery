"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Feedback, useAction } from "../feedback";

type Instance = {
  evolutionInstanceName: string;
  evolutionApiUrl: string;
  connected: boolean;
  botEnabled: boolean;
  botGreeting: string | null;
} | null;

export default function WhatsappClient() {
  const { store: storeId } = useParams<{ store: string }>();
  const base = `/api/stores/${storeId}/whatsapp`;

  const [instance, setInstance] = useState<Instance>(null);
  const [form, setForm] = useState({ evolutionApiUrl: "https://ev.dlsistemas.com.br", apiKey: "", evolutionInstanceName: "" });
  const [qr, setQr] = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");
  const connect = useAction();
  const bot = useAction();
  const manage = useAction();
  const [webhookWarning, setWebhookWarning] = useState<string | null>(null);

  const loadInstance = useCallback(async () => {
    const res = await fetch(base);
    const data: Instance = res.ok ? await res.json() : null;
    setInstance(data);
    if (data) {
      setGreeting(data.botGreeting ?? "");
      setForm((f) => ({ ...f, evolutionApiUrl: data.evolutionApiUrl, evolutionInstanceName: data.evolutionInstanceName }));
    }
  }, [base]);

  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  const showQr = useCallback(async () => {
    const res = await fetch(`${base}/qr`);
    const data = await res.json().catch(() => ({}));
    setQr(res.ok ? data.base64 : null);
  }, [base]);

  // Enquanto desconectado, atualiza o status e o QR a cada 4s.
  useEffect(() => {
    if (!instance || instance.connected) return;
    const tick = async () => {
      const res = await fetch(`${base}/status`);
      if (res.ok) {
        const { connected } = await res.json();
        if (connected) {
          setQr(null);
          loadInstance();
          return;
        }
      }
      showQr();
    };
    tick();
    const timer = setInterval(tick, 4000);
    return () => clearInterval(timer);
  }, [instance, base, loadInstance, showQr]);

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    setWebhookWarning(null);
    const ok = await connect.run(
      async () => {
        const res = await fetch(`${base}/create-instance`, { method: "POST", body: JSON.stringify(form) });
        res.clone().json().then((d) => setWebhookWarning(d.webhookWarning ?? null)).catch(() => {});
        return res;
      },
      "Instância criada! Escaneie o QR code abaixo.",
    );
    if (ok) {
      setForm((f) => ({ ...f, apiKey: "" }));
      loadInstance();
    }
  }

  async function manageInstance(label: string, request: () => Promise<Response>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const ok = await manage.run(request, label);
    if (ok) {
      setQr(null);
      loadInstance();
    }
  }

  const restartInstance = () =>
    manageInstance("Instância reiniciada.", () => fetch(`${base}/restart`, { method: "POST" }));
  const disconnectInstance = () =>
    manageInstance("WhatsApp desconectado. Escaneie o novo QR code para reconectar.", () => fetch(`${base}/disconnect`, { method: "POST" }), "Desconectar o WhatsApp desta loja? Será preciso escanear o QR code de novo.");
  const deleteInstance = (local = false) =>
    manageInstance("Instância excluída.", () => fetch(`${base}${local ? "?local=1" : ""}`, { method: "DELETE" }), local ? "Remover a instância só deste painel? Ela continuará existindo na Evolution." : "Excluir a instância? Ela será apagada na Evolution e o bot deixa de funcionar.");

  function saveBot(patch: { botEnabled?: boolean; botGreeting?: string | null }) {
    return bot.run(async () => {
      const res = await fetch(`${base}/bot`, { method: "PATCH", body: JSON.stringify(patch) });
      if (res.ok) loadInstance();
      return res;
    });
  }

  return (
    <main>
      <h1>WhatsApp e Bot</h1>
      <p>Conecte o número da loja pela Evolution API e configure o atendimento automático.</p>

      <section>
        <h2>1. Dados da Evolution API</h2>
        <form onSubmit={createInstance}>
          <label>
            URL da Evolution
            <input value={form.evolutionApiUrl} onChange={(e) => setForm({ ...form, evolutionApiUrl: e.target.value })} required />
          </label>
          <label>
            API key
            <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={instance ? "(guardada — digite para trocar)" : ""} required />
          </label>
          <label>
            Nome da instância
            <input value={form.evolutionInstanceName} onChange={(e) => setForm({ ...form, evolutionInstanceName: e.target.value })} required />
          </label>
          <Feedback msg={connect.msg} />
          {webhookWarning && <p role="status" className="badge warn">{webhookWarning}</p>}
          <button type="submit" disabled={connect.busy}>{connect.busy ? "Conectando..." : "Criar / conectar instância"}</button>
        </form>
      </section>

      <section>
        <h2>2. Conexão</h2>
        {!instance ? (
          <p className="empty">Preencha os dados acima para gerar o QR code.</p>
        ) : instance.connected ? (
          <p><span className="badge ok">Conectado</span> {instance.evolutionInstanceName}</p>
        ) : (
          <>
            <p><span className="badge warn">Desconectado</span> Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar e escaneie:</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="qr" src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR code do WhatsApp" />
            ) : (
              <p className="empty">Aguardando QR code...</p>
            )}
          </>
        )}
        {instance && (
          <div>
            <button type="button" disabled={manage.busy} onClick={restartInstance}>Reiniciar</button>
            {instance.connected && (
              <button type="button" disabled={manage.busy} onClick={disconnectInstance}>Desconectar</button>
            )}
            <button type="button" disabled={manage.busy} onClick={() => deleteInstance()}>Excluir instância</button>
            <button type="button" disabled={manage.busy} onClick={() => deleteInstance(true)}>Remover só do painel</button>
            <Feedback msg={manage.msg} />
          </div>
        )}
      </section>

      {instance && (
        <section>
          <h2>3. Bot de atendimento</h2>
          <label>
            <input type="checkbox" checked={instance.botEnabled} disabled={bot.busy} onChange={(e) => saveBot({ botEnabled: e.target.checked })} />
            Bot ligado
          </label>
          <div>
            <input style={{ flex: 1, minWidth: 260 }} placeholder="Mensagem padrão de resposta" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
            <button type="button" disabled={bot.busy} onClick={() => saveBot({ botGreeting: greeting })}>{bot.busy ? "Salvando..." : "Salvar mensagem"}</button>
          </div>
          <Feedback msg={bot.msg} />
          <p className="hint" style={{ marginTop: 12, color: "var(--muted)" }}>
            Para receber mensagens, a Evolution precisa alcançar este painel por uma URL pública (webhook). Em rede local só o envio funciona.
          </p>
        </section>
      )}
    </main>
  );
}
