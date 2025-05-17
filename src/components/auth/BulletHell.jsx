import React, { useState, useEffect, useCallback } from 'react';
import { Unity, useUnityContext } from "react-unity-webgl";
import './BulletHell.css';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Helper component for the default Unity loader
const CustomLoader = ({ loadingProgression }) => {
  const loadingPercentage = Math.round(loadingProgression * 100);

  const containerStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    zIndex: 1000
  };

  const logoStyle = {
    width: '154px',
    height: '130px',
    // 경로를 /unity_build3/TemplateData/ 로 변경
    background: 'url("/unity_build3/TemplateData/unity-logo-dark.png") no-repeat center',
    margin: '0 auto'
  };

  const progressBarEmptyStyle = {
    width: '141px',
    height: '18px',
    marginTop: '10px',
    marginLeft: 'auto',
    marginRight: 'auto',
    // 경로를 /unity_build3/TemplateData/ 로 변경
    background: 'url("/unity_build3/TemplateData/progress-bar-empty-dark.png") no-repeat center',
    position: 'relative'
  };

  const progressBarFullStyle = {
    width: `${loadingPercentage}%`,
    height: '18px',
    // 경로를 /unity_build3/TemplateData/ 로 변경
    background: 'url("/unity_build3/TemplateData/progress-bar-full-dark.png") no-repeat center',
    backgroundSize: 'cover',
    position: 'absolute',
    top: 0,
    left: 0
  };

  return (
    <div id="unity-loading-bar" style={containerStyle}>
      <div id="unity-logo" style={logoStyle}></div>
      <div id="unity-progress-bar-empty" style={progressBarEmptyStyle}>
        <div id="unity-progress-bar-full" style={progressBarFullStyle}></div>
      </div>
    </div>
  );
};

function BulletHell() {
  const { unityProvider, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: "/unity_build3/Build/BulletHell.loader.js",
    dataUrl: "/unity_build3/Build/BulletHell.data.gz",
    frameworkUrl: "/unity_build3/Build/BulletHell.framework.js.gz",
    codeUrl: "/unity_build3/Build/BulletHell.wasm.gz",
  });

  const navigate = useNavigate();
  const [isHovering, setIsHovering] = useState(false);

  // Unity -> React: 게임 오버 점수 처리 콜백
  const handleGameOverFromUnity = useCallback(async (event) => {
    if (!event.detail || typeof event.detail.gameOverScore !== 'number') {
      console.warn("React (BulletHell): Invalid score data received from Unity.", event.detail);
      return;
    }

    const newScoreInSeconds = event.detail.gameOverScore;
    console.log(`React (BulletHell): Received game over score from Unity: ${newScoreInSeconds} seconds`);

    // 사용자 로그인 상태 확인
    const user = auth.currentUser;
    if (!user) {
      console.warn("React (BulletHell): User not logged in. Cannot save high score to Firestore.");
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDoc = await getDoc(userDocRef);
      let currentFirestoreHighScore = 0; // 점수는 초 단위로 저장 및 비교

      if (userDoc.exists() && typeof userDoc.data().bullethellHighScore_s3 === 'number') {
        currentFirestoreHighScore = userDoc.data().bullethellHighScore_s3;
      } else {
        console.log("React (BulletHell): No existing bullethellHighScore_s3 found or user document doesn't exist. Using 0.");
      }

      console.log(`React (BulletHell): Current Firestore high score (seconds): ${currentFirestoreHighScore}, New score (seconds): ${newScoreInSeconds}`);

      if (newScoreInSeconds > currentFirestoreHighScore) {
        console.log(`React (BulletHell): New high score! Updating Firestore (${currentFirestoreHighScore} -> ${newScoreInSeconds})`);
        // Firestore에 bullethellHighScore_s3 필드로 점수(초 단위) 저장
        await setDoc(userDocRef, { bullethellHighScore_s3: newScoreInSeconds }, { merge: true });
        console.log("React (BulletHell): High score updated in Firestore.");
      } else {
        console.log("React (BulletHell): New score is not higher than the current high score. No update needed.");
      }
    } catch (error) {
      console.error("React (BulletHell): Error handling game over score in Firestore:", error);
    }
  }, [auth, db]); // auth, db를 의존성 배열에 추가 (App 레벨에서 제공된다면 props로 받아야 할 수도 있음)

  // Unity 게임 오버 이벤트 리스너 등록 및 해제
  useEffect(() => {
    // 'unityGameOver' 이벤트는 .jslib 파일에서 정의한 이름과 일치해야 합니다.
    window.addEventListener('unityGameOver', handleGameOverFromUnity);
    console.log("React (BulletHell): 'unityGameOver' event listener registered.");

    return () => {
      window.removeEventListener('unityGameOver', handleGameOverFromUnity);
      console.log("React (BulletHell): 'unityGameOver' event listener unregistered.");
    };
  }, [handleGameOverFromUnity]); // handleGameOverFromUnity를 의존성 배열에 추가

  // 버튼 스타일 정의 (UndeadSurvivorGame.jsx 참고)
  const baseButtonStyle = {
    width: '100%',
    maxWidth: '360px',
    padding: '1rem',
    background: 'linear-gradient(45deg, #ffcc80, #ffb74d)',
    color: '#5d4037',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
    marginTop: '100px', // 게임 화면과의 간격
  };

  const hoverButtonStyle = {
    ...baseButtonStyle,
    background: 'linear-gradient(45deg, #ffb74d, #ffa726)',
    transform: 'translateY(-2px)',
    marginTop: '100px',
    boxShadow: '0 5px 15px rgba(255, 167, 38, 0.4)',
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#2C2C2C',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative'
    }}>
      {!isLoaded && <CustomLoader loadingProgression={loadingProgression} />}
      <div className="bullet-hell-container">
        <Unity
          unityProvider={unityProvider}
          style={{
            width: '100%',
            height: '100%',
            visibility: isLoaded ? 'visible' : 'hidden'
          }}
        />
      </div>
    {isLoaded && (
      <button 
        onClick={() => navigate('/')} 
        style={isHovering ? hoverButtonStyle : baseButtonStyle}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        메인 화면으로 가기
      </button>
    )}
    </div>
  );
}

export default BulletHell;
