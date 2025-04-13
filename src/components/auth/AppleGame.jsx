import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './AppleGame.css';
import { auth, db } from '../../firebase'; // Import Firebase modules
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; // Import Firestore functions

const GRID_ROWS = 10;
const GRID_COLS = 17;
const GAME_DURATION = 120; // 2 minutes

// Helper: Get random number with weighted probability
const getRandomNumber = () => {
    const rand = Math.random() * 100; // Generate random number between 0 and 99.99...
    // Apply weights (cumulative probability)
    if (rand < 12) return 1;       // 0-11.99 (12%)
    else if (rand < 24) return 9; // 12-23.99 (12%)
    else if (rand < 36) return 2; // 24-35.99 (12%)
    else if (rand < 48) return 8; // 36-47.99 (12%)
    else if (rand < 58) return 3; // 48-57.99 (10%)
    else if (rand < 68) return 7; // 58-67.99 (10%)
    else if (rand < 84) return 5; // 68-83.99 (16%)
    else if (rand < 92) return 4; // 84-91.99 (8%)
    else return 6;                 // 92-99.99 (8%)
};

// Helper: Check rectangle overlap
const checkOverlap = (rect1, rect2) => {
    return (
        rect1.left < rect2.right &&
        rect1.right > rect2.left &&
        rect1.top < rect2.bottom &&
        rect1.bottom > rect2.top
    );
};

// --- Apple Component ---
const Apple = React.memo(({ number, selected }) => (
    <div className={`apple ${selected ? 'selected' : ''}`}>
        <div className="apple-body"></div>
        <div className="apple-leaf"></div>
        <div className="apple-number">{number}</div>
    </div>
));

