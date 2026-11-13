import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { ColorPicker, Dialog, Field, MoneyInput, Seg, useModal } from './ui';
import { diaLocal, faturaDe, hoje, mesDe, saldoConta, somaMes, usoLancado, type Fatura } from '../lib/finance';
import { brl, dataBR, mesCurto, nomeMes } from '../lib/format';
import type { Cartao, Categoria, Conta, Meta, Recorrente, Transacao } from '../lib/types';

const n2 = (n: number) => Math.round(n * 100) / 100;

/* ======================================================================
   Lançamento (receita / despesa / transferência / compra no cartão)
   ====================================================================== */
type TipoForm = 'despesa' | 'receita' | 'transferencia';

export function TransacaoForm({ inicial, tipoInicial = 'despesa', cartaoInicial, contaInicial, destinoInicial, descricaoInicial }: {
  inicial?: Transacao; tipoInicial?: TipoForm; cartaoInicial?: string;
  contaInicial?: string; destinoInicial?: string; descricaoInicial?: string;
}) {
  const { dados, inserir, atualizar, remover, toast } = useStore();
  const { fechar } = useModal();
  const contas = dados.contas.filter((c) => !c.arquivada || c.id === inicial?.conta_id);
  const cartoes = dados.cartoes.filter((c) => !c.arquivado || c.id === inicial?.cartao_id);
  const editando = !!inicial;
  if (cartaoInicial === '__primeiro') cartaoInicial = cartoes[0]?.id;

  const [tipo, setTipo] = useState<TipoForm>((inicial?.tipo as TipoForm) ?? tipoInicial);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? descricaoInicial ?? '');
  const [valor, setValor] = useState<number | null>(inicial?.valor ?? null);
  const [data, setData] = useState(inicial?.data ?? hoje());
  const [categoria, setCategoria] = useState(inicial?.categoria_id ?? '');
  const [meio, setMeio] = useState<'conta' | 'cartao'>(inicial?.cartao_id || cartaoInicial ? 'cartao' : 'conta');
  const [conta, setConta] = useState(inicial?.conta_id ?? contaInicial ?? contas[0]?.id ?? '');
  const [destino, setDestino] = useState(inicial?.conta_destino_id ?? destinoInicial ?? contas.find((c) => c.id !== (contaInicial ?? contas[0]?.id))?.id ?? '');
  const [cartao, setCartao] = useState(inicial?.cartao_id ?? cartaoInicial ?? cartoes[0]?.id ?? '');
  const [pago, setPago] = useState(inicial ? inicial.pago : true);
  const [parcelas, setParcelas] = useState(1);
  const [repetir, setRepetir] = useState(false);
  const [notas, setNotas] = useState(inicial?.notas ?? '');
  const [pagoTocado, setPagoTocado] = useState(editando);

  const cats = dados.categorias.filter((c) => c.tipo === (tipo === 'receita' ? 'receita' : 'despesa'));
  const usaCartao = tipo === 'despesa' && meio === 'cartao' && !!cartao;
  const cartaoObj = dados.cartoes.find((c) => c.id === cartao);
  const faturaBase = usaCartao && cartaoObj ? faturaDe(cartaoObj, data) : null;

  async function salvar() {
    if (valor == null || valor <= 0) return toast('Informe um valor maior que zero.');
    if (tipo === 'transferencia') {
      if (!conta || !destino || conta === destino) return toast('Escolha duas contas diferentes.');
    } else if (!usaCartao && !conta && contas.length) {
      return toast('Escolha a conta.');
    }

    const base = {
      descricao: descricao.trim() || (tipo === 'transferencia' ? 'Transferência' : cats.find((c) => c.id === categoria)?.nome ?? 'Sem descrição'),
      tipo,
      data,
      categoria_id: tipo === 'transferencia' ? null : categoria || null,
      conta_id: usaCartao ? null : conta || null,
      conta_destino_id: tipo === 'transferencia' ? destino : null,
      cartao_id: usaCartao ? cartao : null,
      fatura: faturaBase,
      pago: tipo === 'transferencia' || usaCartao ? true : pago,
      notas: notas.trim() || null,
    };

    if (inicial && !inicial.virtual) {
      await atualizar('transacoes', inicial.id, { ...base, valor: n2(valor), ...(inicial.grupo ? { fatura: inicial.fatura } : {}) });
    } else if (inicial?.virtual) {
      await inserir('transacoes', [{ ...base, valor: n2(valor), recorrente_id: inicial.recorrente_id, competencia: inicial.competencia }]);
    } else if (usaCartao && parcelas > 1) {
      const grupo = crypto.randomUUID();
      const p = Math.floor((valor / parcelas) * 100) / 100;
      const resto = n2(valor - p * parcelas);
      await inserir('transacoes', Array.from({ length: parcelas }, (_, i) => ({
        ...base, valor: n2(p + (i === 0 ? resto : 0)), fatura: somaMes(faturaBase!, i), parcela: i + 1, parcelas, grupo,
      })));
    } else if (repetir && tipo !== 'transferencia') {
      const [rec] = await inserir('recorrentes', [{
        descricao: base.descricao, valor: n2(valor), tipo, dia: Number(data.slice(8, 10)), categoria_id: base.categoria_id,
        conta_id: base.conta_id, cartao_id: base.cartao_id, inicio: mesDe(data), fim: null, ativo: true,
      }]);
      await inserir('transacoes', [{ ...base, valor: n2(valor), recorrente_id: rec.id, competencia: mesDe(data) }]);
    } else {
      await inserir('transacoes', [{ ...base, valor: n2(valor) }]);
    }
    toast(editando ? 'Lançamento atualizado' : 'Lançamento salvo');
    fechar();
  }

  async function excluir() {
    if (!inicial || inicial.virtual) return;
    if (inicial.grupo) {
      const todas = dados.transacoes.filter((t) => t.grupo === inicial.grupo);
      const tudo = window.confirm(`Esta compra tem ${todas.length} parcelas.\n\nOK = excluir TODAS as parcelas\nCancelar = excluir só esta`);
      await remover('transacoes', tudo ? todas.map((t) => t.id) : [inicial.id]);
    } else {
      if (!window.confirm('Excluir este lançamento?')) return;
      await remover('transacoes', [inicial.id]);
    }
    toast('Lançamento excluído');
    fechar();
  }

  const semConta = contas.length === 0;

  return (
    <Dialog
      title={editando ? (inicial?.virtual ? 'Lançar conta fixa do mês' : 'Editar lançamento') : 'Novo lançamento'}
      onSubmit={salvar}
      footer={editando && !inicial?.virtual && (
        <button type="button" className="ghost danger" onClick={excluir}><Trash2 size={14} /> Excluir</button>
      )}
    >
      {!editando && (
        <Seg<TipoForm>
          value={tipo}
          onChange={setTipo}
          options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }, { value: 'transferencia', label: 'Transferência' }]}
        />
      )}
      {inicial?.virtual && <p className="hint-box">Esta é uma conta fixa prevista. Ao salvar, ela vira um lançamento deste mês (o valor da conta fixa não muda).</p>}
      {inicial?.grupo && <p className="hint-box">Parcela {inicial.parcela}/{inicial.parcelas}. Alterações valem só para esta parcela.</p>}

      <div className="form-grid">
        <Field label="Valor"><MoneyInput value={valor} onChange={setValor} autoFocus={!editando} /></Field>
        <Field label="Data"><input type="date" value={data} required onChange={(e) => {
          setData(e.target.value);
          if (!pagoTocado) setPago(e.target.value <= hoje());
        }} /></Field>
        <Field label="Descrição" span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === 'receita' ? 'Ex.: Salário' : 'Ex.: Mercado'} />
        </Field>

        {tipo !== 'transferencia' && (
          <Field label="Categoria" span>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              <option value="">Sem categoria</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        )}

        {tipo === 'despesa' && cartoes.length > 0 && !inicial?.grupo && (
          <Field label="Pagar com" span>
            <Seg value={meio} onChange={setMeio} options={[{ value: 'conta', label: 'Conta / dinheiro / Pix' }, { value: 'cartao', label: 'Cartão de crédito' }]} />
          </Field>
        )}

        {tipo === 'transferencia' ? (
          <>
            <Field label="De"><ContaSelect contas={contas} value={conta} onChange={setConta} /></Field>
            <Field label="Para"><ContaSelect contas={contas} value={destino} onChange={setDestino} /></Field>
          </>
        ) : usaCartao ? (
          <>
            <Field label="Cartão" hint={faturaBase ? `Entra na fatura de ${nomeMes(faturaBase)}` : undefined}>
              <select value={cartao} onChange={(e) => setCartao(e.target.value)} disabled={!!inicial?.grupo}>
                {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
            {!editando && (
              <Field label="Parcelas" hint={parcelas > 1 && valor ? `${parcelas}× de ${brl(valor / parcelas)} · até ${mesCurto(somaMes(faturaBase!, parcelas - 1), true)}` : undefined}>
                <select value={parcelas} onChange={(e) => { setParcelas(Number(e.target.value)); setRepetir(false); }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i + 1}>{i === 0 ? 'À vista' : `${i + 1}×`}</option>)}
                </select>
              </Field>
            )}
          </>
        ) : (
          <Field label="Conta" hint={semConta ? 'Cadastre uma conta em "Contas e saldos" para acompanhar o saldo.' : undefined}>
            <ContaSelect contas={contas} value={conta} onChange={setConta} vazio={semConta} />
          </Field>
        )}

        {tipo !== 'transferencia' && !usaCartao && (
          <Field label="Situação">
            <label className="check-line">
              <input type="checkbox" checked={pago} onChange={(e) => { setPago(e.target.checked); setPagoTocado(true); }} />
              {tipo === 'receita' ? 'Já recebi' : 'Já paguei'}
            </label>
          </Field>
        )}

        {!editando && tipo !== 'transferencia' && parcelas === 1 && (
          <Field label="Repetição" span>
            <label className="check-line">
              <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
              Repetir todo mês (vira uma conta fixa)
            </label>
          </Field>
        )}

        <Field label="Observações" span>
          <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function ContaSelect({ contas, value, onChange, vazio }: { contas: Conta[]; value: string; onChange: (v: string) => void; vazio?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={vazio}>
      {vazio && <option value="">Nenhuma conta cadastrada</option>}
      {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
    </select>
  );
}

/* ======================================================================
   Pagar fatura
   ====================================================================== */
export function PagarFaturaForm({ fatura }: { fatura: Fatura }) {
  const { dados, inserir, toast } = useStore();
  const { fechar } = useModal();
  const contas = dados.contas.filter((c) => !c.arquivada);
  const [valor, setValor] = useState<number | null>(n2(fatura.total - fatura.pago));
  const [conta, setConta] = useState(fatura.cartao.conta_id ?? contas[0]?.id ?? '');
  // fatura já vencida: provavelmente foi paga no vencimento
  const [data, setData] = useState(fatura.vencimento < hoje() ? fatura.vencimento : hoje());
  const contaSel = dados.contas.find((c) => c.id === conta);
  const jaDescontado = !!contaSel?.saldo_em && data < diaLocal(contaSel.saldo_em);
  return (
    <Dialog
      title={`Pagar fatura ${fatura.cartao.nome}`}
      onSubmit={async () => {
        if (!valor || valor <= 0) return toast('Informe o valor pago.');
        await inserir('transacoes', [{
          descricao: `Pagamento fatura ${fatura.cartao.nome} (${mesCurto(fatura.mes, true)})`, valor: n2(valor), tipo: 'pagamento_fatura',
          data, conta_id: conta || null, cartao_id: fatura.cartao.id, fatura: fatura.mes, pago: true,
        }]);
        toast('Pagamento registrado');
        fechar();
      }}
    >
      <p className="muted small">Fatura de {nomeMes(fatura.mes)} · total {brl(fatura.total)}{fatura.pago > 0 && ` · já pago ${brl(fatura.pago)}`}</p>
      <div className="form-grid">
        <Field label="Valor pago"><MoneyInput value={valor} onChange={setValor} autoFocus /></Field>
        <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></Field>
        <Field label="Pago com a conta" span><ContaSelect contas={contas} value={conta} onChange={setConta} vazio={!contas.length} /></Field>
      </div>
      {contaSel?.saldo_em && (
        <p className="tiny muted">
          {jaDescontado
            ? `Pago antes de ${dataBR(diaLocal(contaSel.saldo_em))}, quando você informou o saldo de ${contaSel.nome}: não desconta de novo.`
            : `Vai descontar do saldo de ${contaSel.nome}.`}
        </p>
      )}
    </Dialog>
  );
}

/* ======================================================================
   Conta fixa (recorrente)
   ====================================================================== */
export function RecorrenteForm({ inicial }: { inicial?: Recorrente }) {
  const { dados, inserir, atualizar, remover, toast, mes } = useStore();
  const { fechar } = useModal();
  const contas = dados.contas.filter((c) => !c.arquivada);
  const cartoes = dados.cartoes.filter((c) => !c.arquivado);
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'despesa');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [valor, setValor] = useState<number | null>(inicial?.valor ?? null);
  const [dia, setDia] = useState(inicial?.dia ?? 5);
  const [categoria, setCategoria] = useState(inicial?.categoria_id ?? '');
  const [meio, setMeio] = useState<'conta' | 'cartao'>(inicial?.cartao_id ? 'cartao' : 'conta');
  const [conta, setConta] = useState(inicial?.conta_id ?? contas[0]?.id ?? '');
  const [cartao, setCartao] = useState(inicial?.cartao_id ?? cartoes[0]?.id ?? '');
  const [inicio, setInicio] = useState(inicial?.inicio ?? mes);
  const [fim, setFim] = useState(inicial?.fim ?? '');
  const [ativo, setAtivo] = useState(inicial?.ativo ?? true);
  const cats = dados.categorias.filter((c) => c.tipo === tipo);
  const usaCartao = tipo === 'despesa' && meio === 'cartao' && !!cartao;

  return (
    <Dialog
      title={inicial ? 'Editar conta fixa' : 'Nova conta fixa'}
      onSubmit={async () => {
        if (!descricao.trim()) return toast('Dê um nome para a conta fixa.');
        if (valor == null || valor <= 0) return toast('Informe o valor.');
        const row = {
          descricao: descricao.trim(), valor: n2(valor), tipo, dia, categoria_id: categoria || null,
          conta_id: usaCartao ? null : conta || null, cartao_id: usaCartao ? cartao : null,
          inicio, fim: fim || null, ativo,
        };
        if (inicial) await atualizar('recorrentes', inicial.id, row);
        else await inserir('recorrentes', [row]);
        toast('Conta fixa salva');
        fechar();
      }}
      footer={inicial && (
        <button type="button" className="ghost danger" onClick={async () => {
          if (!window.confirm('Excluir esta conta fixa? Os lançamentos já feitos continuam no histórico.')) return;
          await remover('recorrentes', [inicial.id]);
          fechar();
        }}><Trash2 size={14} /> Excluir</button>
      )}
    >
      <p className="muted small">Contas e receitas que se repetem todo mês (salário, aluguel, internet, assinaturas…). Elas aparecem como previstas em cada mês até você marcar como pagas.</p>
      <Seg value={tipo} onChange={setTipo} options={[{ value: 'despesa', label: 'Despesa fixa' }, { value: 'receita', label: 'Receita fixa' }]} />
      <div className="form-grid">
        <Field label="Nome" span><input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === 'receita' ? 'Ex.: Salário' : 'Ex.: Aluguel'} required autoFocus /></Field>
        <Field label="Valor" hint="Se variar, use o valor médio"><MoneyInput value={valor} onChange={setValor} /></Field>
        <Field label="Dia do mês"><input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Math.min(31, Math.max(1, Number(e.target.value) || 1)))} /></Field>
        <Field label="Categoria" span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
        {tipo === 'despesa' && cartoes.length > 0 && (
          <Field label="Pagar com" span>
            <Seg value={meio} onChange={setMeio} options={[{ value: 'conta', label: 'Conta / boleto / Pix' }, { value: 'cartao', label: 'Cartão de crédito' }]} />
          </Field>
        )}
        {usaCartao ? (
          <Field label="Cartão" span>
            <select value={cartao} onChange={(e) => setCartao(e.target.value)}>
              {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        ) : (
          <Field label="Conta" span><ContaSelect contas={contas} value={conta} onChange={setConta} vazio={!contas.length} /></Field>
        )}
        <Field label="Começa em"><input type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></Field>
        <Field label="Termina em" hint="Vazio = sem data para acabar"><input type="month" value={fim} onChange={(e) => setFim(e.target.value)} /></Field>
        {inicial && (
          <Field label="Status" span>
            <label className="check-line"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativa</label>
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/* ======================================================================
   Conta bancária
   ====================================================================== */
export function ContaForm({ inicial }: { inicial?: Conta }) {
  const { inserir, atualizar, remover, toast, dados } = useStore();
  const { fechar } = useModal();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [tipo, setTipo] = useState<Conta['tipo']>(inicial?.tipo ?? 'corrente');
  // o usuário informa o saldo de HOJE; o saldo inicial é recalculado a partir dele
  const atual = inicial ? saldoConta(dados, inicial.id) : 0;
  const [saldo, setSaldo] = useState<number | null>(inicial ? n2(atual) : 0);
  const [cor, setCor] = useState(inicial?.cor ?? '#e0607a');
  const [arquivada, setArquivada] = useState(inicial?.arquivada ?? false);
  const usada = inicial && dados.transacoes.some((t) => t.conta_id === inicial.id || t.conta_destino_id === inicial.id);
  const rotuloSaldo = tipo === 'a_receber' ? 'Quanto ainda falta receber' : tipo === 'investimento' ? 'Valor atual do investimento' : 'Saldo hoje';
  const dicaSaldo = tipo === 'a_receber'
    ? 'Quando receber, use "Recebi" na conta: o valor vai para sua conta e não conta como renda.'
    : tipo === 'investimento'
      ? 'Veja no app do banco (valor bruto). Atualize quando quiser para acompanhar o rendimento.'
      : 'Veja no app do banco. Pode corrigir a qualquer momento.';
  return (
    <Dialog
      title={inicial ? 'Editar conta' : 'Nova conta'}
      onSubmit={async () => {
        if (!nome.trim()) return toast('Dê um nome para a conta.');
        const row: Record<string, unknown> = { nome: nome.trim(), tipo, cor, arquivada };
        // saldo novo (ou conta antiga sem data): grava o saldo e o momento em que foi informado
        if (!inicial || !inicial.saldo_em || Math.abs((saldo ?? 0) - atual) > 0.005) {
          row.saldo_inicial = n2(saldo ?? 0);
          row.saldo_em = new Date().toISOString();
        }
        if (inicial) await atualizar('contas', inicial.id, row);
        else await inserir('contas', [row]);
        toast('Conta salva');
        fechar();
      }}
      footer={inicial && (
        <button type="button" className="ghost danger" onClick={async () => {
          if (usada) return toast('Essa conta tem lançamentos. Arquive em vez de excluir.');
          if (!window.confirm('Excluir esta conta?')) return;
          await remover('contas', [inicial.id]);
          fechar();
        }}><Trash2 size={14} /> Excluir</button>
      )}
    >
      <div className="form-grid">
        <Field label="Nome" span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus
            placeholder={tipo === 'a_receber' ? 'Ex.: Empréstimo para Ana' : tipo === 'investimento' ? 'Ex.: CDB Inter 120% CDI' : 'Ex.: Nubank, Itaú, Carteira'} />
        </Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Conta['tipo'])}>
            <option value="corrente">Conta corrente</option>
            <option value="carteira">Dinheiro / carteira</option>
            <option value="poupanca">Poupança</option>
            <option value="investimento">Investimento (CDB, Tesouro…)</option>
            <option value="a_receber">Valor a receber (emprestei)</option>
          </select>
        </Field>
        <Field label={rotuloSaldo} hint={dicaSaldo}><MoneyInput value={saldo} onChange={setSaldo} /></Field>
        <Field label="Cor" span><ColorPicker value={cor} onChange={setCor} /></Field>
        {inicial && (
          <Field label="Status" span>
            <label className="check-line"><input type="checkbox" checked={arquivada} onChange={(e) => setArquivada(e.target.checked)} /> Arquivada (some das listas, mantém o histórico)</label>
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/* ======================================================================
   Cartão de crédito
   ====================================================================== */
const BANCOS = [
  { nome: 'Nubank', cor: '#8a05be' },
  { nome: 'Itaú', cor: '#ec7000' },
  { nome: 'Santander', cor: '#cc0000' },
  { nome: 'Inter', cor: '#ff7a00' },
  { nome: 'Mercado Pago', cor: '#00a6e0' },
  { nome: 'Amazon', cor: '#232f3e' },
];
/** Na maioria dos cartões a fatura fecha ~7 dias antes do vencimento. */
const fechamentoPadrao = (venc: number) => (venc - 7 >= 1 ? venc - 7 : venc - 7 + 30);

export function CartaoForm({ inicial }: { inicial?: Cartao }) {
  const { inserir, atualizar, remover, toast, dados } = useStore();
  const { fechar } = useModal();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [limite, setLimite] = useState<number | null>(inicial?.limite ?? null);
  const [venc, setVenc] = useState(inicial?.dia_vencimento ?? 10);
  const [fech, setFech] = useState(inicial?.dia_fechamento ?? fechamentoPadrao(10));
  const [fechManual, setFechManual] = useState(!!inicial);
  const [cor, setCor] = useState(inicial?.cor ?? '#3f6f73');
  const [conta, setConta] = useState(inicial?.conta_id ?? dados.contas.find((c) => !c.arquivada)?.id ?? '');
  const [arquivado, setArquivado] = useState(inicial?.arquivado ?? false);
  const [disponivel, setDisponivel] = useState<number | null>(null);
  const [avancado, setAvancado] = useState(!!inicial);
  const dia = (v: string) => Math.min(31, Math.max(1, Number(v) || 1));
  const banco = BANCOS.find((b) => nome.toLowerCase().startsWith(b.nome.toLowerCase()));

  return (
    <Dialog
      title={inicial ? 'Editar cartão' : 'Novo cartão'}
      onSubmit={async () => {
        if (!nome.trim()) return toast('Escolha o banco ou dê um nome para o cartão.');
        if (disponivel != null && limite != null && disponivel > limite) return toast('O disponível não pode ser maior que o limite.');
        const row: Record<string, unknown> = {
          nome: nome.trim(), limite: n2(limite ?? 0), dia_fechamento: fech, dia_vencimento: venc, cor, conta_id: conta || null, arquivado,
        };
        // cartão novo: o que já está usado no banco vira o ajuste de limite
        if (!inicial && disponivel != null && limite) {
          const usado = n2(limite - disponivel);
          if (usado > 0) row.ajuste_limite = usado;
        }
        if (inicial) await atualizar('cartoes', inicial.id, row);
        else await inserir('cartoes', [row]);
        toast('Cartão salvo');
        fechar();
      }}
      footer={inicial && (
        <button type="button" className="ghost danger" onClick={async () => {
          const n = dados.transacoes.filter((t) => t.cartao_id === inicial.id).length;
          if (!window.confirm(n ? `Excluir o cartão e os ${n} lançamentos dele? Para manter o histórico, arquive.` : 'Excluir este cartão?')) return;
          await remover('cartoes', [inicial.id]);
          fechar();
        }}><Trash2 size={14} /> Excluir</button>
      )}
    >
      {!inicial && (
        <div className="bancos">
          {BANCOS.map((b) => (
            <button type="button" key={b.nome} className={`banco ${banco?.nome === b.nome ? 'on' : ''}`}
              onClick={() => { setNome(b.nome); setCor(b.cor); }}>
              <span className="banco-cor" style={{ background: b.cor }} />{b.nome}
            </button>
          ))}
        </div>
      )}
      <div className="form-grid">
        <Field label="Nome do cartão" span hint={!inicial ? 'Escolha o banco acima ou digite (ex.: "Itaú Personnalité")' : undefined}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank" required />
        </Field>
        <Field label="Dia do vencimento" hint={!fechManual ? `Fecha por volta do dia ${fech}` : undefined}>
          <input type="number" min={1} max={31} value={venc} onChange={(e) => {
            const v = dia(e.target.value);
            setVenc(v);
            if (!fechManual) setFech(fechamentoPadrao(v));
          }} />
        </Field>
        <Field label="Limite total"><MoneyInput value={limite} onChange={setLimite} required={false} /></Field>
        {!inicial && (
          <Field label="Disponível hoje (opcional)" span hint="Veja no app do banco. Assim o limite já começa certo, mesmo com compras antigas.">
            <MoneyInput value={disponivel} onChange={setDisponivel} required={false} />
          </Field>
        )}
      </div>

      {!avancado ? (
        <button type="button" className="link" onClick={() => setAvancado(true)}>Mais opções (fechamento, conta, cor)</button>
      ) : (
        <div className="form-grid">
          <Field label="Dia do fechamento" hint="Compras a partir deste dia vão para a próxima fatura">
            <input type="number" min={1} max={31} value={fech} onChange={(e) => { setFech(dia(e.target.value)); setFechManual(true); }} />
          </Field>
          <Field label="Conta que paga a fatura">
            <select value={conta} onChange={(e) => setConta(e.target.value)}>
              <option value="">—</option>
              {dados.contas.filter((c) => !c.arquivada).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Cor" span><ColorPicker value={cor} onChange={setCor} /></Field>
          {inicial && (
            <Field label="Status" span>
              <label className="check-line"><input type="checkbox" checked={arquivado} onChange={(e) => setArquivado(e.target.checked)} /> Arquivado</label>
            </Field>
          )}
        </div>
      )}
    </Dialog>
  );
}

/* ======================================================================
   Meta / reserva
   ====================================================================== */
export function MetaForm({ inicial }: { inicial?: Meta }) {
  const { inserir, atualizar, remover, toast } = useStore();
  const { fechar } = useModal();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [alvo, setAlvo] = useState<number | null>(inicial?.alvo ?? null);
  const [atual, setAtual] = useState<number | null>(inicial?.atual ?? 0);
  const [prazo, setPrazo] = useState(inicial?.prazo ?? '');
  const [cor, setCor] = useState(inicial?.cor ?? '#5d9d6a');
  return (
    <Dialog
      title={inicial ? 'Editar meta' : 'Nova meta'}
      onSubmit={async () => {
        if (!nome.trim()) return toast('Dê um nome para a meta.');
        const row = { nome: nome.trim(), alvo: n2(alvo ?? 0), atual: n2(atual ?? 0), prazo: prazo || null, cor };
        if (inicial) await atualizar('metas', inicial.id, row);
        else await inserir('metas', [row]);
        toast('Meta salva');
        fechar();
      }}
      footer={inicial && (
        <button type="button" className="ghost danger" onClick={async () => {
          if (!window.confirm('Excluir esta meta?')) return;
          await remover('metas', [inicial.id]);
          fechar();
        }}><Trash2 size={14} /> Excluir</button>
      )}
    >
      <div className="form-grid">
        <Field label="Nome" span><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reserva de emergência, Viagem" required autoFocus /></Field>
        <Field label="Quanto quero juntar"><MoneyInput value={alvo} onChange={setAlvo} /></Field>
        <Field label="Quanto já tenho"><MoneyInput value={atual} onChange={setAtual} /></Field>
        <Field label="Prazo (opcional)"><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Field>
        <Field label="Cor" span><ColorPicker value={cor} onChange={setCor} /></Field>
      </div>
    </Dialog>
  );
}

export function AporteForm({ meta }: { meta: Meta }) {
  const { atualizar, toast } = useStore();
  const { fechar } = useModal();
  const [valor, setValor] = useState<number | null>(null);
  const [modo, setModo] = useState<'add' | 'sub'>('add');
  return (
    <Dialog
      title={`${meta.nome}`}
      onSubmit={async () => {
        if (!valor || valor <= 0) return toast('Informe o valor.');
        await atualizar('metas', meta.id, { atual: n2(meta.atual + (modo === 'add' ? valor : -valor)) });
        const novo = meta.atual + (modo === 'add' ? valor : -valor);
        toast(modo === 'add' && meta.atual < meta.alvo && novo >= meta.alvo ? '★ Meta atingida! O porquinho está em festa ★' : modo === 'add' ? 'Aporte registrado' : 'Retirada registrada');
        fechar();
      }}
    >
      <Seg value={modo} onChange={setModo} options={[{ value: 'add', label: 'Guardar' }, { value: 'sub', label: 'Retirar' }]} />
      <div className="form-grid">
        <Field label="Valor" span><MoneyInput value={valor} onChange={setValor} autoFocus /></Field>
      </div>
      <p className="muted small">Hoje: {brl(meta.atual)} de {brl(meta.alvo)}. Dica: se o dinheiro saiu de uma conta, registre também uma transferência para a conta da reserva (ou uma despesa na categoria "Investimentos / reserva").</p>
    </Dialog>
  );
}

/* ======================================================================
   Categoria
   ====================================================================== */
export function CategoriaForm({ inicial, tipoInicial = 'despesa' }: { inicial?: Categoria; tipoInicial?: Categoria['tipo'] }) {
  const { inserir, atualizar, remover, toast, dados } = useStore();
  const { fechar } = useModal();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [tipo, setTipo] = useState(inicial?.tipo ?? tipoInicial);
  const [cor, setCor] = useState(inicial?.cor ?? '#e0607a');
  const [orc, setOrc] = useState<number | null>(inicial?.orcamento ?? null);
  return (
    <Dialog
      title={inicial ? 'Editar categoria' : 'Nova categoria'}
      onSubmit={async () => {
        if (!nome.trim()) return toast('Dê um nome para a categoria.');
        const repetida = dados.categorias.find((x) => x.id !== inicial?.id && x.tipo === tipo && x.nome.trim().toLowerCase() === nome.trim().toLowerCase());
        if (repetida) return toast('Já existe uma categoria com esse nome.');
        const row = { nome: nome.trim(), tipo, cor, orcamento: tipo === 'despesa' && orc ? n2(orc) : null };
        if (inicial) await atualizar('categorias', inicial.id, row);
        else await inserir('categorias', [row]);
        toast('Categoria salva');
        fechar();
      }}
      footer={inicial && (
        <button type="button" className="ghost danger" onClick={async () => {
          if (!window.confirm('Excluir esta categoria? Os lançamentos dela ficam "sem categoria".')) return;
          await remover('categorias', [inicial.id]);
          fechar();
        }}><Trash2 size={14} /> Excluir</button>
      )}
    >
      {!inicial && <Seg value={tipo} onChange={setTipo} options={[{ value: 'despesa', label: 'Despesa' }, { value: 'receita', label: 'Receita' }]} />}
      <div className="form-grid">
        <Field label="Nome" span><input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus /></Field>
        {tipo === 'despesa' && (
          <Field label="Orçamento mensal (opcional)" span hint="Limite que você quer gastar por mês nessa categoria">
            <MoneyInput value={orc} onChange={setOrc} required={false} />
          </Field>
        )}
        <Field label="Cor" span><ColorPicker value={cor} onChange={setCor} /></Field>
      </div>
    </Dialog>
  );
}

/* ======================================================================
   Ajustar limite do cartão
   ====================================================================== */
export function AjusteLimiteForm({ cartao }: { cartao: Cartao }) {
  const { dados, atualizar, toast } = useStore();
  const { fechar } = useModal();
  const lancado = usoLancado(dados, cartao);
  const usadoAtual = lancado + (cartao.ajuste_limite ?? 0);
  const [limite, setLimite] = useState<number | null>(cartao.limite);
  const [modo, setModo] = useState<'disponivel' | 'usado'>('disponivel');
  const [valor, setValor] = useState<number | null>(n2((cartao.limite ?? 0) - usadoAtual));

  const total = limite ?? 0;
  const usadoNovo = valor == null ? usadoAtual : modo === 'disponivel' ? total - valor : valor;
  const ajuste = n2(usadoNovo - lancado);

  return (
    <Dialog
      title={`Ajustar limite · ${cartao.nome}`}
      onSubmit={async () => {
        if (limite == null || limite < 0) return toast('Informe o limite total.');
        if (valor == null || valor < 0) return toast(modo === 'disponivel' ? 'Informe o limite disponível.' : 'Informe o limite usado.');
        if (usadoNovo > total) return toast('O limite usado não pode ser maior que o limite total.');
        await atualizar('cartoes', cartao.id, { limite: n2(limite), ajuste_limite: ajuste });
        toast('Limite ajustado');
        fechar();
      }}
      footer={(cartao.ajuste_limite ?? 0) !== 0 && (
        <button type="button" className="ghost" onClick={async () => {
          await atualizar('cartoes', cartao.id, { ajuste_limite: 0 });
          toast('Ajuste removido');
          fechar();
        }}>Remover ajuste</button>
      )}
    >
      <p className="muted small">
        Use quando o limite do app estiver diferente do banco, por exemplo, por compras ou parcelas feitas antes de você começar a usar o Stash.
        O ajuste muda só o limite: faturas e gastos continuam iguais.
      </p>
      <div className="form-grid">
        <Field label="Limite total" span><MoneyInput value={limite} onChange={setLimite} /></Field>
        <Field label="Quero informar" span>
          <Seg value={modo} onChange={(m) => {
            setModo(m);
            setValor(n2(m === 'disponivel' ? total - usadoNovo : usadoNovo));
          }} options={[{ value: 'disponivel', label: 'Limite disponível' }, { value: 'usado', label: 'Limite usado' }]} />
        </Field>
        <Field label={modo === 'disponivel' ? 'Disponível hoje (veja no app do banco)' : 'Usado hoje (veja no app do banco)'} span>
          <MoneyInput key={modo} value={valor} onChange={setValor} autoFocus />
        </Field>
      </div>
      <div className="ajuste-resumo">
        <div className="row-between small"><span className="muted">Compras lançadas no Stash</span><b>{brl(lancado)}</b></div>
        <div className="row-between small"><span className="muted">Ajuste (compras anteriores)</span><b>{ajuste >= 0 ? '+ ' : '− '}{brl(Math.abs(ajuste))}</b></div>
        <div className="row-between"><span className="strong">Limite usado</span><b>{brl(usadoNovo)}</b></div>
        <div className="row-between"><span className="strong">Limite disponível</span><b className={total - usadoNovo < 0 ? 'neg' : 'pos'}>{brl(total - usadoNovo)}</b></div>
      </div>
    </Dialog>
  );
}
