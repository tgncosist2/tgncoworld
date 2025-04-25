import React, { useState, useEffect, useCallback } from 'react';
import { Unity, useUnityContext } from "react-unity-webgl";
// Firebase 및 Firestore 임포트 추가
import { auth, db } from '../../firebase'; 
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; // useNavigate 임포트 추가
import './pinhitGame.css'; // 생성한 CSS 파일 임포트

// Helper component for the default Unity loader
const CustomLoader = ({ loadingProgression }) => {
  // CSS 스타일 정의 (기본 Unity 로더 스타일 사용)
  const loadingPercentage = Math.round(loadingProgression * 100);

  const containerStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center'
  };

  const logoStyle = {
    width: '154px',
    height: '130px',
    // 경로를 /unity_build2/TemplateData/ 로 변경
    background: 'url("/unity_build2/TemplateData/unity-logo-dark.png") no-repeat center', 
    margin: '0 auto'
  };

  const progressBarEmptyStyle = {
    width: '141px',
    height: '18px',
    marginTop: '10px',
    marginLeft: 'auto',
    marginRight: 'auto',
    // 경로를 /unity_build2/TemplateData/ 로 변경
    background: 'url("/unity_build2/TemplateData/progress-bar-empty-dark.png") no-repeat center',
    position: 'relative'
  };

  const progressBarFullStyle = {
    width: `${loadingPercentage}%`,
    height: '18px',
    // 경로를 /unity_build2/TemplateData/ 로 변경
    background: 'url("/unity_build2/TemplateData/progress-bar-full-dark.png") no-repeat center',
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

function PinHitGame() {
  const { unityProvider, isLoaded, loadingProgression, sendMessage, addEventListener, removeEventListener } = useUnityContext({
    // 빌드 경로를 public/unity_build2/ 로 변경하고 파일 이름 가정 (PinHit)
    loaderUrl: "/unity_build2/Build/PinHit.loader.js",
    dataUrl: "/unity_build2/Build/PinHit.data.gz",
    frameworkUrl: "/unity_build2/Build/PinHit.framework.js.gz",
    codeUrl: "/unity_build2/Build/PinHit.wasm.gz",
  });
  const navigate = useNavigate(); // useNavigate 초기화
  const [isHovering, setIsHovering] = useState(false); // 버튼 호버 상태 추가
  // --- 추가: 보류된 최고 점수 요청 상태 ---
  const [queuedHighScoreRequest, setQueuedHighScoreRequest] = useState(null); 

  // Unity -> React 통신: 최고 점수 받아서 Firestore에 저장
  const handleHighScoreFromUnity = useCallback(async (score) => {
    console.log(`React: Received high score from Unity: ${score}`);
    // setDisplayHighScore(score); // UI 업데이트 제거됨

    const user = auth.currentUser;
    if (!user) {
      console.warn("React: User not logged in. Cannot save high score to Firestore.");
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    try {
      const userDoc = await getDoc(userDocRef);
      let currentFirestoreHighScore = 0;
      if (userDoc.exists()) {
        currentFirestoreHighScore = userDoc.data().pinhitHighScore_s3 || 0;
      } else {
        // 문서가 없으면 생성 (필요시)
         console.log("React: User document does not exist. Creating with initial score.");
         // await setDoc(userDocRef, { pinhitHighScore: 0 }, { merge: true }); // 필요에 따라 초기화
      }

      if (score > currentFirestoreHighScore) {
        console.log(`React: New high score! Updating Firestore (${currentFirestoreHighScore} -> ${score})`);
        // setDoc 사용 시 필드가 없으면 생성, 있으면 덮어쓰기 (merge: true로 병합)
        await setDoc(userDocRef, { pinhitHighScore_s3: score }, { merge: true }); 
        // 또는 updateDoc 사용 (필드가 반드시 존재해야 함)
        // await updateDoc(userDocRef, { pinhitHighScore: score });
      } else {
        console.log("React: Received score is not higher than Firestore score.");
      }
    } catch (error) {
      console.error("React: Error handling high score in Firestore:", error);
    }
  }, [auth, db]);

  // Firestore에서 최고 점수 가져오기 (비동기 함수 분리)
  const fetchHighScoreFromFirestore = useCallback(async () => {
    const user = auth.currentUser;
    let highScore = 0;
    if (!user) {
      console.warn("React: User not logged in. Using default high score (0).");
    } else {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().pinhitHighScore_s3) {
          highScore = userDoc.data().pinhitHighScore_s3;
        } else {
          console.log("React: No high score found in Firestore for this user. Using 0.");
        }
      } catch (error) {
        console.error("React: Error fetching high score from Firestore:", error);
      }
    }
    return highScore;
  }, [auth, db]);

  // React -> Unity 통신: Firestore에서 최고 점수 가져와 Unity로 보내기 (요청 처리 함수)
  const provideHighScoreDataToUnity = useCallback(async (gameObjectName, functionName) => {
    console.log(`React: Unity requested high score data. GameObject: ${gameObjectName}, Function: ${functionName}`);

    if (!isLoaded) {
      console.warn(`React: Unity is not loaded yet. Queuing request for ${gameObjectName}.${functionName}`);
      // --- 수정: isLoaded가 false이면 요청을 큐에 저장 --- 
      setQueuedHighScoreRequest({ gameObjectName, functionName }); 
      return; // 여기서 함수 실행 중단
    }

    // isLoaded가 true이면 즉시 데이터 가져와서 전송
    const highScoreToSend = await fetchHighScoreFromFirestore();
    console.log(`React: Sending high score ${highScoreToSend} to Unity (${gameObjectName}.${functionName})`);
    try {
        sendMessage(gameObjectName, functionName, highScoreToSend);
    } catch (error) {
        console.error("React: Error calling sendMessage:", error);
    }
  }, [isLoaded, sendMessage, fetchHighScoreFromFirestore]); // isLoaded, sendMessage, fetchHighScoreFromFirestore 의존성 추가

  // --- 추가: isLoaded 상태 변경 및 큐 처리 useEffect ---
  useEffect(() => {
    // isLoaded가 true이고, 큐에 저장된 요청이 있을 때
    if (isLoaded && queuedHighScoreRequest) {
      const { gameObjectName, functionName } = queuedHighScoreRequest;
      console.log(`React: Processing queued high score request for ${gameObjectName}.${functionName}`);
      
      // 비동기 함수로 분리된 점수 가져오기 실행
      fetchHighScoreFromFirestore().then(highScoreToSend => {
        console.log(`React: Sending queued high score ${highScoreToSend} to Unity (${gameObjectName}.${functionName})`);
        try {
          sendMessage(gameObjectName, functionName, highScoreToSend);
          // 성공적으로 전송 후 큐 비우기
          setQueuedHighScoreRequest(null); 
        } catch (error) {
          console.error("React: Error calling sendMessage for queued request:", error);
          // 에러 발생 시 큐를 비울지 여부 결정 (여기서는 비우도록 함)
          setQueuedHighScoreRequest(null);
        }
      });
    }
  }, [isLoaded, queuedHighScoreRequest, sendMessage, fetchHighScoreFromFirestore]); // isLoaded, queuedHighScoreRequest, sendMessage, fetchHighScoreFromFirestore 의존성

  // Unity가 호출할 함수들을 window 객체에 등록/해제 (이전 상태 유지)
  useEffect(() => {
    window.SendHighScoreToReact = handleHighScoreFromUnity;
    window.FetchPinHitHighScore = provideHighScoreDataToUnity; 
    console.log("React: Registered window.SendHighScoreToReact and window.FetchPinHitHighScore");

    return () => {
      delete window.SendHighScoreToReact;
      delete window.FetchPinHitHighScore;
      console.log("React: Unregistered window.SendHighScoreToReact and window.FetchPinHitHighScore");
    };
  }, [handleHighScoreFromUnity, provideHighScoreDataToUnity]);

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
    marginTop: '20px', // 게임 화면과의 간격
  };

  const hoverButtonStyle = {
    ...baseButtonStyle,
    background: 'linear-gradient(45deg, #ffb74d, #ffa726)',
    transform: 'translateY(-2px)',
    boxShadow: '0 5px 15px rgba(255, 167, 38, 0.4)',
  };

  // 컴포넌트 렌더링
  return (
    // 전체 컨테이너 스타일 수정: alignItems: 'flex-start', flexDirection: 'column'
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', height: '100vh', background: '#2C2C2C', position: 'relative', paddingTop: '20px' /* 상단 여백 추가 (선택 사항) */ }}>
      {!isLoaded && <CustomLoader loadingProgression={loadingProgression} />}
      {/* 클래스 이름 적용 및 인라인 width/height 제거 */}
      <div className="pinhit-unity-container" style={{ visibility: isLoaded ? 'visible' : 'hidden', marginBottom: 'auto' /* 버튼과의 간격 확보 위해 추가 */ }}>
        <Unity
          unityProvider={unityProvider}
          className="unity-game" // 내부 Unity 캔버스에 클래스 추가 (선택 사항)
          style={{ width: '100%', height: '100%' }} // 부모 div 크기에 맞춤
          devicePixelRatio={window.devicePixelRatio}
        />
      </div>
      {/* 메인 화면으로 가기 버튼 추가 */}
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

export default PinHitGame;
