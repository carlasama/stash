import { PixelIcon } from '../components/PixelIcon';
import { Mascote } from '../components/Mascote';
import { Pencil, Plus } from 'lucide-react';
import { useStore } from '../store';
import { Empty, Money, Progress, useModal } from '../components/ui';
import { AporteForm, MetaForm } from '../components/forms';
import { diffDias, hoje } from '../lib/finance';
import { brl, dataBR, pct } from '../lib/format';

export function Metas() {
  const { dados } = useStore();
  const { abrir } = useModal();
  const total = dados.metas.reduce((s, m) => s + m.atual, 0);
  return (
    <div className="page">
      <section className="card page-head">
        <div>
          <h2>Metas e reserva</h2>
          <div className="muted small">Total guardado em metas: <b>{brl(total)}</b></div>
        </div>
        <button className="btn-primary" onClick={() => abrir(<MetaForm />)}><Plus size={15} /> Nova meta</button>
      </section>
      {dados.metas.length === 0 ? (
        <section className="card"><Empty icon={<PixelIcon name="alvo" size={36} />} title="Nenhuma meta" text="Crie sua reserva de emergência (recomendado: 6× seu custo mensal) e outros objetivos." /></section>
      ) : (
        <div className="acc-grid">
          {dados.metas.map((m) => {
            const falta = Math.max(m.alvo - m.atual, 0);
            const meses = m.prazo ? Math.max(Math.ceil(diffDias(hoje(), m.prazo) / 30.4), 0) : 0;
            return (
              <section key={m.id} className="card meta">
                <div className="row-between">
                  <h3>{m.nome}</h3>
                  <button className="icon-btn sm" onClick={() => abrir(<MetaForm inicial={m} />)} aria-label="Editar"><Pencil size={13} /></button>
                </div>
                <div className="row-between"><Money value={m.atual} size="md" />{falta === 0 && m.alvo > 0 && <Mascote animacao="festa" className="mascote-festa" />}</div>
                <div className="muted small">de {brl(m.alvo)} · {pct(m.alvo ? m.atual / m.alvo : 0)}</div>
                <Progress value={m.alvo ? m.atual / m.alvo : 0} color={m.cor} />
                <div className="tiny muted">
                  {falta === 0 ? 'Meta atingida!' : `Faltam ${brl(falta)}`}
                  {m.prazo && falta > 0 && ` · até ${dataBR(m.prazo)}${meses > 0 ? ` (≈ ${brl(falta / meses)}/mês)` : ''}`}
                </div>
                <button className="ghost" onClick={() => abrir(<AporteForm meta={m} />)}>Guardar / retirar</button>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
