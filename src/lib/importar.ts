/**
 * Importação de faturas de cartão: CSV, OFX e texto (PDF ou colado).
 * Tudo roda no navegador — o arquivo não é enviado para lugar nenhum.
 */
import type { Categoria, Transacao } from './types';

export interface LinhaImportada {
  id: string;
  data: string;            // YYYY-MM-DD
  descricao: string;
  valor: number;           // sempre positivo
  tipo: 'despesa' | 'receita'; // receita = estorno/crédito na fatura
  parcela: number | null;
  parcelas: number | null;
  pagamento: boolean;      // "pagamento recebido" — não é compra
  incluir: boolean;
  duplicada: boolean;
  categoria_id: string | null;
}

interface Bruta { data: string; descricao: string; valor: number; extra?: string }

/* ---------------- utilidades ---------------- */
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseValorBR(s: string): number | null {
  let t = s.replace(/R\$|BRL|\s| /gi, '');
  if (!t) return null;
  const neg = /^-|-$|^\(.*\)$/.test(t);
  t = t.replace(/[-()+]/g, '');
  if (!/\d/.test(t)) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{1,2}$/.test(t)) t = t.replace(/,/g, '');
  else t = t.replace(/[.,]/g, '');
  const n = Number(t);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Converte várias formas de data. Sem ano → usa o ano da fatura (ou o anterior, se o mês for depois do mês da fatura). */
export function parseData(s: string, fatura: string): string | null {
  const t = s.trim().toLowerCase();
  const [fy, fm] = fatura.split('-').map(Number);
  const comAno = (d: number, m: number, y?: number) => {
    if (!d || !m || d > 31 || m > 12) return null;
    let ano = y ?? (m > fm ? fy - 1 : fy);
    if (ano < 100) ano += 2000;
    return `${ano}-${pad(m)}-${pad(d)}`;
  };
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{4})(\d{2})(\d{2})/); // OFX: 20261105...
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  if (m) return comAno(+m[1], +m[2], m[3] ? +m[3] : undefined);
  m = t.match(/^(\d{1,2})\s*(?:de\s+)?([a-zç]{3})[a-zç]*\.?(?:\s*(?:de\s+)?(\d{2,4}))?/);
  if (m) {
    let mes = MESES_ABREV.indexOf(m[2]);
    if (mes < 0) mes = MESES_EN.indexOf(m[2]);
    if (mes >= 0) return comAno(+m[1], mes + 1, m[3] ? +m[3] : undefined);
  }
  return null;
}

/** Procura "3/10", "03 de 10", "Parcela 3 de 10", "PARC 03/10". */
export function extrairParcela(texto: string): { parcela: number; parcelas: number; resto: string } | null {
  const re = /(?:\bparc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|\bde\b)\s*(\d{1,2})\b/i;
  const m = texto.match(re);
  if (!m) return null;
  const p = +m[1], n = +m[2];
  if (p < 1 || n < 2 || p > n || n > 48) return null;
  return { parcela: p, parcelas: n, resto: (texto.slice(0, m.index) + texto.slice(m.index! + m[0].length)).replace(/\s{2,}/g, ' ').replace(/[\s\-–·]+$/, '').trim() };
}

const ehPagamento = (d: string) => /pagamento|pagto|pgto|payment|pag\s+fatura|cr[eé]dito de pagamento/i.test(d);

/* ---------------- CSV ---------------- */
function lerCSV(texto: string): string[][] {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const delim = primeira.includes(';') ? ';' : primeira.includes('\t') ? '\t' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { linha.push(campo.trim()); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo.trim()); campo = '';
      if (linha.some((x) => x)) linhas.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo.trim());
  if (linha.some((x) => x)) linhas.push(linha);
  return linhas;
}

