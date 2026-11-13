import { PixelIcon } from '../components/PixelIcon';
import { useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useStore } from '../store';
import { Dot, Empty, Money, Progress, Seg, useModal } from '../components/ui';
import { CartaoForm, ContaForm, MetaForm, RecorrenteForm, TransacaoForm } from '../components/forms';
import { CardVisual } from '../components/CardVisual';
import { useAcoes } from '../lib/acoes';
import { diffDias, faturaDoMes, GRUPOS, grupoConta, hoje, limiteUsado, mesAtual, patrimonio, resumoMes, saldoConta, somaMes, type GrupoConta, type ItemPagar } from '../lib/finance';
import { brl, diaMes, mesCurto, nomeMes, pct } from '../lib/format';

export function Dashboard({ irPara }: { irPara: (p: string) => void }) {
  const { dados, mes } = useStore();
  const r = useMemo(() => resumoMes(dados, mes), [dados, mes]);
  return (
    <>
      <Onboarding irPara={irPara} />
      <div className="grid dash">
        <SaldoPrevisto r={r} />
        <APagar r={r} />
        <Categorias r={r} irPara={irPara} />
        <Cartoes irPara={irPara} />
        <Contas irPara={irPara} />
        <Metas irPara={irPara} />
        <Ultimos irPara={irPara} />
      </div>
    </>
  );
}

type Resumo = ReturnType<typeof resumoMes>;

