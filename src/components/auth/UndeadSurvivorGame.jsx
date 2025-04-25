import React, { useState, useEffect, useCallback } from 'react';
import { Unity, useUnityContext } from "react-unity-webgl";
import { auth, db } from '../../firebase'; // Import auth and db
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'; // Import Firestore functions
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './UndeadSurvivorGame.css'; // Import the CSS file

// Helper component for the custom loader
const CustomLoader = ({ loadingProgression }) => {

  // CSS 스타일 정의
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
    background: 'url("/unity_build/TemplateData/unity-logo-dark.png") no-repeat center',
    margin: '0 auto'
  };

  const progressBarEmptyStyle = {
    width: '141px',
    height: '18px',
    marginTop: '10px',
    marginLeft: 'auto',
    marginRight: 'auto',
    background: 'url("/unity_build/TemplateData/progress-bar-empty-dark.png") no-repeat center',
    position: 'relative'
  };

  const progressBarFullStyle = {
    width: `${loadingPercentage}%`,
    height: '18px',
    background: 'url("/unity_build/TemplateData/progress-bar-full-dark.png") no-repeat center',
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

function UndeadSurvivorGame() {
  const { unityProvider, addEventListener, removeEventListener, isLoaded, loadingProgression, sendMessage } = useUnityContext({
    loaderUrl: "/unity_build/Build/Undead.loader.js",
    dataUrl: "/unity_build/Build/Undead.data.gz",
    frameworkUrl: "/unity_build/Build/Undead.framework.js.gz",
    codeUrl: "/unity_build/Build/Undead.wasm.gz",
  });
  const navigate = useNavigate(); // Initialize useNavigate
  const [isHovering, setIsHovering] = useState(false); // State for hover effect

  // Unity에 데이터를 보내기 위한 함수
  const provideHighScoreDataToUnity = useCallback(async (gameObjectName, functionName) => {
    console.log(`Unity requested high score data. GameObject: ${gameObjectName}, Function: ${functionName}`);

    // isLoaded 상태만 확인
    if (!isLoaded) {
      console.error(`Cannot send data to Unity. isLoaded: ${isLoaded}`);
      // Unity가 준비되지 않았으므로 아무것도 보내지 않음
      return;
    }

    const user = auth.currentUser;
    let highScores = {
      highTimeSurvived: 0,
      highKills: 0,
      highLevel: 0
    };
    let jsonData;

    if (!user) {
      console.warn("User not logged in. Sending default high scores (0) to Unity.");
      // 로그인되지 않았을 경우 기본값 전송
      jsonData = JSON.stringify(highScores);
    } else {
      const userDocRef = doc(db, 'users', user.uid);
      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          // Firestore 필드 이름 사용
          highScores = {
            highTimeSurvived: data.undeadHighTimeSurvived_s3 || 0,
            highKills: data.undeadHighKills_s3 || 0,
            highLevel: data.undeadHighLevel_s3 || 0
          };
        } else {
          console.log("User document doesn't exist, sending default high scores (0).");
        }
        jsonData = JSON.stringify(highScores);
      } catch (error) {
        console.error("Error fetching high scores from Firestore:", error);
        // Firestore 오류 시에도 기본값 전송
        jsonData = JSON.stringify(highScores); 
      }
    }

    console.log(`Sending high scores to Unity (${gameObjectName}.${functionName}): ${jsonData}`);

    // sendMessage 함수 사용
    try {
      sendMessage(gameObjectName, functionName, jsonData);
    } catch (error) {
        console.error("Error calling sendMessage:", error);
    }

  }, [isLoaded, sendMessage, db, auth]); // isLoaded와 sendMessage를 의존성 배열에 추가

  // Unity에서 게임 오버 데이터를 받을 함수 (기존 로직 유지)
  const handleGameData = useCallback(async (jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      console.log("유니티에서 받은 데이터:", data); // Data received log

      const user = auth.currentUser;
      if (!user) {
        console.error("User not logged in. Cannot save high score.");
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      let existingData = {};
      let needsUpdate = false;
      const updates = {};

      try {
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          existingData = userDoc.data();
        } else {
          // Initialize fields if document doesn't exist or fields are missing
          console.log("Initializing high score fields for user:", user.uid);
          await setDoc(userDocRef, { 
            undeadHighTimeSurvived_s3: 0,
            undeadHighLevel_s3: 0,
            undeadHighKills_s3: 0
          }, { merge: true });
          existingData = { 
            undeadHighTimeSurvived_s3: 0,
            undeadHighLevel_s3: 0,
            undeadHighKills_s3: 0
          };
        }

        // Ensure fields exist in existingData, default to 0 if not
        const currentHighTime = existingData.undeadHighTimeSurvived_s3 || 0;
        const currentHighLevel = existingData.undeadHighLevel_s3 || 0;
        const currentHighKills = existingData.undeadHighKills_s3 || 0;

        // Compare and prepare updates
        // Assuming Unity sends data with keys: timeSurvived, level, kills
        if (data.timeSurvived !== undefined && data.timeSurvived > currentHighTime) {
          updates.undeadHighTimeSurvived_s3 = data.timeSurvived;
          needsUpdate = true;
          console.log(`New high time: ${data.timeSurvived} (Old: ${currentHighTime})`);
        }
        if (data.level !== undefined && data.level > currentHighLevel) {
          updates.undeadHighLevel_s3 = data.level;
          needsUpdate = true;
          console.log(`New high level: ${data.level} (Old: ${currentHighLevel})`);
        }
        if (data.kills !== undefined && data.kills > currentHighKills) {
          updates.undeadHighKills_s3 = data.kills;
          needsUpdate = true;
          console.log(`New high kills: ${data.kills} (Old: ${currentHighKills})`);
        }

        // Update Firestore if necessary
        if (needsUpdate) {
          console.log("Updating Firestore with new high scores:", updates);
          await updateDoc(userDocRef, updates);
        } else {
           console.log("No new high scores detected.");
        }

      } catch (dbError) {
        console.error("Firebase Firestore 작업 오류:", dbError);
      }

    } catch (parseError) {
      console.error("유니티로부터 받은 데이터 처리 오류:", parseError, "Received data:", jsonData);
    }
  }, []);

  // Unity가 호출할 함수들을 window 객체에 등록
  useEffect(() => {
    console.log("Registering Unity communication functions.");
    window.HandleGameOverData = handleGameData;
    window.fetchHighScoreData = provideHighScoreDataToUnity; // 이전 단계에서 변경한 이름 유지

    return () => {
      console.log("Unregistering Unity communication functions.");
      delete window.HandleGameOverData;
      delete window.fetchHighScoreData;
    };
  }, [handleGameData, provideHighScoreDataToUnity]);

  // Base button style
  const baseButtonStyle = {
    width: '100%',
    maxWidth: '360px', // From SuikaGame.css
    padding: '1rem', // From SuikaGame.css
    background: 'linear-gradient(45deg, #ffcc80, #ffb74d)', // From SuikaGame.css
    color: '#5d4037', // From SuikaGame.css
    border: 'none', // From SuikaGame.css
    borderRadius: '10px', // From SuikaGame.css
    fontSize: '1.1rem', // From SuikaGame.css
    fontWeight: 600, // From SuikaGame.css
    cursor: 'pointer', // From SuikaGame.css
    transition: 'all 0.3s ease', // From SuikaGame.css
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)', // From SuikaGame.css
    marginTop: '20px', // Keep existing margin
  };

  // Hover button style
  const hoverButtonStyle = {
    ...baseButtonStyle,
    background: 'linear-gradient(45deg, #ffb74d, #ffa726)', // From SuikaGame.css :hover
    transform: 'translateY(-2px)', // From SuikaGame.css :hover
    boxShadow: '0 5px 15px rgba(255, 167, 38, 0.4)', // From SuikaGame.css :hover
  };

  // 메인 컨테이너 정의의
  return (
    <div style={{ background: "#2C2C2C", color: "#fff", padding: "1rem", position: 'relative', minHeight: '750px', display: 'flex', flexDirection: 'column', alignItems: 'center' /* Center items */ }}>
      {!isLoaded && <CustomLoader loadingProgression={loadingProgression} />}
      <div 
          className={`unity-container ${isLoaded ? 'loaded' : ''}`} // Apply class name and conditional visibility
        >
        <Unity
          unityProvider={unityProvider}
          className="unity-game" // Apply class name
          devicePixelRatio={window.devicePixelRatio}
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

export default UndeadSurvivorGame;
