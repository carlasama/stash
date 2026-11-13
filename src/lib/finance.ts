import type { Cartao, Conta, Dados, Recorrente, Transacao } from './types';

/* ---------- datas ---------- */
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const mesDe = (data: string) => data.slice(0, 7);
export const mesAtual = () => mesDe(hoje());
export function somaMes(ym: string, n: number) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
export const diasNoMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
/** data no mês, com o dia limitado ao último dia (ex.: dia 31 em fevereiro → 28) */
export const dataNoMes = (ym: string, dia: number) => `${ym}-${String(Math.min(dia, diasNoMes(ym))).padStart(2, '0')}`;
export const diffDias = (a: string, b: string) =>
  Math.round((new Date(b + 'T12:00').getTime() - new Date(a + 'T12:00').getTime()) / 86400000);

/* ---------- cartões ---------- */
/**
 * Mês da fatura (mês de VENCIMENTO) em que cai uma compra.
 * Compras no dia do fechamento ou depois vão para a fatura seguinte.
 */
export function faturaDe(c: Pick<Cartao, 'dia_fechamento' | 'dia_vencimento'>, data: string) {
  const dia = Number(data.slice(8, 10));
  let fechamento = mesDe(data);
  if (dia >= c.dia_fechamento) fechamento = somaMes(fechamento, 1);
  return c.dia_vencimento > c.dia_fechamento ? fechamento : somaMes(fechamento, 1);
}
export const vencimentoFatura = (c: Cartao, fatura: string) => dataNoMes(fatura, c.dia_vencimento);

/* ---------- contas fixas → itens previstos ---------- */
function virtual(r: Recorrente, mes: string, d: Dados): Transacao {
  const data = dataNoMes(mes, r.dia);
  const cartao = r.cartao_id ? d.cartoes.find((c) => c.id === r.cartao_id) : undefined;
  return {
    id: `v_${r.id}_${mes}`,
    descricao: r.descricao,
    valor: r.valor,
    tipo: r.tipo,
    data,
    categoria_id: r.categoria_id,
    conta_id: cartao ? null : r.conta_id,
    conta_destino_id: null,
    cartao_id: cartao ? cartao.id : null,
    fatura: cartao ? faturaDe(cartao, data) : null,
    pago: false,
    parcela: null,
    parcelas: null,
    grupo: null,
    recorrente_id: r.id,
    competencia: mes,
    notas: null,
    virtual: true,
  };
}

/** Lançamentos reais + previstos (contas fixas ainda não lançadas) dos meses indicados. */
export function expandir(d: Dados, meses: string[]): Transacao[] {
  const feitos = new Set(d.transacoes.filter((t) => t.recorrente_id).map((t) => `${t.recorrente_id}|${t.competencia}`));
  const out: Transacao[] = [];
  for (const r of d.recorrentes) {
    if (!r.ativo) continue;
    for (const m of meses) {
      if (m < r.inicio || (r.fim && m > r.fim)) continue;
      if (!feitos.has(`${r.id}|${m}`)) out.push(virtual(r, m, d));
    }
  }
  return out;
}

/** Em qual mês o lançamento pesa no caixa: compras no cartão contam no mês da fatura. */
export const mesCaixa = (t: Transacao) => (t.cartao_id && t.fatura ? t.fatura : mesDe(t.data));

/** Todos os itens (reais + previstos) cujo mês de caixa é `mes`. */
export function itensDoMes(d: Dados, mes: string): Transacao[] {
  const previstos = expandir(d, [somaMes(mes, -2), somaMes(mes, -1), mes]);
  return [...d.transacoes, ...previstos].filter((t) => mesCaixa(t) === mes);
}

export interface Fatura {
  cartao: Cartao;
  mes: string;
  vencimento: string;
  itens: Transacao[];
  total: number;
  pago: number;
  paga: boolean;
}

export function faturaDoMes(d: Dados, cartao: Cartao, mes: string, itens?: Transacao[]): Fatura {
  const base = itens ?? itensDoMes(d, mes);
  const doCartao = base.filter((t) => t.cartao_id === cartao.id && t.tipo !== 'pagamento_fatura');
  const total = doCartao.reduce((s, t) => s + (t.tipo === 'receita' ? -t.valor : t.valor), 0);
  const pago = d.transacoes
    .filter((t) => t.tipo === 'pagamento_fatura' && t.cartao_id === cartao.id && t.fatura === mes)
    .reduce((s, t) => s + t.valor, 0);
  return {
    cartao,
    mes,
    vencimento: vencimentoFatura(cartao, mes),
    itens: doCartao.sort((a, b) => a.data.localeCompare(b.data)),
    total,
    pago,
    paga: total > 0 ? pago >= total - 0.005 : pago > 0,
  };
}

/** Limite usado: compras lançadas em faturas ainda não pagas (inclui parcelas futuras). */
/** Limite usado = compras lançadas no app + ajuste manual (compras feitas antes de usar o Stash). */
export function limiteUsado(d: Dados, c: Cartao) {
  return usoLancado(d, c) + (c.ajuste_limite ?? 0);
}

/** Só o que foi lançado no app: compras em faturas ainda não pagas (inclui parcelas futuras). */
export function usoLancado(d: Dados, c: Cartao) {
  const porFatura = new Map<string, number>();
  for (const t of d.transacoes) {
    if (t.cartao_id !== c.id || !t.fatura) continue;
    const v = t.tipo === 'pagamento_fatura' ? -t.valor : t.tipo === 'receita' ? -t.valor : t.valor;
    porFatura.set(t.fatura, (porFatura.get(t.fatura) ?? 0) + v);
  }
  let usado = 0;
  for (const v of porFatura.values()) if (v > 0) usado += v;
  return usado;
}

