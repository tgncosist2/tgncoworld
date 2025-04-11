import { useRef, useEffect } from 'react';
import './WatermelonGame.css';

export default function WatermelonGamePrototype() {
  const generateRandomCircle = (x) => {
    const stages = [
      { radius: 20, color: '#FF5C5C' }, // 단계 1
      { radius: 30, color: '#FFA500' }, // 단계 2
      { radius: 40, color: '#00C853' }, // 단계 3
    ];
    const stage = stages[Math.floor(Math.random() * stages.length)];

    return {
      x,
      y: 0,
      radius: stage.radius,
      vy: 0,
      color: stage.color,
      stopped: false,
    };
  };

  const canvasRef = useRef(null);
  const circlesRef = useRef([]);
  const nextCircleRef = useRef(generateRandomCircle(180)); // 초기 다음 도형

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const CANVAS_WIDTH = 360;
    const CANVAS_HEIGHT = 540;
    const GRAVITY = 0.0005;

    let lastTime = performance.now();
    let animationId;

    const draw = (time) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 배경
      ctx.fillStyle = '#f0f9ff';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 물리 업데이트
      circlesRef.current.forEach((circle, i) => {
        if (!circle.stopped) {
          circle.vy += GRAVITY * deltaTime;
          circle.y += circle.vy * deltaTime;

          // 바닥 충돌
          if (circle.y + circle.radius > CANVAS_HEIGHT) {
            circle.y = CANVAS_HEIGHT - circle.radius;
            circle.vy = 0;
            circle.stopped = true;
          }

          // 다른 도형들과 충돌 감지
          for (let j = 0; j < circlesRef.current.length; j++) {
            if (i === j) continue;
            const other = circlesRef.current[j];
            const dx = circle.x - other.x;
            const dy = circle.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDist = circle.radius + other.radius;

            if (distance < minDist) {
              // 위치 보정
              const angle = Math.atan2(dy, dx);
              const overlap = minDist - distance;

              const moveX = Math.cos(angle) * overlap / 2;
              const moveY = Math.sin(angle) * overlap / 2;

              circle.x += moveX;
              circle.y += moveY;

              other.x -= moveX;
              other.y -= moveY;

              // 간단한 반발력
              const tmp = circle.vy;
              circle.vy = other.vy;
              other.vy = tmp;
            }
          }
        }
      });

      // 도형 그리기
      circlesRef.current.forEach((circle) => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.fillStyle = circle.color;
        ctx.fill();
        ctx.closePath();
      });

      // 다음 도형 미리보기
      if (nextCircleRef.current) {
        const preview = nextCircleRef.current;
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH / 2, 40, preview.radius, 0, Math.PI * 2);
        ctx.fillStyle = preview.color;
        ctx.fill();
        ctx.closePath();
      }

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, []);

  const handleDrop = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    const circleToAdd = { ...nextCircleRef.current, x: x, y: 0 };
    circlesRef.current.push(circleToAdd);

    // 다음 도형 업데이트
    nextCircleRef.current = generateRandomCircle(180);
  };



  return (
    <div className="watermelon-container">
      <div className="canvas-wrappers">
        <canvas
          ref={canvasRef}
          width={360}
          height={540}
          className="game-canvas"
          onClick={handleDrop}
        />
      </div>
      <button
        className="back-button"
        onClick={() => {
          window.location.href = '/';
        }}
      >
        메인 화면으로 돌아가기
      </button>
    </div>
  );
}