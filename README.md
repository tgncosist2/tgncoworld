# React + Vite 프로젝트

이 프로젝트는 React와 Vite를 사용하여 구축된 현대적인 웹 애플리케이션입니다.

## 🎮 사이트 소개

이 웹사이트는 사용자 인증 시스템을 갖춘 게임 플랫폼입니다. 주요 기능은 다음과 같습니다:

- **로그인/회원가입 시스템**: Firebase를 활용한 안전한 사용자 인증
- **반응형 디자인**: 모바일과 데스크톱 환경 모두 지원
- **게임 플랫폼**: 
  - Flappy Bird 게임
  - Tetris 게임
- **랭킹 시스템**: 게임 점수를 기반으로 한 사용자 랭킹
- **보안 기능**: 30분 동안 활동이 없을 경우 자동 로그아웃

## 🚀 주요 기능

- React 19 기반의 최신 웹 애플리케이션
- Vite를 통한 빠른 개발 환경
- Firebase 통합
- React Router를 통한 라우팅
- Toast 알림 시스템
- Styled Components를 활용한 스타일링

## 🛠 기술 스택

- **프레임워크**: React 19
- **빌드 도구**: Vite 6
- **스타일링**: Styled Components
- **상태 관리**: React Hooks
- **라우팅**: React Router DOM
- **백엔드**: Firebase
- **UI 컴포넌트**: React Toastify

## 📦 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드된 파일 미리보기
npm run preview
```

## 🔍 코드 품질

- ESLint를 통한 코드 품질 관리
- React Hooks 규칙 적용
- React Refresh 지원

## 📝 프로젝트 구조

```
├── public/          # 정적 파일
│   └── vite.svg     # Vite 로고
├── src/            # 소스 코드
│   ├── assets/       # 에셋 파일
│   │   └── react.svg  # React 로고
│   ├── components/   # 공통 컴포넌트
│   │   ├── auth/     # 인증 관련 컴포넌트 (로그인, 회원가입, 게임 컴포넌트 포함)
│   │   │   ├── Login.jsx
│   │   │   ├── Login.css
│   │   │   ├── SignUp.jsx
│   │   │   ├── SignUp.css
│   │   │   ├── FlappyBirdGame.jsx
│   │   │   ├── FlappyBirdGame.css
│   │   │   └── TetrisGame.jsx
│   │   │   └── TetrisGame.css
│   │   └── layout/   # 레이아웃 컴포넌트
│   │       └── MainLayout.jsx
│   ├── context/      # React Context (현재 비어있음)
│   ├── hooks/        # 커스텀 훅 (현재 비어있음)
│   ├── pages/        # 페이지 컴포넌트
│   │   ├── LoginPage.jsx
│   │   ├── SignUpPage.jsx
│   │   ├── MainPage.jsx
│   │   ├── MainPage.css
│   │   ├── MobileMainPage.jsx
│   │   ├── MobileMainPage.css
│   │   ├── RankingPage.jsx
│   │   ├── RankingPage.css
│   │   └── FlappyBirdGamePage.jsx
│   ├── services/     # API 서비스 로직 (현재 비어있음)
│   ├── styles/       # 전역 스타일
│   │   ├── App.css
│   │   └── index.css
│   ├── utils/        # 유틸리티 함수 (현재 비어있음)
│   ├── App.jsx       # 메인 애플리케이션 컴포넌트
│   ├── firebase.jsx  # Firebase 설정
│   └── main.jsx      # 애플리케이션 진입점
├── .env            # 환경 변수
├── .eslintrc.cjs   # ESLint 설정
├── .gitignore      # Git 무시 파일 목록
├── index.html      # HTML 진입점
├── package-lock.json # 의존성 잠금 파일
├── package.json    # 프로젝트 설정
└── vite.config.js  # Vite 설정
```

## 🔧 개발 환경 설정

1. Node.js 설치
2. 프로젝트 클론
3. 의존성 설치
4. 개발 서버 실행

## 📄 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.
