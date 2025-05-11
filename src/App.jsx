import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import FlappyBirdGamePage from './pages/FlappyBirdGamePage';
import MainPage from './pages/MainPage';
import MobileMainPage from './pages/MobileMainPage';
import RankingPage from './pages/RankingPage';
import TetrisGame from './components/auth/TetrisGame';
import SuikaGamePage from './pages/SuikaGamePage';
import AppleGamePage from './pages/AppleGamePage';
import UndeadSurvivorGamePage from './pages/UndeadSurvivorGamePage';
import PinHitGamePage from './pages/PinHitGamePage';
import TgncoShooterPage from './pages/TgncoShooterPage';
import { auth, signOut } from './firebase';
import './styles/App.css';

function App() {
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(null);

  // 사용자 활동 감지
  const updateLastActivity = () => {
    setLastActivity(new Date());
  };

  // 모바일 디바이스 감지
  useEffect(() => {
    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
  }, []);

  // 사용자 활동 이벤트 리스너
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(event => {
      window.addEventListener(event, updateLastActivity);
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, updateLastActivity);
      });
    };
  }, []);

  // 로그인 상태 확인
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setLastActivity(new Date());
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 30분 타이머 설정
  useEffect(() => {
    const checkTimeout = () => {
      if (isAuthenticated && lastActivity) {
        const now = new Date();
        const diffInMinutes = Math.floor((now - lastActivity) / (1000 * 60));
        
        if (diffInMinutes >= 30) {
          signOut(auth)
            .then(() => {
              setIsAuthenticated(false);
              setLastActivity(null);
              console.log('30분 이상 활동이 없어 자동 로그아웃되었습니다.');
            })
            .catch((error) => {
              console.error('로그아웃 중 오류 발생:', error);
            });
        }
      }
    };

    const timeoutInterval = setInterval(checkTimeout, 60000); // 1분마다 체크

    return () => {
      clearInterval(timeoutInterval);
    };
  }, [isAuthenticated, lastActivity]);

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={isAuthenticated ? <Navigate to="/main" replace /> : <LoginPage />} 
        />
        <Route 
          path="/signup" 
          element={isAuthenticated ? <Navigate to="/main" replace /> : <SignUpPage />} 
        />
        <Route 
          path="/main" 
          element={
            isAuthenticated ? 
              (isMobile ? <MobileMainPage /> : <MainPage />) : 
              <Navigate to="/" replace />
          } 
        />
        <Route 
          path="/ranking" 
          element={isAuthenticated ? <RankingPage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/flappybird" 
          element={isAuthenticated ? <FlappyBirdGamePage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/tetris" 
          element={isAuthenticated ? <TetrisGame /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/suika"
          element={isAuthenticated ? <SuikaGamePage /> : <Navigate to="/" replace />}
        />
         <Route 
          path="/apple"
          element={isAuthenticated ? <AppleGamePage /> : <Navigate to="/" replace />}
        />
        <Route 
          path="/undead"
          element={isAuthenticated ? <UndeadSurvivorGamePage /> : <Navigate to="/" replace />}
        />
        <Route 
          path="/pinhit"
          element={isAuthenticated ? <PinHitGamePage /> : <Navigate to="/" replace />}
        />
        <Route 
          path="/tgncoshooter"
          element={isAuthenticated ? <TgncoShooterPage /> : <Navigate to="/" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;
