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
      
      <div className="game-container">
        <div className="game-card" onClick={() => navigate('/flappybird')}>
          <h2>플래피버드</h2>
          <p>클래식한 플래피버드 게임을 즐겨보세요!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/tetris')}>
          <h2>테트리스</h2>
          <p>고전 블록 쌓기 게임, 테트리스!</p>
        </div>

        <div className="game-card" onClick={() => navigate('/suika')}>
          <h2>수박 게임</h2>
          <p>과일을 합쳐 수박을 만들어보세요!</p>
        </div>
      </div>
    </div>
  );
};

export default MainPage; 