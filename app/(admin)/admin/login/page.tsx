'use client';

import { useActionState } from 'react';
import { loginAction } from '../actions';

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, null);
  return (
    <main className="admin-login">
      <section className="admin-login-brand">
        <div className="admin-brand">
          <span className="admin-brand-mark">E</span>EIXU
        </div>
        <div className="admin-login-story">
          <p className="admin-label">Painel interno</p>
          <h1>Seus clientes, um agente e o próximo site no ar.</h1>
          <p>
            Cadastre o cliente, converse com o agente, revise as imagens e
            acompanhe o tráfego. Toda a operação em um só lugar.
          </p>
        </div>
        <p className="admin-login-meta">
          EIXU <span>acesso restrito</span>
        </p>
      </section>
      <section className="admin-login-entry">
        <form action={formAction}>
          <div className="admin-brand">
            <span className="admin-brand-mark">E</span>
            <span>
              EIXU<small>painel interno</small>
            </span>
          </div>
          <h2>Entrar</h2>
          <p>Use a credencial da operação para acessar o painel.</p>
          <label className="admin-field">
            <span>Usuário</span>
            <input
              name="user"
              autoComplete="username"
              required
              className="admin-input"
            />
          </label>
          <label className="admin-field">
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="admin-input"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </label>
          {error ? (
            <p id="login-error" role="alert" className="admin-login-error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className="admin-primary">
            {pending ? 'Entrando…' : 'Entrar no painel'}
          </button>
          <p className="admin-login-note">
            Painel interno da EIXU. Acesso restrito à operação, sem cadastro
            aberto.
          </p>
        </form>
      </section>
    </main>
  );
}
