import React from 'react';
import { Unity, useUnityContext } from "react-unity-webgl";
import './UndeadSurvivorGame.css';

function TgncoShooter() {
  const { unityProvider, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: "/unity_build3/Build/TGNCOShooter.loader.js",
    dataUrl: "/unity_build3/Build/TGNCOShooter.data.gz",
    frameworkUrl: "/unity_build3/Build/TGNCOShooter.framework.js.gz",
    codeUrl: "/unity_build3/Build/TGNCOShooter.wasm.gz",
  });

  // 로딩 화면 컴포넌트
  const LoadingScreen = () => (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      textAlign: 'center',
      color: '#fff'
    }}>
      <div>로딩 중... {Math.round(loadingProgression * 100)}%</div>
    </div>
  );

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#2C2C2C',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative'
    }}>
      {!isLoaded && <LoadingScreen />}
      <div style={{
        width: '1280px',
        height: '720px',
        position: 'relative',
        boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
        background: '#111',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        <Unity
          unityProvider={unityProvider}
          style={{
            width: '100%',
            height: '100%',
            visibility: isLoaded ? 'visible' : 'hidden'
          }}
        />
      </div>
    </div>
  );
}

export default TgncoShooter;
