import { useRef, useEffect, useState, useCallback } from 'react';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import './TetrisGame.css';

// Game constants
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
  null,
  '#FF0D72', // I (Cyan traditionally, but using vibrant colors)
  '#0DC2FF', // J (Blue)
  '#FF8E0D', // L (Orange)
  '#FFE138', // O (Yellow)
  '#0DFF72', // S (Green)
  '#F538FF', // T (Purple)
  '#3877FF'  // Z (Red traditionally, using blue variant here)
];
const GHOST_COLOR = 'rgba(255, 255, 255, 0.1)'; // Ghost piece color (Made lighter)

// Tetromino shapes
const SHAPES = [
  null,
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 0, 0], [2, 2, 2], [0, 0, 0]],                         // J
  [[0, 0, 3], [3, 3, 3], [0, 0, 0]],                         // L
  [[0, 4, 4, 0], [0, 4, 4, 0], [0, 0, 0, 0]],               // O (4x4 for rotation center)
  [[0, 5, 5], [5, 5, 0], [0, 0, 0]],                         // S
  [[0, 6, 0], [6, 6, 6], [0, 0, 0]],                         // T
  [[7, 7, 0], [0, 7, 7], [0, 0, 0]]                          // Z
];

const PREVIEW_CANVAS_SIZE = 4 * 20; // 4 blocks, 20px each
const PREVIEW_BLOCK_SIZE = 20;

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function createPiece() {
  const shapeIndex = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
  const shapeMatrix = SHAPES[shapeIndex];
  // Adjust matrix to be consistently 4x4 for easier rotation/preview centering
  // This might require adjustment based on how SHAPES are defined
  // Example basic padding (adjust SHAPES definition for better results)
  let matrix = shapeMatrix.map(row => [...row]);
  // Pad rows and cols if needed (this is a simplified approach)
  // while (matrix.length < 4) matrix.push(Array(matrix[0]?.length || 0).fill(0));
  // matrix.forEach(row => { while (row.length < 4) row.push(0); });
  // Best practice: Define SHAPES as 4x4 initially if possible

  return {
    shape: shapeIndex,
    matrix: shapeMatrix, // Use original shape matrix for game logic
    // previewMatrix: matrix, // Use padded matrix for preview if needed
    color: COLORS[shapeIndex]
  };
}

