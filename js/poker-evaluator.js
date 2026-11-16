/* ============================================================
   POKER CARDS EVALUATOR (100% ROCK SOLID 7-CARD SOLVER)
============================================================ */
const SUITS = ['♠', '♥', '♦', '♣'];
const SUIT_CLASSES = { '♠': 'suit-s', '♥': 'suit-h', '♦': 'suit-d', '♣': 'suit-c' };
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const RANK_LABELS = { 2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7', 8:'8', 9:'9', 10:'10', 11:'J', 12:'Q', 13:'K', 14:'A' };

function buildDeck() {
  const d = [];
  let id = 0;
  for (const s of SUITS) {
    for (const r of RANKS) {
      d.push({ id: id++, suit: s, rank: r, name: RANK_LABELS[r] });
    }
  }
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function evaluate5Cards(cards) {
  const suits = cards.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const sorted = [...cards].sort((a,b) => b.rank - a.rank);
  const ranks = sorted.map(c => c.rank);

  let isStraight = false;
  let straightHigh = 0;
  if (new Set(ranks).size === 5) {
    if (ranks[0] - ranks[4] === 4) {
      isStraight = true;
      straightHigh = ranks[0];
    } else if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
      isStraight = true;
      straightHigh = 5;
    }
  }

  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const uniqueRanks = Object.keys(counts).map(Number).sort((a,b) => {
    if (counts[b] !== counts[a]) return counts[b] - counts[a];
    return b - a;
  });
  const freqs = uniqueRanks.map(r => counts[r]);

  let category = 1;
  let name = "Mậu Thầu";

  if (isFlush && isStraight) {
    category = (straightHigh === 14) ? 10 : 9;
    name = (category === 10) ? "Royal Flush (Sảnh Rồng)" : "Thùng Phá Sảnh";
  } else if (freqs[0] === 4) {
    category = 8;
    name = "Tứ Quý";
  } else if (freqs[0] === 3 && freqs[1] === 2) {
    category = 7;
    name = "Cù Lũ";
  } else if (isFlush) {
    category = 6;
    name = "Thùng";
  } else if (isStraight) {
    category = 5;
    name = "Sảnh";
  } else if (freqs[0] === 3) {
    category = 4;
    name = "Xám Cô";
  } else if (freqs[0] === 2 && freqs[1] === 2) {
    category = 3;
    name = "Hai Đôi";
  } else if (freqs[0] === 2) {
    category = 2;
    name = "Một Đôi";
  }

  let score = category * Math.pow(15, 5);
  for (let i = 0; i < uniqueRanks.length; i++) {
    score += uniqueRanks[i] * Math.pow(15, 4 - i);
  }

  return { score, category, name, winningCards: sorted };
}

function getCombinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const head = arr[0], tail = arr.slice(1);
  return [...getCombinations(tail, k - 1).map(c => [head, ...c]), ...getCombinations(tail, k)];
}

function evaluate7Cards(cards) {
  if (cards.length < 5) return { score: 0, name: 'Chưa đủ bài', category: 0, winningCardIds: [] };
  const combos = getCombinations(cards, 5);
  let best = { score: -1, name: '', category: 0, winningCards: [] };
  for (const c of combos) {
    const res = evaluate5Cards(c);
    if (res.score > best.score) best = res;
  }
  return {
    ...best,
    winningCardIds: best.winningCards.map(c => c.id)
  };
}

