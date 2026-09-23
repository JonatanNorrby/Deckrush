const STORAGE_KEY = 'deckrush.save.v1';

const defaults = {
  bestScore: 0,
  weeklyBest: {},
  stats: {
    runs: 0,
    wins: 0,
    highestCombo: 0,
    highestMultiplier: 1,
    biggestHit: 0,
  },
};

export function loadSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      ...defaults,
      ...parsed,
      stats: { ...defaults.stats, ...(parsed.stats || {}) },
      weeklyBest: { ...defaults.weeklyBest, ...(parsed.weeklyBest || {}) },
    };
  } catch {
    return structuredClone(defaults);
  }
}

export function saveRunResult(result) {
  const save = loadSave();
  save.stats.runs += 1;
  if (result.victory) save.stats.wins += 1;
  save.bestScore = Math.max(save.bestScore, result.score);
  save.stats.highestCombo = Math.max(save.stats.highestCombo, result.maxCombo);
  save.stats.highestMultiplier = Math.max(save.stats.highestMultiplier, result.maxMultiplier);
  save.stats.biggestHit = Math.max(save.stats.biggestHit, result.biggestHit);
  if (result.mode === 'weekly' && result.weeklyLabel) {
    save.weeklyBest[result.weeklyLabel] = Math.max(save.weeklyBest[result.weeklyLabel] || 0, result.score);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  return save;
}
