import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import './RankingPage.css';

const RankingPage = () => {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const [selectedGame, setSelectedGame] = useState('flappybird');

  const gamesConfig = {
    flappybird: {
      title: '플래피버드',
      scoreField: 'flappyBirdHighScore'
    }
  };

  useEffect(() => {
    loadRankings();
  }, [selectedGame, currentPage]);

  const loadRankings = async () => {
    try {
      const usersRef = collection(db, 'users');
      const scoreField = gamesConfig[selectedGame].scoreField;
      
      let rankingQuery;
      if (currentPage === 1) {
        rankingQuery = query(
          usersRef,
          orderBy(scoreField, 'desc'),
          limit(100)
        );
      } else {
        rankingQuery = query(
          usersRef,
          orderBy(scoreField, 'desc'),
          startAfter(lastVisible),
          limit(100)
        );
      }

      const snapshot = await getDocs(rankingQuery);
      const allRankings = snapshot.docs
        .map(doc => ({
          nickname: doc.data().nickname,
          score: doc.data()[scoreField] || 0
        }))
        .filter(ranking => ranking.score > 0);

      const startIndex = (currentPage - 1) * 20;
      const rankings = allRankings
        .slice(startIndex, startIndex + 20)
        .map((ranking, index) => ({
          ...ranking,
          rank: startIndex + index + 1
        }));

      setRankings(rankings);
      
      if (rankings.length > 0) {
        const lastIndex = Math.min(startIndex + 20 - 1, allRankings.length - 1);
        setLastVisible(snapshot.docs.find(doc => 
          doc.data()[scoreField] === allRankings[lastIndex].score
        ));
      }

      const totalQuery = query(
        usersRef,
        orderBy(scoreField, 'desc')
      );
      const totalSnapshot = await getDocs(totalQuery);
      const totalValidScores = totalSnapshot.docs.filter(doc => 
        (doc.data()[scoreField] || 0) > 0
      ).length;
      setTotalPages(Math.ceil(totalValidScores / 20));
    } catch (error) {
      console.error('랭킹 로드 에러:', error);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="ranking-page">
      <header className="ranking-header">
        <h1>게임 랭킹</h1>
        <nav className="game-nav">
          <button 
            className={`game-nav-button ${selectedGame === 'flappybird' ? 'active' : ''}`}
            onClick={() => setSelectedGame('flappybird')}
          >
            플래피버드
          </button>
        </nav>
      </header>

      <div className="ranking-table">
        <div className="ranking-table-header">
          <div className="rank-column" align="center">순위</div>
          <div className="nickname-column" align="center">닉네임</div>
          <div className="score-column" align="center">최고 점수</div>
        </div>
        
        <div className="ranking-table-body">
          {rankings.map((ranking) => (
            <div 
              key={ranking.rank} 
              className={`ranking-row ${ranking.rank <= 3 ? 'top-three' : ''}`}
            >
              <div className="rank-column" align="center">{ranking.rank}</div>
              <div className="nickname-column" align="center">
                {ranking.nickname}
                {ranking.rank === 1 && <span className="trophy gold">🥇</span>}
                {ranking.rank === 2 && <span className="trophy silver">🥈</span>}
                {ranking.rank === 3 && <span className="trophy bronze">🥉</span>}
              </div>
              <div className="score-column" align="center">{ranking.score}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pagination">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => handlePageChange(page)}
            className={`page-button ${currentPage === page ? 'active' : ''}`}
          >
            {page}
          </button>
        ))}
      </div>

      <button className="back-button" onClick={() => navigate('/main')}>
        메인 화면으로 돌아가기
      </button>
    </div>
  );
};

export default RankingPage; 