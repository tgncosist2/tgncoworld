import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './MobileMainPage.css';

const MobileMainPage = () => {
  const navigate = useNavigate();

  const winnersData = [
    { game: "플래피버드", user: "다이겨" },
    { game: "테트리스", user: "캬하하" },
    { game: "수박게임", user: "해적" },
    { game: "사과게임", user: "준성이옆자리" },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % winnersData.length);
    }, 2000); // 3초마다 변경

    return () => clearInterval(intervalId); // 컴포넌트 언마운트 시 인터벌 제거
  }, [winnersData.length]);

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
      
      {/* Electronic Billboard */}
      <div className="mobile-billboard">
        <h3 className="billboard-title">시즌1 명예의 전당</h3>
        <div className="winner-items-container">
          {winnersData.map((winner, index) => (
            <div
              key={index} // 각 항목에 고유 key 추가
              className={`winner-item ${index === currentIndex ? 'active' : ''}`}
            >
              🏆 [{winner.game} - <span className="nickname">{winner.user}</span>] 🏆
            </div>
          ))}
        </div>
      </div>

      <div className="mobile-game-container">
        <div className="mobile-game-card" onClick={() => navigate('/flappybird')}>
          <h2>플래피버드</h2>
          <p>클래식한 플래피버드 게임을 즐겨보세요!</p>
        </div>
        <div className="mobile-game-card" onClick={() => navigate('/tetris')}>
          <h2>테트리스</h2>
          <p>고전 블록 쌓기 게임, 테트리스!</p>
        </div>
        <div className="mobile-game-card" onClick={() => navigate('/suika')}>
          <h2>수박 게임</h2>
          <p>과일을 합쳐 수박을 만들어보세요!</p>
        </div>
      </div>
    </div>
  );
};

export default MobileMainPage; 