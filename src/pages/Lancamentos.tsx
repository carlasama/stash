import { useMemo, useState } from 'react';
import { Check, Download, Plus, Search } from 'lucide-react';
import { useStore } from '../store';
import { Dot, Empty, Money, Seg, useModal } from '../components/ui';
import { TransacaoForm } from '../components/forms';
import { useAcoes } from '../lib/acoes';
import { itensDoMes } from '../lib/finance';
import { brl, dataBR, nomeMes } from '../lib/format';
import type { Transacao } from '../lib/types';

type Filtro = 'todos' | 'despesa' | 'receita' | 'outros';
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function Lancamentos() {
  const { dados, mes } = useStore();
  const { abrir } = useModal();
  const { alternarPago, abrirLancamento, ocupado } = useAcoes();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [cat, setCat] = useState('');
  const [origem, setOrigem] = useState('');
  const [pendentes, setPendentes] = useState(false);

  const itens = useMemo(() => itensDoMes(dados, mes), [dados, mes]);
  const filtrados = itens
    .filter((t) => filtro === 'todos' || (filtro === 'outros' ? t.tipo === 'transferencia' || t.tipo === 'pagamento_fatura' : t.tipo === filtro))
    .filter((t) => !cat || t.categoria_id === cat)
    .filter((t) => !origem || t.conta_id === origem || t.cartao_id === origem || t.conta_destino_id === origem)
    .filter((t) => !pendentes || (!t.pago && !t.cartao_id))
    .filter((t) => !busca || `${t.descricao} ${t.notas ?? ''}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  const receitas = filtrados.filter((t) => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0);
  const despesas = filtrados.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0);

  const grupos = new Map<string, Transacao[]>();
  for (const t of filtrados) grupos.set(t.data, [...(grupos.get(t.data) ?? []), t]);

  const nomeOrigem = (t: Transacao) => {
    if (t.cartao_id) {
      const c = dados.cartoes.find((x) => x.id === t.cartao_id);
      return `${c?.nome ?? 'Cartão'}${t.tipo !== 'pagamento_fatura' && t.fatura ? ` · fatura ${t.fatura.slice(5)}/${t.fatura.slice(2, 4)}` : ''}`;
    }
    const o = dados.contas.find((x) => x.id === t.conta_id)?.nome;
    if (t.tipo === 'transferencia') return `${o ?? '?'} → ${dados.contas.find((x) => x.id === t.conta_destino_id)?.nome ?? '?'}`;
    return o ?? '';
  };

  function exportarCSV() {
    const linhas = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta/Cartão', 'Fatura', 'Parcela', 'Valor', 'Pago', 'Observações']];
    for (const t of filtrados) {
      if (t.virtual) continue;
      linhas.push([
        dataBR(t.data), t.descricao, t.tipo, dados.categorias.find((c) => c.id === t.categoria_id)?.nome ?? '',
        nomeOrigem(t), t.fatura ?? '', t.parcelas ? `${t.parcela}/${t.parcelas}` : '',
        String(t.valor).replace('.', ','), t.pago ? 'sim' : 'não', t.notas ?? '',
      ]);
    }
    const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `lancamentos-${mes}.csv`;
    a.click();
  }

  return (
    <div className="page">
      <section className="card">
        <div className="page-head">
          <div>
            <h2>Lançamentos</h2>
            <div className="muted small">{nomeMes(mes)} · compras no cartão aparecem no mês da fatura</div>
          </div>
          <div className="row">
            <button className="ghost" onClick={exportarCSV}><Download size={14} /> CSV</button>
            <button className="btn-primary" onClick={() => abrir(<TransacaoForm />)}><Plus size={15} /> Novo</button>
          </div>
        </div>
        <div className="summary">
          <div><div className="muted small">Receitas</div><Money value={receitas} size="sm" className="pos" /></div>
          <div><div className="muted small">Despesas</div><Money value={despesas} size="sm" /></div>
          <div><div className="muted small">Resultado</div><Money value={receitas - despesas} size="sm" className={receitas - despesas < 0 ? 'neg' : 'pos'} /></div>
        </div>
        <div className="filters">
          <Seg value={filtro} onChange={setFiltro} options={[
            { value: 'todos', label: 'Todos' }, { value: 'despesa', label: 'Despesas' },
            { value: 'receita', label: 'Receitas' }, { value: 'outros', label: 'Transf./faturas' },
          ]} />
          <div className="search"><Search size={14} /><input placeholder="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
            <option value="">Todas as contas e cartões</option>
            {dados.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            {dados.cartoes.map((c) => <option key={c.id} value={c.id}>💳 {c.nome}</option>)}
          </select>
          <label className="check-line small"><input type="checkbox" checked={pendentes} onChange={(e) => setPendentes(e.target.checked)} /> Só pendentes</label>
        </div>
      </section>

      <section className="card">
        {filtrados.length === 0 ? (
          <Empty title="Nenhum lançamento" text="Nada encontrado para este mês e filtros." action={<button className="ghost sm" onClick={() => abrir(<TransacaoForm />)}><Plus size={13} /> Novo lançamento</button>} />
        ) : (
          [...grupos.entries()].map(([data, ts]) => (
            <div key={data} className="day-group">
              <div className="day-label">{dataBR(data)} · {DIAS[new Date(data + 'T12:00').getDay()]}</div>
              <ul className="tx-list">
                {ts.map((t) => {
                  const c = dados.categorias.find((x) => x.id === t.categoria_id);
                  const podeMarcar = (t.tipo === 'receita' || t.tipo === 'despesa') && !t.cartao_id;
                  return (
                    <li key={t.id} className={t.virtual ? 'virtual' : ''}>
                      {podeMarcar ? (
                        <button className={`check ${t.pago ? 'on' : ''} ${ocupado(t.id) ? 'ocupado' : ''}`} onClick={() => alternarPago(t)} title={t.pago ? 'Pago' : 'Marcar como pago'}>{t.pago && <Check size={12} />}</button>
                      ) : <span className="check ghosted" />}
                      <button className="tx-main" onClick={() => abrirLancamento(t)}>
                        <span className="tx-desc">
                          {t.descricao}
                          {t.parcelas && <span className="tag">{t.parcela}/{t.parcelas}</span>}
                          {t.recorrente_id && <span className="tag">fixa</span>}
                          {t.virtual && <span className="tag blue">prevista</span>}
                          {!t.pago && !t.virtual && podeMarcar && <span className="tag warn">pendente</span>}
                        </span>
                        <span className="tx-sub">
                          {c && <><Dot color={c.cor} /> {c.nome} · </>}{nomeOrigem(t)}
                        </span>
                      </button>
                      <span className={`strong tx-val ${t.tipo === 'receita' ? 'pos' : t.tipo === 'despesa' ? '' : 'muted'}`}>
                        {t.tipo === 'receita' ? '+ ' : t.tipo === 'despesa' ? '− ' : ''}{brl(t.valor)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
