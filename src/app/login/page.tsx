"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await signIn("credentials", { email, password, redirect: false });
    if (!result || result.error) {
      setError("Email ou senha invalidos.");
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- navegacao completa recarrega a sessao
    window.location.href = "/store-picker";
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Delivery
        </div>
        <h1>Entrar</h1>
        <p className="sub">Acesse o painel da sua loja.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Senha
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">Entrar</button>
        </form>
        <p className="sub"><Link href="/esqueci-senha">Esqueci minha senha</Link></p>
      </div>
    </div>
  );
}