function parseCSV(texto: string, fatura: string): Bruta[] {
  const rows = lerCSV(texto);
  const iHead = rows.findIndex((r) => r.some((c) => /^(data|date)\b/i.test(c)));
  const out: Bruta[] = [];
  if (iHead >= 0) {
    const h = rows[iHead].map((c) => c.toLowerCase());
    const iData = h.findIndex((c) => /^(data|date)\b/.test(c));
    let iDesc = h.findIndex((c) => /descri|title|t[ií]tulo|lan[cç]amento|hist[oó]rico|estabelecimento|detalhe|memo|nome/.test(c));
    const valores = h.map((c, i) => (/valor|amount|value|quantia|montante/.test(c) ? i : -1)).filter((i) => i >= 0);
    const iValor = valores.find((i) => /r\$|brl|real/.test(h[i])) ?? valores.find((i) => !/us\$|usd|d[oó]lar/.test(h[i])) ?? valores[0];
    if (iDesc < 0) iDesc = h.findIndex((_, i) => i !== iData && i !== iValor);
    if (iData < 0 || iValor == null) return [];
    for (const r of rows.slice(iHead + 1)) {
      const data = parseData(r[iData] ?? '', fatura);
      const valor = parseValorBR(r[iValor] ?? '');
      if (!data || valor == null || valor === 0) continue;
      const extra = r.filter((_, i) => i !== iData && i !== iDesc && i !== iValor).join(' ');
      out.push({ data, descricao: r[iDesc] ?? '', valor, extra });
    }
    return out;
  }
  // sem cabeçalho: adivinha pelas colunas
  for (const r of rows) {
    const iD = r.findIndex((c) => parseData(c, fatura));
    const iV = [...r.keys()].reverse().find((i) => i !== iD && /\d[.,]\d{2}\b/.test(r[i]) && parseValorBR(r[i]) != null);
    if (iD < 0 || iV == null) continue;
    const desc = r.filter((_, i) => i !== iD && i !== iV).sort((a, b) => b.length - a.length)[0] ?? '';
    out.push({ data: parseData(r[iD], fatura)!, descricao: desc, valor: parseValorBR(r[iV])! });
  }
  return out;
}

/* ---------------- OFX ---------------- */
function parseOFX(texto: string, fatura: string): Bruta[] {
  const out: Bruta[] = [];
  const tag = (bloco: string, nome: string) => bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
  for (const m of texto.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|<\/BANKTRANLIST>)/gi)) {
    const b = m[1];
    const data = parseData(tag(b, 'DTPOSTED'), fatura);
    const valor = parseValorBR(tag(b, 'TRNAMT'));
    const desc = tag(b, 'MEMO') || tag(b, 'NAME');
    if (data && valor != null && valor !== 0) out.push({ data, descricao: desc, valor });
  }
  return out;
}

/* ---------------- texto (PDF ou colado) ---------------- */
const RE_LINHA = new RegExp(
  '^\\s*(\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?|\\d{1,2}\\s+(?:de\\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\\.?)' + // data
  '\\s+(.+?)\\s+' + // descrição
  '(-\\s?(?:R\\$\\s?)?[\\d.]+,\\d{2}|(?:R\\$\\s?)?-?\\s?[\\d.]+,\\d{2}\\s?-?)\\s*$', // valor
  'i',
);

export function parseTexto(texto: string, fatura: string): Bruta[] {
  const out: Bruta[] = [];
  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.replace(/ /g, ' ').replace(/\s{2,}/g, ' ').trim();
    const m = l.match(RE_LINHA);
    if (!m) continue;
    const data = parseData(m[1], fatura);
    const valor = parseValorBR(m[3]);
    const desc = m[2].replace(/\s+(?:R\$|US\$)\s*$/i, '').trim();
    if (!data || valor == null || valor === 0 || /^(total|saldo|subtotal)/i.test(desc)) continue;
    out.push({ data, descricao: desc, valor });
  }
  return out;
}

export async function textoDoPDF(arquivo: File, senha?: string): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()), password: senha }).promise;
  const linhas: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const conteudo = await page.getTextContent();
    // agrupa os pedaços de texto pela altura (y) para remontar as linhas
    const porLinha = new Map<number, { x: number; s: string }[]>();
    for (const it of conteudo.items as { str: string; transform: number[] }[]) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      porLinha.set(y, [...(porLinha.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    [...porLinha.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, partes]) => linhas.push(partes.sort((a, b) => a.x - b.x).map((x) => x.s.trim()).join(' ')));
  }
  return linhas.join('\n');
}

/* ---------------- categorias ---------------- */
const REGRAS: [RegExp, string[]][] = [
  [/mercado ?pago|mercadopago|\bmp \*/i, []], // intermediador de pagamento: não dá para saber a categoria
  [/amazon prime|prime ?video|netflix|spotify|disney|hbo|\bmax\b|youtube|apple\.com|icloud|google ?one|globoplay|deezer|chatgpt|openai|paramount|crunchyroll|assinatura/i, ['assinaturas']],
  [/ifood|rappi|restaur|lanch|burger|mc ?donald|bk |padaria|caf[eé]|pizz|bar |boteco|sushi|starbucks|outback|subway|a[cç]a[ií]|doceria|sorvet/i, ['alimentação fora', 'alimentacao fora']],
  [/uber|\b99\b|99app|99 ?pop|cabify|posto|shell|ipiranga|petrobras|combust|estacion|sem ?parar|veloe|conectcar|metr[oô]|ped[aá]gio|bilhete/i, ['transporte']],
  [/mercado ?livre|mercadolivre|amazon|shopee|magalu|magazine|americanas|aliexpress|shein|renner|riachuelo|c&a|zara|centauro|netshoes|kabum|casas bahia|leroy/i, ['compras']],
  [/supermerc|mercado|carrefour|p[aã]o de a[cç]ucar|assa[ií]|atacad|hortifruti|sams club|oba |sonda|zaffari|guanabara/i, ['mercado']],
  [/farm[aá]c|drogaria|droga|raia|pacheco|panvel|hospital|cl[ií]nic|laborat|unimed|amil|odonto|dentista|m[eé]dic|psic/i, ['saúde', 'saude']],
  [/cinema|cinemark|ingresso|sympla|eventim|steam|playstation|xbox|nintendo|show|teatro|parque/i, ['lazer']],
  [/udemy|alura|curso|escola|faculdade|universidade|livraria|amazon kindle|duolingo|coursera/i, ['educação', 'educacao']],
  [/enel|sabesp|light|cemig|copel|comgas|claro|vivo|\btim\b|\bnet\b|internet|condom[ií]nio|aluguel/i, ['contas da casa', 'moradia']],
  [/\biof\b|anuidade|tarifa|juros|encargo|multa|imposto|iptu|ipva/i, ['impostos e taxas']],
];

