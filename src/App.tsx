import { Mascote } from './components/Mascote';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Plus, Repeat } from 'lucide-react';
import { PixelIcon, px } from './components/PixelIcon';
import { StoreProvider, useStore } from './store';
import { ModalProvider, useModal } from './components/ui';
import { RecorrenteForm, TransacaoForm } from './components/forms';
import { modoLocal, supabase } from './lib/db';
import { diffDias, hoje, mesAtual, resumoMes, somaMes } from './lib/finance';
import { brl, diaMes, nomeMes } from './lib/format';
import { Dashboard } from './pages/Dashboard';
import { Lancamentos } from './pages/Lancamentos';
import { Cartoes } from './pages/Cartoes';
import { Recorrentes } from './pages/Recorrentes';
import { Contas } from './pages/Contas';
import { Metas } from './pages/Metas';
import { Categorias } from './pages/Categorias';
import { Relatorios } from './pages/Relatorios';
import { Config } from './pages/Config';
import { Login } from './pages/Login';

const MENU = [
  { id: 'visao', label: 'Visão geral', icon: px('grid') },
  { id: 'lancamentos', label: 'Lançamentos', icon: px('lista') },
  { id: 'cartoes', label: 'Cartões', icon: px('cartao') },
  { id: 'fixas', label: 'Contas fixas', icon: px('calendario') },
  { id: 'contas', label: 'Contas e saldos', icon: px('moeda') },
  { id: 'metas', label: 'Metas e reserva', icon: px('coracao') },
  { id: 'relatorios', label: 'Relatórios', icon: px('grafico') },
];
const AJUSTES = [
  { id: 'categorias', label: 'Categorias e orçamento', icon: px('estrela') },
  { id: 'config', label: 'Configurações', icon: px('engrenagem') },
];

function useTema() {
  const [tema, setTema] = useState<'light' | 'dark'>(() => {
    try { return (localStorage.getItem('df-theme') as 'light' | 'dark') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    try { localStorage.setItem('df-theme', tema); } catch { /* */ }
  }, [tema]);
  return [tema, setTema] as const;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checando, setChecando] = useState(!!supabase);
  useTema();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecando(false); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (checando) return <Carregando />;
  if (supabase && !session) return <Login />;
  return (
    <StoreProvider key={session?.user.id ?? 'local'}>
      <ModalProvider>
        <Shell email={session?.user.email} />
      </ModalProvider>
    </StoreProvider>
  );
}

