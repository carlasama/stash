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

/**
 * animacao:
 *  - 'pisca'  → pisca de vez em quando (padrão)
 *  - 'pula'   → pulinhos (carregando)
 *  - 'festa'  → pula e a moeda gira (meta atingida)
 */
export function Mascote({ className, animacao = 'pisca' }: { className?: string; animacao?: 'pisca' | 'pula' | 'festa' | 'nenhuma' }) {
  return (
    <svg viewBox="0 0 16 15" className={`mascote anim-${animacao} ${className ?? ''}`} shapeRendering="crispEdges" aria-hidden>
      {SPRITE.flatMap((linha, y) =>
        [...linha].map((c, x) =>
          c === '.' ? null : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1.02"
              height="1.02"
              fill={CORES[c]}
              className={c === 'E' ? 'olho' : c === 'Y' || c === 'y' ? 'moeda' : undefined}
            />
          ),
        ),
      )}
    </svg>
  );
}
