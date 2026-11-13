import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Dot, Money, Progress, Seg } from '../components/ui';
import { resumoMes, somaMes } from '../lib/finance';
import { brl, mesCurto, pct } from '../lib/format';

export function Relatorios() {
  const { dados, mes, setMes } = useStore();
  const [n, setN] = useState<'6' | '12'>('12');
  const meses = useMemo(() => Array.from({ length: Number(n) }, (_, i) => somaMes(mes, i - Number(n) + 1)), [mes, n]);
  const resumos = useMemo(() => meses.map((m) => ({ m, r: resumoMes(dados, m) })), [dados, meses]);
  const max = Math.max(...resumos.flatMap(({ r }) => [r.totalReceitas, r.totalDespesas]), 1);
  const somaR = resumos.reduce((s, x) => s + x.r.totalReceitas, 0);
  const somaD = resumos.reduce((s, x) => s + x.r.totalDespesas, 0);

  const porCat = new Map<string, number>();
  for (const { r } of resumos) for (const [k, v] of r.porCategoria) porCat.set(k, (porCat.get(k) ?? 0) + v);
  const cats = [...porCat.entries()].map(([id, v]) => ({ c: dados.categorias.find((x) => x.id === id), v })).sort((a, b) => b.v - a.v);
  const totCat = cats.reduce((s, x) => s + x.v, 0);

  return (
    <div className="page">
      <section className="card">
        <div className="page-head">
          <div>
            <h2>Relatórios</h2>
            <div className="muted small">Últimos {n} meses até {mesCurto(mes, true)} (inclui contas fixas previstas)</div>
          </div>
          <div style={{ width: 200 }}><Seg value={n} onChange={setN} options={[{ value: '6', label: '6 meses' }, { value: '12', label: '12 meses' }]} /></div>
        </div>
        <div className="summary">
          <div><div className="muted small">Receitas no período</div><Money value={somaR} size="sm" className="pos" /></div>
          <div><div className="muted small">Despesas no período</div><Money value={somaD} size="sm" /></div>
          <div><div className="muted small">Economia</div><Money value={somaR - somaD} size="sm" className={somaR - somaD < 0 ? 'neg' : 'pos'} /></div>
          <div><div className="muted small">Taxa de poupança</div><div className="strong">{somaR ? pct((somaR - somaD) / somaR, 1) : '—'}</div></div>
          <div><div className="muted small">Gasto médio/mês</div><div className="strong">{brl(somaD / meses.length)}</div></div>
        </div>
        <div className="report-bars">
          {resumos.map(({ m, r }) => (
            <button key={m} className={`rb ${m === mes ? 'on' : ''}`} onClick={() => setMes(m)} title={`Receitas ${brl(r.totalReceitas)} · Despesas ${brl(r.totalDespesas)}`}>
              <span className="rb-cols">
                <span className="rb-r" style={{ height: `${(r.totalReceitas / max) * 100}%` }} />
                <span className="rb-d" style={{ height: `${(r.totalDespesas / max) * 100}%` }} />
              </span>
              <span className="tiny">{mesCurto(m)}</span>
              <span className={`tiny strong ${r.sobra < 0 ? 'neg' : 'pos'}`}>{r.sobra >= 0 ? '+' : ''}{(r.sobra / 1000).toFixed(1).replace('.', ',')}k</span>
            </button>
          ))}
        </div>
        <div className="small muted"><Dot color="var(--green)" /> Receitas &nbsp; <Dot color="var(--blue)" /> Despesas</div>
      </section>

      <section className="card">
        <h3>Para onde foi o dinheiro</h3>
        <ul className="cat-list mt2">
          {cats.map(({ c, v }) => (
            <li key={c?.id ?? 'sem'}>
              <div className="row-between small">
                <span><Dot color={c?.cor ?? 'var(--gray)'} /> {c?.nome ?? 'Sem categoria'}</span>
                <span><b>{brl(v)}</b> <span className="muted">· {pct(v / totCat)} · {brl(v / meses.length)}/mês</span></span>
              </div>
              <Progress value={v / (cats[0]?.v || 1)} color={c?.cor} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