export default function TetrisGame() {
  const canvasRef = useRef(null);
  const nextPieceCanvasRef = useRef(null);
  const leftButtonRef = useRef(null);
  const rightButtonRef = useRef(null);
  const downButtonRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [newHighScore, setNewHighScore] = useState(false);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);

  // Game state
  const [board, setBoard] = useState(() => createEmptyBoard());
  const [piece, setPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [nextPiece, setNextPiece] = useState(() => createPiece());
  const [gameOver, setGameOver] = useState(false);

  // Refs for game loop timing and animation frame handle
  const requestRef = useRef();
  const lastTimeRef = useRef(0);
  const dropCounterRef = useRef(0);

  // Load high score
  useEffect(() => {
    const loadHighScore = async () => {
      const user = auth.currentUser;
      let initialHighScore = 0; // Default
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists() && userDoc.data().tetrisHighScore_s2 !== undefined) {
                initialHighScore = userDoc.data().tetrisHighScore_s2;
            } else {
                // Ensure the field exists if document exists but field doesn't
                 if(userDoc.exists()) {
                    await setDoc(userDocRef, { tetrisHighScore_s2: 0 }, { merge: true });
                 } else {
                    // If user doc doesn't exist at all, create it with score
                     await setDoc(userDocRef, { tetrisHighScore_s2: 0 });
                 }
            }
        } catch (error) {
            console.error("Error loading/setting initial high score:", error);
        }
      }
      // Else (not logged in), initialHighScore remains 0 (or load from localStorage?)
      setHighScore(initialHighScore);
      // Start the game only after high score is potentially loaded
      // Delay slightly or ensure setup is complete before starting
      // setTimeout(() => setIsRunning(true), 0); // Simple delay
      setIsRunning(true); // Assuming setup is synchronous enough
    };
    loadHighScore();
  }, []);

  // Update high score
  const updateHighScore = useCallback(async (currentScore) => {
    // Update high score if current score is higher
    if (currentScore > highScore) {
        setHighScore(currentScore);
        setNewHighScore(true);
        const user = auth.currentUser;
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await updateDoc(userDocRef, { tetrisHighScore_s2: currentScore });
                console.log("Firestore high score updated.");
            } catch (error) {
                console.error("Error updating Firestore high score:", error);
                // Optional: Handle DB update failure (e.g., revert UI state?)
            }
        }
        // Else (not logged in): highScore state already updated, maybe save to localStorage?
    }
  }, [highScore]);

  // --- Collision Detection ---
  const validMove = useCallback((p, pos, currentBoard) => {
    // Checks if piece 'p' at 'pos' is valid on 'currentBoard'
    if (!p || !p.matrix) return false;
    const matrix = p.matrix;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          const boardX = pos.x + x;
          const boardY = pos.y + y;
          if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return false; // Out of bounds L/R/Bottom
          // Allow moves where the piece starts above the board (boardY < 0)
          if (boardY >= 0 && currentBoard[boardY]?.[boardX] !== 0) return false; // Collision with existing block
        }
      }
    }
    return true;
  }, []);

  // --- Piece Manipulation ---
  const mergePiece = useCallback(() => {
    // Merges the current piece onto the board state
    if (!piece) return null;
    let newBoard = board.map(row => [...row]);
    let isGameOver = false;
    const matrix = piece.matrix;
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < matrix[y].length; x++) {
        if (matrix[y][x] !== 0) {
          const boardY = position.y + y;
          const boardX = position.x + x;
          // Check for game over condition *before* trying to place the block
          if (boardY < 0) { // Piece locked entirely above the screen
            isGameOver = true; break;
          }
          // Check if the cell within the board is already occupied
          if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
              if (newBoard[boardY]?.[boardX] !== 0) {
                // This scenario indicates a collision, likely game over if piece is at spawn
                // If validMove allowed this, it suggests the piece is overlapping at spawn
                 console.warn("Collision detected during merge at board Y:", boardY);
                 // If this collision happens at the very top, it's game over.
                 // A more robust check might be needed depending on spawn logic.
                 // For now, assume any merge collision is potentially game over,
                 // especially if boardY is low. Let's check if it's near the top.
                 if (boardY < 2) { // Heuristic: Collision near the top rows often means game over
                      isGameOver = true; break;
                 }
                 // If collision is lower, it might be an edge case, but let's still flag it.
                 // This shouldn't ideally happen with correct validMove checks.
                 // isGameOver = true; break; // Or log warning and continue?
              }
             newBoard[boardY][boardX] = piece.shape;
          } else if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
             // Part of the piece is outside bounds during merge. This shouldn't happen
             // if validMove prevents it, but as a safeguard:
             console.warn("Piece part outside bounds during merge.");
             // This could potentially trigger game over if it means the piece couldn't fit
             // isGameOver = true; break;
          }
        }
      }
      if (isGameOver) break;
    }

    if (isGameOver) {
      setGameOver(true);
      setIsRunning(false);
      console.log("Game Over: Piece locked too high or merge collision detected.");
      updateHighScore(score); // Ensure high score check happens on game over
      return null; // Indicate failure / game over
    } else {
      setBoard(newBoard);
      return newBoard; // Return updated board for line clearing
    }
  }, [piece, position, board, score, updateHighScore]); // Added score, updateHighScore

  const clearLines = useCallback((boardAfterMerge) => {
    // Clears completed lines from the board
    if (!boardAfterMerge) return 0;
    let linesClearedCount = 0;
    // Filter out full rows
    const newBoard = boardAfterMerge.filter(row => !row.every(cell => cell !== 0));
    linesClearedCount = ROWS - newBoard.length;

    if (linesClearedCount > 0) {
        console.log(`Clearing ${linesClearedCount} lines.`); // DEBUG
        // Add empty rows at the top
        const emptyRows = Array.from({ length: linesClearedCount }, () => Array(COLS).fill(0));
        const finalBoard = [...emptyRows, ...newBoard];
        setBoard(finalBoard); // Update the board state

        const newLines = lines + linesClearedCount;
        setLines(newLines);

        // Calculate points based on lines cleared and level
        let points = 0;
        switch (linesClearedCount) {
            case 1: points = 40 * level; break;
            case 2: points = 100 * level; break;
            case 3: points = 300 * level; break;
            case 4: points = 1200 * level; break; // Tetris!
            default: points = 0;
        }
        const newScore = score + points;
        setScore(newScore); // Update score state

        // Update level based on total lines cleared
        const newLevel = Math.floor(newLines / 10) + 1;
        if (newLevel !== level) {
            console.log(`Level up to ${newLevel}`); // DEBUG
            setLevel(newLevel); // Update level state
        }

        // Check and update high score
        // console.log(`Checking high score: New Score ${newScore} vs High Score ${highScore}`); // DEBUG
        if (newScore > highScore) {
            // console.log("New high score detected!"); // DEBUG
            updateHighScore(newScore);
        }
    } else {
        // If no lines were cleared, the board state should have already been set
        // by the caller (mergePiece or hardDrop logic) before calling clearLines.
        // If clearLines was called with a temporary board, the caller is responsible
        // for setting the final board state.
        // setBoard(boardAfterMerge); // This line seems redundant if caller sets state.
    }
    return linesClearedCount;
  }, [lines, level, score, highScore, updateHighScore]); // Dependencies updated


  const rotate = useCallback((matrix) => {
    // Simple 90-degree clockwise rotation
    if (!matrix || matrix.length === 0) return matrix;
    const N = matrix.length;
    // This simple rotation works best for matrices where N === M
    // For non-square, more complex logic is needed
    // Ensure we handle potentially non-square matrices from SHAPES
    const M = matrix[0]?.length ?? 0; // Get width from first row, default 0
     if (M === 0) return matrix; // Handle empty matrix case

    const rotated = Array(M).fill(null).map(() => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < M; x++) {
        // Correct rotation logic: rotated[x][N - 1 - y] = matrix[y][x];
         rotated[x][N - 1 - y] = matrix[y][x];
      }
    }
    return rotated;
  }, []);

  // --- Movement Functions ---
  const spawnNewPiece = useCallback(() => {
    console.log("Attempting spawnNewPiece..."); // DEBUG
    const newPiece = nextPiece || createPiece(); // Use queued piece or create
    // Center the piece horizontally based on its actual matrix width
    const pieceWidth = newPiece.matrix[0]?.length ?? 0;
    const initialX = Math.floor(COLS / 2) - Math.floor(pieceWidth / 2);
    // Start piece potentially slightly above the visible board (y=0 or y=-1 etc.)
    // Adjust initial Y based on the piece's topmost block to avoid immediate collision
    let initialY = 0;
    // Find the first row with a block in it
     const firstBlockRow = newPiece.matrix.findIndex(row => row.some(cell => cell !== 0));
     if (firstBlockRow > 0) {
         initialY = -firstBlockRow; // Start higher up if the first block isn't in the top row of the matrix
     }

    const initialPos = { x: initialX, y: initialY };

    console.log("Spawning piece:", newPiece.shape, "at", initialPos); // DEBUG

    // Use the *current* board state for the spawn check
    if (!validMove(newPiece, initialPos, board)) {
        console.warn("Game Over: Cannot spawn new piece at initial position."); // DEBUG
        // Set piece and position so the failing piece might be visible briefly
        setPiece(newPiece);
        setPosition(initialPos);
        // Trigger game over state
        setGameOver(true);
        setIsRunning(false);
        updateHighScore(score); // Update high score on game over
    } else {
        console.log("Spawn successful."); // DEBUG
        setPiece(newPiece);
        setPosition(initialPos);
        // Generate the *next* piece for the preview
        setNextPiece(createPiece());
        // Reset drop timer for the new piece only after successful spawn
        dropCounterRef.current = 0;
    }

  }, [nextPiece, board, validMove, score, updateHighScore]); // Added score, updateHighScore dependencies


  const moveDown = useCallback(() => {
    // console.log("Attempting moveDown..."); // DEBUG
    if (!piece || gameOver || !isRunning) {
        // console.log("MoveDown aborted: State check failed (!piece/gameOver/!isRunning)"); // DEBUG
        return false;
    }

    const newPos = { ...position, y: position.y + 1 };

    if (validMove(piece, newPos, board)) {
      // console.log("MoveDown successful, new pos:", newPos); // DEBUG
      setPosition(newPos);
      return true; // Move successful
    } else {
      // console.log("MoveDown invalid (locking piece)..."); // DEBUG
      // Cannot move down: Lock piece, clear lines, spawn next
      const boardAfterMerge = mergePiece(); // mergePiece now handles setting board state and gameOver checks
      if (boardAfterMerge !== null) { // Check merge didn't cause game over (null means game over)
          clearLines(boardAfterMerge); // clearLines now needs the board passed in
          spawnNewPiece(); // Spawn the next piece if game isn't over
      } else if (!gameOver) {
          // If mergePiece returned null but didn't set gameOver itself (shouldn't happen now)
          console.error("mergePiece returned null but gameOver is not set. Investigate!");
          setGameOver(true); // Ensure game over is set
          setIsRunning(false);
          updateHighScore(score);
      }
      // Reset drop counter regardless of lock/game over, as the piece action is complete
      dropCounterRef.current = 0;
      return false; // Move failed (piece locked or game over)
    }
  }, [piece, position, board, gameOver, isRunning, validMove, mergePiece, clearLines, spawnNewPiece, score, updateHighScore]); // Added score/updateHighScore back


  const moveLeft = useCallback(() => {
    // console.log("Attempting moveLeft..."); // DEBUG
    if (gameOver || !isRunning || !piece) {
        // console.log("MoveLeft aborted: State check failed (gameOver/!isRunning/!piece)"); // DEBUG
        return;
    }
    const newPos = { ...position, x: position.x - 1 };
    if (validMove(piece, newPos, board)) {
        // console.log("MoveLeft successful, new pos:", newPos); // DEBUG
        setPosition(newPos);
    } else {
        // console.log("MoveLeft invalid."); // DEBUG
    }
  }, [gameOver, isRunning, piece, position, board, validMove]);

  const moveRight = useCallback(() => {
    // console.log("Attempting moveRight..."); // DEBUG
    if (gameOver || !isRunning || !piece) {
        // console.log("MoveRight aborted: State check failed (gameOver/!isRunning/!piece)"); // DEBUG
        return;
    }
    const newPos = { ...position, x: position.x + 1 };
    if (validMove(piece, newPos, board)) {
        // console.log("MoveRight successful, new pos:", newPos); // DEBUG
        setPosition(newPos);
    } else {
        // console.log("MoveRight invalid."); // DEBUG
    }
  }, [gameOver, isRunning, piece, position, board, validMove]);

  const rotatePiece = useCallback(() => {
    // console.log("Attempting rotatePiece..."); // DEBUG
    if (!piece || gameOver || !isRunning) {
        // console.log("Rotate aborted: State check failed (!piece/gameOver/!isRunning)"); // DEBUG
        return;
    }
    // O-block (shape 4) doesn't rotate
    if (piece.shape === 4) {
        // console.log("Rotate aborted: O-block"); // DEBUG
        return;
    }

    const rotatedMatrix = rotate(piece.matrix);
    const rotatedPiece = { ...piece, matrix: rotatedMatrix };

    // Simple Wall Kick Simulation (Basic) - Check current pos, then +/- 1 horizontally
    // More complex SRS (Super Rotation System) kicks could be implemented
    const kicks = [
        { x: 0, y: 0 },  // 1. Try original position
        { x: 1, y: 0 },  // 2. Try one step right
        { x: -1, y: 0 }, // 3. Try one step left
        { x: 2, y: 0 },  // 4. Try two steps right (for I-piece etc.)
        { x: -2, y: 0 }, // 5. Try two steps left (for I-piece etc.)
        // Optional: Add vertical kicks if needed, e.g., { x: 0, y: -1 } for floor kicks
    ];

    for (const kick of kicks) {
      const testPos = { x: position.x + kick.x, y: position.y + kick.y };
      if (validMove(rotatedPiece, testPos, board)) {
        // console.log("Rotate successful with kick:", kick, "New pos:", testPos); // DEBUG
        setPiece(rotatedPiece);
        setPosition(testPos);
        return; // Rotation successful
      }
    }
     // console.log("Rotate invalid after checking kicks."); // DEBUG
  }, [piece, position, board, gameOver, isRunning, rotate, validMove]);


  // --- Hard Drop ---
  const hardDrop = useCallback(() => {
    console.log("Attempting hardDrop..."); // DEBUG
    if (!piece || gameOver || !isRunning) {
        console.log("HardDrop aborted: State check failed (!piece/gameOver/!isRunning)"); // DEBUG
        return;
    }

    // Calculate the final landing position
    let ghostY = position.y;
    while (validMove(piece, { ...position, y: ghostY + 1 }, board)) {
        ghostY++;
    }
    const finalPos = { ...position, y: ghostY };


    // Only proceed if the drop position is different from the current position
    if (finalPos.y > position.y) {
        console.log(`Hard dropping to y: ${finalPos.y}`); // DEBUG

        // --- Direct Lock Sequence using finalPos ---
        // 1. Create the merged board state conceptually using finalPos
        let tempBoard = board.map(row => [...row]);
        let isGameOver = false;
        const matrix = piece.matrix;
        for (let y = 0; y < matrix.length; y++) {
          for (let x = 0; x < matrix[y].length; x++) {
            if (matrix[y][x] !== 0) {
              const boardY = finalPos.y + y; // Use finalPos.y
              const boardX = finalPos.x + x; // Use finalPos.x
              if (boardY < 0) { isGameOver = true; break; } // Locked above screen
              if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
                 if (tempBoard[boardY]?.[boardX] !== 0) { // Collision check
                     console.warn("Collision during hard drop merge calc - potential game over.");
                     isGameOver = true; break;
                 }
                 tempBoard[boardY][boardX] = piece.shape;
              } else if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
                  // Piece part outside bounds during merge - should not happen with validMove
                  console.warn("Piece part outside bounds during hard drop merge calc.");
                  // isGameOver = true; break; // Decide if this causes game over
              }
            }
          }
          if (isGameOver) break;
        }

        if (isGameOver) {
             console.warn("Game Over triggered during hard drop merge calculation.");
             // Set piece to final position briefly for visual feedback
             setPosition(finalPos);
             setGameOver(true);
             setIsRunning(false);
             updateHighScore(score);
        } else {
             // 2. Update the board state *immediately* with the merged result
             setBoard(tempBoard);
             // 3. Set the piece position to the final landing spot *momentarily*
             //    (might not be visually noticeable but helps state consistency if needed)
             setPosition(finalPos); // Update position state
             // 4. Clear lines based on the updated board (tempBoard)
             clearLines(tempBoard); // Pass the already merged board
             // 5. Spawn the next piece (this updates piece and position state again)
             spawnNewPiece(); // spawnNewPiece should handle cases where game ended from clearLines? No, clearLines doesn't end game.
             // 6. Reset drop counter
             dropCounterRef.current = 0;
        }
        // --- End Direct Lock Sequence ---

    } else {
        // If finalPos.y === position.y, it means the piece is already resting on something.
        // Treat this like a normal lock (e.g., pressing down when already grounded)
        console.log("HardDrop essentially locking piece in place (already grounded)."); // DEBUG
        const boardAfterMerge = mergePiece(); // Use standard merge which uses current position state
        if (boardAfterMerge !== null) { // Check if merge caused game over
            clearLines(boardAfterMerge);
            spawnNewPiece(); // Spawn next only if game is not over
        }
        // Reset drop counter even if merge failed (game over occurred)
        dropCounterRef.current = 0;
    }

  }, [piece, position, board, gameOver, isRunning, validMove, mergePiece, clearLines, spawnNewPiece, score, updateHighScore]); // Added dependencies


  // --- Ghost Piece Calculation ---
  const calculateGhostPosition = useCallback((currentPiece, currentPosition, currentBoard) => {
    if (!currentPiece) return null;
    let ghostY = currentPosition.y;
    while (validMove(currentPiece, { ...currentPosition, y: ghostY + 1 }, currentBoard)) {
      ghostY++;
    }
    return { ...currentPosition, y: ghostY };
  }, [validMove]); // Depends only on validMove callback


  // --- Drawing Effects ---

  // Main Game Canvas Drawing
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    const width = COLS * BLOCK_SIZE;
    const height = ROWS * BLOCK_SIZE;

    // Resize canvas for high DPI displays if necessary
    if (canvas.width !== width * scale || canvas.height !== height * scale) {
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale); // Scale context to draw crisply
    }

    // --- Draw Background and Grid ---
    ctx.fillStyle = '#000'; // Black background
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#222'; // Dark grey grid lines
    ctx.lineWidth = 0.5 / scale; // Adjust line width for scale
    ctx.beginPath();
    for (let x = 0; x <= COLS; x++) {
        ctx.moveTo(x * BLOCK_SIZE, 0);
        ctx.lineTo(x * BLOCK_SIZE, height);
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.moveTo(0, y * BLOCK_SIZE);
        ctx.lineTo(width, y * BLOCK_SIZE);
    }
    ctx.stroke();


    // --- Draw Settled Blocks ---
    board.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = COLORS[value];
          ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
          // Add a subtle border or bevel effect (optional)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 1 / scale;
          ctx.strokeRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        }
      });
    });

    // --- Draw Ghost Piece (Before Active Piece) ---
    if (piece && isRunning && !gameOver) {
        const ghostPos = calculateGhostPosition(piece, position, board);
        if (ghostPos && ghostPos.y > position.y) { // Only draw if ghost is below current piece
            const matrix = piece.matrix;
            ctx.fillStyle = GHOST_COLOR; // Use the defined ghost color
            // Alternative: Use piece color with alpha: ctx.fillStyle = piece.color + '66'; // Add alpha hex
            matrix.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value !== 0) {
                        const drawX = (ghostPos.x + x) * BLOCK_SIZE + 1;
                        const drawY = (ghostPos.y + y) * BLOCK_SIZE + 1;
                         if (drawY < height && drawY + BLOCK_SIZE > 0 && drawX < width && drawX + BLOCK_SIZE > 0) {
                           // Draw ghost slightly differently (e.g., outline or just semi-transparent fill)
                            ctx.fillRect(drawX, drawY, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                            // Optional: Outline for ghost piece
                            // ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                            // ctx.lineWidth = 1 / scale;
                            // ctx.strokeRect(drawX, drawY, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                        }
                    }
                });
            });
        }
    }


    // --- Draw the Current Falling Piece (Active Piece) ---
    if (piece && isRunning && !gameOver) {
        const matrix = piece.matrix;
        ctx.fillStyle = piece.color;
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const drawX = (position.x + x) * BLOCK_SIZE + 1;
                    const drawY = (position.y + y) * BLOCK_SIZE + 1;
                    // Only draw parts of the piece that are within the board's visible area (y >= 0)
                    if (drawY + BLOCK_SIZE > 0 && drawY < height && drawX < width && drawX + BLOCK_SIZE > 0) {
                       ctx.fillRect(drawX, Math.max(0, drawY), BLOCK_SIZE - 2, BLOCK_SIZE - 2 - Math.max(0, -drawY)); // Adjust height if partially above screen
                       // Optional: border for falling piece
                       ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                       ctx.lineWidth = 1 / scale;
                       ctx.strokeRect(drawX, Math.max(0, drawY), BLOCK_SIZE - 2, BLOCK_SIZE - 2 - Math.max(0, -drawY));
                    }
                }
            });
        });
    }
  }, [board, piece, position, isRunning, gameOver, calculateGhostPosition]); // Added calculateGhostPosition


  // Next Piece Canvas Drawing
  useEffect(() => {
    if (!nextPieceCanvasRef.current || !nextPiece || !nextPiece.matrix) return;

    const canvas = nextPieceCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const matrix = nextPiece.matrix;
    const color = nextPiece.color;

    // Dynamically calculate required canvas size based on piece matrix dimensions
    const pieceHeight = matrix.length;
    const pieceWidth = matrix[0]?.length ?? 0;
    if (pieceWidth === 0) return; // Avoid drawing if piece is invalid

    const requiredWidth = pieceWidth * PREVIEW_BLOCK_SIZE + 4; // Add padding
    const requiredHeight = pieceHeight * PREVIEW_BLOCK_SIZE + 4; // Add padding
    const canvasSize = Math.max(requiredWidth, requiredHeight, PREVIEW_CANVAS_SIZE); // Ensure minimum size

    const scale = window.devicePixelRatio || 1;
    // Resize canvas if needed (consider devicePixelRatio for preview too?)
    if (canvas.width !== canvasSize * scale || canvas.height !== canvasSize * scale) {
        canvas.width = canvasSize * scale;
        canvas.height = canvasSize * scale;
        ctx.scale(scale, scale); // Scale context if resizing for high DPI
    } else {
        // If not resizing, clear previous content respecting scale
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to clear correctly
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore(); // Restore scale
    }


    // Clear and set background
    ctx.fillStyle = '#333'; // Dark background for preview
    ctx.fillRect(0, 0, canvasSize, canvasSize); // Use scaled size if needed

    // Calculate centering offset within the logical canvas size
    const totalPieceWidthPixels = pieceWidth * PREVIEW_BLOCK_SIZE;
    const totalPieceHeightPixels = pieceHeight * PREVIEW_BLOCK_SIZE;
    const offsetX = Math.floor((canvasSize - totalPieceWidthPixels) / 2);
    const offsetY = Math.floor((canvasSize - totalPieceHeightPixels) / 2);

    // Draw the piece blocks
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5 / scale; // Adjust line width for scale

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
            const drawX = offsetX + x * PREVIEW_BLOCK_SIZE + 1;
            const drawY = offsetY + y * PREVIEW_BLOCK_SIZE + 1;
            const size = PREVIEW_BLOCK_SIZE - 2;
            ctx.fillRect(drawX, drawY, size, size);
            ctx.strokeRect(drawX, drawY, size, size);
        }
      });
    });
  }, [nextPiece]); // Dependency is correct

  // --- Game Loop (requestAnimationFrame) ---

  const gameLoop = useCallback((timestamp) => {
    // Stop loop if paused or game over
    if (!isRunning || gameOver) {
        // Ensure animation frame is cancelled if stopped mid-execution
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = null; // Clear the ref
        return;
    }

    // Calculate deltaTime
    if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp;
    }
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // Automatic Drop Logic based on level
    const baseSpeed = 1000; // Milliseconds for level 1 drop
    const speedIncreaseFactor = 0.8; // Adjusted for potentially faster level progression (was 0.75)
    const minSpeed = 50; // Minimum drop interval in ms (was 100)
    const dropInterval = Math.max(minSpeed, baseSpeed * Math.pow(speedIncreaseFactor, level - 1));


    dropCounterRef.current += deltaTime;

    if (dropCounterRef.current >= dropInterval) {
        if (moveDown()) {
             // Reset counter using modulo for smoother recovery from lag/long frames
            // Only reset *excess* time, don't reset completely to 0
            // dropCounterRef.current %= dropInterval; // Modulo might cause stutter if deltaTime > interval
             dropCounterRef.current = dropCounterRef.current - dropInterval; // Subtract interval
        } else {
            // If moveDown failed (locked or game over), it already reset the counter or stopped the game.
            // The counter was reset to 0 within moveDown/hardDrop in the lock sequence.
        }
    }

    // Continue the loop ONLY if the game should still be running
    if (isRunning && !gameOver) {
        requestRef.current = requestAnimationFrame(gameLoop);
    } else {
         // If loop condition is false but we got here, ensure frame is cancelled
         if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
    }

  }, [isRunning, gameOver, level, moveDown]); // Keep level in deps


  // Effect to manage the game loop lifecycle
  useEffect(() => {
      // Handle initial piece spawn when game becomes active and no piece exists
      if (isRunning && !piece && !gameOver) {
          console.log("Spawning initial piece via useEffect...");
          spawnNewPiece(); // Handles setting piece, position, nextPiece, and initial dropCounter reset
          lastTimeRef.current = 0; // Reset loop timer ref
      }

      // Start/stop the loop based on isRunning and gameOver
      if (isRunning && !gameOver && piece) { // Ensure piece exists before starting loop
          if (!requestRef.current) {
             console.log("Starting game loop via useEffect...");
             lastTimeRef.current = performance.now(); // Use performance.now() for higher precision start time
             requestRef.current = requestAnimationFrame(gameLoop);
          }
      } else {
        // Stop the loop if paused, game over, or no piece exists yet
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
          console.log("Game loop stopped via useEffect. Reason: isRunning=", isRunning, "gameOver=", gameOver, "pieceExists=", !!piece);
        }
      }

      // Cleanup function
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          console.log("Game loop cleaned up via useEffect return:", requestRef.current);
          requestRef.current = null;
        }
      };
  }, [isRunning, gameOver, piece, gameLoop, spawnNewPiece]); // Dependencies updated


  // --- Keyboard Input Effect (Space bar added for Hard Drop) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        // Handle Pause toggle first
        if ((e.key === 'p' || e.key === 'P') && !gameOver) {
             e.preventDefault();
             setIsRunning(prev => !prev);
             console.log("Pause toggled via keydown."); // DEBUG
             return;
        }
        // Ignore other input if paused or game over
        if (!isRunning || gameOver) return;

        // Handle movement/rotation/drop
        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                moveLeft();
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveRight();
                break;
            case 'ArrowUp': // Typically rotate
                e.preventDefault();
                rotatePiece();
                break;
            case 'ArrowDown': // Soft drop
                e.preventDefault();
                if (moveDown()) { // Attempt soft drop
                    // Resetting drop counter here might make soft drop feel less smooth
                    // Let the natural game loop handle the next drop.
                    // dropCounterRef.current = 0; // Optional: Reset auto-drop timer if successful
                }
                break;
            case ' ': // Space bar for Hard Drop
                e.preventDefault();
                hardDrop();
                break;
            default: break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRunning, gameOver, moveLeft, moveRight, rotatePiece, moveDown, hardDrop, setIsRunning]); // Added hardDrop, setIsRunning


  // --- Game Reset ---
  const resetGame = useCallback(() => {
    console.log("Resetting game...");

    // Stop any existing game loop
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
    }

    // Reset all game state variables
    setBoard(createEmptyBoard());
    setPiece(null); // Will trigger spawn in useEffect when isRunning is true
    setNextPiece(createPiece()); // Prepare the next piece
    setPosition({ x: 0, y: 0 }); // Reset position (though spawn will set it)
    setScore(0);
    setLevel(1);
    setLines(0);
    setNewHighScore(false); // Reset new high score flag
    setGameOver(false); // Clear game over state

    // Reset timer refs
    lastTimeRef.current = 0;
    dropCounterRef.current = 0;

    // Restart the game - useEffect will handle spawning the first piece
    // Ensure isRunning state change triggers the useEffect hook correctly
    // Setting isRunning to false then true might be safer if there are race conditions
    // setIsRunning(false);
    // setTimeout(() => setIsRunning(true), 0); // Or just set true directly if useEffect handles it
    setIsRunning(true);


    console.log("Game reset complete. isRunning:", true);

  }, []); // Removed updateHighScore dependency, not needed here.


  // --- Mobile Touch Handlers ---
  const handleTouchRotate = useCallback((e) => {
      // e.preventDefault(); // Keep if needed to prevent zoom/scroll on canvas tap
      if (isRunning && !gameOver) {
          rotatePiece();
      }
  }, [isRunning, gameOver, rotatePiece]);

  const handleTouchLeft = useCallback((e) => {
      // e.preventDefault();
      if (isRunning && !gameOver) {
          moveLeft();
      }
  }, [isRunning, gameOver, moveLeft]);

  const handleTouchRight = useCallback((e) => {
      // e.preventDefault();
      if (isRunning && !gameOver) {
          moveRight();
      }
  }, [isRunning, gameOver, moveRight]);

   const handleTouchDown = useCallback((e) => {
        // e.preventDefault();
        // This handler is now potentially redundant if using Start/End
        if (isRunning && !gameOver) {
           if (moveDown()) {
               // dropCounterRef.current = 0; // Reset auto-drop on manual down press - Maybe remove for consistency
           }
        }
   }, [isRunning, gameOver, moveDown]);

   // Mobile Hard Drop (e.g., tap and hold on down button, or a separate button)
   // Using touch start/end for long press detection
   const longPressTimeoutRef = useRef(null);
   const touchStartTimeRef = useRef(0); // Track start time for tap vs hold distinction

   const handleTouchDownStart = useCallback((e) => {
        // e.preventDefault(); // Prevent default only if needed
        if (isRunning && !gameOver) {
            touchStartTimeRef.current = Date.now(); // Record touch start time

            // Start a timer for long press (e.g., 300-500ms)
            longPressTimeoutRef.current = setTimeout(() => {
                console.log("Long press detected on Down button - Hard Drop!");
                hardDrop();
                longPressTimeoutRef.current = null; // Clear the timeout ref (it fired)
                touchStartTimeRef.current = 0; // Reset start time after hard drop
            }, 400); // 400ms threshold for long press

            // Don't trigger soft drop immediately, wait for touchend or long press
        }
   }, [isRunning, gameOver, hardDrop]); // Removed moveDown dependency

   const handleTouchDownEnd = useCallback((e) => {
        // e.preventDefault(); // Prevent default only if needed
        if (longPressTimeoutRef.current) {
            // If the timeout is still active, clear it (means it was a short tap)
            clearTimeout(longPressTimeoutRef.current);
            longPressTimeoutRef.current = null;

            // Trigger a soft drop only if it was a short tap
            // (Check elapsed time to avoid soft drop after a long press that might have been cancelled just before firing)
            const touchEndTime = Date.now();
            if (touchStartTimeRef.current && (touchEndTime - touchStartTimeRef.current < 400)) {
                 console.log("Short tap detected on Down button - Soft Drop!");
                 if (isRunning && !gameOver) { // Check state again in case it changed
                    if (moveDown()) {
                        // dropCounterRef.current = 0; // Optional reset
                    }
                 }
            }
        }
        touchStartTimeRef.current = 0; // Reset start time
   }, [isRunning, gameOver, moveDown]); // Added isRunning/gameOver checks


  // --- Effect for Mobile Touch Event Listeners ---
  useEffect(() => {
    // Use passive: false ONLY if preventDefault() is called inside the handler
    const options = { passive: false }; // Needed because we call preventDefault

    const gameCanvasElement = canvasRef.current;
    const leftBtn = leftButtonRef.current;
    const rightBtn = rightButtonRef.current;
    const downBtn = downButtonRef.current;

    const listeners = [];

    // Canvas Tap for Rotate
    if (gameCanvasElement) {
        const rotateHandler = (e) => { e.preventDefault(); handleTouchRotate(e); };
        gameCanvasElement.addEventListener('touchstart', rotateHandler, options);
        listeners.push({ element: gameCanvasElement, type: 'touchstart', handler: rotateHandler });
    }
    // Left Button Tap (Continuous move on hold might be better UX)
    if (leftBtn) {
        const leftHandler = (e) => { e.preventDefault(); handleTouchLeft(e); };
        leftBtn.addEventListener('touchstart', leftHandler, options);
        listeners.push({ element: leftBtn, type: 'touchstart', handler: leftHandler });
        // TODO: Consider adding touchmove/touchend/intervals for continuous move
    }
    // Right Button Tap (Continuous move on hold might be better UX)
    if (rightBtn) {
        const rightHandler = (e) => { e.preventDefault(); handleTouchRight(e); };
        rightBtn.addEventListener('touchstart', rightHandler, options);
        listeners.push({ element: rightBtn, type: 'touchstart', handler: rightHandler });
        // TODO: Consider adding touchmove/touchend/intervals for continuous move
    }
    // Down Button Tap (Soft Drop) & Hold (Hard Drop)
    if (downBtn) {
        // Handlers defined using useCallback already
        const downStartHandler = (e) => { e.preventDefault(); handleTouchDownStart(e); };
        const downEndHandler = (e) => { e.preventDefault(); handleTouchDownEnd(e); };

        downBtn.addEventListener('touchstart', downStartHandler, options);
        // Add touchend and touchcancel to clear the long press timeout / trigger soft drop
        downBtn.addEventListener('touchend', downEndHandler, options);
        downBtn.addEventListener('touchcancel', downEndHandler, options); // Handle cancelled touches

        listeners.push({ element: downBtn, type: 'touchstart', handler: downStartHandler });
        listeners.push({ element: downBtn, type: 'touchend', handler: downEndHandler });
        listeners.push({ element: downBtn, type: 'touchcancel', handler: downEndHandler });
    }

    // Cleanup function
    return () => {
         // Clear any pending long press timeout on unmount/re-render
         if (longPressTimeoutRef.current) {
            clearTimeout(longPressTimeoutRef.current);
         }
        listeners.forEach(({ element, type, handler }) => {
            // Need to pass the same options object used in addEventListener
            element.removeEventListener(type, handler, options);
        });
    };
  }, [handleTouchRotate, handleTouchLeft, handleTouchRight, handleTouchDownStart, handleTouchDownEnd]); // Updated dependencies


  // --- Render JSX ---
   return (
     <div className="tetris-container">
       <div className="game-column">
         {/* Canvas and Overlays */}
         <div className="game-area">
           {/* Canvas tap listener added via useEffect */}
           <canvas ref={canvasRef} className="game-canvas" />
            {/* Game Over Overlay */}
            {gameOver && (
              <div className="game-over-overlay">
                <h2>Game Over</h2>
                {newHighScore && <p className="new-high-score-text">🌟 New High Score! 🌟</p>}
                <p>Final Score: {score}</p>
                <button onClick={resetGame} className="reset-button">Play Again</button>
              </div>
            )}
            {/* Paused Overlay */}
            {!isRunning && !gameOver && piece /* Only show paused if game has started */ && (
              <div className="paused-overlay">
                <h2>일시정지</h2>
                <p>(Press 'P' to Resume)</p>
              </div>
            )}
         </div>

          {/* Mobile Controls - Refs assigned, listeners added via useEffect */}
          <div className="mobile-controls">
             <button ref={leftButtonRef} className="control-button left">ᐊ</button>
             {/* Down button now handles tap (soft drop) and hold (hard drop) */}
             <button ref={downButtonRef} className="control-button down">ᐁ</button>
             <button ref={rightButtonRef} className="control-button right">ᐅ</button>
             {/* Consider adding a dedicated rotate button for mobile if canvas tap is unreliable */}
             {/* <button onClick={handleTouchRotate} className="control-button rotate">↻</button> */}
          </div>
       </div> {/* End of game-column */}


       {/* Info Panel */}
       <div className="info-panel">
          <div className="info-box next-piece-box">
            <h3>Next</h3>
            <canvas ref={nextPieceCanvasRef} className="next-piece-canvas"></canvas>
          </div>
          <div className="info-box score-box">
            <h3>Score</h3>
            <p>{score}</p>
            {newHighScore && <p className="new-high-score-indicator">🏆</p>}
          </div>
          <div className="info-box high-score-box">
            <h3>High Score</h3>
            <p>{highScore}</p>
           </div>
          <div className="info-box level-box">
            <h3>Level</h3>
            <p>{level}</p>
          </div>
          <div className="info-box lines-box">
            <h3>Lines</h3>
            <p>{lines}</p>
          </div>
          {/* Action Buttons */}
          <div className="action-buttons">
            <button
                className={`pause-button ${gameOver ? 'disabled' : ''}`}
                onClick={() => { if (!gameOver) setIsRunning(prev => !prev); }}
                disabled={gameOver}
            >
                {isRunning ? '일시정지 (P)' : '재개 (P)'}
            </button>
            <button
                className="back-button"
                onClick={() => {
                    // Optionally pause the game before navigating away
                    if (isRunning) setIsRunning(false);
                    // Use relative path or router navigation
                    window.location.href = "/main"; // Or use react-router navigation
                 }}
            >
                메인화면
            </button>
             <button
                className={`reset-button ${!gameOver ? 'hidden' : ''}`} // Show only when game over
                onClick={resetGame}
                // disabled={!gameOver} // Disable if not game over
            >
                다시하기
            </button>
          </div>
       </div> {/* End of info-panel */}
     </div>
   );
 }