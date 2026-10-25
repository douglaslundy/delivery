export default function EsqueciSenhaPage() {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">🛵</span>
          Delivery
        </div>
        <h1>Esqueci minha senha</h1>
        <p className="sub">
          Ainda não enviamos e-mails de recuperação. Fale com o suporte da plataforma: um administrador pode redefinir a
          senha do dono da loja, e o dono redefine a dos demais usuários em Equipe.
        </p>
        <a href="/login">← Voltar ao login</a>
      </div>
    </div>
  );
}
