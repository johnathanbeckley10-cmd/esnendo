const BOARD_SIZE = 7;

const PIECE_LABELS = {
  hybrid: "H",
  jem: "J",
  quin: "Q",
  mend: "Me",
  con: "C",
  cond: "Cd",
  monem: "Mo",
};

const PIECE_VALUES = {
  hybrid: 1000,
  jem: 10,
  quin: 8,
  cond: 7,
  con: 5,
  monem: 5,
  mend: 4,
};

const state = {
  board: [],
  currentPlayer: "player",
  selected: null,
  legalMoves: [],
  difficulty: "new",
  gameOver: false,
  quinMovesRemaining: 0,
  moveNumber: 1,
};

const boardElement = document.querySelector("#board");
const gameMessage = document.querySelector("#gameMessage");
const turnLabel = document.querySelector("#turnLabel");
const difficultyLabel = document.querySelector("#difficultyLabel");
const difficultySelect = document.querySelector("#difficultySelect");
const newGameButton = document.querySelector("#newGameButton");
const resetProgressButton = document.querySelector("#resetProgressButton");
const beginnerWinsElement = document.querySelector("#beginnerWins");
const proWinsElement = document.querySelector("#proWins");
const ruleStatus = document.querySelector("#ruleStatus");

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

function piece(type, owner, extra = {}) {
  return {
    type,
    owner,
    original: type === "hybrid",
    essoed: false,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    ...extra,
  };
}

function setupBoard() {
  const board = createEmptyBoard();

  // Official starting arrangement.
  board[0] = [
    piece("cond", "bot"),
    piece("mend", "bot"),
    piece("con", "bot"),
    piece("hybrid", "bot"),
    piece("quin", "bot"),
    piece("monem", "bot"),
    piece("jem", "bot"),
  ];

  board[6] = [
    piece("jem", "player"),
    piece("monem", "player"),
    piece("quin", "player"),
    piece("hybrid", "player"),
    piece("con", "player"),
    piece("mend", "player"),
    piece("cond", "player"),
  ];

  return board;
}

function readProgress() {
  try {
    return {
      beginnerWins: Number(localStorage.getItem("esnendoBeginnerWins") || 0),
      proWins: Number(localStorage.getItem("esnendoProWins") || 0),
    };
  } catch {
    return { beginnerWins: 0, proWins: 0 };
  }
}

function saveWin(difficulty) {
  const progress = readProgress();

  if (difficulty === "beginner") {
    localStorage.setItem("esnendoBeginnerWins", String(progress.beginnerWins + 1));
  }

  if (difficulty === "pro") {
    localStorage.setItem("esnendoProWins", String(progress.proWins + 1));
  }

  updateDifficultyLocks();
}

function updateDifficultyLocks() {
  const progress = readProgress();
  const proUnlocked = progress.beginnerWins >= 1;
  const advancedUnlocked = progress.proWins >= 5;
  const proOption = difficultySelect.querySelector('option[value="pro"]');
  const advancedOption = difficultySelect.querySelector('option[value="advanced"]');

  proOption.disabled = !proUnlocked;
  proOption.textContent = proUnlocked ? "Pro" : "Pro — locked";
  advancedOption.disabled = !advancedUnlocked;
  advancedOption.textContent = advancedUnlocked ? "Advanced" : "Advanced — locked";

  beginnerWinsElement.textContent = progress.beginnerWins;
  proWinsElement.textContent = `${progress.proWins} / 5`;

  if (!proUnlocked && difficultySelect.value === "pro") {
    difficultySelect.value = "beginner";
  }

  if (!advancedUnlocked && difficultySelect.value === "advanced") {
    difficultySelect.value = proUnlocked ? "pro" : "beginner";
  }
}

function newGame() {
  removeEndQuinButton();
  state.board = setupBoard();
  state.currentPlayer = "player";
  state.selected = null;
  state.legalMoves = [];
  state.difficulty = difficultySelect.value;
  state.gameOver = false;
  state.quinMovesRemaining = 0;
  state.moveNumber = 1;

  difficultyLabel.textContent = capitalize(state.difficulty);
  setMessage("Select one of your pieces.");
  updateRuleStatus();
  render();
}

