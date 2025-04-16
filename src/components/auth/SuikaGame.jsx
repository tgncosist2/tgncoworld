import { useRef, useEffect, useState } from 'react';
import Matter from 'matter-js';
import { auth, db } from '../../firebase'; // Firebase 설정 가져오기
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import './SuikaGame.css';

// --- Constants ---
const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 540;
const WALL_THICKNESS = 30;
const DROP_LINE_Y = 50;
const GAME_OVER_LINE_Y = 100;

// 과일 정의 (크기 순서대로)
// 크기(반지름), 색상, 점수, 다음 과일 인덱스 (-1이면 마지막)
const FRUITS = [
    // Progressive Radius Increase, Distinct Colors
    { radius: 12, color: '#FFB6C1', score: 1, next: 1, name: 'Cherry' },        // 0: LightPink
    { radius: 16, color: '#DC143C', score: 3, next: 2, name: 'Strawberry' },   // 1: Crimson (+4)
    { radius: 21, color: '#8A2BE2', score: 6, next: 3, name: 'Grape' },        // 2: BlueViolet (+5)
    { radius: 27, color: '#FFA500', score: 10, next: 4, name: 'Dekopon' },     // 3: Orange (+6)
    { radius: 34, color: '#FF4500', score: 15, next: 5, name: 'Persimmon' },   // 4: OrangeRed (+7)
    { radius: 42, color: '#32CD32', score: 21, next: 6, name: 'Apple' },       // 5: LimeGreen (+8)
    { radius: 51, color: '#FFFF00', score: 28, next: 7, name: 'Pear' },        // 6: Yellow (+9)
    { radius: 61, color: '#FF1493', score: 36, next: 8, name: 'Peach' },       // 7: DeepPink (+10)
    { radius: 73, color: '#00CED1', score: 45, next: 9, name: 'Pineapple' },   // 8: DarkTurquoise (+12)
    { radius: 88, color: '#9400D3', score: 55, next: 10, name: 'Melon' },      // 9: DarkViolet (+15)
    { radius: 108, color: '#4682B4', score: 66, next: -1, name: 'Watermelon' }, // 10: SteelBlue (+20)
];

