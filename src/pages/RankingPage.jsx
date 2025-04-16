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
  const [selectedSeason, setSelectedSeason] = useState(2); // Season 2 is default

  const gamesConfig = {
    flappybird: {
      title: '플래피버드',
      scoreField: 'flappyBirdHighScore'
    },
    tetris: {
      title: '테트리스',
      scoreField: 'tetrisHighScore'
    },
    suika: {
      title: '수박 게임',
      scoreField: 'suikaHighScore'
    },
    applegame: {
      title: '사과 게임',
      scoreField: 'appleGameHighScore'
    }
  };

  useEffect(() => {
    // Reset pagination when game or season changes
    setCurrentPage(1);
    setLastVisible(null);
    loadRankings(true); // Pass true to indicate reset
  }, [selectedGame, selectedSeason]);

  useEffect(() => {
    // Load rankings when page changes (but not on initial load triggered by game/season change)
    if (currentPage !== 1) {
      loadRankings(false);
    }
  }, [currentPage]);

  const loadRankings = async (isReset = false) => {
    try {
      const usersRef = collection(db, 'users');
      // Determine score field based on selected season
      const baseScoreField = gamesConfig[selectedGame].scoreField;
      const scoreField = selectedSeason === 1 ? baseScoreField : `${baseScoreField}_s${selectedSeason}`;
      
      let rankingQuery;
      // Use isReset flag to determine if query should start from beginning
      if (isReset || currentPage === 1) {
        rankingQuery = query(
          usersRef,
          orderBy(scoreField, 'desc'),
          limit(100) // Fetch more initially to handle pagination without re-querying db constantly
        );
      } else {
        rankingQuery = query(
          usersRef,
          orderBy(scoreField, 'desc'),
          startAfter(lastVisible), // Use lastVisible for subsequent pages
          limit(100)
        );
      }

      const snapshot = await getDocs(rankingQuery);
      
      // Map and filter all valid rankings from the fetched snapshot
      const allRankingsForPageSet = snapshot.docs
        .map(doc => ({
          id: doc.id, // Keep doc id for potential use with startAfter
          docSnapshot: doc, // Store the snapshot for setting lastVisible correctly
          nickname: doc.data().nickname,
          score: doc.data()[scoreField] || 0
        }))
        .filter(ranking => ranking.score > 0);

      // Calculate the rankings for the current page (client-side pagination from the fetched 100)
      const startIndex = isReset ? 0 : (currentPage - 1) * 20;
      const endIndex = startIndex + 20;
      
      // Since we fetch 100, but display 20 per page, we need to adjust pagination logic.
      // Let's simplify for now: assume we always fetch exactly what's needed per page.
      // TODO: Reimplement more robust pagination if needed.
      
      // For simplicity, let's refetch with limit(20) based on currentPage
      const itemsPerPage = 20;
      let pageQuery;
      if (isReset || currentPage === 1) {
          setCurrentPage(1); // Ensure current page is 1 on reset
          pageQuery = query(
              usersRef,
              orderBy(scoreField, 'desc'),
              limit(itemsPerPage)
          );
          setLastVisible(null); // Clear last visible on reset
      } else {
          // Need the actual last document of the PREVIOUS page to use startAfter
          // This requires a more complex state management or refetching the previous page's last doc
          // Let's stick to the simpler approach for now: fetch first page only or error
          // A proper implementation would store the last doc snapshot of each page.
          // For now, pagination beyond page 1 after initial load might be broken.
          // We will reset pagination logic to fetch based on current page directly.
          
           // Fetch previous page's last doc to get the correct startAfter cursor
           let previousPageLastDoc = null;
           if (currentPage > 1) {
               const prevPageQuery = query(
                   usersRef,
                   orderBy(scoreField, 'desc'),
                   limit((currentPage - 1) * itemsPerPage)
               );
               const prevSnapshot = await getDocs(prevPageQuery);
               if (prevSnapshot.docs.length > 0) {
                   previousPageLastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
               }
           }

          pageQuery = query(
            usersRef,
            orderBy(scoreField, 'desc'),
            ...(previousPageLastDoc ? [startAfter(previousPageLastDoc)] : []), // Use startAfter if we have the cursor
            limit(itemsPerPage)
          );
      }

      const pageSnapshot = await getDocs(pageQuery);
      const newRankings = pageSnapshot.docs.map((doc, index) => ({
          nickname: doc.data().nickname,
          score: doc.data()[scoreField] || 0,
          rank: (currentPage - 1) * itemsPerPage + index + 1 // Calculate rank based on page
      })).filter(ranking => ranking.score > 0); // Ensure score > 0

      setRankings(newRankings);

      // Set lastVisible for potential next page load (using the last doc of the *current* page)
      if (pageSnapshot.docs.length > 0) {
          setLastVisible(pageSnapshot.docs[pageSnapshot.docs.length - 1]);
      } else if (currentPage > 1) {
          // If the current page is empty, likely went past the last page
          // Optionally, could redirect to last valid page or show message
      }

      // Calculate total pages
      const totalQuery = query(
        usersRef // No ordering needed, just count documents with score > 0
      );
      const totalSnapshot = await getDocs(totalQuery);
      const totalValidScores = totalSnapshot.docs.filter(doc =>
        (doc.data()[scoreField] || 0) > 0
      ).length;
      setTotalPages(Math.ceil(totalValidScores / itemsPerPage)); // Use itemsPerPage

    } catch (error) {
      console.error('랭킹 로드 에러:', error);
      // Handle potential errors for non-existent season fields
       if (error.code === 'failed-precondition') {
          console.warn(`Index for field "${scoreField}" might not exist or field is missing in some documents.`);
          setRankings([]);
          setTotalPages(0);
       } else {
          setRankings([]); // Clear rankings on other errors
          setTotalPages(0);
       }
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="ranking-page">
      <header className="ranking-header">
        <h1>{gamesConfig[selectedGame].title} 랭킹</h1>
        
        {/* Season Navigation */}
        <nav className="season-nav">
           <button
             className={`season-nav-button ${selectedSeason === 1 ? 'active' : ''}`}
             onClick={() => setSelectedSeason(1)}
           >
             시즌 1
           </button>
           <button
             className={`season-nav-button ${selectedSeason === 2 ? 'active' : ''}`}
             onClick={() => setSelectedSeason(2)}
             // Disable Season 2 button if needed, e.g., based on date or config
             // disabled={!isSeason2Available} 
           >
             시즌 2
           </button>
        </nav>

        {/* Game Navigation */}
        <nav className="game-nav">
          <button
            className={`game-nav-button ${selectedGame === 'flappybird' ? 'active' : ''}`}
            onClick={() => setSelectedGame('flappybird')}
          >
            플래피버드
          </button>
          <button
            className={`game-nav-button ${selectedGame === 'tetris' ? 'active' : ''}`}
            onClick={() => setSelectedGame('tetris')}
          >
            테트리스
          </button>
          <button
            className={`game-nav-button ${selectedGame === 'suika' ? 'active' : ''}`}
            onClick={() => setSelectedGame('suika')}
          >
            수박 게임
          </button>
          <button
            className={`game-nav-button ${selectedGame === 'applegame' ? 'active' : ''}`}
            onClick={() => setSelectedGame('applegame')}
          >
            사과 게임
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