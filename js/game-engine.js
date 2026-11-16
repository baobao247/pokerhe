/* ============================================================
   DATA MODELS & PERSISTENCE ENGINE
============================================================ */
const fmt = n => Math.floor(n).toLocaleString('en-US') + ' 🪙';
const sleep = ms => new Promise(r => setTimeout(r, ms / GameSpeedFactor));

let GameSpeedFactor = 1.0;

let CareerStats = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  biggestPot: 0,
  bestHandName: 'Chưa có',
  streak: 0,
  bestStreak: 0,
  xp: 0,
  level: 1
};
try {
  const saved = localStorage.getItem('rix_poker_stats_v3');
  if (saved) CareerStats = { ...CareerStats, ...JSON.parse(saved) };
} catch(e){}
const saveStats = () => localStorage.setItem('rix_poker_stats_v3', JSON.stringify(CareerStats));

let UnlockedAchievements = {};
try {
  const ach = localStorage.getItem('rix_poker_ach_v3');
  if (ach) UnlockedAchievements = JSON.parse(ach);
} catch(e){}
const saveAch = () => localStorage.setItem('rix_poker_ach_v3', JSON.stringify(UnlockedAchievements));

const ACHIEVEMENTS_MAP = [
  { id: 'first_win', icon: '🥇', name: 'Chiến Thắng Đầu Tay', desc: 'Thắng ván poker đầu tiên', check: s => s.wins >= 1 },
  { id: 'pot_hunter', icon: '💰', name: 'Thợ Săn Pot', desc: 'Chiến thắng pot trên 1,000 chip', check: s => s.biggestPot >= 1000 },
  { id: 'streak_3', icon: '🔥', name: 'Bất Bại 3 Ván', desc: 'Đạt chuỗi thắng 3 trận liên tiếp', check: s => s.bestStreak >= 3 },
  { id: 'shark_lv5', icon: '⭐', name: 'Cao Thủ Level 5', desc: 'Tích lũy kinh nghiệm lên Lv 5', check: s => s.level >= 5 },
  { id: 'poker_veteran', icon: '🎖️', name: 'Lão Làng Sòng Bạc', desc: 'Tham gia 50 ván đấu', check: s => s.gamesPlayed >= 50 }
];

function grantXP(pts) {
  CareerStats.xp += pts;
  const req = CareerStats.level * 80;
  if (CareerStats.xp >= req) {
    CareerStats.xp -= req;
    CareerStats.level++;
    showToast(`⭐ CHÚC MỪNG: LÊN LEVEL ${CareerStats.level}!`);
  }
  saveStats();
  document.getElementById('level-badge').textContent = `⭐ LV ${CareerStats.level}`;
  checkAchievements();
}

function checkAchievements() {
  let isNew = false;
  ACHIEVEMENTS_MAP.forEach(a => {
    if (!UnlockedAchievements[a.id] && a.check(CareerStats)) {
      UnlockedAchievements[a.id] = true;
      isNew = true;
      showToast(`🏆 MỞ KHÓA: ${a.name}!`);
      AudioEngine.playWin();
    }
  });
  if (isNew) saveAch();
}



/* ============================================================
   GAME STATE & BOT PERSONALITIES
============================================================ */
const SMALL_BLIND = 10;
const BIG_BLIND = 20;

let players = [
  { id: 0, name: "Bạn (VIP)", chips: 1000, hand: [], isHuman: true, folded: false, currentBet: 0, totalContributed: 0, hasActed: false },
  { id: 1, name: "Leo (Aggressive)", style: 'aggressive', chips: 1000, hand: [], isHuman: false, folded: false, currentBet: 0, totalContributed: 0, hasActed: false },
  { id: 2, name: "Alex (Shark)", style: 'smart', chips: 1000, hand: [], isHuman: false, folded: false, currentBet: 0, totalContributed: 0, hasActed: false },
  { id: 3, name: "Taylor (Tight)", style: 'tight', chips: 1000, hand: [], isHuman: false, folded: false, currentBet: 0, totalContributed: 0, hasActed: false }
];