export default function SuikaGame() {
    const canvasRef = useRef(null);
    const engineRef = useRef(null);
    const runnerRef = useRef(null);
    const renderRef = useRef(null);
    const gameOverTimeoutRef = useRef(null);
    const lastDroppedFruitIdRef = useRef(null); // 마지막 드롭된 과일 ID 저장용 Ref
    const safetyDropTimerRef = useRef(null); // 안전 드롭 타이머 ID 저장

    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [nextFruitIndex, setNextFruitIndex] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [canDrop, setCanDrop] = useState(true); // 초기 상태는 true
    // const [lastDroppedFruitId, setLastDroppedFruitId] = useState(null); // 상태 대신 Ref 사용

    // Firebase 최고 점수 관련 로직 (FlappyBirdGame과 유사)
    useEffect(() => {
        const loadHighScore = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                const data = userDoc.data();
                if (userDoc.exists() && data && data.suikaHighScore_s2) {
                    setHighScore(data.suikaHighScore_s2);
                } else {
                    await setDoc(userDocRef, { suikaHighScore_s2: 0 }, { merge: true });
                }
            }
        };
        loadHighScore();
    }, []);

    const updateHighScore = async (newScore) => {
        const user = auth.currentUser;
        if (user && newScore > highScore) {
             console.log(`Updating high score. New: ${newScore}, Old: ${highScore}`);
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await updateDoc(userDocRef, { suikaHighScore_s2: newScore });
                // DB 업데이트 성공 시 로컬 상태도 업데이트
                setHighScore(newScore);
                console.log('High score updated successfully!');
            } catch (error) {
                console.error("Error updating high score: ", error);
                // If the document doesn't exist, create it
                if (error.code === 'not-found') {
                    try {
                        await setDoc(userDocRef, { suikaHighScore_s2: newScore });
                        setHighScore(newScore);
                        console.log('High score document created successfully!');
                    } catch (creationError) {
                        console.error("Error creating high score document: ", creationError);
                    }
                }
            }
        }
    };

    // Matter.js 초기화 및 게임 루프 설정
    useEffect(() => {
        console.log('[Effect Setup] Initializing Matter.js...');
        const canvas = canvasRef.current;
        if (!canvas) {
            console.log('[Effect Setup] Canvas not found, exiting.');
            return;
        }

        // --- Engine, Runner, Render 생성 ---
        // 이전 인스턴스가 남아있을 수 있으므로 clear 시도 (Strict Mode 대비)
        if (engineRef.current) Matter.Engine.clear(engineRef.current);
        if (renderRef.current) Matter.Render.stop(renderRef.current);
        if (runnerRef.current) Matter.Runner.stop(runnerRef.current);

        const engine = Matter.Engine.create();
        const runner = Matter.Runner.create();
        const render = Matter.Render.create({
            element: canvas.parentElement, // Use parent element for render target
            engine: engine,
            canvas: canvas,
            options: {
                width: CANVAS_WIDTH,
                height: CANVAS_HEIGHT,
                wireframes: false,
                background: '#fff8dc'
            }
        });

        engineRef.current = engine;
        runnerRef.current = runner;
        renderRef.current = render;

        // --- 월드 설정 (중력, 벽) ---
        engine.gravity.y = 0.9;
        const ground = Matter.Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT + WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ground' });
        const leftWall = Matter.Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall' });
        const rightWall = Matter.Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall' });
        Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);

        // --- 초기 과일 설정 ---
        setNextFruitIndex(Math.floor(Math.random() * 5));

        // --- 게임 실행 및 이벤트 리스너 ---
        console.log('[Effect Setup] Starting Render and Runner...');
        Matter.Render.run(render);
        Matter.Runner.run(runner, engine);

        const collisionHandler = (event) => handleCollision(event);
        Matter.Events.on(engine, 'collisionStart', collisionHandler);

        // sleepStart 이벤트 핸들러
        const handleSleepStart = (event) => {
             // 로그 추가: 이벤트 발생 및 잠드는 바디 ID 확인
             console.log(`'sleepStart' event fired. Bodies sleeping:`, event.bodies.map(b => b.id));
             console.log(`Current lastDroppedFruitIdRef: ${lastDroppedFruitIdRef.current}`);

             // 여러 물체가 동시에 잠들 수 있으므로 event.bodies 사용
            event.bodies.forEach(body => {
                if (body.id === lastDroppedFruitIdRef.current) {
                    console.log(`Matching fruit ID ${body.id} found sleeping. Enabling drop (via sleep).`);
                    // 안전 타이머가 있다면 취소
                    if (safetyDropTimerRef.current) {
                        clearTimeout(safetyDropTimerRef.current);
                        safetyDropTimerRef.current = null;
                        console.log('Cancelled safety drop timer because fruit slept.');
                    }
                    setCanDrop(true);
                    lastDroppedFruitIdRef.current = null; 
                 } else {
                    // 로그 추가: ID 불일치 시 확인
                    if (lastDroppedFruitIdRef.current !== null) { // 추적 중인 ID가 있을 때만 로그 출력
                         console.log(`Sleeping body ID ${body.id} does not match lastDroppedFruitIdRef ${lastDroppedFruitIdRef.current}`);
                     }
                }
            });
        };
        Matter.Events.on(engine, 'sleepStart', handleSleepStart);

        // ★ 게임 오버 라인 그리기 이벤트 리스너 추가
        const drawGameOverLine = () => {
            const ctx = render.context; // 캔버스 컨텍스트 가져오기
            ctx.beginPath();
            ctx.moveTo(0, GAME_OVER_LINE_Y);
            ctx.lineTo(CANVAS_WIDTH, GAME_OVER_LINE_Y);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; // 반투명 빨간색
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // 점선 스타일
            ctx.stroke();
            ctx.setLineDash([]); // 점선 스타일 리셋 (다른 곳 영향 방지)
        };
        Matter.Events.on(render, 'afterRender', drawGameOverLine);

        // 게임 오버 체크 인터벌
        const intervalId = setInterval(checkGameOver, 500);

        // --- 클린업 함수 --- 
        return () => {
            console.log('[Effect Cleanup] Cleaning up Matter.js...');
            // 0. 게임 오버 타임아웃 클리어
            if (gameOverTimeoutRef.current !== null) {
                 clearTimeout(gameOverTimeoutRef.current);
                 gameOverTimeoutRef.current = null;
                 console.log('[Effect Cleanup] Cleared game over timeout.');
            }
            // ★ 안전 드롭 타이머 클리어 추가
             if (safetyDropTimerRef.current !== null) {
                 clearTimeout(safetyDropTimerRef.current);
                 safetyDropTimerRef.current = null;
                 console.log('[Effect Cleanup] Cleared safety drop timer.');
             }
            // 1. 인터벌 클리어
            clearInterval(intervalId);
            console.log('[Effect Cleanup] Cleared checkGameOver interval.');

            // 2. 이벤트 리스너 제거
            if (engineRef.current) {
                Matter.Events.off(engineRef.current, 'collisionStart', collisionHandler);
                Matter.Events.off(engineRef.current, 'sleepStart', handleSleepStart); // sleepStart 리스너 제거
                console.log('[Effect Cleanup] Removed event listeners.');
            }

            // 4. 렌더러, 러너 중지
            if (renderRef.current) {
                Matter.Render.stop(renderRef.current);
                 console.log('[Effect Cleanup] Stopped Matter Render.');
                 renderRef.current = null;
            }
            if (runnerRef.current) {
                Matter.Runner.stop(runnerRef.current);
                console.log('[Effect Cleanup] Stopped Matter Runner.');
                runnerRef.current = null;
            }

            // 5. 엔진 클리어 (월드 포함 모든 것 제거)
            if (engineRef.current) {
                Matter.Engine.clear(engineRef.current);
                 console.log('[Effect Cleanup] Cleared Matter Engine.');
                 engineRef.current = null;
            }
             console.log('[Effect Cleanup] Finished cleanup.');
        };
    }, []); // 초기 한 번만 실행 (의존성 배열 비어 있음)

    // 과일 생성 함수
    const createFruit = (x, index) => {
        if (index < 0 || index >= FRUITS.length) return null;
        const fruitData = FRUITS[index];
        const fruit = Matter.Bodies.circle(x, DROP_LINE_Y, fruitData.radius, {
            label: `fruit_${index}`,
            restitution: 0.3, // 약간의 탄성
            friction: 0.5,
            render: {
                fillStyle: fruitData.color
            }
        });
        return fruit;
    };

    // 과일 드롭 함수
    const dropFruit = (xPosition) => {
        console.log(`Attempting to drop fruit at x: ${xPosition}, canDrop: ${canDrop}, isGameOver: ${isGameOver}`);
        if (!canDrop || isGameOver) return;
        if (!engineRef.current) {
             console.error('Engine not available for dropping fruit.');
             return;
        }

        const fruit = createFruit(xPosition, nextFruitIndex);
        if (fruit) {
            // 이전 안전 타이머가 혹시 남아있다면 클리어 (만약을 대비)
            if (safetyDropTimerRef.current) {
                clearTimeout(safetyDropTimerRef.current);
            }

            console.log('Adding fruit to world:', fruit.label, ' ID:', fruit.id);
            Matter.Composite.add(engineRef.current.world, fruit);
            lastDroppedFruitIdRef.current = fruit.id; 
            setCanDrop(false); 

            // ★ 안전 타이머 설정 (2초 후 드롭 활성화)
             safetyDropTimerRef.current = setTimeout(() => {
                // 이 타이머가 실행될 때, 아직 lastDroppedFruitIdRef가 현재 과일 ID와 같다면
                // (즉, sleepStart가 아직 발생 안 했거나 다른 과일이 먼저 잠든 경우)
                if (lastDroppedFruitIdRef.current === fruit.id) {
                     console.log(`Safety timer expired for fruit ID ${fruit.id}. Forcing drop enable.`);
                     setCanDrop(true);
                     lastDroppedFruitIdRef.current = null; // ID 추적 중지
                     safetyDropTimerRef.current = null; // 타이머 ID 초기화
                 } else {
                     console.log(`Safety timer expired, but fruit ID ${fruit.id} already slept or irrelevant.`);
                     safetyDropTimerRef.current = null; // 타이머 ID 초기화
                 }
             }, 2000); // 2초 후 실행

            const nextIndex = Math.floor(Math.random() * 5);
            setNextFruitIndex(nextIndex);
        } else {
             console.error('Failed to create fruit.');
        }
    };

     // 마우스 클릭/터치로 과일 드롭
     useEffect(() => {
        const canvas = canvasRef.current;
        // isGameOver 상태 추가: 게임 오버 시 이벤트 리스너 제거
        if (!canvas || isGameOver) {
            console.log('Canvas not available or game over, skipping drop listener setup.');
            return;
        }

        const handleClick = (event) => {
            if (!canDrop) return; // 드롭 불가능 상태면 무시

            const rect = canvas.getBoundingClientRect();
            let clientX;
            if (event.type === 'mousedown' || event.type === 'mousemove') {
                clientX = event.clientX;
            } else if (event.type === 'touchstart' || event.type === 'touchmove') {
                clientX = event.touches[0].clientX;
            }

            if (clientX !== undefined) {
                const x = clientX - rect.left;
                // 캔버스 경계 내에서만 드롭
                 const clampedX = Math.max(
                    FRUITS[nextFruitIndex].radius + 5, // 왼쪽 벽과의 최소 거리
                    Math.min(x, CANVAS_WIDTH - FRUITS[nextFruitIndex].radius - 5) // 오른쪽 벽과의 최소 거리
                );
                dropFruit(clampedX);
            }
        };

        console.log('Setting up drop listeners...');
        canvas.addEventListener('mousedown', handleClick);
        canvas.addEventListener('touchstart', handleClick);

        return () => {
            console.log('Cleaning up drop listeners...');
            canvas.removeEventListener('mousedown', handleClick);
            canvas.removeEventListener('touchstart', handleClick);
        };
        // isGameOver 상태를 의존성 배열에 추가
    }, [canDrop, nextFruitIndex, isGameOver]);

    // 충돌 처리 로직
    const handleCollision = (event) => {
        const pairs = event.pairs;

        pairs.forEach(pair => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;

            // 두 충돌체가 모두 과일인지 확인
            if (bodyA.label.startsWith('fruit_') && bodyB.label.startsWith('fruit_')) {
                const indexA = parseInt(bodyA.label.split('_')[1]);
                const indexB = parseInt(bodyB.label.split('_')[1]);

                // 같은 종류의 과일이고, 마지막 과일(수박)이 아닌 경우
                if (indexA === indexB && indexA < FRUITS.length - 1) {
                    const nextFruitIndex = FRUITS[indexA].next;
                    if (nextFruitIndex !== -1) {
                        const mergedFruitData = FRUITS[nextFruitIndex];

                        // 충돌 지점 계산 (두 과일의 중간 지점)
                        const collisionPoint = pair.collision.supports[0] || {
                            x: (bodyA.position.x + bodyB.position.x) / 2,
                            y: (bodyA.position.y + bodyB.position.y) / 2
                        };

                        // 기존 과일 제거
                        Matter.World.remove(engineRef.current.world, [bodyA, bodyB]);

                        // 합쳐진 새 과일 생성
                        const newFruit = Matter.Bodies.circle(collisionPoint.x, collisionPoint.y, mergedFruitData.radius, {
                            label: `fruit_${nextFruitIndex}`,
                            restitution: 0.3,
                            friction: 0.5,
                            render: {
                                fillStyle: mergedFruitData.color
                            }
                        });
                        Matter.World.add(engineRef.current.world, newFruit);

                        // 점수 추가
                        setScore(prev => prev + FRUITS[indexA].score);
                    }
                }
            }
        });
    };

    // 게임 오버 체크 함수 (조건 수정)
    const checkGameOver = () => {
        if (isGameOver || !engineRef.current) return;

        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        let isAnyFruitAboveLine = false;

        for (const body of bodies) {
            // isSleeping 조건 제거, 위치만 확인
            if (body.label.startsWith('fruit_') && body.position.y - body.circleRadius < GAME_OVER_LINE_Y) {
                 isAnyFruitAboveLine = true;
                 break; 
            }
        }

        if (isAnyFruitAboveLine) {
            if (gameOverTimeoutRef.current === null) {
                console.log('Fruit detected above game over line. Starting timer...');
                gameOverTimeoutRef.current = setTimeout(() => {
                    console.log('Game over grace period ended. Ending game.');
                    endGame();
                    gameOverTimeoutRef.current = null; 
                }, 1500); 
            }
        } else {
            if (gameOverTimeoutRef.current !== null) {
                console.log('No fruit above game over line. Cancelling timer.');
                clearTimeout(gameOverTimeoutRef.current);
                gameOverTimeoutRef.current = null;
            }
        }
    };

    // 게임 종료 처리
    const endGame = () => {
        if (isGameOver) return; 

        // 진행 중이던 게임 오버 타임아웃 취소 (혹시 모를 중복 실행 방지)
        if (gameOverTimeoutRef.current !== null) {
            clearTimeout(gameOverTimeoutRef.current);
            gameOverTimeoutRef.current = null;
        }

        console.log("Game Over!");
        setIsGameOver(true);
        setCanDrop(false);
        if (runnerRef.current) {
            Matter.Runner.stop(runnerRef.current);
        }
        updateHighScore(score);

         // 모든 과일 static으로 만들기 (멈춤 효과)
        const bodies = Matter.Composite.allBodies(engineRef.current.world);
        bodies.forEach(body => {
            if (body.label.startsWith('fruit_')) {
                Matter.Body.setStatic(body, true);
            }
        });
    };

    // 게임 재시작 함수
    const restartGame = () => {
         // 진행 중이던 게임 오버 타임아웃 취소
         if (gameOverTimeoutRef.current !== null) {
            clearTimeout(gameOverTimeoutRef.current);
            gameOverTimeoutRef.current = null;
        }
        // 기존 물리 객체 모두 제거
        if (engineRef.current) {
            Matter.World.clear(engineRef.current.world, false); // false: static bodies 유지 안함

            // 벽 다시 추가
            const ground = Matter.Bodies.rectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT + WALL_THICKNESS / 2, CANVAS_WIDTH, WALL_THICKNESS, { isStatic: true, label: 'ground' });
            const leftWall = Matter.Bodies.rectangle(-WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall' });
            const rightWall = Matter.Bodies.rectangle(CANVAS_WIDTH + WALL_THICKNESS / 2, CANVAS_HEIGHT / 2, WALL_THICKNESS, CANVAS_HEIGHT, { isStatic: true, label: 'wall' });
            // 마우스 제약조건도 다시 추가 (null 체크 추가)
            if (mouseConstraintRef.current) {
                 Matter.Composite.add(engineRef.current.world, [ground, leftWall, rightWall, mouseConstraintRef.current]);
            } else {
                 Matter.Composite.add(engineRef.current.world, [ground, leftWall, rightWall]);
            }
           
        }

        // 상태 초기화
        setScore(0);
        setIsGameOver(false);
        setCanDrop(true);
        setNextFruitIndex(Math.floor(Math.random() * 5)); // 다음 과일 랜덤 설정

        // 물리 엔진 재시작 (run 사용)
        if (runnerRef.current && engineRef.current) {
            Matter.Runner.run(runnerRef.current, engineRef.current);
        }
        console.log("Game Restarted!");
    };

    // 다음 떨어질 과일 미리보기 스타일
    const nextFruitData = FRUITS[nextFruitIndex];
    const nextFruitStyle = nextFruitData
        ? { backgroundColor: nextFruitData.color }
        : {};

    // ★ 미리보기 크기 계산 (반지름의 1.5배, 최소/최대 크기 제한 추가 가능)
    const previewRadius = nextFruitData ? nextFruitData.radius : 12; // 기본값 설정
    // ★ 크기 비율 및 최대 제한 증가
    const previewSize = Math.max(15, Math.min(40, Math.round(previewRadius * 1.5))); // 비율 1.5, 최대 40px

    // ★ 나가기 버튼 핸들러
    const handleExitGame = async () => {
        console.log('Exiting game, attempting to update high score...');
         // 현재 점수로 DB 업데이트 시도
        await updateHighScore(score);
        // DB 업데이트를 기다린 후 페이지 이동 (선택 사항)
        // 또는 updateHighScore 호출 후 바로 이동 (백그라운드 업데이트)
        window.location.href = "/main"; // 또는 사용하는 라우터의 이동 함수 사용
    };

    return (
        <div className="suika-container">
            <div className="game-area">
                 <div className="info-bar">
                    <span>점수: {score}</span>
                    <span>최고 점수: {highScore}</span>
                </div>
                <div className="canvas-wrapper" style={{ position: 'relative' }}>
                    <div
                        className="next-fruit-indicator"
                        style={{
                            position: 'absolute',
                            top: '10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: 'lightgray',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid #ccc'
                        }}
                    >
                        <span style={{ marginRight: '10px', color: 'black', fontStyle: 'bold', fontSize: '18px' }}>다음:</span>
                        <div
                            className="next-fruit-preview"
                            style={{
                                ...nextFruitStyle,
                                width: `${previewSize}px`,
                                height: `${previewSize}px`,
                                borderRadius: '50%' // 원형 유지
                            }}
                         ></div>
                    </div>
                    <canvas ref={canvasRef} className="game-canvas" />
                     {isGameOver && (
                        <div className="game-over-overlay">
                            <h2>게임 오버!</h2>
                            <p>최종 점수: {score}</p>
                             {score > highScore && score > 0 && <p style={{ color: 'gold' }}>🎉 새로운 최고 점수! 🎉</p>}
                            <button onClick={restartGame}>다시 시작</button>
                        </div>
                    )}
                </div>
            </div>
            <button className="back-button" onClick={handleExitGame}>
                메인 화면으로 돌아가기
            </button>
        </div>
    );
} 