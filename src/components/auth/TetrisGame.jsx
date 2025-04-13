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
            if (userDoc.exists() && userDoc.data().tetrisHighScore !== undefined) {
                initialHighScore = userDoc.data().tetrisHighScore;
            } else {
                // Ensure the field exists if document exists but field doesn't
                 if(userDoc.exists()) {
                    await setDoc(userDocRef, { tetrisHighScore: 0 }, { merge: true });
                 } else {
                    // If user doc doesn't exist at all, create it with score
                     await setDoc(userDocRef, { tetrisHighScore: 0 });
                 }
            }
        } catch (error) {
            console.error("Error loading/setting initial high score:", error);
        }
      }
      // Else (not logged in), initialHighScore remains 0 (or load from localStorage?)
      setHighScore(initialHighScore);
      // Start the game only after high score is potentially loaded
      setIsRunning(true);
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
                await updateDoc(userDocRef, { tetrisHighScore: currentScore });
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
          if (boardY < 0) { // Piece locked above the screen
            isGameOver = true; break;
          }
          if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
            if (newBoard[boardY]?.[boardX] !== 0) { // Collision during merge (shouldn't happen)
              isGameOver = true; break;
            }
            newBoard[boardY][boardX] = piece.shape;
          } // Ignore parts outside L/R bounds
        }
      }
      if (isGameOver) break;
    }

    if (isGameOver) {
      setGameOver(true);
      setIsRunning(false);
      console.log("Game Over: Piece locked too high or merge collision.");
      return null; // Indicate failure
    } else {
      setBoard(newBoard);
      return newBoard; // Return updated board for line clearing
    }
  }, [piece, position, board]); // Depends on piece and board state

  const clearLines = useCallback((boardAfterMerge) => {
    // Clears completed lines from the board
    if (!boardAfterMerge) return 0;
    let linesClearedCount = 0;
    const newBoard = boardAfterMerge.filter(row => !row.every(cell => cell !== 0));
    linesClearedCount = ROWS - newBoard.length;

    if (linesClearedCount > 0) {
      const emptyRows = Array.from({ length: linesClearedCount }, () => Array(COLS).fill(0));
      const finalBoard = [...emptyRows, ...newBoard];
      setBoard(finalBoard);

      const newLines = lines + linesClearedCount;
      setLines(newLines);

      let points = 0;
      switch (linesClearedCount) {
        case 1: points = 40 * level; break;
        case 2: points = 100 * level; break;
        case 3: points = 300 * level; break;
        case 4: points = 1200 * level; break;
        default: points = 0;
      }
      const newScore = score + points;
      setScore(newScore);

      const newLevel = Math.floor(newLines / 10) + 1;
      if (newLevel !== level) setLevel(newLevel);

      // Update high score check is now separate
      // updateHighScore(newScore); // Call this outside or ensure it's safe here
      // Safest: Check high score after state updates settle
      if (newScore > highScore) {
          updateHighScore(newScore);
      }
    }
    return linesClearedCount;
  }, [lines, level, score, highScore, updateHighScore]);

  const rotate = useCallback((matrix) => {
    // Simple 90-degree clockwise rotation
    if (!matrix || matrix.length === 0) return matrix;
    const N = matrix.length;
    // This simple rotation works best for matrices where N === M
    // For non-square, more complex logic is needed
    const M = matrix[0].length;
    const rotated = Array(M).fill(null).map(() => Array(N).fill(0));
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < M; x++) {
        rotated[x][N - 1 - y] = matrix[y][x];
      }
    }
    return rotated;
  }, []);

  // --- Movement Functions ---
  const spawnNewPiece = useCallback(() => {
    // Handles spawning the next piece
    const newPiece = nextPiece || createPiece(); // Use queued piece or create
    const initialX = Math.floor(COLS / 2) - Math.floor(newPiece.matrix[0]?.length / 2 || 0);
    const initialPos = { x: initialX, y: 0 }; // Spawn at top-center

    // Use the *current* board state for the spawn check
    if (!validMove(newPiece, initialPos, board)) {
      setGameOver(true);
      setIsRunning(false);
      setPiece(newPiece); // Show the piece that caused game over
      setPosition(initialPos);
      console.log("Game Over: Cannot spawn new piece.");
    } else {
      setPiece(newPiece);
      setPosition(initialPos);
    }
    setNextPiece(createPiece()); // Generate the *next* next piece
    dropCounterRef.current = 0; // Reset drop timer for the new piece

  }, [nextPiece, board, validMove]); // Depends on nextPiece and board state

  const moveDown = useCallback(() => {
    console.log("Attempting moveDown..."); // DEBUG
    if (!piece || gameOver || !isRunning) {
        console.log("MoveDown aborted: State check failed (!piece/gameOver/!isRunning)"); // DEBUG
        return false;
    }

    const newPos = { ...position, y: position.y + 1 };

    if (validMove(piece, newPos, board)) {
      console.log("MoveDown successful, new pos:", newPos); // DEBUG
      setPosition(newPos);
      return true; // Move successful
    } else {
      console.log("MoveDown invalid (locking piece)..."); // DEBUG
      // Cannot move down: Lock piece, clear lines, spawn next
      const boardAfterMerge = mergePiece();
      if (boardAfterMerge !== null) { // Check if merge caused game over
        clearLines(boardAfterMerge);
        spawnNewPiece(); // Spawn the next piece
      }
      // Else: mergePiece already set gameOver and stopped running state
      return false; // Move failed (piece locked or game over)
    }
  }, [piece, position, board, gameOver, isRunning, validMove, mergePiece, clearLines, spawnNewPiece]);

  const moveLeft = useCallback(() => {
    console.log("Attempting moveLeft..."); // DEBUG
    if (gameOver || !isRunning || !piece) {
        console.log("MoveLeft aborted: State check failed (gameOver/!isRunning/!piece)"); // DEBUG
        return;
    }
    const newPos = { ...position, x: position.x - 1 };
    if (validMove(piece, newPos, board)) {
        console.log("MoveLeft successful, new pos:", newPos); // DEBUG
        setPosition(newPos);
    } else {
         console.log("MoveLeft invalid."); // DEBUG
    }
  }, [gameOver, isRunning, piece, position, board, validMove]);

  const moveRight = useCallback(() => {
    console.log("Attempting moveRight..."); // DEBUG
    if (gameOver || !isRunning || !piece) {
        console.log("MoveRight aborted: State check failed (gameOver/!isRunning/!piece)"); // DEBUG
        return;
    }
    const newPos = { ...position, x: position.x + 1 };
    if (validMove(piece, newPos, board)) {
        console.log("MoveRight successful, new pos:", newPos); // DEBUG
        setPosition(newPos);
    } else {
        console.log("MoveRight invalid."); // DEBUG
    }
  }, [gameOver, isRunning, piece, position, board, validMove]);

  const rotatePiece = useCallback(() => {
    console.log("Attempting rotatePiece..."); // DEBUG
    if (!piece || gameOver || !isRunning) {
        console.log("Rotate aborted: State check failed (!piece/gameOver/!isRunning)"); // DEBUG
        return;
    }
    if (piece.shape === 4) {
        console.log("Rotate aborted: O-block"); // DEBUG
        return;
    } // O-block doesn't rotate

    const rotatedMatrix = rotate(piece.matrix);
    const rotatedPiece = { ...piece, matrix: rotatedMatrix };

    const kicks = [ { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -2, y: 0 }, { x: 0, y: -1 } ];
    for (const kick of kicks) {
      const testPos = { x: position.x + kick.x, y: position.y + kick.y };
      if (validMove(rotatedPiece, testPos, board)) {
        console.log("Rotate successful, new piece/pos:", rotatedPiece, testPos); // DEBUG
        setPiece(rotatedPiece); setPosition(testPos); return;
      }
    }
     console.log("Rotate invalid."); // DEBUG
  }, [piece, position, board, gameOver, isRunning, rotate, validMove]);

  // --- Drawing Effects ---

  // Main Game Canvas Drawing
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const scale = window.devicePixelRatio || 1;
    const width = COLS * BLOCK_SIZE;
    const height = ROWS * BLOCK_SIZE;

    if (canvas.width !== width * scale || canvas.height !== height * scale) {
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    board.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = COLORS[value];
          ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        }
      });
    });

    if (piece && isRunning && !gameOver) {
        const matrix = piece.matrix;
        ctx.fillStyle = piece.color;
        matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const drawX = (position.x + x) * BLOCK_SIZE + 1;
                    const drawY = (position.y + y) * BLOCK_SIZE + 1;
                    if (drawY < height && drawX + BLOCK_SIZE > 0 && drawX < width) {
                       ctx.fillRect(drawX, drawY, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                    }
                }
            });
        });
    }
  }, [board, piece, position, isRunning, gameOver]);

  // Next Piece Canvas Drawing
  useEffect(() => {
    if (!nextPieceCanvasRef.current || !nextPiece || !nextPiece.matrix) return;

    const canvas = nextPieceCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const matrix = nextPiece.matrix;

    // Ensure canvas size is correct
    if (canvas.width !== PREVIEW_CANVAS_SIZE || canvas.height !== PREVIEW_CANVAS_SIZE) {
        canvas.width = PREVIEW_CANVAS_SIZE;
        canvas.height = PREVIEW_CANVAS_SIZE;
    }

    // Clear and set background
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center and draw the piece
    ctx.fillStyle = nextPiece.color;
    const pieceHeight = matrix.length;
    const pieceWidth = matrix[0]?.length ?? 0;
    const matrixBlockSize = PREVIEW_BLOCK_SIZE;
    // Calculate centering offset based on actual piece dimensions vs canvas size
    const totalPieceWidth = pieceWidth * matrixBlockSize;
    const totalPieceHeight = pieceHeight * matrixBlockSize;
    const offsetX = Math.floor((PREVIEW_CANVAS_SIZE - totalPieceWidth) / 2);
    const offsetY = Math.floor((PREVIEW_CANVAS_SIZE - totalPieceHeight) / 2);

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillRect(
            offsetX + x * matrixBlockSize + 1,
            offsetY + y * matrixBlockSize + 1,
            matrixBlockSize - 2,
            matrixBlockSize - 2
          );
        }
      });
    });
  }, [nextPiece]);

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
        // Initialize on the first frame *after* starting/resuming
        // console.log("Initializing loop timer.");
        lastTimeRef.current = timestamp;
    }
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    // --- Automatic Drop Logic ---
    // Fixed drop interval of 1000ms (1 second) as requested
    const dropInterval = 1000;

    /* // Original level-based speed calculation (commented out)
    const baseSpeed = 1000;
    const speedIncrease = 50;
    const minSpeed = 100;
    const dropInterval = Math.max(minSpeed, baseSpeed - (level - 1) * speedIncrease);
    */

    // Accumulate time towards the next drop
    dropCounterRef.current += deltaTime;

    // Check if enough time has passed to trigger an auto-drop
    if (dropCounterRef.current >= dropInterval) {
        // Attempt to move the piece down
        if (moveDown()) {
            // If moveDown was successful (piece didn't lock), reset counter based on interval
            dropCounterRef.current %= dropInterval; // Use modulo for smoother recovery from lag
        } else {
            // If moveDown failed (piece locked or game over), the moveDown function
            // already resets the counter or stops the game.
            // No need to reset counter here in that case.
        }
    }
    // --- End Automatic Drop Logic ---

    // Continue the loop
    // Ensure we only request next frame if loop should still be running
    if (isRunning && !gameOver) {
        requestRef.current = requestAnimationFrame(gameLoop);
    } else {
        // Clean up if state changed during this frame execution
         if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
        }
    }

  }, [isRunning, gameOver, level, moveDown]); // Keep level in deps if speed might depend on it later


  // Effect to manage the game loop lifecycle
  useEffect(() => {
      // Handle initial piece spawn when game becomes active and no piece exists
      if (isRunning && !piece && !gameOver) {
          console.log("Spawning initial piece via useEffect...");
          spawnNewPiece(); // This function now handles setting piece, position, nextPiece
          // Reset timer refs when the first piece spawns
          lastTimeRef.current = 0;
          dropCounterRef.current = 0;
      }

      // Start/stop the loop based on isRunning and gameOver
      // Ensure a piece exists before starting the loop
      if (isRunning && !gameOver && piece) {
          // Start the loop only if it's not already running
          if (!requestRef.current) {
             console.log("Starting game loop via useEffect...");
             // Reset time reference *before* starting the loop for accurate first delta
             lastTimeRef.current = 0;
             requestRef.current = requestAnimationFrame(gameLoop);
             // console.log("Game loop started with request ID:", requestRef.current);
          }
      } else {
        // Stop the loop if paused, game over, or no piece exists
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          requestRef.current = null;
          console.log("Game loop stopped via useEffect. Reason: isRunning=", isRunning, "gameOver=", gameOver, "pieceExists=", !!piece);
        }
      }

      // Cleanup function: Cancel animation frame on unmount or when effect re-runs
      return () => {
        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
          console.log("Game loop cleaned up via useEffect return:", requestRef.current);
          requestRef.current = null; // Clear the ref on cleanup
        }
      };
    // Dependencies: run when game starts/stops, on game over, or when the initial piece is set.
    // `gameLoop` and `spawnNewPiece` included as they are called by the effect.
  }, [isRunning, gameOver, piece, gameLoop, spawnNewPiece]);

  // --- Keyboard Input Effect (Space bar case removed) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
        // Handle Pause toggle first
        if ((e.key === 'p' || e.key === 'P') && !gameOver) {
             e.preventDefault();
             setIsRunning(prev => !prev);
             return;
        }
        // Ignore other input if paused or game over
        if (!isRunning || gameOver) return;

        // Handle movement/rotation
        switch (e.key) {
            case 'ArrowLeft': e.preventDefault(); moveLeft(); break;
            case 'ArrowRight': e.preventDefault(); moveRight(); break;
            case 'ArrowUp': e.preventDefault(); rotatePiece(); break;
            case 'ArrowDown':
                e.preventDefault();
                if (moveDown()) { // Attempt soft drop
                    dropCounterRef.current = 0; // Reset auto-drop timer if successful
                }
                break;
            // Space bar case (' ') fully removed
            default: break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // Dependencies no longer include hardDrop
  }, [isRunning, gameOver, moveLeft, moveRight, rotatePiece, moveDown]);

  // --- Game Reset ---
  const resetGame = useCallback(() => {
    console.log("Resetting game...");

    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
    }

    setBoard(createEmptyBoard());
    setPiece(null);
    setNextPiece(createPiece());
    setPosition({ x: 0, y: 0 });
    setScore(0);
    setLevel(1);
    setLines(0);
    setNewHighScore(false);
    setGameOver(false);

    lastTimeRef.current = 0;
    dropCounterRef.current = 0;

    setIsRunning(true);

    console.log("Game reset complete. isRunning:", true);

  }, []);

  // --- Mobile Touch Handlers (handleTouchDrop removed) ---
  const handleTouchRotate = useCallback((e) => {
      // preventDefault might still be needed depending on exact browser behavior
      // e.preventDefault();
      console.log("Canvas Touched - handleTouchRotate");
      if (isRunning && !gameOver) {
          console.log("Calling rotatePiece...");
          rotatePiece();
      } else {
          console.log("Rotate ignored: isRunning=", isRunning, "gameOver=", gameOver);
      }
  }, [isRunning, gameOver, rotatePiece]); // Added rotatePiece

  const handleTouchLeft = useCallback((e) => {
      // e.preventDefault();
      console.log("Left Button Touched - handleTouchLeft");
      if (isRunning && !gameOver) {
           console.log("Calling moveLeft...");
          moveLeft();
      } else {
          console.log("Left move ignored: isRunning=", isRunning, "gameOver=", gameOver);
      }
  }, [isRunning, gameOver, moveLeft]); // Added moveLeft

  const handleTouchRight = useCallback((e) => {
      // e.preventDefault();
      console.log("Right Button Touched - handleTouchRight");
      if (isRunning && !gameOver) {
          console.log("Calling moveRight...");
          moveRight();
      } else {
           console.log("Right move ignored: isRunning=", isRunning, "gameOver=", gameOver);
      }
  }, [isRunning, gameOver, moveRight]); // Added moveRight

   const handleTouchDown = useCallback((e) => {
        // e.preventDefault();
        console.log("Down Button Touched - handleTouchDown");
        if (isRunning && !gameOver) {
             console.log("Calling moveDown...");
           if (moveDown()) {
               dropCounterRef.current = 0;
               console.log("Soft drop successful, counter reset.");
           } else {
                console.log("Soft drop failed (locked or game over).");
           }
        } else {
             console.log("Down move ignored: isRunning=", isRunning, "gameOver=", gameOver);
        }
   }, [isRunning, gameOver, moveDown]); // Added moveDown


  // --- Effect for Mobile Touch Event Listeners ---
  useEffect(() => {
    const options = { passive: false }; // Specify non-passive listeners

    // It's safer to add listener to the canvas itself for rotation
    const gameCanvasElement = canvasRef.current;
    const leftBtn = leftButtonRef.current;
    const rightBtn = rightButtonRef.current;
    const downBtn = downButtonRef.current;

    // Store added listeners to remove them correctly
    const listeners = [];

    if (gameCanvasElement) {
        const rotateHandler = (e) => { e.preventDefault(); handleTouchRotate(e); };
        gameCanvasElement.addEventListener('touchstart', rotateHandler, options);
        listeners.push({ element: gameCanvasElement, type: 'touchstart', handler: rotateHandler });
    }
    if (leftBtn) {
        const leftHandler = (e) => { e.preventDefault(); handleTouchLeft(e); };
        leftBtn.addEventListener('touchstart', leftHandler, options);
        listeners.push({ element: leftBtn, type: 'touchstart', handler: leftHandler });
    }
    if (rightBtn) {
        const rightHandler = (e) => { e.preventDefault(); handleTouchRight(e); };
        rightBtn.addEventListener('touchstart', rightHandler, options);
        listeners.push({ element: rightBtn, type: 'touchstart', handler: rightHandler });
    }
    if (downBtn) {
        const downHandler = (e) => { e.preventDefault(); handleTouchDown(e); };
        downBtn.addEventListener('touchstart', downHandler, options);
        listeners.push({ element: downBtn, type: 'touchstart', handler: downHandler });
    }

    // Cleanup function to remove listeners
    return () => {
        listeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
    };
    // Dependencies: Include handler functions. Refs don't need to be dependencies
    // if the effect runs once on mount and cleans up on unmount.
    // However, if handlers change due to state changes, include them.
  }, [handleTouchRotate, handleTouchLeft, handleTouchRight, handleTouchDown]);


  // --- Render JSX ---
   return (
     <div className="tetris-container">
       <div className="game-column">
         {/* Remove onTouchStart from game-area, listener added to canvas via ref */}
         <div className="game-area">
           <canvas ref={canvasRef} className="game-canvas" />
            {/* Overlays */}
            {gameOver && ( <div className="game-over-overlay"><h2>Game Over</h2>{newHighScore && <p className="new-high-score-text">New High Score!</p>}<p>Final Score: {score}</p><button onClick={resetGame} className="reset-button">Play Again</button></div> )}
            {!isRunning && !gameOver && ( <div className="paused-overlay"><h2>일시정지</h2></div> )}
         </div>

          {/* Mobile Controls - Add refs, remove onTouchStart */}
          <div className="mobile-controls">
             {/* Assign refs to buttons */}
             <button ref={leftButtonRef} className="control-button left">ᐊ</button>
             <button ref={downButtonRef} className="control-button down">ᐁ</button>
             <button ref={rightButtonRef} className="control-button right">ᐅ</button>
          </div>
       </div> {/* End of game-column */}


       {/* Info Panel */}
       <div className="info-panel">
          {/* ... Info boxes ... */}
          <div className="info-box next-piece-box"><h3>Next</h3><canvas ref={nextPieceCanvasRef} className="next-piece-canvas"></canvas></div>
          <div className="info-box score-box"><h3>Score</h3><p>{score}</p></div>
          <div className="info-box high-score-box"><h3>High Score</h3><p>{highScore}</p></div>
          <div className="info-box level-box"><h3>Level</h3><p>{level}</p></div>
          <div className="info-box lines-box"><h3>Lines</h3><p>{lines}</p></div>
          {/* Back and Pause buttons */}
          <button className="back-button" onClick={() => { if (!gameOver) setIsRunning(false); window.location.href = "/main"; }}>메인화면</button>
          <button className="pause-button" onClick={() => { if (!gameOver) setIsRunning(prev => !prev); }} disabled={gameOver}>{isRunning ? '일시정지' : '재개'}</button>
       </div>
     </div>
   );
 }