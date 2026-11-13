export type TipoCat = 'receita' | 'despesa';
export type TipoTx = 'receita' | 'despesa' | 'transferencia' | 'pagamento_fatura';

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoCat;
  cor: string;
  orcamento: number | null;
}

export interface Conta {
  id: string;
  nome: string;
  tipo: 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'a_receber';
  saldo_inicial: number;
  /** quando o saldo foi informado; pagamentos com data anterior já estão nele */
  saldo_em?: string | null;
  cor: string;
  arquivada: boolean;
}

export interface Cartao {
  id: string;
  nome: string;
  limite: number;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string;
  conta_id: string | null;
  arquivado: boolean;
  /** valor que já estava usado no limite antes de começar a usar o app */
  ajuste_limite?: number;
}

export interface Recorrente {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoCat;
  dia: number;
  categoria_id: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  inicio: string;
  fim: string | null;
  ativo: boolean;
}

export interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoTx;
  data: string;
  categoria_id: string | null;
  conta_id: string | null;
  conta_destino_id: string | null;
  cartao_id: string | null;
  fatura: string | null;
  pago: boolean;
  parcela: number | null;
  parcelas: number | null;
  grupo: string | null;
  recorrente_id: string | null;
  competencia: string | null;
  notas: string | null;
  created_at?: string;
  /** item previsto gerado a partir de uma conta fixa (ainda não existe no banco) */
  virtual?: boolean;
}

export interface Meta {
  id: string;
  nome: string;
  alvo: number;
  atual: number;
  prazo: string | null;
  cor: string;
}

export interface Dados {
  categorias: Categoria[];
  contas: Conta[];
  cartoes: Cartao[];
  recorrentes: Recorrente[];
  transacoes: Transacao[];
  metas: Meta[];
}

export type Tabela = keyof Dados;
export const TABELAS: Tabela[] = ['categorias', 'contas', 'cartoes', 'recorrentes', 'transacoes', 'metas'];
