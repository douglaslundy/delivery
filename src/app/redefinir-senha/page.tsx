"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function Form() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) setDone(true);
    else setError((await res.json().catch(() => null))?.error ?? "Não foi possível redefinir");
  }

  if (done) return <p className="sub">Senha alterada. <Link href="/login">Entrar</Link></p>;
  return (
    <form onSubmit={submit}>
      <label>
        Nova senha (mínimo 8 caracteres)
        <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit">Salvar nova senha</button>
    </form>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Delivery
        </div>
        <h1>Nova senha</h1>
        <Suspense>
          <Form />
        </Suspense>
      </div>
    </div>
  );
}
