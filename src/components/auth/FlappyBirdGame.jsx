import { useRef, useEffect, useState } from 'react';
import { auth, db } from '../../firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import './FlappyBirdGame.css';

export default function FlappyBirdGame() {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(true);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [newHighScore, setNewHighScore] = useState(false);

  // 최고 점수 불러오기
  useEffect(() => {
    const loadHighScore = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists() && userDoc.data().flappyBirdHighScore_s3) {
          setHighScore(userDoc.data().flappyBirdHighScore_s3);
        } else {
          // 최고 점수가 없으면 0으로 초기화
          await setDoc(userDocRef, { flappyBirdHighScore_s3: 0 }, { merge: true });
        }
      }
    };

    loadHighScore();
  }, []);

  // 최고 점수 업데이트
  const updateHighScore = async (newScore) => {
    const user = auth.currentUser;
    if (user && newScore > highScore) {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        flappyBirdHighScore_s3: newScore
      });
      setHighScore(newScore);
      setNewHighScore(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const CANVAS_WIDTH = 360;
    const CANVAS_HEIGHT = 540;

    // 고정 설정값 -> 초기 설정값으로 변경
    const GRAVITY = 0.002;
    const JUMP_STRENGTH = -0.4;
    // const PIPE_SPEED = 0.35; // let으로 변경
    const PIPE_SPAWN_RATE = 1300; // ms 단위

    const BIRD_WIDTH = 34;
    const BIRD_HEIGHT = 24;
    const PIPE_WIDTH = 52;
    // const GAP_HEIGHT = 160; // let으로 변경

    // 초기 게임 상태 변수
    const INITIAL_PIPE_SPEED = 0.35;
    const INITIAL_GAP_HEIGHT = 160;
    const PIPE_SPEED_INCREMENT = 0.02;
    const GAP_HEIGHT_DECREMENT = 2;
    const SCORE_THRESHOLDS = [30, 70, 140, 230, 350, 500, 700, 1000]; // 스테이지 변경 점수 기준

    let birdY = 250;
    let velocity = 0;
    let pipes = [];
    let lastTime = performance.now();
    let lastPipeSpawn = performance.now();
    let animationId = null;
    let gameOver = false;
    let localScore = 0;
    let stage = 1; // 현재 스테이지
    let pipeSpeed = INITIAL_PIPE_SPEED; // 현재 파이프 속도
    let gapHeight = INITIAL_GAP_HEIGHT; // 현재 파이프 간격

    const background = new Image();
    background.src = '/assets/background.png';

    const bird = new Image();
    bird.src = '/assets/bird.png';

    const pipeTop = new Image();
    pipeTop.src = '/assets/pipe.png';

    const pipeBottom = new Image();
    pipeBottom.src = '/assets/pipe.png';

    const resetGame = () => {
      birdY = 250;
      velocity = 0;
      pipes = [];
      lastPipeSpawn = performance.now();
      localScore = 0;
      setScore(0);
      gameOver = false;
      lastTime = performance.now();
      // 게임 상태 초기화
      stage = 1;
      pipeSpeed = INITIAL_PIPE_SPEED;
      gapHeight = INITIAL_GAP_HEIGHT;
      loop(lastTime);
    };

    const spawnPipe = () => {
      // 현재 gapHeight 사용
      const topPipeHeight = Math.random() * (CANVAS_HEIGHT - gapHeight - 100) + 20;
      pipes.push({
        x: CANVAS_WIDTH,
        topHeight: topPipeHeight,
        passed: false,
      });
    };

    const checkCollision = (pipe) => {
      const birdX = 50;
      const birdBottom = birdY + BIRD_HEIGHT;
      const gapStart = pipe.topHeight;
      // 현재 gapHeight 사용
      const gapEnd = pipe.topHeight + gapHeight;

      const isInPipeX = birdX + BIRD_WIDTH > pipe.x && birdX < pipe.x + PIPE_WIDTH;
      const isInPipeY = birdY < gapStart || birdBottom > gapEnd;

      if (isInPipeX && isInPipeY) return true;
      if (birdBottom >= CANVAS_HEIGHT || birdY <= 0) return true;

      return false;
    };

    const loop = (now) => {
      if (!isRunning) return;

      const deltaTime = now - lastTime;
      lastTime = now;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- 난이도 및 스테이지 업데이트 ---
      let currentStage = 1;
      let calculatedSpeed = INITIAL_PIPE_SPEED;
      let calculatedGap = INITIAL_GAP_HEIGHT;

      for (let i = 0; i < SCORE_THRESHOLDS.length; i++) {
        if (localScore > SCORE_THRESHOLDS[i]) {
          currentStage++;
          calculatedSpeed += PIPE_SPEED_INCREMENT;
          calculatedGap -= GAP_HEIGHT_DECREMENT;
        } else {
          break; // 점수가 다음 기준보다 낮으면 중단
        }
      }
      // 간격이 너무 좁아지지 않도록 최소값 설정 (예: 80)
      calculatedGap = Math.max(80, calculatedGap); 
      
      stage = currentStage;
      pipeSpeed = calculatedSpeed;
      gapHeight = calculatedGap;
      // --- 난이도 업데이트 끝 ---

      velocity += GRAVITY * deltaTime;
      birdY += velocity * deltaTime;
      ctx.drawImage(bird, 50, birdY, BIRD_WIDTH, BIRD_HEIGHT);

      // 파이프 스폰
      if (now - lastPipeSpawn > PIPE_SPAWN_RATE) {
        spawnPipe();
        lastPipeSpawn = now;
      }

      pipes.forEach((pipe) => {
        // 현재 pipeSpeed 사용
        pipe.x -= pipeSpeed * deltaTime;

        // 파이프 상단 (뒤집음)
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.topHeight);
        ctx.scale(1, -1);
        ctx.drawImage(pipeTop, -PIPE_WIDTH / 2, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.restore();

        // 파이프 하단
        // 현재 gapHeight 사용
        const bottomY = pipe.topHeight + gapHeight;
        const bottomHeight = CANVAS_HEIGHT - bottomY;
        ctx.drawImage(pipeBottom, pipe.x, bottomY, PIPE_WIDTH, bottomHeight);

        // 점수 체크
        if (pipe.x + PIPE_WIDTH < 50 && !pipe.passed) {
          pipe.passed = true;
          localScore++;
          setScore(localScore);
        }

        // 충돌 체크
        if (checkCollision(pipe)) {
          gameOver = true;
        }
      });

      // 점수 표시
      ctx.fillStyle = 'black';
      ctx.font = '20px Arial';
      ctx.fillText(`점수: ${localScore}`, 10, 30);
      ctx.textAlign = 'right';
      ctx.fillText(`최고 점수: ${Math.max(highScore, localScore)}`, CANVAS_WIDTH - 10, 30);
      
      // --- 스테이지 표시 ---
      ctx.fillStyle = '#333333'; // 요청된 색상 코드
      ctx.font = '20px Arial'; // 폰트 설정 (점수와 동일하게)
      ctx.textAlign = 'center'; // 중앙 정렬
      ctx.fillText(`Stage: ${stage}`, CANVAS_WIDTH / 2, 30); // 캔버스 상단 중앙에 표시
      // --- 스테이지 표시 끝 ---

      ctx.textAlign = 'left'; // 다음 텍스트를 위해 정렬 복원
      ctx.fillStyle = 'black'; // 다음 텍스트를 위해 색상 복원

      if (gameOver) {
        setIsRunning(false);
        updateHighScore(localScore);
        ctx.fillStyle = 'red';
        ctx.font = '26px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        if (newHighScore) {
          ctx.fillStyle = 'gold';
          ctx.font = '20px Arial';
          ctx.fillText('새로운 최고 점수!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
        }
        ctx.font = '20px Arial';
        ctx.fillText('Tap to Restart', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
        ctx.textAlign = 'left';
        return;
      }

      animationId = requestAnimationFrame(loop);
    };

    const handleJump = () => {
      if (!isRunning) {
        setIsRunning(true);
        setNewHighScore(false);
        resetGame();
        return;
      }
      velocity = JUMP_STRENGTH;
    };

    window.addEventListener('mousedown', handleJump);
    window.addEventListener('touchstart', handleJump);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        handleJump();
      }
    });

    lastTime = performance.now();
    loop(lastTime);

    return () => {
      window.removeEventListener('mousedown', handleJump);
      window.removeEventListener('touchstart', handleJump);
      cancelAnimationFrame(animationId);
    };
  }, [isRunning, highScore, newHighScore]);

  return (
    <div className="flappy-container">
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={360}
          height={540}
          className="game-canvas"
        />
      </div>
      <button className="back-button" onClick={() => {
        window.location.href = "/main";
      }}>
        메인 화면으로 돌아가기
      </button>
    </div>
  );
}