function Shell({ email }: { email?: string }) {
  const { carregando, erro, mes, setMes, mudarMes, toastMsg, recarregar } = useStore();
  const { abrir } = useModal();
  const [tema, setTema] = useTema();
  const [pagina, setPagina] = useState(() => location.hash.slice(1) || 'visao');
  const [menuAdd, setMenuAdd] = useState(false);

  useEffect(() => { location.hash = pagina; window.scrollTo(0, 0); }, [pagina]);

  const ir = (p: string) => setPagina(p);
  const conteudo = (() => {
    switch (pagina) {
      case 'lancamentos': return <Lancamentos />;
      case 'cartoes': return <Cartoes />;
      case 'fixas': return <Recorrentes />;
      case 'contas': return <Contas />;
      case 'metas': return <Metas />;
      case 'relatorios': return <Relatorios />;
      case 'categorias': return <Categorias />;
      case 'config': return <Config email={email} />;
      default: return <Dashboard irPara={ir} />;
    }
  })();

  const add = (n: React.ReactNode) => { setMenuAdd(false); abrir(n); };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo"><Mascote /></div>
          <div>
            <div className="brand-name">Stash</div>
            <div className="muted small">Controle financeiro</div>
          </div>
        </div>
        <Nav title="Menu" items={MENU} pagina={pagina} ir={ir} />
        <Nav title="Ajustes" items={AJUSTES} pagina={pagina} ir={ir} />
        <div className="sidebar-spacer" />
        <div className="theme-row">
          <span className="nav-item-static"><PixelIcon name={tema === 'light' ? 'sol' : 'lua'} size={15} /> Tema</span>
          <div className="theme-toggle">
            <button className={tema === 'light' ? 'on' : ''} onClick={() => setTema('light')} aria-label="Tema claro"><PixelIcon name="sol" size={13} /></button>
            <button className={tema === 'dark' ? 'on' : ''} onClick={() => setTema('dark')} aria-label="Tema escuro"><PixelIcon name="lua" size={13} /></button>
          </div>
        </div>
        <button className="profile" onClick={() => ir('config')}>
          <span className="av av-blue lg">{(email ?? 'V')[0].toUpperCase()}</span>
          <div>
            <div className="strong small ellipsis">{email ?? 'Você'}</div>
            <div className={`tiny ${modoLocal ? 'warn' : 'pos'}`}>
              <span className={`dot ${modoLocal ? 'dot-warn' : 'green'}`} /> {modoLocal ? 'Modo local' : 'Salvo na nuvem'}
            </div>
          </div>
        </button>
      </aside>

      <main className="main">
        <header className="topbar card">
          <div className="month-nav">
            <button className="icon-btn" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
            <button className="icon-btn" onClick={() => mudarMes(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
            <label className="month-pick">
              <h1>{nomeMes(mes).split(' ')[0]} <span className="muted">{mes.slice(0, 4)}</span> <ChevronDown size={16} className="muted" /></h1>
              <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Escolher mês" />
            </label>
            {mes !== mesAtual() && <button className="ghost sm" onClick={() => setMes(mesAtual())}>Hoje</button>}
          </div>
          <div className="top-actions">
            <Alertas />
            <div className="split-btn">
              <button className="primary" onClick={() => add(<TransacaoForm />)}><Plus size={15} /> <span className="hide-sm">Adicionar</span></button>
              <button className="primary caret" onClick={() => setMenuAdd((v) => !v)} aria-label="Mais opções"><ChevronDown size={15} /></button>
              {menuAdd && (
                <>
                  <div className="click-away" onClick={() => setMenuAdd(false)} />
                  <div className="dropdown">
                    <button onClick={() => add(<TransacaoForm tipoInicial="despesa" />)}>Despesa</button>
                    <button onClick={() => add(<TransacaoForm tipoInicial="receita" />)}>Receita</button>
                    <button onClick={() => add(<TransacaoForm tipoInicial="despesa" cartaoInicial="__primeiro" />)}><CreditCard size={14} /> Compra no cartão</button>
                    <button onClick={() => add(<TransacaoForm tipoInicial="transferencia" />)}><ArrowLeftRight size={14} /> Transferência</button>
                    <button onClick={() => add(<RecorrenteForm />)}><Repeat size={14} /> Conta fixa</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {modoLocal && pagina === 'visao' && (
          <div className="banner">⚠️ Modo local: seus dados estão só neste navegador. Siga o README para conectar ao Supabase e salvar na nuvem.</div>
        )}

        {carregando ? (
          <div className="card loading-card"><Mascote animacao="pula" className="mascote-load" /><span>Carregando seus dados…</span></div>
        ) : erro ? (
          <div className="card loading-card">
            <div className="neg strong">Não foi possível carregar os dados</div>
            <div className="muted small">{erro}</div>
            <div className="muted small">Verifique se você rodou o arquivo supabase/schema.sql no Supabase.</div>
            <button className="ghost mt" onClick={() => recarregar()}>Tentar de novo</button>
          </div>
        ) : conteudo}
      </main>
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </div>
  );
}

function Nav({ title, items, pagina, ir }: { title: string; items: typeof MENU; pagina: string; ir: (p: string) => void }) {
  return (
    <nav className="nav">
      <div className="nav-title">{title}</div>
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} className={`nav-item ${pagina === id ? 'active' : ''}`} onClick={() => ir(id)}>
          <Icon size={15} /> <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/** Sino: contas atrasadas ou vencendo nos próximos 3 dias (mês atual e anterior). */
function Alertas() {
  const { dados } = useStore();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hj = hoje();
  const itens = useMemo(() => {
    const m = mesAtual();
    return [...resumoMes(dados, somaMes(m, -1)).aPagar, ...resumoMes(dados, m).aPagar, ...resumoMes(dados, somaMes(m, 1)).aPagar]
      .filter((i) => !i.pago && diffDias(hj, i.data) <= 3);
  }, [dados, hj]);
  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn bell" aria-label="Alertas" onClick={() => setAberto((v) => !v)}>
        <PixelIcon name="sino" size={18} />
        {itens.length > 0 && <span className="badge">{itens.length}</span>}
      </button>
      {aberto && (
        <>
          <div className="click-away" onClick={() => setAberto(false)} />
          <div className="dropdown wide">
            <div className="dd-title">Vencendo e atrasadas</div>
            {itens.length === 0 ? <div className="muted small pad">Tudo em dia 🎉</div> : itens.map((i) => (
              <div key={i.id} className="dd-row">
                <span className="grow">{i.descricao}<div className={`tiny ${i.data < hj ? 'neg' : 'muted'}`}>{i.data < hj ? 'atrasada · ' : ''}{diaMes(i.data)}</div></span>
                <b>{brl(i.valor)}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Carregando() {
  return (
    <div className="loading">
      <div className="loading-inner"><Mascote animacao="pula" className="mascote-load" /><span>Carregando…</span></div>
    </div>
  );
}
