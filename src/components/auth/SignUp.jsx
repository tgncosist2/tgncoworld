import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './SignUp.css';

const SignUp = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nickname: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getErrorMessage = (error) => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return '이미 사용 중인 이메일입니다.';
      case 'auth/invalid-email':
        return '유효하지 않은 이메일 형식입니다.';
      case 'auth/operation-not-allowed':
        return '이메일/비밀번호 계정이 비활성화되어 있습니다.';
      case 'auth/weak-password':
        return '비밀번호는 6글자 이상이어야 합니다.';
      default:
        return '회원가입 중 오류가 발생했습니다.';
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // Firebase Authentication에 닉네임 저장
      await updateProfile(user, {
        displayName: formData.nickname
      });

      // Firestore에 사용자 정보 저장
      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        nickname: formData.nickname,
        createdAt: new Date(),
        lastLoginAt: new Date()
      });

      // 회원가입 완료 토스트 메시지 표시
      toast.success('회원가입이 완료되었습니다!', {
        position: "top-center",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });

      // 2초 후 메인 페이지로 이동
      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  return (
    <div className="login-container">
      <ToastContainer
        position="top-center"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      <div className="logo-container">
        <img src="/logo.png" alt="로고" className="login-logo" />
      </div>
      <form className="login-form" onSubmit={handleSignUp}>
        <h2>회원가입</h2>
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
        <div className="form-group">
          <input
            type="text"
            name="nickname"
            placeholder="닉네임을 입력하세요"
            value={formData.nickname}
            onChange={handleChange}
            required
          />
        </div>
        <button type="submit" className="signup-button">회원가입</button>
      </form>
    </div>
  );
};

export default SignUp; 