/* ---------- primeiros passos ---------- */
function Onboarding({ irPara }: { irPara: (p: string) => void }) {
  const { dados } = useStore();
  const { abrir } = useModal();
  const [fechado, setFechado] = useState(() => {
    try { return localStorage.getItem('df-onboarding') === '1'; } catch { return false; }
  });
  const passos = [
    { ok: dados.contas.length > 0, label: 'Cadastre suas contas bancárias e o saldo atual', acao: () => abrir(<ContaForm />) },
    { ok: dados.cartoes.length > 0, label: 'Cadastre seus cartões de crédito (fechamento e vencimento)', acao: () => abrir(<CartaoForm />) },
    { ok: dados.recorrentes.some((x) => x.tipo === 'receita'), label: 'Cadastre seu salário como receita fixa', acao: () => abrir(<RecorrenteForm />) },
    { ok: dados.recorrentes.some((x) => x.tipo === 'despesa'), label: 'Cadastre suas contas fixas (aluguel, luz, internet…)', acao: () => abrir(<RecorrenteForm />) },
    { ok: dados.transacoes.some((t) => t.tipo === 'despesa' && !t.recorrente_id), label: 'Lance seus gastos do dia a dia e compras no cartão', acao: () => abrir(<TransacaoForm />) },
    { ok: dados.metas.length > 0, label: 'Crie uma meta (reserva de emergência, viagem…)', acao: () => irPara('metas') },
  ];
  const feitos = passos.filter((p) => p.ok).length;
  if (fechado || feitos === passos.length) return null;
  return (
    <section className="card onboarding">
      <div className="row-between">
        <div>
          <h3>Primeiros passos</h3>
          <div className="muted small">{feitos} de {passos.length} concluídos. Quanto mais você registrar, mais preciso fica o saldo previsto.</div>
        </div>
        <button className="icon-btn" aria-label="Esconder" onClick={() => {
          try { localStorage.setItem('df-onboarding', '1'); } catch { /* */ }
          setFechado(true);
        }}><X size={16} /></button>
      </div>
      <ol className="steps">
        {passos.map((p, i) => (
          <li key={i} className={p.ok ? 'done' : ''}>
            <span className={`check ${p.ok ? 'on' : ''}`}>{p.ok ? <Check size={12} /> : i + 1}</span>
            <span className="grow">{p.label}</span>
            {!p.ok && <button className="ghost sm" onClick={p.acao}>Fazer agora</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------- saldo previsto ---------- */
function SaldoPrevisto({ r }: { r: Resumo }) {
  const { dados, mes } = useStore();
  const { abrir } = useModal();
  const recebido = r.receitas.filter((t) => t.pago).reduce((s, t) => s + t.valor, 0);
  const aReceber = r.totalReceitas - recebido;
  const pendentesReceita = r.receitas.filter((t) => !t.pago).sort((a, b) => a.data.localeCompare(b.data));

  // quanto de cada grupo já foi pago (já saiu da conta)
  const pagoFixas = r.despesasConta.filter((t) => t.recorrente_id && t.pago).reduce((s, t) => s + t.valor, 0);
  const pagoVariaveis = r.despesasConta.filter((t) => !t.recorrente_id && t.pago).reduce((s, t) => s + t.valor, 0);
  const pagoCartoes = r.faturas.reduce((s, f) => s + Math.min(f.pago, Math.max(f.total, 0)), 0);
  const faltaPagar = Math.max(r.totalDespesas - pagoFixas - pagoVariaveis - pagoCartoes, 0);

  // mês atual com contas cadastradas: parte do dinheiro de hoje (o que já foi pago já saiu do saldo)
  const disponivel = patrimonio(dados).disponivel;
  const modoHoje = mes === mesAtual() && dados.contas.some((c) => !c.arquivada);
  const sobra = modoHoje ? disponivel - faltaPagar : r.sobra;
  const depois = sobra + aReceber;

  const base = Math.max(r.totalReceitas, r.totalDespesas, 1);
  const segs = [
    { label: 'Contas fixas', v: r.fixas, pago: pagoFixas, cor: 'var(--navy)' },
    { label: 'Outras despesas', v: r.variaveis, pago: pagoVariaveis, cor: 'var(--blue)' },
    { label: 'Faturas de cartão', v: r.cartoes, pago: pagoCartoes, cor: 'var(--sky)' },
  ];
  const sobraPlano = r.sobra;

  return (
    <section className="card saldo">
      <div className="card-head">
        <h3>{modoHoje ? 'Sobra até agora' : 'Saldo previsto'} · {nomeMes(mes)}</h3>
      </div>

      {modoHoje ? (
        <div className="saldo-main">
          <Money value={sobra} size="xl" className={sobra < 0 ? 'neg' : ''} />
          <div className="saldo-note">
            <div className="conta-hoje small">
              <span className="muted">Disponível hoje</span> <b>{brl(disponivel)}</b>
              <span className="muted"> − falta pagar</span> <b>{brl(faltaPagar)}</b>
            </div>
            <div className="muted small">o que já foi pago (contas e faturas) já saiu do seu saldo</div>
            {aReceber > 0.005 && (
              <div className="small a-receber">
                <b className="pos">+ {brl(aReceber)}</b> a receber
                {pendentesReceita.length === 1
                  ? <> ({pendentesReceita[0].descricao}, dia {Number(pendentesReceita[0].data.slice(8))})</>
                  : <> ({pendentesReceita.length} entradas)</>}
                <span className="muted"> · depois disso: </span>
                <b className={depois >= 0 ? 'pos' : 'neg'}>{brl(depois)}</b>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="saldo-main">
          <Money value={sobra} size="xl" className={sobra < 0 ? 'neg' : ''} />
          <div className="saldo-note">
            {r.totalReceitas > 0 ? (
              <div className={`strong ${sobra >= 0 ? 'pos' : 'neg'}`}>
                {sobra >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} {pct(sobra / r.totalReceitas)} da renda {sobra >= 0 ? 'livre' : 'no vermelho'}
              </div>
            ) : (
              <button className="link" onClick={() => abrir(<RecorrenteForm />)}>+ Cadastre sua renda para ver a sobra</button>
            )}
            <div className="muted small">receitas − todas as despesas e faturas do mês</div>
          </div>
        </div>
      )}

      <div className="stack-bar">
        {segs.map((s) => s.v > 0 && <span key={s.label} className="seg" style={{ flexGrow: s.v / base, background: s.cor }} title={`${s.label}: ${brl(s.v)}`} />)}
        {sobraPlano > 0 && <span className="seg" style={{ flexGrow: sobraPlano / base, background: 'var(--green)' }} title={`Sobra do mês: ${brl(sobraPlano)}`} />}
        {r.totalDespesas === 0 && sobraPlano <= 0 && <span className="seg" style={{ flexGrow: 1, background: 'var(--soft)' }} />}
      </div>
      <div className="saldo-legend">
        <div>
          <div className="muted small"><Dot color="var(--fg)" /> Receitas</div>
          <div className="strong">{brl(r.totalReceitas)}</div>
          <div className="tiny muted">{aReceber > 0.005 ? `${brl(aReceber)} a receber` : 'tudo recebido'}</div>
        </div>
        {segs.map((s) => {
          const falta = Math.max(s.v - s.pago, 0);
          return (
            <div key={s.label}>
              <div className="muted small"><Dot color={s.cor} /> {s.label}</div>
              <div className="strong">− {brl(s.v)}</div>
              {s.v > 0 && <div className="tiny muted">{falta < 0.005 ? 'tudo pago' : s.pago > 0 ? `falta ${brl(falta)}` : 'nada pago ainda'}</div>}
            </div>
          );
        })}
        <div>
          <div className="muted small"><Dot color="var(--green)" /> <b className="fg">= Sobra do mês</b></div>
          <div className={`strong ${sobraPlano >= 0 ? 'pos' : 'neg'}`}>{brl(sobraPlano)}</div>
          {r.totalReceitas > 0 && <div className="tiny muted">{pct(sobraPlano / r.totalReceitas)} da renda</div>}
        </div>
      </div>
    </section>
  );
}

/* ---------- contas a pagar / receber ---------- */
function APagar({ r }: { r: Resumo }) {
  const { abrir } = useModal();
  const { alternarPago, alternarFatura, marcarFatura, abrirLancamento, ocupado } = useAcoes();
  const [aba, setAba] = useState<'pagar' | 'receber'>('pagar');
  const lista = aba === 'pagar' ? r.aPagar : r.aReceber;
  const pendentes = lista.filter((i) => !i.pago);
  const totalPend = pendentes.reduce((s, i) => s + i.valor, 0);
  const dias = [...new Set(lista.map((i) => i.data))].sort();
  const proximo = pendentes[0]?.data;
  const [dia, setDia] = useState<string | 'todos'>('todos');
  const visiveis = dia === 'todos' ? lista : lista.filter((i) => i.data === dia);
  const hj = hoje();

  const clicarCheck = (i: ItemPagar) => (i.fatura ? marcarFatura(i.fatura) : i.transacao && alternarPago(i.transacao));
  const clicarItem = (i: ItemPagar) => (i.fatura ? alternarFatura(i.fatura) : i.transacao && abrirLancamento(i.transacao));

  return (
    <section className="card pagar">
      <div className="card-head">
        <h3>{aba === 'pagar' ? 'Contas a pagar' : 'A receber'} {proximo && <span className="muted small">• próx. {diaMes(proximo)}</span>}</h3>
      </div>
      <Seg value={aba} onChange={(v) => { setAba(v); setDia('todos'); }} options={[{ value: 'pagar', label: 'A pagar' }, { value: 'receber', label: 'A receber' }]} />
      <div className="mt2">
        <Money value={totalPend} size="md" />
        <div className="muted small">
          {proximo && diffDias(hj, proximo) >= 0 ? `próxima em ${diffDias(hj, proximo)} dia(s) · ` : ''}
          {lista.length - pendentes.length} de {lista.length} {aba === 'pagar' ? 'pagas' : 'recebidas'}
        </div>
      </div>
      {lista.length === 0 ? (
        <Empty
          title={aba === 'pagar' ? 'Nada a pagar neste mês' : 'Nada a receber neste mês'}
          text={aba === 'pagar' ? 'Cadastre suas contas fixas para elas aparecerem aqui todo mês.' : 'Cadastre seu salário como receita fixa.'}
          action={<button className="ghost sm" onClick={() => abrir(<RecorrenteForm />)}><Plus size={13} /> Conta fixa</button>}
        />
      ) : (
        <>
          <div className="days">
            <button className={`day ${dia === 'todos' ? 'on' : ''}`} onClick={() => setDia('todos')}><span>Todas</span><span className="pips" /></button>
            {dias.map((d) => {
              const its = lista.filter((i) => i.data === d);
              const ok = its.every((i) => i.pago);
              return (
                <button key={d} className={`day ${d === dia ? 'on' : ''} ${ok ? 'ok' : d < hj ? 'late' : ''}`} onClick={() => setDia(d)}>
                  <span>{d.slice(8)}</span>
                  <span className="pips">{'•'.repeat(Math.min(its.length, 5))}</span>
                </button>
              );
            })}
          </div>
          <ul className="bill-list">
            {visiveis.map((i) => (
              <li key={i.id} className={i.pago ? 'paid' : ''}>
                <button className={`check ${i.pago ? 'on' : ''} ${ocupado(i.id) ? 'ocupado' : ''}`} onClick={() => clicarCheck(i)} aria-label={i.pago ? 'Desmarcar' : 'Marcar como pago'} title={i.pago ? 'Desmarcar' : 'Marcar como pago'}>{i.pago && <Check size={12} />}</button>
                <button className="grow item-btn" onClick={() => clicarItem(i)}>
                  <span>{i.descricao}</span>
                  <span className={`tiny ${!i.pago && i.data < hj ? 'neg' : 'muted'}`}>
                    {diaMes(i.data)}{!i.pago && i.data < hj ? ' · atrasada' : ''}{i.transacao?.virtual ? ' · prevista' : ''}
                  </span>
                </button>
                <span className="strong">{brl(i.valor)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ---------- gastos por categoria ---------- */
function Categorias({ r, irPara }: { r: Resumo; irPara: (p: string) => void }) {
  const { dados } = useStore();
  const linhas = [...r.porCategoria.entries()]
    .map(([id, v]) => ({ cat: dados.categorias.find((c) => c.id === id), v }))
    .sort((a, b) => b.v - a.v);
  const total = linhas.reduce((s, l) => s + l.v, 0);
  return (
    <section className="card categorias">
      <div className="card-head">
        <div>
          <h3>Gastos por categoria</h3>
          <div className="muted small mt">Total de despesas</div>
          <Money value={total} size="md" />
        </div>
        <button className="ghost sm" onClick={() => irPara('categorias')}>Orçamentos</button>
      </div>
      {linhas.length === 0 ? (
        <Empty title="Sem despesas neste mês" />
      ) : (
        <ul className="cat-list">
          {linhas.map(({ cat, v }) => {
            const orc = cat?.orcamento ?? 0;
            return (
              <li key={cat?.id ?? 'sem'}>
                <div className="row-between small">
                  <span><Dot color={cat?.cor ?? 'var(--gray)'} /> {cat?.nome ?? 'Sem categoria'}</span>
                  <span>
                    <b>{brl(v)}</b>
                    <span className="muted"> {orc ? `/ ${brl(orc)}` : r.totalReceitas ? `· ${pct(v / r.totalReceitas)}` : ''}</span>
                  </span>
                </div>
                <Progress value={orc ? v / orc : v / total} color={cat?.cor} danger={!!orc && v > orc} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------- cartões ---------- */
function Cartoes({ irPara }: { irPara: (p: string) => void }) {
  const { dados, mes } = useStore();
  const { abrir } = useModal();
  const { alternarFatura } = useAcoes();
  const cartoes = dados.cartoes.filter((c) => !c.arquivado);
  const [idx, setIdx] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const c = cartoes[Math.min(idx, cartoes.length - 1)];

  if (!c) {
    return (
      <section className="card cartoes">
        <h3>Cartões</h3>
        <Empty icon={<PixelIcon name="cartao" size={36} />} title="Nenhum cartão cadastrado" text="Cadastre para acompanhar faturas, parcelas e limite." action={<button className="ghost sm" onClick={() => abrir(<CartaoForm />)}><Plus size={13} /> Cartão</button>} />
      </section>
    );
  }
  const fatura = faturaDoMes(dados, c, mes);
  const prox = [0, 1, 2].map((i) => faturaDoMes(dados, c, somaMes(mes, i)));
  const max = Math.max(...prox.map((f) => f.total), 1);
  const ir = (n: number) => {
    const i = (idx + n + cartoes.length) % cartoes.length;
    setIdx(i);
    track.current?.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  return (
    <section className="card cartoes">
      <div className="card-head">
        <div>
          <h3>Cartões</h3>
          <div className="muted small mt">Fatura {c.nome} · vence {diaMes(fatura.vencimento)}</div>
          <Money value={fatura.total} size="md" />
        </div>
        {fatura.total > 0 && (
          <button className={`ghost sm ${fatura.paga ? 'done' : ''}`} onClick={() => alternarFatura(fatura)}>
            {fatura.paga ? <><Check size={13} /> Paga</> : 'Pagar'}
          </button>
        )}
      </div>
      <div className="row-between mt">
        <button className="ghost sm" onClick={() => irPara('cartoes')}>Ver fatura</button>
        {cartoes.length > 1 && (
          <div className="arrows">
            <button className="icon-btn sm" onClick={() => ir(-1)} aria-label="Anterior"><ChevronLeft size={15} /></button>
            <button className="icon-btn sm" onClick={() => ir(1)} aria-label="Próximo"><ChevronRight size={15} /></button>
          </div>
        )}
      </div>
      <div className="card-track" ref={track}>
        {cartoes.map((k, i) => (
          <CardVisual key={k.id} cartao={k} livre={k.limite - limiteUsado(dados, k)} status={faturaDoMes(dados, k, mes).paga ? 'Paga' : 'Aberta'} onClick={() => setIdx(i)} selecionado={i === idx && cartoes.length > 1} />
        ))}
      </div>
      <div className="tiny muted caps mt2">Próximas faturas</div>
      <div className="fat-bars">
        {prox.map((f, i) => (
          <div key={f.mes} className={`fat-bar ${i === 0 ? 'on' : ''}`}>
            <div className="fat-col"><span style={{ height: `${(f.total / max) * 100}%` }} /></div>
            <div className="strong small">{mesCurto(f.mes, true)}</div>
            <div className="tiny muted">{brl(f.total)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- contas bancárias ---------- */
function Contas({ irPara }: { irPara: (p: string) => void }) {
  const { dados } = useStore();
  const { abrir } = useModal();
  const contas = dados.contas.filter((c) => !c.arquivada);
  const saldos = contas.map((c) => ({ c, s: saldoConta(dados, c.id), g: grupoConta(c) }));
  const p = patrimonio(dados);
  const total = p.disponivel;
  const grupos = (['disponivel', 'investido', 'receber'] as GrupoConta[]).filter((g) => saldos.some((x) => x.g === g));
  return (
    <section className="card contas-card">
      <div className="card-head">
        <div>
          <h3>Contas e saldos</h3>
          <div className="muted small mt">Disponível hoje</div>
          <Money value={total} size="md" className={total < 0 ? 'neg' : ''} />
        </div>
        <button className="ghost sm" onClick={() => irPara('contas')}>Ver</button>
      </div>
      {contas.length === 0 ? (
        <Empty title="Nenhuma conta" action={<button className="ghost sm" onClick={() => abrir(<ContaForm />)}><Plus size={13} /> Conta</button>} />
      ) : (
        <>
          {grupos.map((g) => (
            <div key={g} className="conta-grupo">
              {grupos.length > 1 && (
                <div className="row-between tiny muted conta-grupo-head"><span>{GRUPOS[g]}</span><span>{brl(p[g])}</span></div>
              )}
              <ul className="rows">
                {saldos.filter((x) => x.g === g).map(({ c, s }) => (
                  <li key={c.id}>
                    <Dot color={c.cor} />
                    <span className="grow">{c.nome}</span>
                    <span className={`strong ${s < 0 ? 'neg' : ''}`}>{brl(s)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {grupos.length > 1 && (
            <div className="row-between conta-patrimonio"><span className="strong">Patrimônio total</span><b>{brl(p.total)}</b></div>
          )}
        </>
      )}
    </section>
  );
}

/* ---------- metas ---------- */
function Metas({ irPara }: { irPara: (p: string) => void }) {
  const { dados } = useStore();
  const { abrir } = useModal();
  return (
    <section className="card metas-card">
      <div className="card-head">
        <h3>Metas e reserva</h3>
        <button className="ghost sm" onClick={() => irPara('metas')}>Ver</button>
      </div>
      {dados.metas.length === 0 ? (
        <Empty icon={<PixelIcon name="alvo" size={36} />} title="Nenhuma meta" action={<button className="ghost sm" onClick={() => abrir(<MetaForm />)}><Plus size={13} /> Meta</button>} />
      ) : (
        <ul className="cat-list">
          {dados.metas.map((m) => (
            <li key={m.id}>
              <div className="row-between small">
                <span className="strong">{m.nome}</span>
                <span><b>{brl(m.atual)}</b> <span className="muted">/ {brl(m.alvo)}</span></span>
              </div>
              <Progress value={m.alvo ? m.atual / m.alvo : 0} color={m.cor} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- últimos lançamentos ---------- */
function Ultimos({ irPara }: { irPara: (p: string) => void }) {
  const { dados } = useStore();
  const { abrirLancamento } = useAcoes();
  const ult = dados.transacoes.filter((t) => !t.grupo || t.parcela === 1).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')).slice(0, 6);
  return (
    <section className="card ultimos">
      <div className="card-head">
        <h3>Últimos lançamentos</h3>
        <button className="ghost sm" onClick={() => irPara('lancamentos')}>Ver todos</button>
      </div>
      {ult.length === 0 ? (
        <Empty title="Nenhum lançamento ainda" text='Use o botão "+ Adicionar" no topo.' />
      ) : (
        <ul className="rows">
          {ult.map((t) => {
            const cat = dados.categorias.find((c) => c.id === t.categoria_id);
            const sinal = t.tipo === 'receita' ? 'pos' : t.tipo === 'despesa' ? '' : 'muted';
            return (
              <li key={t.id} className="clickable" onClick={() => abrirLancamento(t)}>
                <Dot color={cat?.cor ?? 'var(--gray)'} />
                <span className="grow">{t.descricao}{t.parcelas ? <span className="muted"> {t.parcela}/{t.parcelas}</span> : null}</span>
                <span className="muted small">{diaMes(t.data)}</span>
                <span className={`strong ${sinal}`}>{t.tipo === 'receita' ? '+ ' : t.tipo === 'despesa' ? '− ' : ''}{brl(t.valor)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