let deck = [];
let communityCards = [];
let pot = 0;
let currentHighestBet = 0;
let minRaiseDelta = BIG_BLIND;
let dealerIdx = 0;
let activeTurnIdx = 0;
let gameStage = 'PREFLOP'; // PREFLOP, FLOP, TURN, RIVER, SHOWDOWN, END
let isLoopRunning = false;
let turnTimerInterval = null;

/* ============================================================
   UI RENDERING SYSTEM
============================================================ */
function log(msg, type = '') {
  const box = document.getElementById('game-log');
  const row = document.createElement('div');
  row.className = `log-item ${type}`;
  row.innerHTML = msg;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

function showToast(msg) {
  const anchor = document.getElementById('toast-anchor');
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  anchor.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function showSpeech(pIdx, text) {
  const el = document.getElementById(`bubble-${pIdx}`);
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 1200);
}

function renderCardDOM(card, isFlipped, isWinCard = false, isDim = false) {
  const wrapper = document.createElement('div');
  wrapper.className = `card-3d ${isFlipped ? 'flipped' : ''} ${isWinCard ? 'win-card' : ''} ${isDim ? 'dim-card' : ''}`;
  const suitCls = SUIT_CLASSES[card.suit] || 'suit-s';
  wrapper.innerHTML = `
    <div class="card-inner">
      <div class="card-face card-back-side"></div>
      <div class="card-face card-front-side ${suitCls}">
        <div>${card.name}</div>
        <div class="suit-symbol">${card.suit}</div>
      </div>
    </div>`;
  return wrapper;
}

function updateUI(winningIds = []) {
  document.getElementById('pot-amount').textContent = `POT: ${fmt(pot)}`;

  players.forEach((p, i) => {
    document.getElementById(`name-${i}`).textContent = p.name;
    document.getElementById(`chips-${i}`).textContent = fmt(p.chips);

    const betTag = document.getElementById(`bet-${i}`);
    if (p.currentBet > 0) {
      betTag.textContent = `Bet: ${fmt(p.currentBet)}`;
      betTag.classList.add('show');
    } else {
      betTag.classList.remove('show');
    }

    const puck = document.getElementById(`puck-${i}`);
    puck.style.display = (dealerIdx === i) ? 'grid' : 'none';

    const seatEl = document.getElementById(`seat-${i}`);
    const isTheirTurn = (activeTurnIdx === i && gameStage !== 'SHOWDOWN' && gameStage !== 'END' && !p.folded && p.chips > 0);
    seatEl.classList.toggle('active-turn', isTheirTurn);
    seatEl.classList.toggle('folded', p.folded);

    // Cards
    const row = document.getElementById(`cards-${i}`);
    row.innerHTML = '';
    if (p.hand.length > 0) {
      row.classList.add('has-cards');
      p.hand.forEach(c => {
        const reveal = p.isHuman || gameStage === 'SHOWDOWN' || gameStage === 'END';
        const isWin = winningIds.includes(c.id);
        const isDim = winningIds.length > 0 && !isWin;
        row.appendChild(renderCardDOM(c, reveal, isWin, isDim));
      });
    } else {
      row.classList.remove('has-cards');
    }
  });

  // Board Cards
  for (let b = 0; b < 5; b++) {
    const slot = document.getElementById(`board-${b}`);
    slot.innerHTML = '';
    if (communityCards[b]) {
      const c = communityCards[b];
      const isWin = winningIds.includes(c.id);
      const isDim = winningIds.length > 0 && !isWin;
      slot.appendChild(renderCardDOM(c, true, isWin, isDim));
    }
  }

  // Hand Strength & Win Rate Calculator
  const human = players[0];
  const hsText = document.getElementById('hud-hand-strength');
  const eqText = document.getElementById('hud-equity-text');
  const eqBar = document.getElementById('hud-equity-bar');

  if (human.folded) {
    hsText.textContent = "Bạn đã Fold ván này";
    eqText.textContent = "0%";
    eqBar.style.width = "0%";
  } else if (human.hand.length === 2) {
    const all = [...human.hand, ...communityCards];
    if (all.length >= 5) {
      const evalRes = evaluate7Cards(all);
      hsText.textContent = evalRes.name;
    } else {
      const isPair = human.hand[0].rank === human.hand[1].rank;
      hsText.textContent = isPair ? `Đôi ${human.hand[0].name}` : `Bài tẩy ${human.hand[0].name}-${human.hand[1].name}`;
    }
    // Estimated Equity & Outs Draw Analysis
    const est = calculateFastEquity(human);
    let drawTip = '';
    if (communityCards.length >= 3 && !human.folded) {
      const allCards = [...human.hand, ...communityCards];
      const suitCounts = {};
      allCards.forEach(c => suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1);
      const flushSuit = Object.keys(suitCounts).find(s => suitCounts[s] === 4);
      const humanHasFlushSuit = flushSuit && human.hand.some(c => c.suit === flushSuit);
      if (flushSuit && humanHasFlushSuit) {
        drawTip = ' • Đợi Thùng (9 outs)';
      } else {
        const ranks = [...new Set(allCards.map(c => c.rank))].sort((a,b) => a - b);
        let openEnded = false;
        let gutshot = false;
        for (let i = 0; i <= ranks.length - 4; i++) {
          if (ranks[i+3] - ranks[i] === 3) openEnded = true;
          else if (ranks[i+3] - ranks[i] === 4) gutshot = true;
        }
        if (openEnded) drawTip = ' • Đợi Sảnh 2 đầu (8 outs)';
        else if (gutshot) drawTip = ' • Đợi Sảnh khe (4 outs)';
      }
    }
    eqText.textContent = `Win: ${est}%${drawTip}`;
    eqBar.style.width = `${est}%`;
  }

  // Action Buttons
  const isHumanTurn = (activeTurnIdx === 0 && gameStage !== 'SHOWDOWN' && gameStage !== 'END' && !human.folded && human.chips > 0);
  const isEnd = (gameStage === 'SHOWDOWN' || gameStage === 'END');
  const callCost = currentHighestBet - human.currentBet;

  document.getElementById('btn-fold').disabled = !isHumanTurn;
  document.getElementById('btn-check').disabled = !isHumanTurn || callCost > 0;
  document.getElementById('btn-call').disabled = !isHumanTurn || callCost <= 0;
  document.getElementById('btn-raise').disabled = !isHumanTurn || human.chips <= callCost;
  document.getElementById('btn-next').style.display = isEnd ? 'block' : 'none';

  const callBtn = document.getElementById('btn-call');
  callBtn.textContent = callCost > 0 ? `Call ${fmt(Math.min(callCost, human.chips))}` : 'Call';

  // Slider limits
  const slider = document.getElementById('bet-slider');
  const minRaiseTo = Math.min(currentHighestBet + minRaiseDelta, human.chips + human.currentBet);
  const maxRaiseTo = human.chips + human.currentBet;

  slider.min = minRaiseTo;
  slider.max = Math.max(minRaiseTo, maxRaiseTo);
  if (parseInt(slider.value) < slider.min) slider.value = slider.min;
  if (parseInt(slider.value) > slider.max) slider.value = slider.max;
  document.getElementById('bet-slider-val').textContent = fmt(slider.value);

  const raiseBtn = document.getElementById('btn-raise');
  if (parseInt(slider.value) >= maxRaiseTo && maxRaiseTo > 0) {
    raiseBtn.textContent = 'ALL-IN 🔥';
  } else {
    raiseBtn.textContent = 'Tố (R)';
  }
}

function calculateFastEquity(human) {
  if (human.folded) return 0;
  if (communityCards.length === 0) {
    const isPair = human.hand[0].rank === human.hand[1].rank;
    const high = Math.max(human.hand[0].rank, human.hand[1].rank);
    if (isPair) return Math.min(88, 55 + high * 2.5);
    return Math.min(75, 30 + high * 2.5);
  }
  const evalH = evaluate7Cards([...human.hand, ...communityCards]);
  if (evalH.category >= 7) return 96;
  if (evalH.category >= 5) return 88;
  if (evalH.category >= 3) return 72;
  if (evalH.category >= 2) return 55;
  return 28;
}

/* ============================================================
   SIDE POTS & BET POSTING ENGINE
============================================================ */
function postBet(pIdx, amount) {
  const p = players[pIdx];
  const actual = Math.min(amount, p.chips);
  p.chips -= actual;
  p.currentBet += actual;
  p.totalContributed += actual;
  pot += actual;
  AudioEngine.playChip();
}

function resolveSidePots(evalResults) {
  const activeContribs = players.map(p => ({
    id: p.id,
    contributed: p.totalContributed,
    folded: p.folded,
    player: p
  }));

  const uniqueLevels = [...new Set(activeContribs.map(c => c.contributed).filter(c => c > 0))].sort((a,b) => a-b);
  let prevLevel = 0;

  for (const lvl of uniqueLevels) {
    const tierSize = lvl - prevLevel;
    let tierAmount = 0;
    const eligiblePlayers = [];

    activeContribs.forEach(c => {
      if (c.contributed >= lvl) {
        tierAmount += tierSize;
        if (!c.folded) eligiblePlayers.push(c.player);
      } else if (c.contributed > prevLevel) {
        tierAmount += (c.contributed - prevLevel);
      }
    });

    if (tierAmount > 0) {
      if (eligiblePlayers.length > 0) {
        const contenders = evalResults.filter(r => eligiblePlayers.some(ep => ep.id === r.player.id));
        if (contenders.length > 0) {
          const topScore = Math.max(...contenders.map(c => c.score));
          const winners = contenders.filter(c => c.score === topScore);
          const share = Math.floor(tierAmount / winners.length);
          winners.forEach(w => { w.player.chips += share; });
          const rem = tierAmount - (share * winners.length);
          if (rem > 0) winners[0].player.chips += rem;
        } else {
          evalResults[0].player.chips += tierAmount;
        }
      } else if (evalResults.length > 0) {
        evalResults[0].player.chips += tierAmount;
      }
    }
    prevLevel = lvl;
  }
}

/* ============================================================
   RADIAL TIMER RING CONTROLLER
============================================================ */
function startRadialTimer(seatIdx) {
  stopRadialTimer();
  const stroke = document.getElementById(`timer-stroke-${seatIdx}`);
  if (!stroke) return;

  const totalTime = 18;
  let remaining = totalTime;
  const maxDash = 126;

  turnTimerInterval = setInterval(() => {
    remaining -= 0.1;
    const frac = Math.max(0, remaining / totalTime);
    stroke.style.strokeDashoffset = (1 - frac) * maxDash;
    if (remaining <= 4) stroke.style.stroke = '#ef4444';
    else stroke.style.stroke = 'var(--gold)';

    if (remaining <= 0) {
      stopRadialTimer();
      if (seatIdx === 0) {
        const human = players[0];
        const cost = currentHighestBet - human.currentBet;
        if (cost === 0) handleUserAction('check');
        else handleUserAction('fold');
      }
    }
  }, 100);
}

function stopRadialTimer() {
  if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
  for (let i = 0; i < 4; i++) {
    const s = document.getElementById(`timer-stroke-${i}`);
    if (s) {
      s.style.strokeDashoffset = 0;
      s.style.stroke = 'var(--gold)';
    }
  }
}

/* ============================================================
   CORE FINITE STATE MACHINE GAME ENGINE
============================================================ */
async function advanceStreet() {
  players.forEach(p => { p.currentBet = 0; p.hasActed = false; });
  currentHighestBet = 0;
  minRaiseDelta = BIG_BLIND;

  if (gameStage === 'PREFLOP') {
    gameStage = 'FLOP';
    communityCards.push(deck.pop(), deck.pop(), deck.pop());
    log("--- VÒNG FLOP ---", 'gold');
    AudioEngine.playCard();
  } else if (gameStage === 'FLOP') {
    gameStage = 'TURN';
    communityCards.push(deck.pop());
    log("--- VÒNG TURN ---", 'gold');
    AudioEngine.playCard();
  } else if (gameStage === 'TURN') {
    gameStage = 'RIVER';
    communityCards.push(deck.pop());
    log("--- VÒNG RIVER ---", 'gold');
    AudioEngine.playCard();
  } else if (gameStage === 'RIVER') {
    gameStage = 'SHOWDOWN';
    await handleShowdown();
    return false;
  }

  let next = (dealerIdx + 1) % 4;
  for (let i = 0; i < 4; i++) {
    if (!players[next].folded && players[next].chips > 0) break;
    next = (next + 1) % 4;
  }
  activeTurnIdx = next;
  return true;
}

async function handleShowdown() {
  log("--- 🎴 SO BÀI (SHOWDOWN) 🎴 ---", 'gold');
  
  const activePlayers = players.filter(p => !p.folded);
  const results = activePlayers.map(p => {
    const res = evaluate7Cards([...p.hand, ...communityCards]);
    return { player: p, score: res.score, name: res.name, category: res.category, winningCardIds: res.winningCardIds };
  });

  results.sort((a,b) => b.score - a.score);
  results.forEach(r => log(`${r.player.name}: [${r.name}]`));

  const bestResult = results[0];
  updateUI(bestResult.winningCardIds);

  resolveSidePots(results);
  pot = 0;

  const topScore = results[0].score;
  const winners = results.filter(r => r.score === topScore);

  winners.forEach(w => {
    document.getElementById(`seat-${w.player.id}`).classList.add('winner');
    showSpeech(w.player.id, "THẮNG! 🎉");
  });

  if (winners.some(w => w.player.id === 0)) {
    log(`🏆 Bạn chiến thắng ván bài!`, 'win');
    AudioEngine.playWin();
    showToast("🎉 BẠN CHIẾN THẮNG!");
    CareerStats.wins++;
    CareerStats.streak++;
    if (CareerStats.streak > CareerStats.bestStreak) CareerStats.bestStreak = CareerStats.streak;
    grantXP(35);
  } else {
    log(`🏆 ${winners.map(w=>w.player.name).join(', ')} chiến thắng!`, 'win');
    CareerStats.losses++;
    CareerStats.streak = 0;
    grantXP(10);
  }

  CareerStats.gamesPlayed++;
  saveStats();
  gameStage = 'END';
  updateUI(bestResult.winningCardIds);
}

async function handleWinByFold(winner) {
  winner.chips += pot;
  pot = 0;
  log(`🏆 ${winner.name} thắng vì đối thủ đều đã Fold!`, 'win');
  document.getElementById(`seat-${winner.id}`).classList.add('winner');
  showSpeech(winner.id, "THẮNG! 🎉");

  if (winner.id === 0) {
    AudioEngine.playWin();
    showToast("🎉 ĐỐI THỦ ĐÃ FOLD — BẠN THẮNG!");
    CareerStats.wins++;
    CareerStats.streak++;
    if (CareerStats.streak > CareerStats.bestStreak) CareerStats.bestStreak = CareerStats.streak;
    grantXP(25);
  } else {
    CareerStats.losses++;
    CareerStats.streak = 0;
    grantXP(8);
  }

  CareerStats.gamesPlayed++;
  saveStats();
  gameStage = 'END';
  updateUI();
}

async function processTurnEngine() {
  if (isLoopRunning) return;
  isLoopRunning = true;

  try {
    while (true) {
      updateUI();
      if (gameStage === 'SHOWDOWN' || gameStage === 'END') break;

      // 1. Fold victory check
      const unfolded = players.filter(p => !p.folded);
      if (unfolded.length === 1) {
        await handleWinByFold(unfolded[0]);
        break;
      }

      // 2. Betting round completion check
      const canAct = players.filter(p => !p.folded && p.chips > 0);
      const allMatched = canAct.every(p => p.currentBet === currentHighestBet);
      const allActed = canAct.every(p => p.hasActed);

      if (canAct.length <= 1 && allMatched) {
        await sleep(600);
        const cont = await advanceStreet();
        if (!cont) break;
        continue;
      }

      if (allMatched && allActed) {
        await sleep(500);
        const cont = await advanceStreet();
        if (!cont) break;
        continue;
      }

      // 3. Find next candidate
      let targetIdx = -1;
      for (let s = 0; s < 4; s++) {
        const cand = (activeTurnIdx + s) % 4;
        const p = players[cand];
        if (!p.folded && p.chips > 0 && (!p.hasActed || p.currentBet < currentHighestBet)) {
          targetIdx = cand;
          break;
        }
      }

      if (targetIdx === -1) {
        await sleep(400);
        const cont = await advanceStreet();
        if (!cont) break;
        continue;
      }

      activeTurnIdx = targetIdx;
      updateUI();

      const curP = players[activeTurnIdx];
      if (curP.isHuman) {
        // Evaluate pre-actions
        if (checkPreActions()) break;
        startRadialTimer(0);
        break; // Wait for human tap
      } else {
        stopRadialTimer();
        startRadialTimer(curP.id);
        await executeBotBrain(curP);
        stopRadialTimer();
        activeTurnIdx = (activeTurnIdx + 1) % 4;
      }
    }
  } finally {
    isLoopRunning = false;
    updateUI();
  }
}

function checkPreActions() {
  const chkFold = document.getElementById('pre-check-fold').checked;
  const autoChk = document.getElementById('pre-auto-check').checked;
  const callAny = document.getElementById('pre-call-any').checked;
  const diff = currentHighestBet - players[0].currentBet;

  if (chkFold) {
    document.getElementById('pre-check-fold').checked = false;
    if (diff === 0) handleUserAction('check');
    else handleUserAction('fold');
    return true;
  }
  if (autoChk && diff === 0) {
    document.getElementById('pre-auto-check').checked = false;
    handleUserAction('check');
    return true;
  }
  if (callAny && diff > 0) {
    document.getElementById('pre-call-any').checked = false;
    handleUserAction('call');
    return true;
  }
  return false;
}



/* ============================================================
   USER ACTIONS & DISPATCHERS
============================================================ */
function handleUserAction(action) {
  if (activeTurnIdx !== 0 || isLoopRunning) return;
  stopRadialTimer();

  const human = players[0];
  const diff = currentHighestBet - human.currentBet;

  if (action === 'fold') {
    human.folded = true;
    showSpeech(0, "Fold 🏳️");
    AudioEngine.playFold();
    human.hasActed = true;
    log(`Bạn Fold.`);
  } else if (action === 'check') {
    if (diff > 0) return;
    showSpeech(0, "Check");
    AudioEngine.playKnock();
    human.hasActed = true;
    log(`Bạn Check.`);
  } else if (action === 'call') {
    applyBetAction(human, diff, 'CALL');
  } else if (action === 'raise') {
    const target = parseInt(document.getElementById('bet-slider').value);
    applyBetAction(human, target, 'RAISE');
  }

  activeTurnIdx = (activeTurnIdx + 1) % 4;
  updateUI();
  processTurnEngine();
}

function startNewHand() {
  document.querySelectorAll('.seat').forEach(s => s.classList.remove('winner', 'active-turn'));
  pot = 0;
  communityCards = [];
  gameStage = 'PREFLOP';
  currentHighestBet = 0;
  minRaiseDelta = BIG_BLIND;

  // Rebui for broke human
  if (players[0].chips <= 0) {
    players[0].chips = 1000;
    log("💰 Tài trợ hồi sinh 1,000 chip cho bạn!", 'gold');
    showToast("💰 Tài trợ hồi sinh 1,000 🪙");
  }

  // Refill broke bots
  players.forEach((p, idx) => {
    if (!p.isHuman && p.chips <= 0) p.chips = 1000;
    p.hand = [];
    p.folded = false;
    p.currentBet = 0;
    p.totalContributed = 0;
    p.hasActed = false;
  });

  dealerIdx = (dealerIdx + 1) % 4;
  deck = buildDeck();

  // Deal 2 cards to each
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 4; i++) {
      players[i].hand.push(deck.pop());
    }
  }

  // Blinds
  const sb = (dealerIdx + 1) % 4;
  const bb = (dealerIdx + 2) % 4;
  postBet(sb, SMALL_BLIND);
  postBet(bb, BIG_BLIND);
  currentHighestBet = BIG_BLIND;

  log(`--- VÁN MỚI BẮT ĐẦU ---`, 'gold');
  activeTurnIdx = (dealerIdx + 3) % 4;

  updateUI();
  processTurnEngine();
}

