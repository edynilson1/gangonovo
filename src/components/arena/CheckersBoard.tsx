import { BOARD_SIZE, type Board, type Move, type Player, type Pos } from "@/lib/games/checkers";

type Props = {
  board: Board;
  /** Peça selecionada pelo jogador. */
  selected: Pos | null;
  /** Lances legais da peça selecionada (destinos realçados). */
  targets: Move[];
  /** Todos os lances legais do jogador atual — usados para realçar capturas obrigatórias. */
  legal: Move[];
  onSquare: (row: number, col: number) => void;
  /** Inverte o tabuleiro para quem joga com as peças escuras. */
  flipped?: boolean;
  disabled?: boolean;
  /** Lado do jogador local (para etiquetas de acessibilidade). */
  mySide?: Player;
};

export function CheckersBoard({
  board,
  selected,
  targets,
  legal,
  onSquare,
  flipped = false,
  disabled = false,
  mySide = "p",
}: Props) {
  const mandatory = legal.some((m) => m.captures.length > 0);
  const capturePieces = mandatory ? legal.filter((m) => m.captures.length > 0).map((m) => m.from) : [];

  const order = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);
  const cells = flipped ? [...order].reverse() : order;

  return (
    <div
      className="grid aspect-square w-full grid-cols-8 overflow-hidden rounded-2xl border border-border shadow-[var(--shadow-card)]"
      role="grid"
      aria-label="Tabuleiro de damas"
    >
      {cells.map((i) => {
        const row = Math.floor(i / BOARD_SIZE);
        const col = i % BOARD_SIZE;
        const dark = (row + col) % 2 === 1;
        const piece = board[row]![col];
        const isSelected = selected?.row === row && selected?.col === col;
        const target = targets.find((m) => m.to.row === row && m.to.col === col);
        const mustCapture = capturePieces.some((p) => p.row === row && p.col === col);

        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onSquare(row, col)}
            aria-label={`Casa ${row + 1}-${col + 1}${
              piece
                ? piece.player === mySide
                  ? `, tua ${piece.king ? "dama" : "peça"}`
                  : `, ${piece.king ? "dama" : "peça"} adversária`
                : target
                  ? ", movimento possível"
                  : ""
            }`}
            className={`relative grid place-items-center transition-colors ${
              dark ? "bg-surface-2" : "bg-surface"
            } ${isSelected ? "ring-2 ring-inset ring-primary" : ""} ${
              target?.captures.length ? "ring-2 ring-inset ring-destructive/70" : ""
            }`}
          >
            {piece && (
              <span
                className={`grid size-[74%] place-items-center rounded-full text-base font-bold shadow-sm transition-transform ${
                  piece.player === "p"
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground"
                } ${mustCapture ? "ring-2 ring-warning ring-offset-1 ring-offset-transparent" : ""} ${
                  isSelected ? "scale-105" : ""
                }`}
              >
                {piece.king ? "♛" : ""}
              </span>
            )}
            {target && !piece && (
              <span
                className={`rounded-full ${
                  target.captures.length ? "size-4 bg-destructive/80" : "size-3 bg-primary/70"
                }`}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
