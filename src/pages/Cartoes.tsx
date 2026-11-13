import { PixelIcon } from '../components/PixelIcon';
import { useState } from 'react';
import { Check, FileUp, Pencil, Plus } from 'lucide-react';
import { ImportarFaturaForm } from '../components/ImportarFatura';
import { useStore } from '../store';
import { Dot, Empty, Money, Progress, useModal } from '../components/ui';
import { AjusteLimiteForm, CartaoForm, TransacaoForm } from '../components/forms';
import { CardVisual } from '../components/CardVisual';
import { useAcoes } from '../lib/acoes';
import { faturaDoMes, limiteUsado, somaMes } from '../lib/finance';
import { brl, dataBR, diaMes, mesCurto, nomeMes } from '../lib/format';

export function Cartoes() {
  const { dados, mes, setMes } = useStore();
  const { abrir } = useModal();
  const { alternarFatura, abrirLancamento } = useAcoes();
  const ativos = dados.cartoes.filter((c) => !c.arquivado);
  const arquivados = dados.cartoes.filter((c) => c.arquivado);
  const [selId, setSelId] = useState<string | null>(null);
  const c = dados.cartoes.find((x) => x.id === selId) ?? ativos[0] ?? arquivados[0];

  if (!c) {
    return (
      <section className="card">
        <Empty icon={<PixelIcon name="cartao" size={36} />} title="Nenhum cartão cadastrado" text="Cadastre seus cartões com dia de fechamento e vencimento. As compras vão automaticamente para a fatura certa, inclusive parcelas."
          action={<button className="btn-primary" onClick={() => abrir(<CartaoForm />)}><Plus size={15} /> Cadastrar cartão</button>} />
      </section>
    );
  }

  const usado = limiteUsado(dados, c);
  const f = faturaDoMes(dados, c, mes);
  const meses = Array.from({ length: 8 }, (_, i) => somaMes(mes, i - 2));
  const historico = meses.map((m) => faturaDoMes(dados, c, m));
  const max = Math.max(...historico.map((h) => h.total), 1);

  return (
    <div className="page">
      <section className="card">
        <div className="page-head">
          <h2>Cartões</h2>
          <button className="btn-primary" onClick={() => abrir(<CartaoForm />)}><Plus size={15} /> Novo cartão</button>
        </div>
        <div className="card-strip">
          {[...ativos, ...arquivados].map((k) => (
            <CardVisual key={k.id} cartao={k} livre={k.limite - limiteUsado(dados, k)} status={k.arquivado ? 'Arquivado' : undefined} onClick={() => setSelId(k.id)} selecionado={k.id === c.id} />
          ))}
        </div>
      </section>

      <div className="grid two">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>{c.nome}</h3>
              <div className="muted small mt">Fatura de {nomeMes(mes)} · vence {dataBR(f.vencimento)} · fecha dia {c.dia_fechamento}</div>
              <Money value={f.total} size="lg" />
              {f.pago > 0 && <div className="small pos">Pago {brl(f.pago)}</div>}
            </div>
            <div className="col-actions">
              {f.total > 0 && (
                <button className={f.paga ? 'ghost done' : 'btn-primary'} onClick={() => alternarFatura(f)}>
                  {f.paga ? <><Check size={14} /> Paga</> : 'Pagar fatura'}
                </button>
              )}
              <button className="ghost" onClick={() => abrir(<ImportarFaturaForm cartao={c} faturaInicial={mes} />)}><FileUp size={14} /> Importar fatura</button>
              <button className="ghost" onClick={() => abrir(<TransacaoForm cartaoInicial={c.id} />)}><Plus size={14} /> Compra</button>
              <button className="ghost" onClick={() => abrir(<CartaoForm inicial={c} />)}><Pencil size={13} /> Editar</button>
            </div>
          </div>
          {f.itens.length === 0 ? (
            <Empty title="Fatura vazia" text="Importe a fatura do banco (PDF, CSV ou OFX) ou lance as compras manualmente." action={<button className="btn-primary" onClick={() => abrir(<ImportarFaturaForm cartao={c} faturaInicial={mes} />)}><FileUp size={14} /> Importar fatura</button>} />
          ) : (
            <ul className="rows mt2">
              {f.itens.map((t) => {
                const cat = dados.categorias.find((x) => x.id === t.categoria_id);
                return (
                  <li key={t.id} className={`clickable ${t.virtual ? 'virtual' : ''}`} onClick={() => abrirLancamento(t)}>
                    <Dot color={cat?.cor ?? 'var(--gray)'} />
                    <span className="muted small">{diaMes(t.data)}</span>
                    <span className="grow">
                      {t.descricao}
                      {t.parcelas && <span className="tag">{t.parcela}/{t.parcelas}</span>}
                      {t.recorrente_id && <span className="tag">fixa</span>}
                    </span>
                    <span className="strong">{t.tipo === 'receita' ? '− ' : ''}{brl(t.valor)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h3>Limite</h3>
              <button className="ghost sm" onClick={() => abrir(<AjusteLimiteForm cartao={c} />)}><Pencil size={13} /> Ajustar</button>
            </div>
            <div className="row-between mt2 small limite-legenda">
              <span>Usado <b>{brl(usado)}</b></span>
              <span>Livre <b className={c.limite - usado < 0 ? 'neg' : 'pos'}>{brl(c.limite - usado)}</b></span>
            </div>
            <Progress value={c.limite ? usado / c.limite : 0} danger={usado > c.limite * 0.9} />
            <div className="tiny muted mt">Limite total {brl(c.limite)} · inclui parcelas futuras de faturas não pagas{(c.ajuste_limite ?? 0) !== 0 && <> · ajuste manual de {brl(c.ajuste_limite ?? 0)}</>}</div>
          </section>
          <section className="card">
            <h3>Faturas</h3>
            <div className="bars mt2">
              {historico.map((h) => (
                <button key={h.mes} className={`bar ${h.mes === mes ? 'on' : ''}`} onClick={() => setMes(h.mes)} title={brl(h.total)}>
                  <span className="bar-col"><span style={{ height: `${(h.total / max) * 100}%` }} className={h.paga ? 'paid' : ''} /></span>
                  <span className="tiny">{mesCurto(h.mes)}</span>
                </button>
              ))}
            </div>
            <ul className="rows mt2">
              {historico.filter((h) => h.mes >= mes && h.total > 0).slice(0, 4).map((h) => (
                <li key={h.mes}>
                  <span className="grow">{nomeMes(h.mes)}</span>
                  <span className="strong">{brl(h.total)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
