import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './MainPage.css';

const MainPage = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  return (
    <div className="main-page">
      <header className="main-header">
        <div className="header-title-group">
          <h1>티지앤코</h1>
          <img src="/cat-logo.png" alt="고양이 로고" className="header-logo" />
        </div>
        <div className="header-buttons">
          <button onClick={() => navigate('/ranking')} className="ranking-button">랭킹</button>
          <button onClick={handleLogout} className="logout-button">로그아웃</button>
        </div>
      </header>
      <div className="main-body">
        <div className="marquee-container">
          <div className="marquee-content">
            🏆 시즌2 명예의 전당 [플래피버드 - <span className="nickname">갓현석</span>] 🏆 [테트리스 - <span className="nickname">더더덕범</span>] 🏆 [수박게임 - <span className="nickname">장태규</span>] 🏆 [사과게임 - <span className="nickname">준성이옆자리</span>] 🏆 [언데드서바이벌 - <span className="nickname">해적</span>] 🏆 [핀히트 - <span className="nickname">jaein</span>] 🏆
          </div>
        </div>
      </div>
      <div className="game-container">
        <div className="game-card" onClick={() => navigate('/flappybird')}>
          <h2>🐦 플래피버드</h2>
          <p>클래식한 플래피버드 게임을 즐겨보세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/tetris')}>
          <h2>🧱 테트리스</h2>
          <p>고전 블록 쌓기 게임, 테트리스!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/suika')}>
          <h2>🍉 수박 게임</h2>
          <p>과일을 합쳐 수박을 만들어보세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/apple')}>
          <h2>🍎 사과 게임</h2>
          <p>사과를 모아 10을 만들어보세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/undead')}>
          <h2>💀 언데드서바이벌</h2>
          <p>쏟아지는 좀비들을 처치하세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/pinhit')}>
          <h2>🎯 핀히트</h2>
          <p>타겟을 맞춰 점수를 획득하세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/bullethell')}>
          <h2>💥 불랫헬</h2>
          <p>총알을 피하며 생존하세요!</p>
        </div>
      </div>
    </div>
  );
};

export default MainPage; 