/* ---------- saldos ---------- */
/**
 * O lançamento já está embutido no saldo informado? (pago antes do momento em que você digitou o saldo)
 * Mesmo dia: conta só se foi lançado depois de informar o saldo.
 */
export function jaNoSaldo(conta: Conta | undefined, t: Transacao) {
  if (!conta?.saldo_em) return false;
  const dia = diaLocal(conta.saldo_em);
  if (t.data < dia) return true;
  if (t.data > dia) return false;
  return !t.created_at || new Date(t.created_at).getTime() <= new Date(conta.saldo_em).getTime();
}

/** data (YYYY-MM-DD) no fuso local de um timestamp */
export function diaLocal(ts: string) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function saldoConta(d: Dados, contaId: string, ate?: string) {
  const conta = d.contas.find((c) => c.id === contaId);
  let s = conta?.saldo_inicial ?? 0;
  for (const t of d.transacoes) {
    if (!t.pago || (ate && t.data > ate)) continue;
    if (jaNoSaldo(conta, t)) continue;
    if (t.tipo === 'receita' && t.conta_id === contaId && !t.cartao_id) s += t.valor;
    else if (t.tipo === 'despesa' && t.conta_id === contaId && !t.cartao_id) s -= t.valor;
    else if (t.tipo === 'pagamento_fatura' && t.conta_id === contaId) s -= t.valor;
    else if (t.tipo === 'transferencia') {
      if (t.conta_id === contaId) s -= t.valor;
      if (t.conta_destino_id === contaId) s += t.valor;
    }
  }
  return s;
}

/* ---------- patrimônio ---------- */
export type GrupoConta = 'disponivel' | 'investido' | 'receber';
export const GRUPOS: Record<GrupoConta, string> = { disponivel: 'Disponível', investido: 'Guardado e investido', receber: 'A receber' };
export const grupoConta = (c: Conta): GrupoConta =>
  c.tipo === 'investimento' || c.tipo === 'poupanca' ? 'investido' : c.tipo === 'a_receber' ? 'receber' : 'disponivel';

export function patrimonio(d: Dados) {
  const t = { disponivel: 0, investido: 0, receber: 0, total: 0 };
  for (const c of d.contas) {
    if (c.arquivada) continue;
    const s = saldoConta(d, c.id);
    t[grupoConta(c)] += s;
    t.total += s;
  }
  return t;
}

export const saldoTotal = (d: Dados) =>
  d.contas.filter((c) => !c.arquivada).reduce((s, c) => s + saldoConta(d, c.id), 0);

/* ---------- resumo do mês ---------- */
export interface ItemPagar {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'conta' | 'fatura' | 'receber';
  pago: boolean;
  transacao?: Transacao;
  fatura?: Fatura;
}

export function resumoMes(d: Dados, mes: string) {
  const itens = itensDoMes(d, mes);
  const receitas = itens.filter((t) => t.tipo === 'receita' && !t.cartao_id);
  const despesasConta = itens.filter((t) => t.tipo === 'despesa' && !t.cartao_id);
  const faturas = d.cartoes
    .map((c) => faturaDoMes(d, c, mes, itens))
    .filter((f) => f.total > 0 || f.pago > 0);

  const totalReceitas = receitas.reduce((s, t) => s + t.valor, 0);
  const fixas = despesasConta.filter((t) => t.recorrente_id).reduce((s, t) => s + t.valor, 0);
  const variaveis = despesasConta.filter((t) => !t.recorrente_id).reduce((s, t) => s + t.valor, 0);
  const cartoes = faturas.reduce((s, f) => s + Math.max(f.total, 0), 0);
  const totalDespesas = fixas + variaveis + cartoes;

  const aPagar: ItemPagar[] = [
    ...despesasConta.map((t) => ({
      id: t.id, descricao: t.descricao, valor: t.valor, data: t.data, tipo: 'conta' as const, pago: t.pago, transacao: t,
    })),
    ...faturas
      .filter((f) => f.total > 0)
      .map((f) => ({
        id: `fat_${f.cartao.id}_${mes}`, descricao: `Fatura ${f.cartao.nome}`, valor: f.total, data: f.vencimento,
        tipo: 'fatura' as const, pago: f.paga, fatura: f,
      })),
  ].sort((a, b) => a.data.localeCompare(b.data) || b.valor - a.valor);

  const aReceber: ItemPagar[] = receitas
    .map((t) => ({ id: t.id, descricao: t.descricao, valor: t.valor, data: t.data, tipo: 'receber' as const, pago: t.pago, transacao: t }))
    .sort((a, b) => a.data.localeCompare(b.data));

  // gastos por categoria (despesas do mês, incluindo itens de cartão)
  const porCategoria = new Map<string, number>();
  for (const t of itens) {
    if (t.tipo !== 'despesa') continue;
    const k = t.categoria_id ?? '';
    porCategoria.set(k, (porCategoria.get(k) ?? 0) + t.valor);
  }

  return {
    itens, receitas, despesasConta, faturas, totalReceitas, fixas, variaveis, cartoes, totalDespesas,
    sobra: totalReceitas - totalDespesas, aPagar, aReceber, porCategoria,
  };
}
