import type { Cartao } from '../lib/types';
import { brl } from '../lib/format';

export function CardVisual({ cartao, livre, status, onClick, selecionado }: {
  cartao: Cartao; livre: number; status?: string; onClick?: () => void; selecionado?: boolean;
}) {
  return (
    <div
      className={`credit ${selecionado ? 'sel' : ''}`}
      style={{ background: `linear-gradient(135deg, ${cartao.cor}, color-mix(in srgb, ${cartao.cor} 70%, #000))` }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="credit-top">
        <span className="bank">{cartao.nome}</span>
        {status && <span className="pill">{status}</span>}
      </div>
      <div className="credit-mid">
        <span className="chip" />
        <span className="nfc">)))</span>
      </div>
      <div className="credit-bot">
        <div><div className="tiny op">FECHA / VENCE</div><div className="strong">dia {cartao.dia_fechamento} / {cartao.dia_vencimento}</div></div>
        <div className="right"><div className="tiny op">LIMITE LIVRE</div><div className="strong">{brl(livre)}</div></div>
      </div>
    </div>
  );
}
