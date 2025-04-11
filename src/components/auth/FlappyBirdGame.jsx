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
        
        if (userDoc.exists() && userDoc.data().flappyBirdHighScore) {
          setHighScore(userDoc.data().flappyBirdHighScore);
        } else {
          // 최고 점수가 없으면 0으로 초기화
          await setDoc(userDocRef, { flappyBirdHighScore: 0 }, { merge: true });
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
        flappyBirdHighScore: newScore
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

    // 고정 설정값
    const GRAVITY = 0.002;
    const JUMP_STRENGTH = -0.4;
    const PIPE_SPEED = 0.25;
    const PIPE_SPAWN_RATE = 1300; // ms 단위

    const BIRD_WIDTH = 34;
    const BIRD_HEIGHT = 24;
    const PIPE_WIDTH = 52;
    const GAP_HEIGHT = 160;

    let birdY = 250;
    let velocity = 0;
    let pipes = [];
    let lastTime = performance.now();
    let lastPipeSpawn = performance.now();
    let animationId = null;
    let gameOver = false;
    let localScore = 0;

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
      loop(lastTime);
    };

    const spawnPipe = () => {
      const topPipeHeight = Math.random() * (CANVAS_HEIGHT - GAP_HEIGHT - 100) + 20;
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
      const gapEnd = pipe.topHeight + GAP_HEIGHT;

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

      velocity += GRAVITY * deltaTime;
      birdY += velocity * deltaTime;
      ctx.drawImage(bird, 50, birdY, BIRD_WIDTH, BIRD_HEIGHT);

      // 파이프 스폰
      if (now - lastPipeSpawn > PIPE_SPAWN_RATE) {
        spawnPipe();
        lastPipeSpawn = now;
      }

      pipes.forEach((pipe) => {
        pipe.x -= PIPE_SPEED * deltaTime;

        // 파이프 상단 (뒤집음)
        ctx.save();
        ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.topHeight);
        ctx.scale(1, -1);
        ctx.drawImage(pipeTop, -PIPE_WIDTH / 2, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.restore();

        // 파이프 하단
        const bottomY = pipe.topHeight + GAP_HEIGHT;
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
      ctx.textAlign = 'left';

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