/* ============================================================
   MODALS, SHORTCUTS & EVENT BINDINGS
============================================================ */
document.getElementById('btn-fold').onclick = () => handleUserAction('fold');
document.getElementById('btn-check').onclick = () => handleUserAction('check');
document.getElementById('btn-call').onclick = () => handleUserAction('call');
document.getElementById('btn-raise').onclick = () => handleUserAction('raise');
document.getElementById('btn-next').onclick = () => startNewHand();

const slider = document.getElementById('bet-slider');
slider.oninput = () => {
  document.getElementById('bet-slider-val').textContent = fmt(slider.value);
  const max = players[0].chips + players[0].currentBet;
  const btn = document.getElementById('btn-raise');
  btn.textContent = (parseInt(slider.value) >= max && max > 0) ? 'ALL-IN 🔥' : 'Tố (R)';
};

document.querySelectorAll('.preset-tag').forEach(tag => {
  tag.onclick = () => {
    const human = players[0];
    const diff = currentHighestBet - human.currentBet;
    const curPot = pot + diff;
    let target = currentHighestBet + minRaiseDelta;

    if (tag.dataset.preset === 'min') target = currentHighestBet + minRaiseDelta;
    else if (tag.dataset.preset === '2.5bb') target = BIG_BLIND * 2.5;
    else if (tag.dataset.preset === 'half') target = currentHighestBet + Math.floor(curPot * 0.5);
    else if (tag.dataset.preset === 'pot') target = currentHighestBet + curPot;
    else if (tag.dataset.preset === 'allin') target = human.chips + human.currentBet;

    slider.value = Math.min(target, human.chips + human.currentBet);
    slider.oninput();
  };
});

