import { useRef, useState } from 'react';
import { useStore } from '../store';
import { useModal } from '../components/ui';
import { PagarFaturaForm, TransacaoForm } from '../components/forms';
import { grupoConta, hoje, type Fatura } from './finance';
import { mesCurto } from './format';
import type { Transacao } from './types';

const n2 = (n: number) => Math.round(n * 100) / 100;

/** Ações comuns usadas em várias telas. */
export function useAcoes() {
  const { dados, inserir, atualizar, remover, toast } = useStore();
  const { abrir } = useModal();
  // evita clique duplo enquanto salva (ex.: duas cópias de uma conta fixa)
  const emAndamento = useRef(new Set<string>());
  const [ocupados, setOcupados] = useState<string[]>([]);

  async function comTrava(id: string, fn: () => Promise<void>) {
    if (emAndamento.current.has(id)) return;
    emAndamento.current.add(id);
    setOcupados((o) => [...o, id]);
    try {
      await fn();
    } finally {
      emAndamento.current.delete(id);
      setOcupados((o) => o.filter((x) => x !== id));
    }
  }

  const ocupado = (id: string) => ocupados.includes(id);

  function alternarPago(t: Transacao) {
    return comTrava(t.id, async () => {
      if (t.virtual) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, virtual, ...resto } = t;
        await inserir('transacoes', [{ ...resto, pago: true }]);
      } else {
        await atualizar('transacoes', t.id, { pago: !t.pago });
      }
    });
  }

  const pagamentosDa = (f: Fatura) =>
    dados.transacoes.filter((t) => t.tipo === 'pagamento_fatura' && t.cartao_id === f.cartao.id && t.fatura === f.mes);

  /** Check da fatura: marca como paga na hora (valor que falta, na data do vencimento se já passou) ou desfaz. */
  function marcarFatura(f: Fatura) {
    const id = `fat_${f.cartao.id}_${f.mes}`;
    return comTrava(id, async () => {
      if (f.paga) {
        await remover('transacoes', pagamentosDa(f).map((t) => t.id));
        toast('Fatura desmarcada');
        return;
      }
      const falta = n2(f.total - f.pago);
      if (falta <= 0) return;
      const conta = f.cartao.conta_id ?? dados.contas.find((c) => !c.arquivada && grupoConta(c) === 'disponivel')?.id ?? null;
      await inserir('transacoes', [{
        descricao: `Pagamento fatura ${f.cartao.nome} (${mesCurto(f.mes, true)})`, valor: falta, tipo: 'pagamento_fatura',
        data: f.vencimento < hoje() ? f.vencimento : hoje(), conta_id: conta, cartao_id: f.cartao.id, fatura: f.mes, pago: true,
      }]);
      toast('Fatura marcada como paga');
    });
  }

  /** Clique no nome da fatura: abre o pagamento detalhado (valor parcial, conta, data) ou oferece desfazer. */
  async function alternarFatura(f: Fatura) {
    if (f.paga) {
      if (!window.confirm('Desfazer o pagamento desta fatura?')) return;
      await remover('transacoes', pagamentosDa(f).map((t) => t.id));
      toast('Pagamento desfeito');
    } else {
      abrir(<PagarFaturaForm fatura={f} />);
    }
  }

  async function abrirLancamento(t: Transacao) {
    if (t.tipo === 'pagamento_fatura') {
      if (window.confirm(`${t.descricao}\n\nExcluir este pagamento de fatura?`)) {
        await remover('transacoes', [t.id]);
        toast('Pagamento excluído');
      }
      return;
    }
    abrir(<TransacaoForm inicial={t} />);
  }

  return { alternarPago, alternarFatura, marcarFatura, abrirLancamento, ocupado };
}
