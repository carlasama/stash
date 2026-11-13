import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileUp } from 'lucide-react';
import { useStore } from '../store';
import { Dialog, Field, useModal } from './ui';
import { faturaDe, hoje, somaMes } from '../lib/finance';
import { brl, diaMes, nomeMes } from '../lib/format';
import {
  chaveDuplicata, detectarFormato, interpretar, montarLinhas, textoDoPDF, type LinhaImportada,
} from '../lib/importar';
import type { Cartao } from '../lib/types';

const n2 = (n: number) => Math.round(n * 100) / 100;

export function ImportarFaturaForm({ cartao, faturaInicial }: { cartao: Cartao; faturaInicial: string }) {
  const { dados, inserir, toast } = useStore();
  const { fechar } = useModal();
  const input = useRef<HTMLInputElement>(null);

  const [fatura, setFatura] = useState(faturaInicial);
  const [fonte, setFonte] = useState<{ texto: string; formato: 'ofx' | 'csv' | 'texto'; nome: string } | null>(null);
  const [linhas, setLinhas] = useState<LinhaImportada[] | null>(null);
  const [colado, setColado] = useState('');
  const [arrastando, setArrastando] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [pdfPendente, setPdfPendente] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [futuras, setFuturas] = useState(true);

  const cats = dados.categorias.filter((c) => c.tipo === 'despesa');

  function processar(texto: string, formato: 'ofx' | 'csv' | 'texto', nome: string, fat = fatura) {
    const brutas = interpretar(texto, formato, fat);
    if (!brutas.length) {
      setErro('Não encontrei lançamentos nesse arquivo. Tente outro formato (CSV ou OFX) ou cole o texto da fatura.');
      return;
    }
    // sugere a fatura pela compra mais recente, se o usuário não mudou
    let f = fat;
    if (fat === faturaInicial) {
      const datas = brutas.map((b) => b.data).sort();
      const maisRecente = datas[datas.length - 1];
      f = faturaDe(cartao, maisRecente);
      if (f !== fat) {
        setFatura(f);
        return processar(texto, formato, nome, f);
      }
    }
    setErro(null);
    setFonte({ texto, formato, nome });
    setLinhas(montarLinhas(brutas, f, dados.categorias, dados.transacoes, cartao.id));
  }

  async function lerArquivo(arq: File, senhaPdf?: string) {
    setErro(null);
    setLendo(true);
    try {
      if (/\.pdf$/i.test(arq.name) || arq.type === 'application/pdf') {
        try {
          const texto = await textoDoPDF(arq, senhaPdf);
          setPdfPendente(null);
          processar(texto, 'texto', arq.name);
        } catch (e) {
          if ((e as { name?: string })?.name === 'PasswordException') {
            setPdfPendente(arq);
            setErro(senhaPdf ? 'Senha incorreta. Tente de novo.' : null);
          } else throw e;
        }
      } else {
        const buf = await arq.arrayBuffer();
        let texto = new TextDecoder('utf-8').decode(buf);
        if (texto.includes('�')) texto = new TextDecoder('windows-1252').decode(buf); // arquivos antigos de banco
        processar(texto, detectarFormato(arq.name, texto), arq.name);
      }
    } catch (e) {
      setErro(`Não consegui ler o arquivo: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLendo(false);
    }
  }

  // ao trocar a fatura, recalcula datas sem ano e duplicatas
  function mudarFatura(f: string) {
    setFatura(f);
    if (fonte) {
      const novas = montarLinhas(interpretar(fonte.texto, fonte.formato, f), f, dados.categorias, dados.transacoes, cartao.id);
      // mantém o que o usuário já editou
      setLinhas((antigas) => novas.map((n, i) => (antigas?.[i] ? { ...n, incluir: antigas[i].incluir && !n.duplicada, categoria_id: antigas[i].categoria_id, descricao: antigas[i].descricao } : n)));
    }
  }

  const alterar = (id: string, patch: Partial<LinhaImportada>) => setLinhas((ls) => ls!.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const resumo = useMemo(() => {
    const ls = linhas ?? [];
    const sel = ls.filter((l) => l.incluir);
    return {
      sel,
      total: sel.reduce((s, l) => s + (l.tipo === 'despesa' ? l.valor : -l.valor), 0),
      duplicadas: ls.filter((l) => l.duplicada).length,
      pagamentos: ls.filter((l) => l.pagamento).length,
      parceladas: sel.filter((l) => l.parcela && l.parcelas && l.parcela < l.parcelas).length,
    };
  }, [linhas]);

  async function importar() {
    if (!resumo.sel.length) return toast('Nenhum lançamento selecionado.');
    const existentes = new Set(
      dados.transacoes.filter((t) => t.cartao_id === cartao.id && t.fatura).map((t) => chaveDuplicata(t.fatura!, t.descricao, t.valor, t.parcela)),
    );
    const rows: Record<string, unknown>[] = [];
    for (const l of resumo.sel) {
      const grupo = l.parcela && l.parcelas ? crypto.randomUUID() : null;
      const base = {
        descricao: l.descricao.trim() || 'Compra', valor: n2(l.valor), tipo: l.tipo, data: l.data, categoria_id: l.categoria_id,
        conta_id: null, conta_destino_id: null, cartao_id: cartao.id, pago: true, parcelas: l.parcelas, grupo,
        notas: 'Importado da fatura',
      };
      rows.push({ ...base, fatura, parcela: l.parcela });
      if (futuras && l.parcela && l.parcelas && l.tipo === 'despesa') {
        for (let k = l.parcela + 1; k <= l.parcelas; k++) {
          const f = somaMes(fatura, k - l.parcela);
          if (existentes.has(chaveDuplicata(f, base.descricao, base.valor, k))) continue;
          rows.push({ ...base, fatura: f, parcela: k });
        }
      }
    }
    for (let i = 0; i < rows.length; i += 400) await inserir('transacoes', rows.slice(i, i + 400));
    toast(`${resumo.sel.length} lançamento(s) importado(s) na fatura de ${nomeMes(fatura)}`);
    fechar();
  }

  /* ---------- etapa 1: escolher arquivo ---------- */
  if (!linhas) {
    return (
      <Dialog title={`Importar fatura · ${cartao.nome}`} wide>
        <div
          className={`dropzone ${arrastando ? 'over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            const f = e.dataTransfer.files?.[0];
            if (f) void lerArquivo(f);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        >
          <FileUp size={28} />
          <div className="strong">{lendo ? 'Lendo arquivo…' : 'Arraste o arquivo da fatura aqui'}</div>
          <div className="muted small">ou clique para escolher · PDF, CSV ou OFX</div>
          <input ref={input} type="file" hidden accept=".pdf,.csv,.ofx,.qfx,.txt,application/pdf,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); e.target.value = ''; }} />
        </div>

        {pdfPendente && (
          <div className="senha-pdf">
            <p className="small">Esse PDF tem senha (muitos bancos usam os primeiros dígitos do CPF).</p>
            <div className="row">
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha do PDF" autoFocus />
              <button type="button" className="btn-primary" onClick={() => lerArquivo(pdfPendente, senha)}>Abrir</button>
            </div>
          </div>
        )}

        {erro && <p className="small neg">{erro}</p>}

        <Field label="Ou cole aqui o texto da fatura (copiado do PDF ou do app do banco)">
          <textarea rows={4} value={colado} onChange={(e) => setColado(e.target.value)} placeholder={'05/11 PADARIA BOA VISTA 23,50\n06/11 LOJA X 02/10 150,00'} />
        </Field>
        <div className="row-between">
          <span className="tiny muted">O arquivo é lido só no seu navegador e não é enviado para lugar nenhum.</span>
          <button type="button" className="ghost" disabled={!colado.trim()} onClick={() => processar(colado, 'texto', 'texto colado')}>Ler texto</button>
        </div>

        <details className="ajuda">
          <summary>Onde baixo a fatura de cada banco?</summary>
          <ul>
            <li><b>Nubank:</b> app → Cartão → fatura → "Exportar fatura" (CSV) ou receba o PDF por e-mail.</li>
            <li><b>Itaú, Santander, Amazon (Bradesco):</b> app ou site → Cartões → Fatura → "Baixar PDF" (às vezes também OFX/Excel no site).</li>
            <li><b>Inter:</b> app → Cartão → Faturas → compartilhar/baixar a fatura em PDF.</li>
            <li><b>Mercado Pago:</b> app → Cartão de crédito → Fatura → "Baixar fatura" (PDF).</li>
          </ul>
          <p className="tiny muted">Se o banco só oferecer Excel, abra no Excel e salve como CSV.</p>
        </details>
      </Dialog>
    );
  }

  /* ---------- etapa 2: revisar ---------- */
  return (
    <Dialog
      title={`Revisar importação · ${cartao.nome}`}
      wide
      onSubmit={importar}
      footer={<button type="button" className="ghost" onClick={() => { setLinhas(null); setFonte(null); }}><ArrowLeft size={14} /> Outro arquivo</button>}
    >
      <div className="import-top">
        <Field label="Esses lançamentos são da fatura de">
          <input type="month" value={fatura} onChange={(e) => e.target.value && mudarFatura(e.target.value)} />
        </Field>
        <div className="import-resumo">
          <div><span className="muted small">Selecionados</span><b>{resumo.sel.length}</b></div>
          <div><span className="muted small">Total</span><b>{brl(resumo.total)}</b></div>
          {resumo.duplicadas > 0 && <div><span className="muted small">Já lançados</span><b>{resumo.duplicadas}</b></div>}
          {resumo.pagamentos > 0 && <div><span className="muted small">Pagamentos</span><b>{resumo.pagamentos}</b></div>}
        </div>
      </div>
      {resumo.parceladas > 0 && (
        <label className="check-line small">
          <input type="checkbox" checked={futuras} onChange={(e) => setFuturas(e.target.checked)} />
          Criar também as parcelas futuras ({resumo.parceladas} compra(s) parcelada(s)) — assim o limite e as próximas faturas ficam certos
        </label>
      )}
      <p className="tiny muted">Lido de "{fonte?.nome}". Pagamentos de fatura e itens já lançados vêm desmarcados. Confira as categorias antes de importar.</p>

      <div className="import-table">
        <div className="it-head">
          <span />
          <span>Data</span>
          <span>Descrição</span>
          <span>Categoria</span>
          <span className="right">Valor</span>
        </div>
        {linhas.map((l) => (
          <div key={l.id} className={`it-row ${l.incluir ? '' : 'off'}`}>
            <input type="checkbox" checked={l.incluir} onChange={(e) => alterar(l.id, { incluir: e.target.checked })} aria-label="Incluir" />
            <span className="small muted tnum">{diaMes(l.data)}</span>
            <span className="it-desc">
              <input value={l.descricao} onChange={(e) => alterar(l.id, { descricao: e.target.value })} />
              <span className="it-tags">
                {l.parcela && <span className="tag">{l.parcela}/{l.parcelas}</span>}
                {l.duplicada && <span className="tag warn">já lançado</span>}
                {l.pagamento && <span className="tag">pagamento</span>}
                {l.tipo === 'receita' && !l.pagamento && <span className="tag blue">estorno/crédito</span>}
              </span>
            </span>
            <select value={l.categoria_id ?? ''} onChange={(e) => alterar(l.id, { categoria_id: e.target.value || null })} disabled={l.tipo === 'receita'}>
              <option value="">Sem categoria</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <span className={`strong right tnum ${l.tipo === 'receita' ? 'pos' : ''}`}>{l.tipo === 'receita' ? '− ' : ''}{brl(l.valor)}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted">Data de hoje: {diaMes(hoje())}. Datas sem ano são ajustadas pelo mês da fatura.</p>
    </Dialog>
  );
}
