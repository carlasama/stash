import { useRef, useState } from 'react';
import { Download, LogOut, Upload } from 'lucide-react';
import { useStore } from '../store';
import * as db from '../lib/db';
import { TABELAS, type Dados } from '../lib/types';

export function Config({ email }: { email?: string }) {
  const { dados, recarregar, toast } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);

  function exportar() {
    const blob = new Blob([JSON.stringify({ app: 'stash', versao: 1, exportado: new Date().toISOString(), dados }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  async function importar(file: File) {
    setImportando(true);
    try {
      const json = JSON.parse(await file.text());
      const d: Dados = json.dados ?? json;
      const existentes = new Set(TABELAS.flatMap((t) => dados[t].map((r) => r.id)));
      // categorias padrão com o mesmo nome não são duplicadas
      const nomesCat = new Map(dados.categorias.map((c) => [`${c.tipo}|${c.nome}`, c.id]));
      const trocaCat = new Map<string, string>();
      if (!window.confirm('Importar este backup? Itens que já existem são ignorados.')) return;
      for (const t of TABELAS) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rows = (d[t] ?? []).filter((r: any) => !existentes.has(r.id)) as any[];
        if (t === 'categorias') {
          rows = rows.filter((c) => {
            const ja = nomesCat.get(`${c.tipo}|${c.nome}`);
            if (ja) trocaCat.set(c.id, ja);
            return !ja;
          });
        }
        rows = rows.map(({ created_at, virtual, ...r }) => {
          void virtual;
          if (r.categoria_id && trocaCat.has(r.categoria_id)) r.categoria_id = trocaCat.get(r.categoria_id);
          return created_at ? { ...r, created_at } : r;
        });
        for (let i = 0; i < rows.length; i += 500) await db.inserir(t, rows.slice(i, i + 500));
      }
      await recarregar();
      toast('Backup importado');
    } catch (e) {
      toast(`Falha ao importar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setImportando(false);
      if (input.current) input.current.value = '';
    }
  }

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const contagens = [
    plural(dados.transacoes.length, 'lançamento', 'lançamentos'),
    plural(dados.contas.length, 'conta', 'contas'),
    plural(dados.cartoes.length, 'cartão', 'cartões'),
    plural(dados.recorrentes.length, 'conta fixa', 'contas fixas'),
    plural(dados.metas.length, 'meta', 'metas'),
  ];
  return (
    <div className="page">
      <section className="card page-head">
        <div>
          <h2>Configurações</h2>
          <div className="muted small">Backup dos seus dados e informações da conta.</div>
        </div>
      </section>

      <section className="card config-section">
        <h3>Onde seus dados ficam</h3>
        <div className="config-body">
          <div className="config-status">
            <span className={`dot ${db.modoLocal ? 'dot-warn' : 'green'}`} />
            <div>
              <div className="strong">{db.modoLocal ? 'Modo local' : 'Salvo na nuvem (Supabase)'}</div>
              <div className="muted small">
                {db.modoLocal
                  ? 'Os dados estão só neste navegador. Configure o Supabase (veja o README) para salvar na nuvem.'
                  : `Conectado como ${email ?? ''}.`}
              </div>
            </div>
          </div>
          {db.supabase && (
            <div className="config-actions">
              <button className="ghost danger" onClick={() => db.supabase!.auth.signOut()}><LogOut size={14} /> Sair da conta</button>
            </div>
          )}
        </div>
      </section>

      <section className="card config-section">
        <h3>Backup</h3>
        <div className="config-body">
          <p className="muted small">Baixe uma cópia de tudo que você registrou ou restaure uma cópia anterior. Itens que já existem não são duplicados.</p>
          <ul className="config-chips">
            {contagens.map((c) => <li key={c} className="tag">{c}</li>)}
          </ul>
          <div className="config-actions">
            <button className="ghost" onClick={exportar}><Download size={14} /> Exportar backup (.json)</button>
            <button className="ghost" disabled={importando} onClick={() => input.current?.click()}><Upload size={14} /> {importando ? 'Importando…' : 'Importar backup'}</button>
            <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
          </div>
          <p className="hint-box">Dica: se você começou no modo local, exporte o backup, configure o Supabase e importe-o depois de entrar.</p>
        </div>
      </section>
    </div>
  );
}