// --- Main Game Component ---
const AppleGame = () => {
    const navigate = useNavigate(); // Get navigate function
    // --- State --- 
    const [grid, setGrid] = useState([]);
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [isTimerRunning, setIsTimerRunning] = useState(true);
    const [score, setScore] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartCoords, setDragStartCoords] = useState({ x: 0, y: 0 });
    const [dragCurrentCoords, setDragCurrentCoords] = useState({ x: 0, y: 0 });
    const [dragBoxStyle, setDragBoxStyle] = useState({});
    const [selectedAppleIds, setSelectedAppleIds] = useState(new Set());
    const [isGameOver, setIsGameOver] = useState(false);
    const [highScore, setHighScore] = useState(0); // Add highScore state
    const [newHighScore, setNewHighScore] = useState(false); // State for new high score message

    // --- Refs --- 
    const gameContainerRef = useRef(null);
    const gridContainerRef = useRef(null);
    const appleElementsRef = useRef({}); // Store refs to apple elements if needed for direct measurement (alternative)

    // --- Effects --- 

    // Load High Score on mount
    useEffect(() => {
        const loadHighScore = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists() && userDoc.data().appleGameHighScore !== undefined) {
                        setHighScore(userDoc.data().appleGameHighScore);
                    } else {
                        // Initialize score if not exists
                        await setDoc(userDocRef, { appleGameHighScore: 0 }, { merge: true });
                        setHighScore(0);
                    }
                } catch (error) {
                    console.error("Error loading high score:", error);
                    // Handle error appropriately
                }
            }
        };
        loadHighScore();
    }, []); // Run only on mount

    // Function to initialize/reset the grid
    const initializeGrid = useCallback(() => {
        const initialGrid = Array.from({ length: GRID_ROWS }, (_, r) =>
            Array.from({ length: GRID_COLS }, (_, c) => ({
                id: `r${r}c${c}`,
                number: getRandomNumber(),
            }))
        );
        setGrid(initialGrid);
    }, []);

    // Initialize Grid on mount
    useEffect(() => {
        initializeGrid();
    }, [initializeGrid]);

    // Update High Score function
    const updateHighScoreInDb = async (newScore) => {
        const user = auth.currentUser;
        if (user && newScore > highScore) {
            setNewHighScore(true); // Indicate new high score achieved
            setHighScore(newScore); // Update local state immediately
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await updateDoc(userDocRef, {
                    appleGameHighScore: newScore
                });
                console.log("High score updated successfully!");
            } catch (error) {
                console.error("Error updating high score:", error);
                // Handle error appropriately (e.g., revert local state?)
            }
        } else {
            setNewHighScore(false); // Reset if not a new high score
        }
    };

    // Timer Countdown
    useEffect(() => {
        // Don't run timer if game is over
        if (!isTimerRunning || isGameOver) return;

        if (timeLeft <= 0) {
            setIsTimerRunning(false);
            setIsGameOver(true); // Set game over state
            console.log("Time's up! Game Over.");
            updateHighScoreInDb(score); // Call update high score on game over
            return;
        }
        const intervalId = setInterval(() => {
            setTimeLeft((prevTime) => prevTime - 1);
        }, 1000);
        return () => clearInterval(intervalId);
    }, [timeLeft, isTimerRunning, isGameOver, score, highScore]); // Add score and highScore dependencies

    // --- Callbacks / Event Handlers --- 

    // Helper: Get coords relative to an element (stable, doesn't need useCallback wrapper if pure)
    const getRelativeCoords = (event, element) => {
        if (!element) return { x: 0, y: 0 };
        const rect = element.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    };

    // Mouse Down: Start Dragging
    const handleMouseDown = useCallback((e) => {
        // Prevent interaction if game is over
        if (isGameOver || !gameContainerRef.current) return;
        e.preventDefault();
        const startCoords = getRelativeCoords(e, gameContainerRef.current);

        setIsDragging(true);
        setDragStartCoords(startCoords);
        setDragCurrentCoords(startCoords);
        setSelectedAppleIds(new Set()); // Clear previous selection

        // Initial drag box style (0 size, positioned with transform)
        setDragBoxStyle({
            width: `0px`,
            height: `0px`,
            transform: `translate(${startCoords.x}px, ${startCoords.y}px)`,
        });

    }, [getRelativeCoords, isGameOver]);

    // Mouse Move: Update Drag Box & Selection
    const handleMouseMove = useCallback((e) => {
        // Prevent interaction if game is over
        if (isGameOver || !isDragging || !gameContainerRef.current || !gridContainerRef.current) return;
        e.preventDefault();

        const currentCoords = getRelativeCoords(e, gameContainerRef.current);
        setDragCurrentCoords(currentCoords);

        // Calculate box dimensions and position
        const boxTop = Math.min(dragStartCoords.y, currentCoords.y);
        const boxLeft = Math.min(dragStartCoords.x, currentCoords.x);
        const boxWidth = Math.abs(dragStartCoords.x - currentCoords.x);
        const boxHeight = Math.abs(dragStartCoords.y - currentCoords.y);

        // Update drag box style using transform
        setDragBoxStyle({
            width: `${boxWidth}px`,
            height: `${boxHeight}px`,
            transform: `translate(${boxLeft}px, ${boxTop}px)`,
        });

        // Define the drag rectangle relative to the game container
        const dragRect = {
            top: boxTop,
            left: boxLeft,
            bottom: boxTop + boxHeight,
            right: boxLeft + boxWidth,
        };

        // Find overlapping apples
        const currentlySelected = new Set();
        const gameContainerRect = gameContainerRef.current.getBoundingClientRect();
        const cells = gridContainerRef.current.children;

        for (const cell of cells) {
            const appleId = cell.dataset.appleId;
            if (!appleId) continue;

            const cellRectRaw = cell.getBoundingClientRect();
            // Cell rect relative to game container
            const cellRect = {
                top: Math.round(cellRectRaw.top - gameContainerRect.top),
                left: Math.round(cellRectRaw.left - gameContainerRect.left),
                bottom: Math.round(cellRectRaw.bottom - gameContainerRect.top),
                right: Math.round(cellRectRaw.right - gameContainerRect.left),
            };

            const overlaps = checkOverlap(dragRect, cellRect);

            if (overlaps) {
                currentlySelected.add(appleId);
            }
        }
        setSelectedAppleIds(currentlySelected);

    }, [isDragging, dragStartCoords, getRelativeCoords, isGameOver]);

    // Mouse Up: End Drag & Process Selection
    const handleMouseUp = useCallback((e) => {
        // Prevent interaction if game is over
        if (isGameOver || !isDragging) return;
        e.preventDefault();

        if (selectedAppleIds.size > 0) {
            const appleMap = new Map(grid.flat().filter(Boolean).map(apple => [apple.id, apple]));
            let sum = 0;
            selectedAppleIds.forEach(id => {
                const apple = appleMap.get(id);
                if (apple) {
                    sum += apple.number;
                }
            });

            if (sum === 10) {
                setScore(prevScore => prevScore + 1);
                // Remove selected apples
                setGrid(prevGrid => {
                    const newGridFlat = prevGrid.flat().map(apple => {
                        if (apple && selectedAppleIds.has(apple.id)) {
                            return null; // Mark for removal
                        }
                        return apple;
                    });
                    // Reconstruct 2D grid
                    const newGrid = [];
                    while (newGridFlat.length) newGrid.push(newGridFlat.splice(0, GRID_COLS));
                    return newGrid;
                });
            }
            // No 'else' needed, selection clears below anyway
        }

        setIsDragging(false);
        setDragBoxStyle({}); // Hide drag box
        setSelectedAppleIds(new Set()); // Clear selection state

    }, [isDragging, selectedAppleIds, grid, isGameOver]);

    // Restart Game Handler - Reset newHighScore state
    const handleRestart = useCallback(() => {
        console.log("Restarting game...");
        initializeGrid(); // Generate new apples
        setScore(0);
        setTimeLeft(GAME_DURATION);
        setIsGameOver(false);
        setIsTimerRunning(true);
        setSelectedAppleIds(new Set());
        setDragBoxStyle({});
        setIsDragging(false);
        setNewHighScore(false); // Reset new high score flag
    }, [initializeGrid]);

    // Handle Go To Main Menu
    const handleGoToMainClick = () => {
        console.log("Navigating to /main...");
        navigate('/main'); // Use navigate
    };

    // --- Render --- 
    const gaugeHeightPercent = (timeLeft / GAME_DURATION) * 100;

    return (
        <div className="apple-game-component">
            <div
                className={`game-container ${isGameOver ? 'game-over' : ''}`}
                ref={gameContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ cursor: isDragging && !isGameOver ? 'grabbing' : 'default' }}
            >
                {/* Score Display */}
                <div className="score-display">점수 : {score}</div>

                {/* High Score Display */}
                <div className="high-score-corner-display">최고 점수: {highScore}</div>

                {/* Game Area - Always rendered, but style changes on game over */}
                <div className="game-area">
                    {/* Grid */}
                    <div 
                        className={`grid-container ${isGameOver ? 'grid-over' : ''}`}
                        ref={gridContainerRef}
                    >
                         {grid.map((row, r) =>
                            row.map((appleData, c) => (
                                <div
                                    key={appleData ? appleData.id : `empty-${r}-${c}`}
                                    className="grid-cell"
                                    data-apple-id={appleData?.id}
                                >
                                    {appleData && (
                                        <Apple
                                            number={appleData.number}
                                            selected={!isGameOver && selectedAppleIds.has(appleData.id)}
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Timer */}
                    <div className="timer-container">
                        <div className="gauge-bar-background">
                            <div
                                className="gauge-bar-fill"
                                style={{ height: isGameOver ? '0%' : `${gaugeHeightPercent}%` }}
                            ></div>
                        </div>
                        <div className="clock-icon">🕒</div>
                    </div>
                </div>

                {/* Drag Selection Box - Only show if not game over */}
                {isDragging && !isGameOver && dragBoxStyle.width && dragBoxStyle.height && (
                    <div className="drag-selection" style={dragBoxStyle}></div>
                )}

                {/* Centered Game Over Text/Score/Button */}
                {isGameOver && (
                    <div className="game-over-text-centered">
                        게임오버<br />
                        최종 점수: {score}
                        {newHighScore && (
                            <div className="new-high-score-message">🎉 새로운 최고 점수 달성! 🎉</div>
                        )}
                        <button onClick={handleRestart} className="restart-button">
                            다시 시작
                        </button>
                    </div>
                )}
            </div>

            {/* Main Menu Button */}
            <button onClick={handleGoToMainClick} className="main-menu-button">
                메인으로 돌아가기
            </button>
        </div>
    );
};

export default AppleGame; 