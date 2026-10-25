"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setSent(true);
    else setError((await res.json().catch(() => null))?.error ?? "Não foi possível enviar");
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Delivery
        </div>
        <h1>Esqueci minha senha</h1>
        {sent ? (
          <p className="sub">Se o e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Ele vale por 1 hora.</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            {error && <p role="alert">{error}</p>}
            <button type="submit">Enviar link</button>
          </form>
        )}
        <Link href="/login">← Voltar ao login</Link>
      </div>
    </div>
  );
}
