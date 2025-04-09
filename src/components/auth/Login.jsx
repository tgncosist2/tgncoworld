import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      // 로그인 성공 시 처리 (예: 홈페이지로 리다이렉트)
      console.log('로그인 성공!');
    } catch (error) {
      console.error('로그인 에러:', error);
      switch (error.code) {
        case 'auth/invalid-email':
          setError('유효하지 않은 이메일 주소입니다.');
          break;
        case 'auth/user-disabled':
          setError('해당 사용자 계정이 비활성화되었습니다.');
          break;
        case 'auth/user-not-found':
          setError('등록되지 않은 이메일입니다.');
          break;
        case 'auth/wrong-password':
          setError('잘못된 비밀번호입니다.');
          break;
        default:
          setError('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="login-container">
      <div className="logo-container">
        <img src="/logo.png" alt="로고" className="login-logo" />
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>로그인</h2>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <input
            type="email"
            name="email"
            placeholder="이메일을 입력하세요"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <input
            type="password"
            name="password"
            placeholder="비밀번호를 입력하세요"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="login-button">로그인</button>
        <button type="button" className="signup-button" onClick={() => window.location.href = "/signup"}>회원가입</button>
      </form>
    </div>
  );
};

export default Login; 