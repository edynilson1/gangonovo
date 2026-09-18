/**
 * Damas (8x8) — regras essenciais: movimento diagonal, captura por salto,
 * capturas múltiplas, promoção a dama e vitória por eliminação/bloqueio.
 * Estruturado para receber multijogador online depois (estado serializável).
 */

export type Player = "p" | "a"; // p = jogador (peças claras, sobe), a = adversário (desce)
export type Piece = { player: Player; king: boolean };
export type Board = (Piece | null)[][]; // [row][col], row 0 = topo
export type Pos = { row: number; col: number };
export type Move = { from: Pos; to: Pos; captures: Pos[] };

export const BOARD_SIZE = 8;

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
    if (!mid || mid.player === piece.player) continue;
    if (board[landRow]![landCol]) continue;
    if (taken.some((t) => t.row === midRow && t.col === midCol)) continue;

    const next = cloneBoard(board);
    next[from.row]![from.col] = null;
    next[midRow]![midCol] = null;
    const promoted =
      piece.king ||
      (piece.player === "p" && landRow === 0) ||
      (piece.player === "a" && landRow === BOARD_SIZE - 1);
    const movedPiece: Piece = { player: piece.player, king: promoted };
    next[landRow]![landCol] = movedPiece;

    const captures = [...taken, { row: midRow, col: midCol }];
    const deeper = captureSequences(next, { row: landRow, col: landCol }, movedPiece, captures);
    if (deeper.length > 0) {
      for (const d of deeper) results.push({ from, to: d.to, captures: d.captures });
    } else {
      results.push({ from, to: { row: landRow, col: landCol }, captures });
    }
  }
  return results;
}

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
  // Captura é obrigatória quando existe.
  return capturing.length > 0 ? capturing : simple;
}

export function applyMove(board: Board, move: Move): Board {
  const next = cloneBoard(board);
  const piece = next[move.from.row]![move.from.col]!;
  next[move.from.row]![move.from.col] = null;
  for (const c of move.captures) next[c.row]![c.col] = null;
  const promoted =
    piece.king ||
    (piece.player === "p" && move.to.row === 0) ||
    (piece.player === "a" && move.to.row === BOARD_SIZE - 1);
  next[move.to.row]![move.to.col] = { player: piece.player, king: promoted };
  return next;
}

export function countPieces(board: Board, player: Player): number {
  return board.flat().filter((cell) => cell?.player === player).length;
}

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
