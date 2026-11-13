import { Mascote } from '../components/Mascote';
import { useState } from 'react';
import { supabase } from '../lib/db';

export function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setMsg(null);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: senha });
        if (error) throw error;
        if (!data.session) setMsg({ tipo: 'ok', texto: 'Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.' });
      }
    } catch (err) {
      const t = err instanceof Error ? err.message : String(err);
      setMsg({ tipo: 'erro', texto: t === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : t });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={enviar}>
        <div className="brand">
          <div className="logo"><Mascote /></div>
          <div>
            <div className="brand-name">Stash</div>
            <div className="muted small">Seu controle financeiro</div>
          </div>
        </div>
        <h2>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</h2>
        <label className="field"><span className="field-label">E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label className="field"><span className="field-label">Senha</span><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} minLength={6} required /></label>
        {msg && <div className={`small ${msg.tipo === 'erro' ? 'neg' : 'pos'}`}>{msg.texto}</div>}
        <button className="btn-primary full" disabled={enviando}>{enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
        <button type="button" className="link" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setMsg(null); }}>
          {modo === 'entrar' ? 'Primeiro acesso? Criar conta' : 'Já tenho conta'}
        </button>
      </form>
    </div>
  );
}
