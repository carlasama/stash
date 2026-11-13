import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { num, parseValor } from '../lib/format';

/* ---------- dinheiro ---------- */
export function Money({ value, size = 'md', prefix, className = '' }: {
  value: number; size?: 'xl' | 'lg' | 'md' | 'sm'; prefix?: string; className?: string;
}) {
  const [int, dec] = num(Math.abs(value)).split(',');
  return (
    <span className={`money money-${size} ${className}`}>
      {prefix && <span className="money-prefix">{prefix}</span>}
      <span className="money-cur">{value < 0 ? '−R$' : 'R$'}</span>
      <span className="money-int">{int}</span>
      <span className="money-dec">,{dec}</span>
    </span>
  );
}

/* ---------- modal ---------- */
interface ModalCtx { abrir: (n: ReactNode) => void; fechar: () => void }
const MCtx = createContext<ModalCtx>({ abrir: () => {}, fechar: () => {} });
export const useModal = () => useContext(MCtx);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  useEffect(() => {
    if (!node) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNode(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node]);
  return (
    <MCtx.Provider value={{ abrir: setNode, fechar: () => setNode(null) }}>
      {children}
      {node && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setNode(null)}>
          {node}
        </div>
      )}
    </MCtx.Provider>
  );
}

export function Dialog({ title, children, onSubmit, footer, wide }: {
  title: string; children: ReactNode; onSubmit?: () => void | Promise<void>; footer?: ReactNode; wide?: boolean;
}) {
  const { fechar } = useModal();
  const [salvando, setSalvando] = useState(false);
  return (
    <form
      className={`dialog ${wide ? 'wide' : ''}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!onSubmit || salvando) return;
        setSalvando(true);
        try {
          await onSubmit();
        } catch {
          /* erro já mostrado no toast */
        } finally {
          setSalvando(false);
        }
      }}
    >
      <div className="dialog-head">
        <h3>{title}</h3>
        <button type="button" className="icon-btn" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="dialog-body">{children}</div>
      <div className="dialog-foot">
        {footer}
        <span className="grow" />
        <button type="button" className="ghost" onClick={fechar}>Cancelar</button>
        {onSubmit && <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>}
      </div>
    </form>
  );
}

/* ---------- campos ---------- */
export function Field({ label, children, hint, span }: { label: string; children: ReactNode; hint?: string; span?: boolean }) {
  return (
    <label className={`field ${span ? 'span' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Campo de valor em reais. Guarda texto enquanto digita; devolve number via onChange. */
export function MoneyInput({ value, onChange, autoFocus, required = true }: {
  value: number | null; onChange: (n: number | null) => void; autoFocus?: boolean; required?: boolean;
}) {
  const [txt, setTxt] = useState(value != null && !isNaN(value) ? num(value) : '');
  return (
    <div className="money-input">
      <span>R$</span>
      <input
        inputMode="decimal"
        placeholder="0,00"
        value={txt}
        autoFocus={autoFocus}
        required={required}
        onChange={(e) => {
          setTxt(e.target.value);
          const n = parseValor(e.target.value);
          onChange(isNaN(n) ? null : n);
        }}
        onBlur={() => {
          const n = parseValor(txt);
          if (!isNaN(n)) setTxt(num(n));
        }}
      />
    </div>
  );
}

export const CORES = ['#e0607a', '#f49ac1', '#c97b9c', '#b48ad6', '#8fa6e0', '#6fb3d9', '#5fa8a0', '#3f6f73', '#5d9d6a', '#a9c96b', '#f2c25c', '#f2a65e', '#e57b5e', '#d64545', '#9a7b6b', '#4a2a2c'];

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="colors">
      {CORES.map((c) => (
        <button type="button" key={c} className={`color ${c === value ? 'on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="strong">{title}</div>
      {text && <div className="muted small">{text}</div>}
      {action}
    </div>
  );
}

export function Progress({ value, color, danger }: { value: number; color?: string; danger?: boolean }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.min(Math.max(value, 0), 1) * 100}%`, background: danger ? 'var(--red)' : color ?? 'var(--blue)' }} />
    </div>
  );
}

export function Seg<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="seg-ctrl" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button type="button" key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}
