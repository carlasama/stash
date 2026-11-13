const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number) => nf.format(n);
export const brl = (n: number) => `${n < 0 ? '−' : ''}R$ ${nf.format(Math.abs(n))}`;
export const pct = (n: number, d = 0) => (isFinite(n) ? `${(n * 100).toFixed(d).replace('.', ',')}%` : '—');

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** 'YYYY-MM' → 'Dezembro 2026' */
export const nomeMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
};
export const mesCurto = (ym: string, comAno = false) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES_CURTOS[m - 1]}${comAno ? ` ${String(y).slice(2)}` : ''}`;
};
/** 'YYYY-MM-DD' → '05/12' */
export const diaMes = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** aceita "1.234,56", "1234.56", "1234,5" */
export function parseValor(s: string): number {
  const t = s.trim().replace(/[R$\s]/g, '');
  if (!t) return NaN;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(norm);
}
