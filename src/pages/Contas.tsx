import { PixelIcon } from '../components/PixelIcon';
import { ArrowLeftRight, HandCoins, Plus } from 'lucide-react';
import { useStore } from '../store';
import { Empty, Money, useModal } from '../components/ui';
import { ContaForm, TransacaoForm } from '../components/forms';
import { GRUPOS, grupoConta, patrimonio, saldoConta, type GrupoConta } from '../lib/finance';
import { brl } from '../lib/format';
import type { Conta } from '../lib/types';

export const TIPOS: Record<Conta['tipo'], string> = {
  corrente: 'Conta corrente', poupanca: 'Poupança', investimento: 'Investimento', carteira: 'Dinheiro', a_receber: 'A receber',
};

const DICAS: Record<GrupoConta, string> = {
  disponivel: 'Dinheiro que você pode usar agora.',
  investido: 'Reserva e aplicações. Toque para atualizar o valor com o rendimento.',
  receber: 'Dinheiro seu com outras pessoas. Use "Recebi" quando pagarem — não conta como renda.',
};

export function Contas() {
  const { dados } = useStore();
  const { abrir } = useModal();
  const ativas = dados.contas.filter((c) => !c.arquivada);
  const arquivadas = dados.contas.filter((c) => c.arquivada);
  const p = patrimonio(dados);
  const disponiveis = ativas.filter((c) => grupoConta(c) === 'disponivel');

  return (
    <div className="page">
      <section className="card page-head">
        <div>
          <h2>Contas e saldos</h2>
          <div className="muted small">Toque em uma conta para corrigir o saldo de hoje.</div>
        </div>
        <div className="row">
          {ativas.length > 1 && <button className="ghost" onClick={() => abrir(<TransacaoForm tipoInicial="transferencia" />)}><ArrowLeftRight size={14} /> Transferir</button>}
          <button className="btn-primary" onClick={() => abrir(<ContaForm />)}><Plus size={15} /> Nova conta</button>
        </div>
      </section>

      {ativas.length === 0 ? (
        <section className="card"><Empty icon={<PixelIcon name="moeda" size={36} />} title="Nenhuma conta cadastrada" text="Cadastre suas contas bancárias, investimentos, dinheiro em espécie e valores que tem a receber." /></section>
      ) : (
        <>
          <section className="card patrimonio">
            <div>
              <div className="muted small">Patrimônio total</div>
              <Money value={p.total} size="lg" className={p.total < 0 ? 'neg' : ''} />
            </div>
            {(['disponivel', 'investido', 'receber'] as GrupoConta[]).map((g) => (
              <div key={g}>
                <div className="muted small">{GRUPOS[g]}</div>
                <div className="strong">{brl(p[g])}</div>
              </div>
            ))}
          </section>

          {(['disponivel', 'investido', 'receber'] as GrupoConta[]).map((g) => {
            const contas = ativas.filter((c) => grupoConta(c) === g);
            if (!contas.length) return null;
            return (
              <section key={g} className="grupo-contas">
                <div className="grupo-head">
                  <h3>{GRUPOS[g]}</h3>
                  <span className="muted small">{DICAS[g]}</span>
                </div>
                <div className="acc-grid">
                  {contas.map((c) => {
                    const s = saldoConta(dados, c.id);
                    const pend = dados.transacoes.filter((t) => !t.pago && t.conta_id === c.id && !t.cartao_id)
                      .reduce((acc, t) => acc + (t.tipo === 'receita' ? t.valor : -t.valor), 0);
                    return (
                      <div key={c.id} role="button" tabIndex={0} className="card acc" style={{ borderTop: `4px solid ${c.cor}` }}
                        onClick={() => abrir(<ContaForm inicial={c} />)}
                        onKeyDown={(e) => e.key === 'Enter' && abrir(<ContaForm inicial={c} />)}>
                        <div className="muted small">{TIPOS[c.tipo]}</div>
                        <div className="strong">{c.nome}</div>
                        <Money value={s} size="md" className={s < 0 ? 'neg' : ''} />
                        {pend !== 0 && <div className="tiny muted">pendentes lançados: {pend > 0 ? '+' : ''}{brl(pend)}</div>}
                        {g === 'receber' && s > 0 && (
                          <button className="ghost sm" onClick={(e) => {
                            e.stopPropagation();
                            abrir(<TransacaoForm tipoInicial="transferencia" contaInicial={c.id} destinoInicial={disponiveis[0]?.id} descricaoInicial={`Recebido: ${c.nome}`} />);
                          }}><HandCoins size={13} /> Recebi</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}
      {arquivadas.length > 0 && (
        <section className="card">
          <h3>Arquivadas</h3>
          <ul className="rows">
            {arquivadas.map((c) => (
              <li key={c.id} className="clickable inativa" onClick={() => abrir(<ContaForm inicial={c} />)}>
                <span className="grow">{c.nome}</span><span>{brl(saldoConta(dados, c.id))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
