import React from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './MobileMainPage.css';

const MobileMainPage = () => {
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
    <div className="mobile-main-page">
      <header className="mobile-header">
        <div className="mobile-header-title-group">
          <h1>티지앤코</h1>
          <img src="/cat-logo.png" alt="고양이 로고" className="mobile-header-logo" />
        </div>
        <div className="mobile-header-buttons">
          <button onClick={() => navigate('/ranking')} className="mobile-ranking-button">랭킹</button>
          <button onClick={handleLogout} className="mobile-logout-button">로그아웃</button>
        </div>
      </header>
      
      <div className="mobile-game-container">
        <div className="mobile-game-card" onClick={() => navigate('/flappybird')}>
          <h2>플래피버드</h2>
          <p>클래식한 플래피버드 게임을 즐겨보세요!</p>
        </div>
        
        <div className="mobile-game-card" onClick={() => navigate('/watermelon')}>
          <h2>수박 게임</h2>
          <p>수박을 합쳐서 더 큰 과일을 만들어보세요!</p>
        </div>
      </div>
    </div>
  );
};

export default MobileMainPage; 