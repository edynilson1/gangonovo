/**
 * Damas (8x8) — motor de regras puro e serializável.
 * Usado no cliente (interface) e no servidor (validação das partidas online).
 *
 * Variante implementada (consistente em todos os modos):
 * - Peça normal: move 1 casa na diagonal para a frente; captura por salto apenas para a frente.
 * - Dama: move 1 casa na diagonal em qualquer direção; captura por salto em qualquer direção.
 * - Captura é obrigatória quando existe.
 * - Capturas consecutivas obrigatórias com a mesma peça.
 * - Promoção a dama ao chegar à última linha adversária; a promoção termina a sequência de capturas.
 * - Perde quem ficar sem peças ou sem movimentos legais.
 * - Empate por 40 lances consecutivos sem captura nem promoção.
 */

export type Player = "p" | "a"; // p = peças claras (sobem), a = peças escuras (descem)
export type Piece = { player: Player; king: boolean };
export type Board = (Piece | null)[][]; // [row][col], row 0 = topo
export type Pos = { row: number; col: number };
export type Move = { from: Pos; to: Pos; captures: Pos[] };

export const BOARD_SIZE = 8;
export const IDLE_MOVES_DRAW = 40;

export function opponent(player: Player): Player {
  return player === "p" ? "a" : "p";
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null as Piece | null),
  );
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 !== 1) continue;
      if (row < 3) board[row]![col] = { player: "a", king: false };
      if (row > 4) board[row]![col] = { player: "p", king: false };
    }
  }
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

const inside = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

function promotes(piece: Piece, row: number): boolean {
  return (
    !piece.king &&
    ((piece.player === "p" && row === 0) || (piece.player === "a" && row === BOARD_SIZE - 1))
  );
}

/** Direções permitidas: peça normal só para a frente, dama nas quatro diagonais. */
function directions(piece: Piece): Array<[number, number]> {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  }
  return piece.player === "p"
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

function captureSequences(board: Board, from: Pos, piece: Piece, taken: Pos[]): Move[] {
  const results: Move[] = [];
  for (const [dr, dc] of directions(piece)) {
    const midRow = from.row + dr;
    const midCol = from.col + dc;
    const landRow = from.row + dr * 2;
    const landCol = from.col + dc * 2;
    if (!inside(landRow, landCol)) continue;
    const mid = board[midRow]?.[midCol];
    // Não captura casa vazia nem peça própria.
    if (!mid || mid.player === piece.player) continue;
    // Casa de aterragem tem de estar livre (não se atravessa peças).
    if (board[landRow]![landCol]) continue;
    if (taken.some((t) => t.row === midRow && t.col === midCol)) continue;

    const justPromoted = promotes(piece, landRow);
    const next = cloneBoard(board);
    next[from.row]![from.col] = null;
    next[midRow]![midCol] = null;
    const movedPiece: Piece = { player: piece.player, king: piece.king || justPromoted };
    next[landRow]![landCol] = movedPiece;

    const captures = [...taken, { row: midRow, col: midCol }];
    // A promoção encerra a sequência de capturas.
    const deeper = justPromoted
      ? []
      : captureSequences(next, { row: landRow, col: landCol }, movedPiece, captures);
    if (deeper.length > 0) {
      for (const d of deeper) results.push({ from, to: d.to, captures: d.captures });
    } else {
      results.push({ from, to: { row: landRow, col: landCol }, captures });
    }
  }
  return results;
}

/** Todos os lances legais; se existir captura, apenas capturas são devolvidas. */
export function legalMoves(board: Board, player: Player): Move[] {
  const simple: Move[] = [];
  const capturing: Move[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row]![col];
      if (!piece || piece.player !== player) continue;
      const from = { row, col };
      capturing.push(...captureSequences(board, from, piece, []));
      for (const [dr, dc] of directions(piece)) {
        const r = row + dr;
        const c = col + dc;
        if (inside(r, c) && !board[r]![c]) simple.push({ from, to: { row: r, col: c }, captures: [] });
      }
    }
  }
  return capturing.length > 0 ? capturing : simple;
}

export function hasMandatoryCapture(board: Board, player: Player): boolean {
  return legalMoves(board, player).some((m) => m.captures.length > 0);
}

