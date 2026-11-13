import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { Dot, Progress, useModal } from '../components/ui';
import { CategoriaForm } from '../components/forms';
import { itensDoMes } from '../lib/finance';
import { brl, nomeMes } from '../lib/format';

export function Categorias() {
  const { dados, mes } = useStore();
  const { abrir } = useModal();
  const gasto = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of itensDoMes(dados, mes)) {
      if (t.tipo !== 'despesa' && t.tipo !== 'receita') continue;
      if (t.categoria_id) m.set(t.categoria_id, (m.get(t.categoria_id) ?? 0) + t.valor);
    }
    return m;
  }, [dados, mes]);

  const bloco = (tipo: 'despesa' | 'receita') => {
    const cats = dados.categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome));
    const orcTotal = cats.reduce((s, c) => s + (c.orcamento ?? 0), 0);
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <h3>{tipo === 'despesa' ? 'Despesas' : 'Receitas'}</h3>
            {tipo === 'despesa' && orcTotal > 0 && <div className="muted small">Orçamento total: {brl(orcTotal)}/mês</div>}
          </div>
          <button className="ghost sm" onClick={() => abrir(<CategoriaForm tipoInicial={tipo} />)}><Plus size={13} /> Categoria</button>
        </div>
        <ul className="cat-list">
          {cats.map((c) => {
            const v = gasto.get(c.id) ?? 0;
            return (
              <li key={c.id} className="clickable" onClick={() => abrir(<CategoriaForm inicial={c} />)}>
                <div className="row-between small">
                  <span><Dot color={c.cor} /> {c.nome}</span>
                  <span><b>{brl(v)}</b>{c.orcamento ? <span className="muted"> / {brl(c.orcamento)}</span> : null}</span>
                </div>
                {c.orcamento ? <Progress value={v / c.orcamento} color={c.cor} danger={v > c.orcamento} /> : null}
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="page">
      <section className="card page-head">
        <div>
          <h2>Categorias e orçamento</h2>
          <div className="muted small">Valores de {nomeMes(mes)}. Clique numa categoria de despesa para definir um limite mensal.</div>
        </div>
      </section>
      <div className="grid two">
        {bloco('despesa')}
        {bloco('receita')}
      </div>
    </div>
  );
}
