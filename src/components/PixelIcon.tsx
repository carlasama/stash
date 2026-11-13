/** Ícones em pixel art 9×9. "X" = pixel pintado (usa a cor do texto). */
const ICONES = {
  grid: [
    'XXXX.XXXX',
    'X..X.X..X',
    'X..X.X..X',
    'XXXX.XXXX',
    '.........',
    'XXXX.XXXX',
    'X..X.X..X',
    'X..X.X..X',
    'XXXX.XXXX',
  ],
  lista: [
    'XX.XXXXXX',
    'XX.XXXXXX',
    '.........',
    'XX.XXXXXX',
    'XX.XXXXXX',
    '.........',
    'XX.XXXXXX',
    'XX.XXXXXX',
    '.........',
  ],
  cartao: [
    '.........',
    'XXXXXXXXX',
    'X.......X',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'X.......X',
    'X.XXX...X',
    'XXXXXXXXX',
    '.........',
  ],
  calendario: [
    '.X.....X.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'X.......X',
    'X.X.X.X.X',
    'X.......X',
    'X.X.X.X.X',
    'X.......X',
    'XXXXXXXXX',
  ],
  moeda: [
    '..XXXXX..',
    '.X.....X.',
    'X...X...X',
    'X..XXX..X',
    'X..XX...X',
    'X...XX..X',
    'X..XXX..X',
    '.X..X..X.',
    '..XXXXX..',
  ],
  coracao: [
    '.........',
    '.XX...XX.',
    'XXXX.XXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  grafico: [
    '.......XX',
    '.......XX',
    '....XX.XX',
    '....XX.XX',
    '.XX.XX.XX',
    '.XX.XX.XX',
    '.XX.XX.XX',
    '.........',
    'XXXXXXXXX',
  ],
  estrela: [
    '....X....',
    '...XXX...',
    '...XXX...',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '..XXXXX..',
    '.XX...XX.',
    '.X.....X.',
  ],
  engrenagem: [
    '...X.X...',
    '.X.XXX.X.',
    '..XXXXX..',
    'XXX...XXX',
    '.XX...XX.',
    'XXX...XXX',
    '..XXXXX..',
    '.X.XXX.X.',
    '...X.X...',
  ],
  sino: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    '.........',
    '...XXX...',
  ],
  sol: [
    '....X....',
    '.X.....X.',
    '...XXX...',
    '..XXXXX..',
    'X.XXXXX.X',
    '..XXXXX..',
    '...XXX...',
    '.X.....X.',
    '....X....',
  ],
  lua: [
    '...XXX...',
    '..XXX....',
    '.XXX.....',
    '.XXX.....',
    '.XXX.....',
    '.XXX.....',
    '.XXXX....',
    '..XXXXXX.',
    '...XXXX..',
  ],
  casa: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    '.X.....X.',
    '.X.XX..X.',
    '.X.XX..X.',
    '.XXXXXXX.',
  ],
  alvo: [
    '..XXXXX..',
    '.X.....X.',
    'X..XXX..X',
    'X.X...X.X',
    'X.X.X.X.X',
    'X.X...X.X',
    'X..XXX..X',
    '.X.....X.',
    '..XXXXX..',
  ],
} as const;

export type NomeIcone = keyof typeof ICONES;

export function PixelIcon({ name, size = 16, className }: { name: NomeIcone; size?: number; className?: string }) {
  const rects: JSX.Element[] = [];
  ICONES[name].forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c === 'X') rects.push(<rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" />);
    }),
  );
  return (
    <svg width={size} height={size} viewBox="0 0 9 9" fill="currentColor" shapeRendering="crispEdges" className={`pixel-icon ${className ?? ''}`} aria-hidden>
      {rects}
    </svg>
  );
}

/** Cria um componente com a mesma assinatura dos ícones do lucide ({ size }). */
export const px = (name: NomeIcone) => ({ size }: { size?: number }) => <PixelIcon name={name} size={size} />;
