import React, { useState, useEffect, useCallback } from 'react';
import { Unity, useUnityContext } from "react-unity-webgl";

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
  const { unityProvider, addEventListener, removeEventListener, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: "/unity_build/Build/WebGL3.loader.js",
    dataUrl: "/unity_build/Build/WebGL3.data",
    frameworkUrl: "/unity_build/Build/WebGL3.framework.js",
    codeUrl: "/unity_build/Build/WebGL3.wasm",
  });

  const handleGameData = useCallback((jsonData) => {
    try {
      const data = JSON.parse(jsonData);
      console.log("유니티에서 받은 데이터:", data); // 데이터 수신 확인용 로그 추가

    } catch (error) {
      console.error("유니티로부터 받은 데이터 처리 오류:", error, "Received data:", jsonData);
    }
  }, []);

  // 받아온 데이터를 처리하는 함수를 유니티에서 호출할 수 있도록 설정
  useEffect(() => {
    window.HandleGameOverData = handleGameData;
    addEventListener("HandleGameOverData", handleGameData);

    // 컴포넌트가 언마운트될 때 함수를 제거
    return () => {
      delete window.HandleGameOverData;
      removeEventListener("HandleGameOverData", handleGameData);
    };
  }, [isLoaded, addEventListener, removeEventListener, handleGameData]);

  // 메인 컨테이너 정의의
  return (
    <div style={{ background: "#2C2C2C", color: "#fff", padding: "1rem", position: 'relative', minHeight: '650px' /* Ensure container has height */ }}>
      {!isLoaded && <CustomLoader loadingProgression={loadingProgression} />}
      <div style={{ width: "470px", margin: "0 auto", visibility: isLoaded ? 'visible' : 'hidden' }}>
        {/* 유니티 컴포넌트 렌더링 */}
        <Unity
          unityProvider={unityProvider}
          style={{ width: 470, height: 580 }}
          devicePixelRatio={window.devicePixelRatio}
        />
      </div>
    </div>
  );
}

export default UndeadSurvivorGame;