function render() {
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = row;
      square.dataset.col = col;
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", squareDescription(row, col));

      if (state.selected?.row === row && state.selected?.col === col) {
        square.classList.add("selected");
      }

      const move = state.legalMoves.find(
        (candidate) => candidate.row === row && candidate.col === col
      );

      if (move) {
        square.classList.add(move.capture ? "capture" : "legal");
      }

      const currentPiece = state.board[row][col];
      if (currentPiece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${currentPiece.owner}`;
        if (currentPiece.essoed) pieceElement.classList.add("essoed");
        pieceElement.textContent = PIECE_LABELS[currentPiece.type];
        pieceElement.title = `${currentPiece.owner} ${currentPiece.type}${currentPiece.essoed ? ", Esso used" : ""}`;
        square.appendChild(pieceElement);
      }

      square.addEventListener("click", () => handleSquareClick(row, col));
      boardElement.appendChild(square);
    }
  }

  turnLabel.textContent = state.currentPlayer === "player" ? "Player" : "Bot";
  updateRuleStatus();
}

function squareDescription(row, col) {
  const currentPiece = state.board[row]?.[col];
  const coordinate = `${String.fromCharCode(65 + col)}${BOARD_SIZE - row}`;
  if (!currentPiece) return `${coordinate}, empty`;
  return `${coordinate}, ${currentPiece.owner} ${currentPiece.type}`;
}

function handleSquareClick(row, col) {
  if (state.gameOver || state.currentPlayer !== "player") return;

  const clickedPiece = state.board[row][col];
  const chosenMove = state.legalMoves.find(
    (move) => move.row === row && move.col === col
  );

  if (state.selected && chosenMove) {
    performMove(state.selected, chosenMove);
    return;
  }

  if (clickedPiece?.owner === "player") {
    const moves = getLegalMoves(row, col);
    state.selected = { row, col };
    state.legalMoves = moves;

    if (moves.length === 0) {
      setMessage(explainNoMoves(row, col));
    } else {
      setMessage(`${capitalize(clickedPiece.type)} selected. Choose a highlighted square.`);
    }
  } else {
    state.selected = null;
    state.legalMoves = [];
    setMessage("Select one of your pieces.");
  }

  render();
}

function explainNoMoves(row, col) {
  const currentPiece = state.board[row][col];
  if (!currentPiece) return "That square is empty.";

  if (currentPiece.type === "hybrid" && isHybridSequoiaStalemated(currentPiece.owner)) {
    return "Sequoia stalemate: your Hybrid cannot move until the enemy Con moves away or is captured.";
  }

  if (currentPiece.type === "jem" && isJemSequoiaStalemated(row, col)) {
    return "Sequoia stalemate: this Jem cannot move until the enemy Con moves away or is captured.";
  }

  return "That piece has no legal moves right now.";
}

function performMove(from, to) {
  const movingPiece = state.board[from.row][from.col];
  const capturedPiece = state.board[to.row][to.col];

  state.board[to.row][to.col] = movingPiece;
  state.board[from.row][from.col] = null;

  if (capturedPiece?.type === "hybrid") {
    finishGame(movingPiece.owner, "A Hybrid was captured.");
    return;
  }

  const essoMessage = attemptEsso(to.row, to.col, movingPiece);

  if (
    movingPiece.type === "quin" &&
    movingPiece.owner === "player" &&
    state.quinMovesRemaining === 0
  ) {
    state.quinMovesRemaining = 1;
    state.selected = { row: to.row, col: to.col };
    state.legalMoves = getLegalMoves(to.row, to.col);

    if (state.legalMoves.length > 0) {
      setMessage(`${essoMessage ? `${essoMessage} ` : ""}Quin may move one more time.`);
      showEndQuinButton();
      render();
      return;
    }
  }

  endPlayerTurn(essoMessage);
}

function attemptEsso(row, col, movingPiece) {
  if (!['hybrid', 'jem'].includes(movingPiece.type) || movingPiece.essoed) return "";

  const targetEdge = movingPiece.owner === "player" ? 0 : BOARD_SIZE - 1;
  if (row !== targetEdge) return "";

  if (isEssoStalemated(row, col, movingPiece.owner)) {
    return "Esso was cancelled by an enemy Hybrid beside it horizontally.";
  }

  const duplicateCol = nearestEmptyColumnOnRow(targetEdge, col);
  if (duplicateCol === null) {
    return "Esso could not create a duplicate because the opposite edge is full.";
  }

  movingPiece.essoed = true;
  state.board[targetEdge][duplicateCol] = piece(movingPiece.type, movingPiece.owner, {
    original: false,
    essoed: true,
  });

  return `${capitalize(movingPiece.type)} used Esso and duplicated.`;
}

function nearestEmptyColumnOnRow(row, preferredCol) {
  const columns = Array.from({ length: BOARD_SIZE }, (_, col) => col)
    .filter((col) => state.board[row][col] === null)
    .sort((a, b) => Math.abs(a - preferredCol) - Math.abs(b - preferredCol));
  return columns.length ? columns[0] : null;
}

function isEssoStalemated(row, col, owner) {
  for (const offset of [-1, 1]) {
    const other = state.board[row]?.[col + offset];
    if (other?.owner !== owner && other?.type === "hybrid") return true;
  }
  return false;
}

function showEndQuinButton() {
  let button = document.querySelector("#endQuinButton");
  if (button) return;

  button = document.createElement("button");
  button.id = "endQuinButton";
  button.type = "button";
  button.className = "secondary-button end-quin-button";
  button.textContent = "End Quin turn";
  button.addEventListener("click", () => {
    button.remove();
    endPlayerTurn();
  });
  gameMessage.insertAdjacentElement("afterend", button);
}

function removeEndQuinButton() {
  document.querySelector("#endQuinButton")?.remove();
}

function endPlayerTurn(extraMessage = "") {
  removeEndQuinButton();
  state.quinMovesRemaining = 0;
  state.selected = null;
  state.legalMoves = [];

  if (checkPermanentSequoiaLoss("bot")) return;

  state.currentPlayer = "bot";
  setMessage(extraMessage || "Bot is choosing a move...");
  render();
  window.setTimeout(botTurn, 450);
}

function botTurn() {
  if (state.gameOver) return;

  if (checkPermanentSequoiaLoss("bot")) return;

  const moves = getAllMoves("bot");
  if (moves.length === 0) {
    finishGame("player", "The bot has no legal moves.");
    return;
  }

  const selectedMove = chooseBotMove(moves);
  const movingPiece = state.board[selectedMove.from.row][selectedMove.from.col];
  const capturedPiece = state.board[selectedMove.to.row][selectedMove.to.col];

  state.board[selectedMove.to.row][selectedMove.to.col] = movingPiece;
  state.board[selectedMove.from.row][selectedMove.from.col] = null;

  if (capturedPiece?.type === "hybrid") {
    finishGame("bot", "The bot captured your Hybrid.");
    return;
  }

  let botMessage = attemptEsso(selectedMove.to.row, selectedMove.to.col, movingPiece);

  if (movingPiece.type === "quin") {
    const secondMoves = getLegalMoves(selectedMove.to.row, selectedMove.to.col);
    if (secondMoves.length > 0) {
      const secondMove = chooseBotDestination(secondMoves);
      const secondCaptured = state.board[secondMove.row][secondMove.col];

      state.board[secondMove.row][secondMove.col] = movingPiece;
      state.board[selectedMove.to.row][selectedMove.to.col] = null;

      if (secondCaptured?.type === "hybrid") {
        finishGame("bot", "The bot's Quin captured your Hybrid.");
        return;
      }
    }
  }

  if (checkPermanentSequoiaLoss("player")) return;

  state.currentPlayer = "player";
  state.moveNumber += 1;
  setMessage(botMessage ? `${botMessage} Your turn.` : "Your turn. Select one of your pieces.");
  render();
}

function checkPermanentSequoiaLoss(owner) {
  if (!isHybridSequoiaStalemated(owner)) return false;

  const nonHybridMoves = getAllMoves(owner, { excludeTypes: ["hybrid"] });
  if (nonHybridMoves.length > 0) return false;

  finishGame(opponent(owner), `${capitalize(owner)} lost by permanent Sequoia stalemate.`);
  return true;
}

function chooseBotMove(moves) {
  const captures = moves.filter((move) => move.to.capture);
  const hybridCapture = captures.find(
    (move) => state.board[move.to.row][move.to.col]?.type === "hybrid"
  );

  if (hybridCapture) return hybridCapture;
  if (state.difficulty === "new") return randomItem(moves);

  if (state.difficulty === "beginner") {
    return Math.random() < 0.55 && captures.length ? randomItem(captures) : randomItem(moves);
  }

  if (state.difficulty === "pro") {
    return captures.length ? highestValueCapture(captures) : randomItem(moves);
  }

  if (captures.length) return highestValueCapture(captures);

  const playerHybrid = findPiece("hybrid", "player");
  if (!playerHybrid) return randomItem(moves);

  return [...moves].sort((a, b) =>
    chebyshevDistance(a.to, playerHybrid) - chebyshevDistance(b.to, playerHybrid)
  )[0];
}

function chooseBotDestination(moves) {
  const captures = moves.filter((move) => move.capture);
  return captures.length ? highestValueDestination(captures) : randomItem(moves);
}

function highestValueCapture(captures) {
  return [...captures].sort((a, b) => {
    const pieceA = state.board[a.to.row][a.to.col];
    const pieceB = state.board[b.to.row][b.to.col];
    return (PIECE_VALUES[pieceB?.type] || 0) - (PIECE_VALUES[pieceA?.type] || 0);
  })[0];
}

function highestValueDestination(captures) {
  return [...captures].sort((a, b) => {
    const pieceA = state.board[a.row][a.col];
    const pieceB = state.board[b.row][b.col];
    return (PIECE_VALUES[pieceB?.type] || 0) - (PIECE_VALUES[pieceA?.type] || 0);
  })[0];
}

function getAllMoves(owner, options = {}) {
  const moves = [];
  const excluded = new Set(options.excludeTypes || []);

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const currentPiece = state.board[row][col];
      if (currentPiece?.owner !== owner || excluded.has(currentPiece.type)) continue;

      for (const destination of getLegalMoves(row, col)) {
        moves.push({ from: { row, col }, to: destination });
      }
    }
  }

  return moves;
}

function getLegalMoves(row, col) {
  const currentPiece = state.board[row][col];
  if (!currentPiece) return [];

  if (currentPiece.type === "hybrid" && isHybridSequoiaStalemated(currentPiece.owner)) {
    return [];
  }

  if (currentPiece.type === "jem" && isJemSequoiaStalemated(row, col)) {
    return [];
  }

  switch (currentPiece.type) {
    case "hybrid": {
      const normal = adjacentMoves(row, col, currentPiece.owner);
      return isTemaActive(currentPiece.owner)
        ? mergeMoves(normal, fixedOffsets(row, col, currentPiece.owner, [[-2,-2],[-2,2],[2,-2],[2,2]], false))
        : normal;
    }
    case "quin":
      return adjacentMoves(row, col, currentPiece.owner);
    case "mend":
      return fixedOffsets(row, col, currentPiece.owner, [[-2,-2],[-2,2],[2,-2],[2,2]], false);
    case "con":
      return ringMoves(row, col, currentPiece.owner, [2], false);
    case "cond":
      return ringMoves(row, col, currentPiece.owner, [1,2,3], true);
    case "jem":
      return mergeMoves(
        adjacentMoves(row, col, currentPiece.owner),
        ringMoves(row, col, currentPiece.owner, [2], false)
      );
    case "monem":
      return monemMoves(row, col, currentPiece.owner);
    default:
      return [];
  }
}

function isTemaActive(owner) {
  const pieces = listPieces(owner);
  return pieces.length === 1 && pieces[0].piece.type === "hybrid";
}

function isHybridSequoiaStalemated(owner) {
  const originalHybrid = listPieces(owner).find(
    ({ piece: currentPiece }) => currentPiece.type === "hybrid" && currentPiece.original
  );
  if (!originalHybrid) return false;
  return hasAdjacentEnemyCon(originalHybrid.row, originalHybrid.col, owner);
}

function isJemSequoiaStalemated(row, col) {
  const currentPiece = state.board[row][col];
  if (!currentPiece || currentPiece.type !== "jem" || currentPiece.essoed) return false;
  return hasAdjacentEnemyCon(row, col, currentPiece.owner);
}

function hasAdjacentEnemyCon(row, col, owner) {
  const offsets = [[-1,0],[1,0],[0,-1],[0,1]];
  return offsets.some(([r, c]) => {
    const nearby = state.board[row + r]?.[col + c];
    return nearby?.owner !== owner && nearby?.type === "con";
  });
}

function adjacentMoves(row, col, owner) {
  const offsets = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset !== 0 || colOffset !== 0) offsets.push([rowOffset, colOffset]);
    }
  }
  return fixedOffsets(row, col, owner, offsets, false);
}

function fixedOffsets(row, col, owner, offsets, canJump) {
  const moves = [];
  for (const [rowOffset, colOffset] of offsets) {
    const targetRow = row + rowOffset;
    const targetCol = col + colOffset;
    if (!insideBoard(targetRow, targetCol)) continue;
    if (!canJump && pathBlocked(row, col, targetRow, targetCol)) continue;
    addMoveIfAllowed(moves, targetRow, targetCol, owner);
  }
  return moves;
}

function ringMoves(row, col, owner, radii, canJump) {
  const offsets = [];
  for (const radius of radii) {
    for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
      for (let colOffset = -radius; colOffset <= radius; colOffset += 1) {
        if (Math.max(Math.abs(rowOffset), Math.abs(colOffset)) === radius) {
          offsets.push([rowOffset, colOffset]);
        }
      }
    }
  }
  return fixedOffsets(row, col, owner, offsets, canJump);
}

function monemMoves(row, col, owner) {
  const moves = [];
  const forward = owner === "player" ? -1 : 1;
  const right = owner === "player" ? 1 : -1;

  for (const [rowOffset, colOffset] of [[forward, 0], [0, right]]) {
    const targetRow = row + rowOffset;
    const targetCol = col + colOffset;
    if (insideBoard(targetRow, targetCol) && state.board[targetRow][targetCol] === null) {
      moves.push({ row: targetRow, col: targetCol, capture: false });
    }
  }

  for (const colOffset of [-1, 1]) {
    const targetCol = col + colOffset;
    const target = state.board[row]?.[targetCol];
    if (target && target.owner !== owner) {
      moves.push({ row, col: targetCol, capture: true });
    }
  }

  for (const [rowStep, colStep] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let targetRow = row + rowStep;
    let targetCol = col + colStep;
    while (insideBoard(targetRow, targetCol)) {
      const targetPiece = state.board[targetRow][targetCol];
      if (targetPiece) {
        if (targetPiece.owner !== owner) {
          moves.push({ row: targetRow, col: targetCol, capture: true });
        }
        break;
      }
      targetRow += rowStep;
      targetCol += colStep;
    }
  }

  return moves;
}

function pathBlocked(startRow, startCol, targetRow, targetCol) {
  const rowDifference = targetRow - startRow;
  const colDifference = targetCol - startCol;
  const steps = Math.max(Math.abs(rowDifference), Math.abs(colDifference));
  if (steps <= 1) return false;

  const straightOrDiagonal =
    rowDifference === 0 ||
    colDifference === 0 ||
    Math.abs(rowDifference) === Math.abs(colDifference);
  if (!straightOrDiagonal) return false;

  const rowStep = Math.sign(rowDifference);
  const colStep = Math.sign(colDifference);
  for (let step = 1; step < steps; step += 1) {
    if (state.board[startRow + rowStep * step][startCol + colStep * step]) return true;
  }
  return false;
}

function addMoveIfAllowed(moves, row, col, owner) {
  const targetPiece = state.board[row][col];
  if (!targetPiece) {
    moves.push({ row, col, capture: false });
  } else if (targetPiece.owner !== owner) {
    moves.push({ row, col, capture: true });
  }
}

function mergeMoves(...moveGroups) {
  const combined = new Map();
  for (const group of moveGroups) {
    for (const move of group) combined.set(`${move.row},${move.col}`, move);
  }
  return [...combined.values()];
}

function listPieces(owner) {
  const pieces = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const currentPiece = state.board[row][col];
      if (currentPiece?.owner === owner) pieces.push({ row, col, piece: currentPiece });
    }
  }
  return pieces;
}

function findPiece(type, owner) {
  const result = listPieces(owner).find(({ piece: currentPiece }) => currentPiece.type === type);
  return result ? { row: result.row, col: result.col } : null;
}

function updateRuleStatus() {
  if (!ruleStatus) return;
  const statuses = [];

  for (const owner of ["player", "bot"]) {
    if (isHybridSequoiaStalemated(owner)) {
      statuses.push(`${owner === "player" ? "Your" : "Bot"} Hybrid is Sequoia stalemated`);
    }
    if (isTemaActive(owner)) {
      statuses.push(`${owner === "player" ? "Your" : "Bot"} Tema is active`);
    }
  }

  ruleStatus.textContent = statuses.length ? statuses.join(" • ") : "No special rule is active.";
}

function finishGame(winner, reason = "") {
  state.gameOver = true;
  state.selected = null;
  state.legalMoves = [];
  removeEndQuinButton();

  if (winner === "player") {
    saveWin(state.difficulty);
    setMessage(`You won against the ${capitalize(state.difficulty)} bot! ${reason}`.trim());
  } else {
    setMessage(`The bot wins. ${reason}`.trim());
  }

  render();
}

function setMessage(message) {
  gameMessage.textContent = message;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function chebyshevDistance(a, b) {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function insideBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function opponent(owner) {
  return owner === "player" ? "bot" : "player";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

newGameButton.addEventListener("click", newGame);

difficultySelect.addEventListener("change", () => {
  const selectedOption = difficultySelect.options[difficultySelect.selectedIndex];
  if (selectedOption.disabled) difficultySelect.value = "beginner";
});

resetProgressButton.addEventListener("click", () => {
  localStorage.removeItem("esnendoBeginnerWins");
  localStorage.removeItem("esnendoProWins");
  difficultySelect.value = "new";
  updateDifficultyLocks();
  newGame();
});

updateDifficultyLocks();
newGame();