// Felt Color Switcher
document.querySelectorAll('.swatch-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const color = btn.dataset.felt;
    const table = document.getElementById('table-felt');
    if (color === 'emerald') table.style.background = 'var(--felt-emerald)';
    else if (color === 'blue') table.style.background = 'var(--felt-blue)';
    else if (color === 'crimson') table.style.background = 'var(--felt-crimson)';
    else if (color === 'onyx') table.style.background = 'var(--felt-onyx)';
  };
});

// 4-Color Deck Toggle
document.getElementById('setting-4color').onchange = (e) => {
  document.body.classList.toggle('classic-deck', !e.target.checked);
};

// Speed Toggle
document.getElementById('setting-speed').onchange = (e) => {
  GameSpeedFactor = parseFloat(e.target.value);
};

// Sound Toggle
document.getElementById('setting-sound').onchange = (e) => {
  AudioEngine.enabled = e.target.checked;
};
document.getElementById('btn-sound').onclick = () => {
  AudioEngine.enabled = !AudioEngine.enabled;
  document.getElementById('setting-sound').checked = AudioEngine.enabled;
  document.getElementById('btn-sound').innerHTML = AudioEngine.enabled ? '<i class="fas fa-volume-high"></i>' : '<i class="fas fa-volume-xmark"></i>';
};

