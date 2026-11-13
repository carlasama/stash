import { createClient } from '@supabase/supabase-js';
import type { Tabela } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const modoLocal = !supabase;

// Postgres devolve numeric como string — converte de volta para number.
const NUMERICOS = ['valor', 'saldo_inicial', 'limite', 'orcamento', 'alvo', 'atual', 'ajuste_limite'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
function normaliza(r: Row): Row {
  for (const k of NUMERICOS) if (r[k] != null) r[k] = Number(r[k]);
  delete r.user_id;
  return r;
}

/* ---------- modo local (localStorage) ---------- */
const lk = (t: Tabela) => `df:${t}`;
function lerLocal(t: Tabela): Row[] {
  try {
    return JSON.parse(localStorage.getItem(lk(t)) || '[]');
  } catch {
    return [];
  }
}
function gravarLocal(t: Tabela, rows: Row[]) {
  localStorage.setItem(lk(t), JSON.stringify(rows));
}

/* ---------- API ---------- */
export async function listar(t: Tabela): Promise<Row[]> {
  if (!supabase) return lerLocal(t);
  const out: Row[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(t).select('*').order('created_at').range(from, from + page - 1);
    if (error) throw error;
    out.push(...data.map(normaliza));
    if (data.length < page) break;
  }
  return out;
}

export async function inserir(t: Tabela, rows: Row[]): Promise<Row[]> {
  if (!rows.length) return [];
  if (!supabase) {
    const now = new Date().toISOString();
    const novos = rows.map((r) => ({ ...r, id: r.id ?? crypto.randomUUID(), created_at: now }));
    gravarLocal(t, [...lerLocal(t), ...novos]);
    return novos;
  }
  const { data, error } = await supabase.from(t).insert(rows).select('*');
  if (error) throw error;
  return data.map(normaliza);
}

export async function atualizar(t: Tabela, id: string, patch: Row): Promise<Row> {
  if (!supabase) {
    const rows = lerLocal(t);
    const i = rows.findIndex((r) => r.id === id);
    rows[i] = { ...rows[i], ...patch };
    gravarLocal(t, rows);
    return rows[i];
  }
  const { data, error } = await supabase.from(t).update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return normaliza(data);
}

/** Atualiza todas as linhas cujo `campo` está em `valores`. */
export async function atualizarOnde(t: Tabela, campo: string, valores: string[], patch: Row): Promise<void> {
  if (!valores.length) return;
  if (!supabase) {
    gravarLocal(t, lerLocal(t).map((r) => (valores.includes(r[campo]) ? { ...r, ...patch } : r)));
    return;
  }
  const { error } = await supabase.from(t).update(patch).in(campo, valores);
  if (error) throw error;
}

export async function remover(t: Tabela, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (!supabase) {
    gravarLocal(t, lerLocal(t).filter((r) => !ids.includes(r.id)));
    return;
  }
  const { error } = await supabase.from(t).delete().in('id', ids);
  if (error) throw error;
}
