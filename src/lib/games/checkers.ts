export type Player = "black" | "white";

export type PieceType = "man" | "king";

export type Piece = {
  player: Player;
  type: PieceType;
};

export type Pos = {
  row: number;
  col: number;
};

export type Board = Array<Array<Piece | null>>;

export type Step = {
  from: Pos;
  to: Pos;
  capture: Pos | null;
};

export type MoveResult = {
  board: Board;
  promoted: boolean;
  continues: boolean;
};

export const BOARD_SIZE = 8;

export function opponent(player: Player): Player {
  return player === "black" ? "white" : "black";
}

export function isInside(pos: Pos): boolean {
  return pos.row >= 0 && pos.row < BOARD_SIZE && pos.col >= 0 && pos.col < BOARD_SIZE;
}

export function isDarkSquare(pos: Pos): boolean {
  return (pos.row + pos.col) % 2 === 1;
}

export function samePos(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () =>
    Array<Piece | null>(BOARD_SIZE).fill(null),
  );

  // Peças pretas
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isDarkSquare({ row, col })) {
        const r = board[row];
        if (r) {
          r[col] = {
            player: "black",
            type: "man",
          };
        }
      }
    }
  }

  // Peças brancas
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (isDarkSquare({ row, col })) {
        const r = board[row];
        if (r) {
          r[col] = {
            player: "white",
            type: "man",
          };
        }
      }
    }
  }

  return board;
}

function forwardDirection(player: Player): number {
  return player === "black" ? 1 : -1;
}

function simpleStepsFrom(board: Board, from: Pos): Step[] {
  const piece = board[from.row]?.[from.col];

  if (!piece) {
    return [];
  }

  const directions =
    piece.type === "man"
      ? [
          { row: forwardDirection(piece.player), col: -1 },
          { row: forwardDirection(piece.player), col: 1 },
        ]
      : [
          { row: -1, col: -1 },
          { row: -1, col: 1 },
          { row: 1, col: -1 },
          { row: 1, col: 1 },
        ];
  const steps: Step[] = [];

  for (const direction of directions) {
    let to = { row: from.row + direction.row, col: from.col + direction.col };
    while (isInside(to) && board[to.row]?.[to.col] === null) {
      steps.push({ from, to, capture: null });
      if (piece.type === "man") break;
      to = { row: to.row + direction.row, col: to.col + direction.col };
    }
  }

  return steps;
}

function captureStepsFrom(board: Board, from: Pos): Step[] {
  const piece = board[from.row]?.[from.col];

  if (!piece) {
    return [];
  }

  const directions: Pos[] = [
    { row: -1, col: -1 },
    { row: -1, col: 1 },
    { row: 1, col: -1 },
    { row: 1, col: 1 },
  ];

  const result: Step[] = [];

  for (const direction of directions) {
    let pos = { row: from.row + direction.row, col: from.col + direction.col };

    if (piece.type === "man") {
      const capturedPiece = board[pos.row]?.[pos.col];
      const to = { row: pos.row + direction.row, col: pos.col + direction.col };
      if (
        capturedPiece &&
        capturedPiece.player !== piece.player &&
        isInside(to) &&
        board[to.row]?.[to.col] === null
      ) {
        result.push({ from, to, capture: pos });
      }
      continue;
    }

    while (isInside(pos) && board[pos.row]?.[pos.col] === null) {
      pos = { row: pos.row + direction.row, col: pos.col + direction.col };
    }

    if (!isInside(pos)) continue;
    const capturedPiece = board[pos.row]?.[pos.col];
    if (!capturedPiece || capturedPiece.player === piece.player) continue;

    const captured = pos;
    pos = { row: pos.row + direction.row, col: pos.col + direction.col };
    while (isInside(pos) && board[pos.row]?.[pos.col] === null) {
      result.push({ from, to: pos, capture: captured });
      pos = { row: pos.row + direction.row, col: pos.col + direction.col };
    }
  }

  return result;
}

export function legalSteps(board: Board, player: Player, chainFrom?: Pos | null): Step[] {
  if (chainFrom) {
    return captureStepsFrom(board, chainFrom).filter((step) => {
      const piece = board[step.from.row]?.[step.from.col];
      return piece?.player === player;
    });
  }

  const captures: Step[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const r = board[row];
      const piece = r ? r[col] : null;

      if (!piece || piece.player !== player) {
        continue;
      }

      captures.push(...captureStepsFrom(board, { row, col }));
    }
  }

  if (captures.length > 0) {
    return captures;
  }

  const moves: Step[] = [];

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const r = board[row];
      const piece = r ? r[col] : null;

      if (!piece || piece.player !== player) {
        continue;
      }

      moves.push(...simpleStepsFrom(board, { row, col }));
    }
  }

  return moves;
}

export function findLegalStep(
  board: Board,
  player: Player,
  from: Pos,
  to: Pos,
  chainFrom?: Pos | null,
): Step | null {
  const steps = legalSteps(board, player, chainFrom);

  return steps.find((step) => samePos(step.from, from) && samePos(step.to, to)) ?? null;
}

export function applyStep(board: Board, step: Step): MoveResult {
  const next = cloneBoard(board);

  const fromRow = next[step.from.row];
  if (!fromRow) {
    throw new Error("Linha inicial inválida.");
  }

  const piece = fromRow[step.from.col];

  if (!piece) {
    throw new Error("Não existe peça na posição inicial.");
  }

  fromRow[step.from.col] = null;

  if (step.capture) {
    const captureRow = next[step.capture.row];
    if (captureRow) {
      captureRow[step.capture.col] = null;
    }
  }

  const toRow = next[step.to.row];
  if (!toRow) {
    throw new Error("Linha de destino inválida.");
  }
  toRow[step.to.col] = piece;

  let promoted = false;

  if (
    piece.type === "man" &&
    ((piece.player === "white" && step.to.row === 0) ||
      (piece.player === "black" && step.to.row === 7))
  ) {
    piece.type = "king";
    promoted = true;
  }

  const continues =
    step.capture !== null && !promoted && captureStepsFrom(next, step.to).length > 0;

  return {
    board: next,
    promoted,
    continues,
  };
}

export type GameStatus = "playing" | "black_won" | "white_won" | "draw";

export function gameStatus(board: Board, currentPlayer: Player, idleMoves = 0): GameStatus {
  let blackPieces = 0;
  let whitePieces = 0;

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;

      if (piece.player === "black") {
        blackPieces++;
      } else {
        whitePieces++;
      }
    }
  }

  if (blackPieces === 0) {
    return "white_won";
  }

  if (whitePieces === 0) {
    return "black_won";
  }

  const legal = legalSteps(board, currentPlayer);

  if (legal.length === 0) {
    return currentPlayer === "black" ? "white_won" : "black_won";
  }

  if (idleMoves >= 40) {
    return "draw";
  }

  return "playing";
}

export function isBoard(value: unknown): value is Board {
  if (!Array.isArray(value)) {
    return false;
  }

  if (value.length !== BOARD_SIZE) {
    return false;
  }

  for (const row of value) {
    if (!Array.isArray(row) || row.length !== BOARD_SIZE) {
      return false;
    }

    for (const piece of row) {
      if (piece === null) {
        continue;
      }

      if (typeof piece !== "object" || piece === null) {
        return false;
      }

      const p = piece as Record<string, unknown>;

      const playerVal = p["player"];
      const typeVal = p["type"];

      if (
        (playerVal !== "white" && playerVal !== "black") ||
        (typeVal !== "man" && typeVal !== "king")
      ) {
        return false;
      }
    }
  }

  return true;
}
