import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as db from './lib/db';
import { mesAtual, somaMes } from './lib/finance';
import { TABELAS, type Dados, type Tabela } from './lib/types';

const VAZIO: Dados = { categorias: [], contas: [], cartoes: [], recorrentes: [], transacoes: [], metas: [] };

const CATEGORIAS_PADRAO = [
  { nome: 'Salário', tipo: 'receita', cor: '#5d9d6a' },
  { nome: 'Freelance / extra', tipo: 'receita', cor: '#5fa8a0' },
  { nome: 'Rendimentos', tipo: 'receita', cor: '#a9c96b' },
  { nome: 'Outras receitas', tipo: 'receita', cor: '#8fc79a' },
  { nome: 'Moradia', tipo: 'despesa', cor: '#e0607a' },
  { nome: 'Contas da casa', tipo: 'despesa', cor: '#6fb3d9' },
  { nome: 'Mercado', tipo: 'despesa', cor: '#f2c25c' },
  { nome: 'Alimentação fora', tipo: 'despesa', cor: '#f2a65e' },
  { nome: 'Transporte', tipo: 'despesa', cor: '#b48ad6' },
  { nome: 'Saúde', tipo: 'despesa', cor: '#d64545' },
  { nome: 'Educação', tipo: 'despesa', cor: '#8fa6e0' },
  { nome: 'Lazer', tipo: 'despesa', cor: '#f49ac1' },
  { nome: 'Compras', tipo: 'despesa', cor: '#c97b9c' },
  { nome: 'Assinaturas', tipo: 'despesa', cor: '#3f6f73' },
  { nome: 'Família', tipo: 'despesa', cor: '#e57b5e' },
  { nome: 'Impostos e taxas', tipo: 'despesa', cor: '#9a7b6b' },
  { nome: 'Investimentos / reserva', tipo: 'despesa', cor: '#7fbf7f' },
  { nome: 'Outros', tipo: 'despesa', cor: '#c4a8a2' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
let semeando: Promise<Row[]> | null = null;

/**
 * Junta categorias com o mesmo tipo e nome (ignorando maiúsculas/espaços):
 * mantém a mais antiga, move lançamentos e contas fixas para ela e apaga as cópias.
 * Altera `d` no lugar.
 */
async function deduplicarCategorias(d: Dados) {
  const chave = (c: Dados['categorias'][number]) => `${c.tipo}|${c.nome.trim().toLowerCase()}`;
  const grupos = new Map<string, Dados['categorias']>();
  for (const c of d.categorias) grupos.set(chave(c), [...(grupos.get(chave(c)) ?? []), c]);
  const remover: string[] = [];
  for (const lista of grupos.values()) {
    if (lista.length < 2) continue;
    const [fica, ...copias] = lista; // já vem ordenado por created_at
    const ids = copias.map((c) => c.id);
    await db.atualizarOnde('transacoes', 'categoria_id', ids, { categoria_id: fica.id });
    await db.atualizarOnde('recorrentes', 'categoria_id', ids, { categoria_id: fica.id });
    for (const t of d.transacoes) if (t.categoria_id && ids.includes(t.categoria_id)) t.categoria_id = fica.id;
    for (const r of d.recorrentes) if (r.categoria_id && ids.includes(r.categoria_id)) r.categoria_id = fica.id;
    const orc = copias.find((c) => c.orcamento)?.orcamento;
    if (!fica.orcamento && orc) {
      await db.atualizar('categorias', fica.id, { orcamento: orc });
      fica.orcamento = orc;
    }
    remover.push(...ids);
  }
  if (remover.length) {
    await db.remover('categorias', remover);
    d.categorias = d.categorias.filter((c) => !remover.includes(c.id));
  }
}

interface Store {
  dados: Dados;
  carregando: boolean;
  erro: string | null;
  mes: string;
  setMes: (m: string) => void;
  mudarMes: (n: number) => void;
  inserir: (t: Tabela, rows: Row[]) => Promise<Row[]>;
  atualizar: (t: Tabela, id: string, patch: Row) => Promise<void>;
  remover: (t: Tabela, ids: string[]) => Promise<void>;
  recarregar: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mes, setMes] = useState(mesAtual());
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 3500);
  }, []);

  const recarregar = useCallback(async () => {
    try {
      const listas = await Promise.all(TABELAS.map((t) => db.listar(t)));
      const novo = Object.fromEntries(TABELAS.map((t, i) => [t, listas[i]])) as unknown as Dados;
      if (novo.categorias.length === 0) {
        // evita criar as categorias duas vezes se o carregamento rodar em paralelo
        semeando ??= db.inserir('categorias', CATEGORIAS_PADRAO).catch(() => db.listar('categorias'));
        novo.categorias = (await semeando) as Dados['categorias'];
      }
      await deduplicarCategorias(novo);
      setDados(novo);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void recarregar(); }, [recarregar]);

  const wrap = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (e) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e);
        toast(`Erro ao salvar: ${msg}`);
        throw e;
      }
    },
    [toast],
  );

  const inserir = useCallback(
    (t: Tabela, rows: Row[]) =>
      wrap(async () => {
        const novos = await db.inserir(t, rows);
        setDados((d) => ({ ...d, [t]: [...d[t], ...novos] }));
        return novos;
      }),
    [wrap],
  );

  const atualizar = useCallback(
    (t: Tabela, id: string, patch: Row) =>
      wrap(async () => {
        const row = await db.atualizar(t, id, patch);
        setDados((d) => ({ ...d, [t]: (d[t] as Row[]).map((r) => (r.id === id ? { ...r, ...row } : r)) }));
      }),
    [wrap],
  );

  const remover = useCallback(
    (t: Tabela, ids: string[]) =>
      wrap(async () => {
        await db.remover(t, ids);
        setDados((d) => ({ ...d, [t]: (d[t] as Row[]).filter((r) => !ids.includes(r.id)) }));
      }),
    [wrap],
  );

  const value = useMemo<Store>(
    () => ({
      dados, carregando, erro, mes, setMes, mudarMes: (n) => setMes((m) => somaMes(m, n)),
      inserir, atualizar, remover, recarregar, toast, toastMsg,
    }),
    [dados, carregando, erro, mes, inserir, atualizar, remover, recarregar, toast, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