export const chaveDescricao = (d: string) =>
  d.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');

export function sugerirCategoria(desc: string, categorias: Categoria[], aprendidas: Map<string, string>): string | null {
  const ja = aprendidas.get(chaveDescricao(desc));
  if (ja && categorias.some((c) => c.id === ja)) return ja;
  for (const [re, nomes] of REGRAS) {
    if (!re.test(desc)) continue;
    if (!nomes.length) return null;
    const c = categorias.find((x) => x.tipo === 'despesa' && nomes.includes(x.nome.trim().toLowerCase()));
    if (c) return c.id;
  }
  return null;
}

/** Lembra a categoria que você usou para cada descrição (o app "aprende"). */
export function categoriasAprendidas(transacoes: Transacao[]): Map<string, string> {
  const m = new Map<string, string>();
  const ordenadas = [...transacoes].sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  for (const t of ordenadas) if (t.categoria_id && t.tipo === 'despesa') m.set(chaveDescricao(t.descricao), t.categoria_id);
  return m;
}

/* ---------------- montagem final ---------------- */
export function detectarFormato(nome: string, texto: string): 'ofx' | 'csv' | 'texto' {
  if (/\.(ofx|qfx)$/i.test(nome) || /<OFX>|OFXHEADER/i.test(texto.slice(0, 2000))) return 'ofx';
  if (/\.csv$/i.test(nome)) return 'csv';
  return 'texto';
}

export function interpretar(texto: string, formato: 'ofx' | 'csv' | 'texto', fatura: string): Bruta[] {
  if (formato === 'ofx') return parseOFX(texto, fatura);
  if (formato === 'csv') {
    const r = parseCSV(texto, fatura);
    return r.length ? r : parseTexto(texto, fatura);
  }
  return parseTexto(texto, fatura);
}

export const chaveDuplicata = (fatura: string, descricao: string, valor: number, parcela: number | null) =>
  `${fatura}|${Math.round(valor * 100)}|${chaveDescricao(descricao)}|${parcela ?? ''}`;

export function montarLinhas(
  brutas: Bruta[], fatura: string, categorias: Categoria[], transacoes: Transacao[], cartaoId: string,
): LinhaImportada[] {
  // convenção de sinal: o sinal mais comum (excluindo pagamentos) é o das compras
  const semPag = brutas.filter((b) => !ehPagamento(b.descricao));
  const positivos = semPag.filter((b) => b.valor > 0).length;
  const compraPositiva = positivos >= semPag.length - positivos;
  const aprendidas = categoriasAprendidas(transacoes);
  const existentes = new Set(
    transacoes.filter((t) => t.cartao_id === cartaoId && t.fatura).map((t) => chaveDuplicata(t.fatura!, t.descricao, t.valor, t.parcela)),
  );

  return brutas.map((b, i) => {
    const pagamento = ehPagamento(b.descricao);
    const compra = compraPositiva ? b.valor > 0 : b.valor < 0;
    const p = extrairParcela(b.descricao) ?? (b.extra ? extrairParcela(b.extra) : null);
    const descricao = (p && extrairParcela(b.descricao) ? p.resto : b.descricao).replace(/\s+/g, ' ').trim() || 'Compra';
    const valor = Math.abs(b.valor);
    const duplicada = existentes.has(chaveDuplicata(fatura, descricao, valor, p?.parcela ?? null));
    return {
      id: `imp_${i}`,
      data: b.data,
      descricao,
      valor,
      tipo: compra ? 'despesa' : 'receita',
      parcela: p?.parcela ?? null,
      parcelas: p?.parcelas ?? null,
      pagamento,
      incluir: !pagamento && !duplicada,
      duplicada,
      categoria_id: compra ? sugerirCategoria(descricao, categorias, aprendidas) : null,
    };
  });
}
