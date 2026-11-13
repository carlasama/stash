import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { Dot, Empty, Money, useModal } from '../components/ui';
import { RecorrenteForm } from '../components/forms';
import { brl, mesCurto } from '../lib/format';
import type { Recorrente } from '../lib/types';

export function Recorrentes() {
  const { dados, mes } = useStore();
  const { abrir } = useModal();
  const vigente = (r: Recorrente) => r.ativo && r.inicio <= mes && (!r.fim || r.fim >= mes);

  const bloco = (tipo: 'receita' | 'despesa') => {
    const lista = dados.recorrentes.filter((r) => r.tipo === tipo).sort((a, b) => Number(vigente(b)) - Number(vigente(a)) || a.dia - b.dia);
    const total = lista.filter(vigente).reduce((s, r) => s + r.valor, 0);
    return (
      <section className="card">
        <div className="card-head">
          <div>
            <h3>{tipo === 'receita' ? 'Receitas fixas' : 'Despesas fixas'}</h3>
            <div className="muted small mt">Total por mês</div>
            <Money value={total} size="md" className={tipo === 'receita' ? 'pos' : ''} />
          </div>
        </div>
        {lista.length === 0 ? (
          <Empty title={tipo === 'receita' ? 'Nenhuma receita fixa' : 'Nenhuma despesa fixa'} text={tipo === 'receita' ? 'Ex.: salário, aluguel que você recebe, pensão.' : 'Ex.: aluguel, condomínio, luz, internet, academia, streaming.'} />
        ) : (
          <ul className="rows">
            {lista.map((r) => {
              const cat = dados.categorias.find((c) => c.id === r.categoria_id);
              const meio = r.cartao_id ? `💳 ${dados.cartoes.find((c) => c.id === r.cartao_id)?.nome ?? ''}` : dados.contas.find((c) => c.id === r.conta_id)?.nome ?? '';
              return (
                <li key={r.id} className={`clickable ${vigente(r) ? '' : 'inativa'}`} onClick={() => abrir(<RecorrenteForm inicial={r} />)}>
                  <span className="dia-badge">{String(r.dia).padStart(2, '0')}</span>
                  <span className="grow">
                    <div>{r.descricao} {!r.ativo ? <span className="tag">pausada</span> : r.fim && <span className="tag">até {mesCurto(r.fim, true)}</span>}</div>
                    <div className="tiny muted">{cat && <><Dot color={cat.cor} /> {cat.nome} · </>}{meio}</div>
                  </span>
                  <span className="strong">{brl(r.valor)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  };

  return (
    <div className="page">
      <section className="card page-head">
        <div>
          <h2>Contas fixas</h2>
          <div className="muted small">O que se repete todo mês. Aparece como "previsto" em cada mês até você marcar como pago.</div>
        </div>
        <button className="btn-primary" onClick={() => abrir(<RecorrenteForm />)}><Plus size={15} /> Nova conta fixa</button>
      </section>
      <div className="grid two">
        {bloco('receita')}
        {bloco('despesa')}
      </div>
    </div>
  );
}
