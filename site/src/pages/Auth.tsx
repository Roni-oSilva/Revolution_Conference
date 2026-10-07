import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Page } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { isConfigured } from "@/lib/supabase";

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return setErr("Backend não configurado.");
    const r = await signIn(f.email.trim(), f.password);
    r ? setErr(r) : nav("/comunidade");
  };
  return (
    <Page title="Entrar">
      <form onSubmit={submit} className="max-w-sm space-y-3">
        <input className="input w-full" type="email" placeholder="E-mail" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input w-full" type="password" placeholder="Senha" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        {err && <p role="alert" className="text-yellow-300">{err}</p>}
        <button className="btn">Entrar</button>
        <p>Novo por aqui? <Link to="/cadastro" className="underline">Criar conta</Link></p>
      </form>
    </Page>
  );
}

export function Signup() {
  const { signUp } = useAuth();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) return setErr("Backend não configurado.");
    if (f.name.trim().length < 2) return setErr("Informe seu nome.");
    if (f.password.length < 8) return setErr("A senha precisa ter ao menos 8 caracteres.");
    if (f.password !== f.confirm) return setErr("As senhas não conferem.");
    const r = await signUp(f.name, f.email.trim(), f.password);
    r ? setErr(r) : setOk(true);
  };
  if (ok) return <Page title="Conta criada"><p>Verifique seu e-mail para confirmar o cadastro (se a confirmação estiver ativada) e depois <Link to="/login" className="underline">entre</Link>.</p></Page>;
  return (
    <Page title="Criar conta">
      <form onSubmit={submit} className="max-w-sm space-y-3">
        <input className="input w-full" placeholder="Nome (aparece nos comentários)" maxLength={80} required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input w-full" type="email" placeholder="E-mail (nunca é exibido)" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="input w-full" type="password" placeholder="Senha" autoComplete="new-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <input className="input w-full" type="password" placeholder="Confirmar senha" autoComplete="new-password" required value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        {err && <p role="alert" className="text-yellow-300">{err}</p>}
        <button className="btn">Cadastrar</button>
        <p>Já tem conta? <Link to="/login" className="underline">Entrar</Link></p>
      </form>
    </Page>
  );
}
