import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs, startAfter, where } from 'firebase/firestore';
import './RankingPage.css';

// Helper function to format seconds into MM:SS
const formatTime = (totalSeconds) => {
  if (typeof totalSeconds !== 'number' || totalSeconds < 0) {
    return '00:00'; // Return default or error format
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const RankingPage = () => {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [lastVisible, setLastVisible] = useState(null);
  const [selectedGame, setSelectedGame] = useState('flappybird');
  const [selectedSeason, setSelectedSeason] = useState(3); // Default to Season 3

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
    },
    pinhit: {
      title: '핀히트',
      scoreField: 'pinhitHighScore'
    },
    undeadsurvival: {
      title: '언데드서바이벌',
      scoreField: 'undeadHighTimeSurvived',
      levelField: 'undeadHighLevel',
      killsField: 'undeadHighKills'
    }
  };

  useEffect(() => {
    // Reset pagination when game or season changes
    // Handle specific game availability logic if needed (e.g., Undead Survival in S1)
    if (selectedSeason === 1 && selectedGame === 'undeadsurvival') {
      setSelectedGame('flappybird'); // Switch to a default game for S1
      console.log("Switched to Season 1, changing game from Undead Survival to Flappy Bird.");
      // Let the subsequent logic handle the reset based on the new game
    } else {
       // Standard reset logic for other cases
       setCurrentPage(1);
       setLastVisible(null);
       loadRankings(true); // Pass true to indicate reset
    }
  }, [selectedGame, selectedSeason]);

  // Separate useEffect for handling game switch after season change (if needed)
  // useEffect(() => {
  // }, [selectedGame]); // Currently handled by the main effect


  useEffect(() => {
    // Load rankings when page changes (but not on initial load triggered by game/season change)
    // The initial load is handled by the effect watching [selectedGame, selectedSeason]
    if (currentPage !== 1) {
      loadRankings(false);
    }
  }, [currentPage]);

  const loadRankings = async (isReset = false) => {
    // Determine the current page number, considering potential reset
    const pageToLoad = isReset ? 1 : currentPage;
    console.log(`Loading rankings - Game: ${selectedGame}, Season: ${selectedSeason}, Page: ${pageToLoad}, isReset: ${isReset}`);

    // Update currentPage state immediately if reset is requested
    if (isReset && currentPage !== 1) {
      setCurrentPage(1);
      console.log("State updated: currentPage reset to 1");
      // Since state update is async, we proceed using pageToLoad = 1 for this load
    }

    // Early exit if trying to load Undead Survival for Season 1
    if (selectedGame === 'undeadsurvival' && selectedSeason === 1) {
        console.warn("Attempted to load Undead Survival for Season 1. Clearing rankings.");
        setRankings([]);
        setTotalPages(0);
        setLastVisible(null);
        return; // Stop execution for this invalid state
    }

    try {
      const usersRef = collection(db, 'users');
      const gameConfig = gamesConfig[selectedGame];
      if (!gameConfig) {
          console.error(`Invalid game selected: ${selectedGame}`);
          setRankings([]);
          setTotalPages(0);
          return;
      }

      // Determine suffix based on season
      let seasonSuffix = '';
      if (selectedSeason === 2) {
        // S2: Add suffix unless it's Undead Survival or Pinhit
        if (selectedGame !== 'undeadsurvival' && selectedGame !== 'pinhit') {
            seasonSuffix = '_s2';
        }
      } else if (selectedSeason === 3) {
        // S3: Always add suffix
        seasonSuffix = '_s3';
      }
      // S1: No suffix (default)

      // Determine field names based on game and season
      const scoreField = `${gameConfig.scoreField}${seasonSuffix}`;
      let levelField = null;
      let killsField = null;

      // Undead Survival specific fields (check game type, suffix is already handled)
      if (selectedGame === 'undeadsurvival') {
        // Construct field names with suffix IF season is 2 or 3
        levelField = `${gameConfig.levelField}${seasonSuffix}`; // Apply suffix like scoreField
        killsField = `${gameConfig.killsField}${seasonSuffix}`; // Apply suffix like scoreField
      }
      console.log(`Using fields - Score: ${scoreField}, Level: ${levelField}, Kills: ${killsField}`);

      const itemsPerPage = 20;
      let pageQuery;
      let previousPageLastDoc = null;

      // Fetch cursor only if loading a page beyond the first and not resetting
      if (pageToLoad > 1) {
        console.log(`Attempting to fetch cursor for page ${pageToLoad}...`);
        const prevLimit = (pageToLoad - 1) * itemsPerPage;
        if (prevLimit > 0) {
          const prevPageQuery = query(
            usersRef,
            orderBy(scoreField, 'desc'), // Use the determined scoreField
            limit(prevLimit)
          );
          try {
            const prevSnapshot = await getDocs(prevPageQuery);
            if (prevSnapshot.docs.length === prevLimit) {
              previousPageLastDoc = prevSnapshot.docs[prevSnapshot.docs.length - 1];
              console.log(`Successfully fetched cursor: ${previousPageLastDoc?.id}`);
            } else {
              console.warn(`Cursor query returned ${prevSnapshot.docs.length} docs (expected ${prevLimit}). Cannot set cursor reliably. Will load page ${pageToLoad} from start.`);
              previousPageLastDoc = null;
            }
          } catch (cursorError) {
            console.error("Error fetching cursor:", cursorError);
            if (cursorError.code === 'failed-precondition') {
                 console.error(`Firestore index missing for cursor query on field: ${scoreField}. Create a descending index.`);
                 alert(`Firestore 인덱스 오류: ${scoreField} 필드에 대한 내림차순 인덱스가 필요합니다.`);
            }
            previousPageLastDoc = null;
          }
        } else {
          console.warn("Calculated prevLimit <= 0 for page > 1, unexpected.");
          previousPageLastDoc = null;
        }
      } else {
        console.log("Loading first page (or reset), no cursor needed.");
        previousPageLastDoc = null;
      }

      console.log(`Building query for page ${pageToLoad}. Using startAfter: ${!!previousPageLastDoc}`);
      pageQuery = query(
        usersRef,
        // Ensure scoreField exists before ordering/filtering
        where(scoreField, '>', -Infinity), // Check existence; adjust condition if 0 is invalid
        orderBy(scoreField, 'desc'), // Use the determined scoreField
        ...(previousPageLastDoc ? [startAfter(previousPageLastDoc)] : []),
        limit(itemsPerPage)
      );

      const pageSnapshot = await getDocs(pageQuery);
      console.log(`Fetched ${pageSnapshot.docs.length} documents for page ${pageToLoad}.`);

      const newRankings = pageSnapshot.docs
        .map((doc, index) => {
          const data = doc.data();
          // Check if the score field exists and is valid before proceeding
          if (data[scoreField] === undefined || data[scoreField] === null) {
            console.warn(`Document ${doc.id} missing or has invalid score field '${scoreField}'. Skipping.`);
            return null; // Skip this document
          }
          const baseRankInfo = {
            nickname: data.nickname || '-',
            score: data[scoreField] || 0, // Use the determined scoreField
            rank: (pageToLoad - 1) * itemsPerPage + index + 1
          };
          // Use the determined level/kills fields (with suffix)
          if (selectedGame === 'undeadsurvival') {
            return {
              ...baseRankInfo,
              // Use the determined suffixed fields
              level: data[levelField] || 0,
              kills: data[killsField] || 0
            };
          }
          return baseRankInfo;
        })
        // Filter out nulls (skipped docs) and rankings with score <= 0
        .filter(ranking => ranking && ranking.score > 0);


      console.log(`Processed ${newRankings.length} valid rankings after filtering.`);

      setRankings(newRankings);

      if (pageSnapshot.docs.length > 0 && newRankings.length > 0) {
        // Find the original document corresponding to the last valid ranking
        const lastValidRankingNickname = newRankings[newRankings.length - 1].nickname;
        const correspondingDoc = pageSnapshot.docs.find(doc => doc.data().nickname === lastValidRankingNickname);
        if (correspondingDoc) {
            setLastVisible(correspondingDoc);
            console.log(`Set lastVisible for next page load to doc id: ${correspondingDoc.id}`);
        } else {
             setLastVisible(pageSnapshot.docs[pageSnapshot.docs.length - 1]); // Fallback
             console.warn(`Could not find original doc for last ranking, using last doc in snapshot as fallback cursor: ${pageSnapshot.docs[pageSnapshot.docs.length - 1].id}`);
        }
      } else {
        setLastVisible(null);
        console.log("No valid documents in snapshot or after filtering, setting lastVisible to null.");
        if (pageToLoad > 1) {
          console.log("No results found for this page (> 1), likely reached the end or page is invalid.");
        }
      }

      console.log(`Calculating total pages based on field: ${scoreField}...`);
      // Use the determined scoreField for the count query as well
      const totalQuery = query(usersRef, where(scoreField, '>', 0));
      try {
          const totalSnapshot = await getDocs(totalQuery);
          const totalValidScores = totalSnapshot.size;
          console.log(`Total documents with ${scoreField} > 0: ${totalValidScores}`);
          setTotalPages(Math.ceil(totalValidScores / itemsPerPage));
      } catch (countError) {
          console.error("Error counting documents:", countError);
           if (countError.code === 'failed-precondition') {
               console.error(`Firestore index missing for count query on field: ${scoreField}. Create an index.`);
               // Alert specifically mentions the needed index might be for counting
               alert(`Firestore 인덱스 오류: 총 페이지 수를 계산하기 위해 ${scoreField} 필드에 대한 인덱스가 필요합니다.`);
           }
          setTotalPages(1); // Default to 1 page on count error
      }

    } catch (error) {
      console.error('랭킹 로드 중 심각한 오류 발생:', error);
      if (error.code === 'failed-precondition') {
        // Check if the error message gives more context (e.g., field path)
        console.error(`인덱스 문제일 가능성이 높습니다. Firestore에서 "${scoreField}" 필드에 대한 내림차순 및 존재 여부 필터링 인덱스를 확인하세요. 오류: ${error.message}`);
        alert(`랭킹을 불러오는 데 필요한 Firestore 인덱스가 없습니다. 필드: ${scoreField}. Firestore 콘솔에서 생성해주세요.`);
      } else if (error.code === 'invalid-argument') {
         console.error(`쿼리 인수 오류: ${error.message}. 필드 '${scoreField}'가 일부 문서에 존재하지 않을 수 있습니다.`);
         alert(`랭킹 데이터 조회 중 오류 발생: ${scoreField} 필드가 일부 사용자에게 존재하지 않을 수 있습니다.`);
      }
       else {
        alert(`랭킹 로드 중 오류 발생: ${error.message}`);
      }
      setRankings([]);
      setTotalPages(0);
      setLastVisible(null);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Determine layout type based on season and game
  const shouldUseCardLayout = selectedSeason === 3 || (selectedSeason === 2 && selectedGame === 'undeadsurvival');


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
           >
             시즌 2
           </button>
           <button
             className={`season-nav-button ${selectedSeason === 3 ? 'active' : ''}`}
             onClick={() => setSelectedSeason(3)}
           >
             시즌 3
           </button>
        </nav>

        {/* Game Navigation */}
        <nav className="game-nav">
          {/* Always show Flappy Bird */}
          <button
            className={`game-nav-button ${selectedGame === 'flappybird' ? 'active' : ''}`}
            onClick={() => setSelectedGame('flappybird')}
          >
            플래피버드
          </button>
          {/* Always show Tetris */}
          <button
            className={`game-nav-button ${selectedGame === 'tetris' ? 'active' : ''}`}
            onClick={() => setSelectedGame('tetris')}
          >
            테트리스
          </button>
          {/* Always show Suika */}
          <button
            className={`game-nav-button ${selectedGame === 'suika' ? 'active' : ''}`}
            onClick={() => setSelectedGame('suika')}
          >
            수박 게임
          </button>
          {/* Always show Apple Game */}
          <button
            className={`game-nav-button ${selectedGame === 'applegame' ? 'active' : ''}`}
            onClick={() => setSelectedGame('applegame')}
          >
            사과 게임
          </button>
          {/* Conditionally show Undead Survival for Season 2 or 3 */}
          {(selectedSeason === 2 || selectedSeason === 3) && (
            <button
              className={`game-nav-button ${selectedGame === 'undeadsurvival' ? 'active' : ''}`}
              onClick={() => setSelectedGame('undeadsurvival')}
            >
              언데드서바이벌
            </button>
          )}
          {/* Conditionally show Pinhit for Season 2 or 3 */}
          {(selectedSeason === 2 || selectedSeason === 3) && (
            <button
              className={`game-nav-button ${selectedGame === 'pinhit' ? 'active' : ''}`}
              onClick={() => setSelectedGame('pinhit')}
            >
              핀히트
            </button>
          )}
        </nav>
      </header>

      {/* Conditional Rendering: Card Layout for S3 or S2 Undead, Table otherwise */}
      {shouldUseCardLayout ? (
        // Card Layout
        <div className="ranking-cards">
          {rankings.map((ranking) => (
            <div key={ranking.rank} className={`ranking-card ${ranking.rank <= 3 ? 'top-three' : ''}`}>
              <div className="card-rank" align="center">
                {ranking.rank === 1 && <span className="trophy gold">🥇</span>}
                {ranking.rank === 2 && <span className="trophy silver">🥈</span>}
                {ranking.rank === 3 && <span className="trophy bronze">🥉</span>}
                <span className="rank-number">{ranking.rank}</span>
              </div>
              <div className="card-nickname" align="center">{ranking.nickname}</div>
              {/* Metrics container */}
              <div className="card-metrics">
                 {/* Specific metrics for Undead Survival */}
                 {selectedGame === 'undeadsurvival' ? (
                   <>
                     <div className="metric-card">
                       <div className="metric-label">생존시간</div>
                       {/* Use formatTime only for undead survival score (time) */}
                       <div className="metric-value">{formatTime(ranking.score)}</div>
                     </div>
                     <div className="metric-card">
                       <div className="metric-label">레벨</div>
                       <div className="metric-value">{ranking.level}</div>
                     </div>
                     <div className="metric-card">
                       <div className="metric-label">킬수</div>
                       <div className="metric-value">{ranking.kills}</div>
                     </div>
                   </>
                 ) : (
                   /* Generic Score Metric for other games in Card Layout (S3) */
                   <div className="metric-card wide"> {/* Add 'wide' class if you want it centered */}
                     <div className="metric-label">점수</div>
                     <div className="metric-value">{ranking.score}</div>
                   </div>
                 )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Original Table Layout for S1/S2 (non-Undead)
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
      )}

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