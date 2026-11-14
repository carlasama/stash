/** Mascote do Stash: porquinho-cofre em pixel art (16×15) com uma moedinha. */
const SPRITE = [
  '......KKKK......',
  '.....KYYYYK.....',
  '.KK..KYyyYK..KK.',
  '.KDK.KYYYYK.KDK.',
  '.KDDKKKKKKKKDDK.',
  'KPPPPPPPPPPPPPPK',
  'KPWPPPPPPPPPPPPK',
  'KPPPEPPPPPPEPPPK',
  'KPPPEPPPPPPEPPPK',
  'KPBBPDDDDDDPBBPK',
  'KPPPPDKDDKDPPPPK',
  'KPPPPDDDDDDPPPPK',
  '.KPPPPPPPPPPPPK.',
  '..KDDKKKKKKDDK..',
  '..KKKK....KKKK..',
];

const CORES: Record<string, string> = {
  K: '#5e2a35', // contorno
  E: '#5e2a35', // olhos (piscam)
  P: '#f8b9c7', // corpo
  D: '#ee8fa6', // rosa escuro
  B: '#ef6f8f', // bochecha
  W: '#ffffff', // brilho
  Y: '#f7d679', // moeda
  y: '#d9a441', // sombra da moeda
};

type Teste = (c: string, x: number, y: number) => boolean;

/** Junta as células que passam no teste em um único path (cada linha vira faixas horizontais). */
function pathDe(teste: Teste) {
  let d = '';
  SPRITE.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (!teste(linha[x], x, y)) { x++; continue; }
      const ini = x;
      while (x < linha.length && teste(linha[x], x, y)) x++;
      d += `M${ini} ${y}h${x - ini}v1h${ini - x}z`;
    }
  });
  return d;
}

const ehTopoDoOlho: Teste = (c, x, y) => c === 'E' && SPRITE[y - 1]?.[x] !== 'E';

// Cada cor vira um único path: dentro de um mesmo path não existem emendas entre pixels,
// então o sprite não ganha "linhas" quando é deslocado em frações de pixel (hover/pulos).
const FUNDO = pathDe((c) => c !== '.');
const CAMADAS = (['K', 'D', 'B', 'W'] as const).map((c) => ({ cor: CORES[c], d: pathDe((k) => k === c) }));
const OLHO_BAIXO = pathDe((c, x, y) => c === 'E' && !ehTopoDoOlho(c, x, y));
const OLHO_TOPO = pathDe(ehTopoDoOlho);
const MOEDA = (['Y', 'y'] as const).map((c) => ({ cor: CORES[c], d: pathDe((k) => k === c) }));

/**
 * animacao:
 *  - 'pisca'  → pisca de vez em quando (padrão)
 *  - 'pula'   → pulinhos (carregando)
 *  - 'festa'  → pula e a moeda gira (meta atingida)
 */
export function Mascote({ className, animacao = 'pisca' }: { className?: string; animacao?: 'pisca' | 'pula' | 'festa' | 'nenhuma' }) {
  return (
    <svg viewBox="0 0 16 15" className={`mascote anim-${animacao} ${className ?? ''}`} shapeRendering="crispEdges" aria-hidden>
      {/* corpo rosa sob o sprite inteiro: qualquer fresta entre cores mostra rosa, não o fundo */}
      <path d={FUNDO} fill={CORES.P} />
      {CAMADAS.map(({ cor, d }) => <path key={cor} d={d} fill={cor} />)}
      <path d={OLHO_BAIXO} fill={CORES.E} />
      {/* olho: ao piscar, só o pixel de cima some e o olho vira um tracinho fechado */}
      <path d={OLHO_TOPO} fill={CORES.E} className="olho" />
      {MOEDA.map(({ cor, d }) => <path key={cor} d={d} fill={cor} className="moeda" />)}
    </svg>
  );
}