export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const piece = next[move.from.row]![move.from.col]!;
  next[move.from.row]![move.from.col] = null;
  for (const c of move.captures) next[c.row]![c.col] = null;
  next[move.to.row]![move.to.col] = {
    player: piece.player,
    king: piece.king || promotes(piece, move.to.row),
  };
  return next;
}

/** Verifica se um lance enviado pelo cliente corresponde a um lance legal. */
export function findLegalMove(board: Board, player: Player, from: Pos, to: Pos): Move | null {
  const candidates = legalMoves(board, player).filter(
    (m) => m.from.row === from.row && m.from.col === from.col && m.to.row === to.row && m.to.col === to.col,
  );
  if (candidates.length === 0) return null;
  // Entre sequências com o mesmo destino, escolhe a que captura mais.
  return candidates.sort((a, b) => b.captures.length - a.captures.length)[0]!;
}

export function countPieces(board: Board, player: Player): number {
  return board.flat().filter((cell) => cell?.player === player).length;
}

export type GameStatus =
  | { over: false }
  | { over: true; winner: Player | null; reason: "pieces" | "blocked" | "idle" };

/** Estado do jogo para quem está a jogar agora (`turn`). */
export function gameStatus(board: Board, turn: Player, idleMoves = 0): GameStatus {
  if (countPieces(board, turn) === 0) return { over: true, winner: opponent(turn), reason: "pieces" };
  if (countPieces(board, opponent(turn)) === 0) return { over: true, winner: turn, reason: "pieces" };
  if (legalMoves(board, turn).length === 0) {
    return { over: true, winner: opponent(turn), reason: "blocked" };
  }
  if (idleMoves >= IDLE_MOVES_DRAW) return { over: true, winner: null, reason: "idle" };
  return { over: false };
}

/** Lance "parado": sem captura e sem promoção (conta para o empate). */
export function isIdleMove(board: Board, move: Move): boolean {
  if (move.captures.length > 0) return false;
  const piece = board[move.from.row]![move.from.col];
  return !!piece && !promotes(piece, move.to.row);
}

/* ------------------------- Serialização ------------------------- */

export function boardToJson(board: Board): unknown {
  return board.map((row) => row.map((cell) => (cell ? (cell.king ? cell.player.toUpperCase() : cell.player) : null)));
}

export function boardFromJson(value: unknown): Board {
  const rows = value as unknown[];
  if (!Array.isArray(rows) || rows.length !== BOARD_SIZE) throw new Error("Tabuleiro inválido.");
  return rows.map((row) => {
    const cells = row as unknown[];
    if (!Array.isArray(cells) || cells.length !== BOARD_SIZE) throw new Error("Tabuleiro inválido.");
    return cells.map((cell) => {
      if (cell == null) return null;
      if (cell === "p") return { player: "p" as Player, king: false };
      if (cell === "a") return { player: "a" as Player, king: false };
      if (cell === "P") return { player: "p" as Player, king: true };
      if (cell === "A") return { player: "a" as Player, king: true };
      throw new Error("Tabuleiro inválido.");
    });
  });
}

/* ------------------------------ IA ------------------------------ */

function evaluate(board: Board): number {
  let score = 0;
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const piece = board[row]![col];
      if (!piece) continue;
      const value = piece.king ? 3.4 : 1 + (piece.player === "a" ? row : BOARD_SIZE - 1 - row) * 0.06;
      score += piece.player === "a" ? value : -value;
    }
  }
  return score;
}

function minimax(board: Board, depth: number, player: Player, alpha: number, beta: number): number {
  const moves = legalMoves(board, player);
  if (depth === 0 || moves.length === 0) {
    if (moves.length === 0) return player === "a" ? -1000 : 1000;
    return evaluate(board);
  }
  if (player === "a") {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(board, move), depth - 1, "p", alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(board, move), depth - 1, "a", alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Difficulty = "facil" | "medio" | "dificil";

/** A IA usa exatamente as mesmas regras (captura obrigatória, promoção, capturas consecutivas). */
export function chooseAiMove(board: Board, difficulty: Difficulty): Move | null {
  const moves = legalMoves(board, "a");
  if (moves.length === 0) return null;
  if (difficulty === "facil" && Math.random() < 0.35) {
    return moves[Math.floor(Math.random() * moves.length)]!;
  }
  const depth = difficulty === "facil" ? 1 : difficulty === "medio" ? 3 : 5;
  let best = moves[0]!;
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = minimax(applyMove(board, move), depth - 1, "p", -Infinity, Infinity);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