// Keyboard Hotkeys
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'f') handleUserAction('fold');
  else if (k === 'c') {
    const diff = currentHighestBet - players[0].currentBet;
    handleUserAction(diff === 0 ? 'check' : 'call');
  } else if (k === 'r') handleUserAction('raise');
  else if (e.key === ' ' && (gameStage === 'SHOWDOWN' || gameStage === 'END')) {
    e.preventDefault();
    startNewHand();
  }
});

// Modals Handlers
document.querySelectorAll('[data-close]').forEach(b => {
  b.onclick = () => b.closest('.modal-overlay').classList.remove('open');
});

document.getElementById('btn-settings').onclick = () => document.getElementById('modal-settings').classList.add('open');
document.getElementById('btn-stats').onclick = () => {
  const winRate = CareerStats.gamesPlayed > 0 ? ((CareerStats.wins / CareerStats.gamesPlayed) * 100).toFixed(1) : '0.0';
  document.getElementById('stats-render-body').innerHTML = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
      <div style="background:var(--surface-2); padding:10px; border-radius:8px;">Ván Đã Đấu: <strong>${CareerStats.gamesPlayed}</strong></div>
      <div style="background:var(--surface-2); padding:10px; border-radius:8px;">Tỉ Lệ Thắng: <strong style="color:var(--emerald);">${winRate}%</strong></div>
      <div style="background:var(--surface-2); padding:10px; border-radius:8px;">Thắng / Thua: <strong>${CareerStats.wins} / ${CareerStats.losses}</strong></div>
      <div style="background:var(--surface-2); padding:10px; border-radius:8px;">Chuỗi Thắng Max: <strong style="color:var(--gold);">${CareerStats.bestStreak}</strong></div>
    </div>
    <p>Cấp Bậc Hiện Tại: <strong>Level ${CareerStats.level}</strong> (${CareerStats.xp} / ${CareerStats.level * 80} XP)</p>
  `;
  document.getElementById('modal-stats').classList.add('open');
};

document.getElementById('btn-ach').onclick = () => {
  document.getElementById('ach-render-grid').innerHTML = ACHIEVEMENTS_MAP.map(a => `
    <div style="background:var(--surface-2); padding:10px; border-radius:8px; border:1px solid ${UnlockedAchievements[a.id] ? 'var(--gold)' : 'var(--border)'}; opacity:${UnlockedAchievements[a.id] ? '1' : '0.4'}">
      <div style="font-size:1.4rem;">${a.icon}</div>
      <div style="font-weight:bold; font-size:0.75rem; color:var(--gold);">${a.name}</div>
      <div style="font-size:0.65rem; color:var(--text-muted);">${a.desc}</div>
    </div>
  `).join('');
  document.getElementById('modal-ach').classList.add('open');
};

document.getElementById('btn-reset-game').onclick = () => {
  if (confirm("Khởi động lại toàn bộ số vốn và thống kê?")) {
    players[0].chips = 1000;
    CareerStats = { gamesPlayed: 0, wins: 0, losses: 0, biggestPot: 0, bestHandName: 'Chưa có', streak: 0, bestStreak: 0, xp: 0, level: 1 };
    saveStats();
    startNewHand();
    document.getElementById('modal-settings').classList.remove('open');
  }
};

// Initial Start
startNewHand();