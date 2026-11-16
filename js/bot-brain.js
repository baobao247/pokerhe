/* ============================================================
   INTELLIGENT BOT BRAIN (STYLES & PSYCHOLOGY)
============================================================ */
async function executeBotBrain(bot) {
  await sleep(750 + Math.random() * 550);

  const diff = currentHighestBet - bot.currentBet;
  let handScore = 0.5;

  if (gameStage === 'PREFLOP') {
    const high = Math.max(bot.hand[0].rank, bot.hand[1].rank);
    const isPair = bot.hand[0].rank === bot.hand[1].rank;
    handScore = isPair ? 0.8 : (high >= 12 ? 0.65 : 0.4);
  } else {
    const res = evaluate7Cards([...bot.hand, ...communityCards]);
    handScore = res.category >= 5 ? 0.95 : res.category >= 3 ? 0.75 : res.category >= 2 ? 0.58 : 0.28;
  }

  // Adjust by personality
  if (bot.style === 'aggressive') handScore += 0.12;
  else if (bot.style === 'tight') handScore -= 0.08;

  if (diff === 0) {
    if (handScore > 0.75 && Math.random() < 0.55 && bot.chips > BIG_BLIND * 2) {
      const raiseTo = Math.min(bot.chips + bot.currentBet, currentHighestBet + BIG_BLIND * 2);
      applyBetAction(bot, raiseTo, 'RAISE');
    } else {
      showSpeech(bot.id, "Check");
      AudioEngine.playKnock();
      bot.hasActed = true;
      log(`${bot.name} Check.`);
    }
  } else {
    if (handScore < 0.38 && diff > BIG_BLIND) {
      bot.folded = true;
      showSpeech(bot.id, "Fold 🏳️");
      AudioEngine.playFold();
      bot.hasActed = true;
      log(`${bot.name} Fold.`);
    } else if (handScore > 0.82 && Math.random() < 0.45 && bot.chips > diff * 2) {
      const raiseTo = Math.min(bot.chips + bot.currentBet, currentHighestBet + diff + BIG_BLIND * 2);
      applyBetAction(bot, raiseTo, 'RAISE');
    } else {
      applyBetAction(bot, diff, 'CALL');
    }
  }
}

function applyBetAction(player, targetValue, type) {
  if (type === 'RAISE') {
    const addAmt = targetValue - player.currentBet;
    postBet(player.id, addAmt);
    const prev = currentHighestBet;
    currentHighestBet = player.currentBet;
    minRaiseDelta = Math.max(BIG_BLIND, currentHighestBet - prev);
    players.forEach(p => { if (p.id !== player.id && !p.folded && p.chips > 0) p.hasActed = false; });
    showSpeech(player.id, `Tố ${fmt(currentHighestBet)}`);
    log(`${player.name} Tố lên ${fmt(currentHighestBet)}!`, 'gold');
  } else {
    const callAmt = Math.min(targetValue, player.chips);
    postBet(player.id, callAmt);
    showSpeech(player.id, `Call ${fmt(callAmt)}`);
    log(`${player.name} Call ${fmt(callAmt)}.`);
  }
  player.hasActed = true;
}

