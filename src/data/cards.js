export const CARD_ANIMATION_CLASSES = Object.freeze(['magical', 'melee', 'defensive']);

const card = (config) => {
  if (!CARD_ANIMATION_CLASSES.includes(config.animationClass)) {
    throw new Error(`Card ${config.id} must declare a valid animationClass.`);
  }

  return {
    rarity: 'common',
    art: null,
    ...config,
  };
};

export const CARD_LIBRARY = {
  strike: card({
    id: 'strike', name: 'Strike', cost: 1, tags: ['attack'], animationClass: 'melee',
    description: 'Deal 6 damage. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 6 }],
  }),
  guard: card({
    id: 'guard', name: 'Guard', cost: 1, tags: ['skill'], animationClass: 'defensive',
    description: 'Gain 6 Block.', effects: [{ type: 'block', amount: 6 }],
  }),
  jab: card({
    id: 'jab', name: 'Jab', cost: 0, tags: ['attack'], animationClass: 'melee',
    description: 'Deal 3 damage. Draw 1. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 3 }, { type: 'draw', amount: 1 }],
  }),
  greed: card({
    id: 'greed', name: 'Greed', cost: 0, tags: ['risk'], animationClass: 'magical',
    description: 'Lose 2 HP. Gain +0.25x multiplier.',
    effects: [{ type: 'selfDamage', amount: 2 }, { type: 'multiplier', amount: 0.25 }],
  }),
  cashin: card({
    id: 'cashin', name: 'Cash In', cost: 0, tags: ['score'], animationClass: 'magical',
    description: 'Gain 120 score. Lose half your Combo.',
    effects: [{ type: 'score', amount: 120 }, { type: 'halveCombo' }],
  }),
  toxicCut: card({
    id: 'toxic-cut', name: 'Toxic Cut', cost: 1, tags: ['attack', 'poison'], animationClass: 'melee',
    description: 'Deal 4 damage. Apply 3 Poison. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 4 }, { type: 'poison', amount: 3 }],
  }),
  envenom: card({
    id: 'envenom', name: 'Envenom', cost: 1, tags: ['poison'], animationClass: 'magical',
    description: 'Apply 5 Poison.',
    effects: [{ type: 'poison', amount: 5 }],
  }),
  quickStab: card({
    id: 'quick-stab', name: 'Quick Stab', cost: 0, tags: ['attack'], animationClass: 'melee',
    description: 'Deal 3 damage. Draw 1. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 3 }, { type: 'draw', amount: 1 }],
  }),
  evade: card({
    id: 'evade', name: 'Evade', cost: 1, tags: ['skill'], animationClass: 'defensive',
    description: 'Gain 7 Block.',
    effects: [{ type: 'block', amount: 7 }],
  }),
  catalyst: card({
    id: 'catalyst', name: 'Catalyst', cost: 1, tags: ['poison'], animationClass: 'magical', rarity: 'uncommon',
    description: 'Double the enemy’s Poison.',
    effects: [{ type: 'doublePoison' }],
  }),
  venomBloom: card({
    id: 'venom-bloom', name: 'Venom Bloom', cost: 2, tags: ['poison'], animationClass: 'magical', rarity: 'uncommon',
    description: 'Apply 9 Poison. Gain +0.15x multiplier.',
    effects: [{ type: 'poison', amount: 9 }, { type: 'multiplier', amount: 0.15 }],
  }),
  toxicPayoff: card({
    id: 'toxic-payoff', name: 'Toxic Payoff', cost: 1, tags: ['score', 'poison'], animationClass: 'magical', rarity: 'uncommon',
    description: 'Gain 35 score per Poison on the enemy.',
    effects: [{ type: 'scorePerPoison', amount: 35 }],
  }),
  shieldStrike: card({
    id: 'shield-strike', name: 'Shield Strike', cost: 1, tags: ['attack', 'block'], animationClass: 'melee',
    description: 'Deal 4 damage. Gain 4 Block. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 4 }, { type: 'block', amount: 4 }],
  }),
  fortify: card({
    id: 'fortify', name: 'Fortify', cost: 1, tags: ['skill', 'block'], animationClass: 'defensive',
    description: 'Gain 9 Block.',
    effects: [{ type: 'block', amount: 9 }],
  }),
  shieldBash: card({
    id: 'shield-bash', name: 'Shield Bash', cost: 1, tags: ['attack', 'block'], animationClass: 'melee',
    description: 'Deal 4 + 60% of your current Block as damage. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damageFromBlock', base: 4, ratio: 0.6 }],
  }),
  ironWall: card({
    id: 'iron-wall', name: 'Iron Wall', cost: 2, tags: ['skill', 'block'], animationClass: 'defensive', rarity: 'uncommon',
    description: 'Gain 16 Block.',
    effects: [{ type: 'block', amount: 16 }],
  }),
  counterweight: card({
    id: 'counterweight', name: 'Counterweight', cost: 1, tags: ['score', 'block'], animationClass: 'defensive', rarity: 'uncommon',
    description: 'Gain 22 score per current Block.',
    effects: [{ type: 'scorePerBlock', amount: 22 }],
  }),
  uppercut: card({
    id: 'uppercut', name: 'Uppercut', cost: 1, tags: ['attack'], animationClass: 'melee',
    description: 'Deal 10 damage. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damage', amount: 10 }],
  }),
  flurry: card({
    id: 'flurry', name: 'Flurry', cost: 1, tags: ['attack'], animationClass: 'melee',
    description: 'Deal 3 damage three times. Build 2 Combo.', comboGain: 2,
    effects: [{ type: 'damage', amount: 3, hits: 3 }],
  }),
  execution: card({
    id: 'execution', name: 'Execution', cost: 1, tags: ['attack', 'score'], animationClass: 'melee', rarity: 'uncommon',
    description: 'Deal 8 damage. If this kills, gain 350 score.', comboGain: 1,
    effects: [{ type: 'damage', amount: 8, killScore: 350 }],
  }),
  haymaker: card({
    id: 'haymaker', name: 'Haymaker', cost: 2, tags: ['attack', 'risk'], animationClass: 'melee', rarity: 'uncommon',
    description: 'Lose 3 HP. Deal 18 damage. Huge overkill potential.', comboGain: 1,
    effects: [{ type: 'selfDamage', amount: 3 }, { type: 'damage', amount: 18 }],
  }),
  momentum: card({
    id: 'momentum', name: 'Momentum', cost: 1, tags: ['score'], animationClass: 'magical',
    description: 'Gain +0.12x multiplier per current Combo.',
    effects: [{ type: 'multiplierPerCombo', amount: 0.12 }],
  }),
  insurance: card({
    id: 'insurance', name: 'Insurance', cost: 1, tags: ['skill', 'score'], animationClass: 'defensive',
    description: 'Gain 6 Block and 100 score.',
    effects: [{ type: 'block', amount: 6 }, { type: 'score', amount: 100 }],
  }),
  redline: card({
    id: 'redline', name: 'Redline', cost: 0, tags: ['risk', 'score'], animationClass: 'magical', rarity: 'uncommon',
    description: 'Lose 5 HP. Gain +0.5x multiplier.',
    effects: [{ type: 'selfDamage', amount: 5 }, { type: 'multiplier', amount: 0.5 }],
  }),
  payday: card({
    id: 'payday', name: 'Payday', cost: 1, tags: ['score'], animationClass: 'magical',
    description: 'Gain 45 score per Combo, then reset Combo.',
    effects: [{ type: 'scorePerCombo', amount: 45 }, { type: 'resetCombo' }],
  }),
  brace: card({
    id: 'brace', name: 'Brace', cost: 1, tags: ['skill'], animationClass: 'defensive',
    description: 'Gain 10 Block.', effects: [{ type: 'block', amount: 10 }],
  }),
  secondWind: card({
    id: 'second-wind', name: 'Second Wind', cost: 1, tags: ['skill'], animationClass: 'defensive', rarity: 'uncommon',
    description: 'Heal 5. Draw 1.', effects: [{ type: 'heal', amount: 5 }, { type: 'draw', amount: 1 }],
  }),
  allIn: card({
    id: 'all-in', name: 'All In', cost: 2, tags: ['risk', 'score'], animationClass: 'magical', rarity: 'rare',
    description: 'Gain +0.75x multiplier. Enemy gains +3 damage this fight.',
    effects: [{ type: 'multiplier', amount: 0.75 }, { type: 'enemyStrength', amount: 3 }],
  }),
  chainReaction: card({
    id: 'chain-reaction', name: 'Chain Reaction', cost: 1, tags: ['attack', 'score'], animationClass: 'melee', rarity: 'uncommon',
    description: 'Deal 4 + current Combo damage. Build 1 Combo.', comboGain: 1,
    effects: [{ type: 'damagePerCombo', base: 4, amount: 1 }],
  }),
  adrenaline: card({
    id: 'adrenaline', name: 'Adrenaline', cost: 0, tags: ['skill'], animationClass: 'defensive', rarity: 'uncommon',
    description: 'Gain 1 Energy. Draw 1. Lose 1 HP.',
    effects: [{ type: 'energy', amount: 1 }, { type: 'draw', amount: 1 }, { type: 'selfDamage', amount: 1 }],
  }),
  jackpot: card({
    id: 'jackpot', name: 'Jackpot', cost: 2, tags: ['score'], animationClass: 'magical', rarity: 'rare',
    description: 'Gain 900 score if Combo is 6 or higher.',
    effects: [{ type: 'conditionalScore', comboAtLeast: 6, amount: 900 }],
  }),
  precision: card({
    id: 'precision', name: 'Precision', cost: 1, tags: ['attack', 'score'], animationClass: 'melee',
    description: 'Deal 7. Gain 150 score if the hit leaves the enemy at 5 HP or less.', comboGain: 1,
    effects: [{ type: 'damage', amount: 7, lowHpScore: 150, lowHpThreshold: 5 }],
  }),
  vault: card({
    id: 'vault', name: 'Vault', cost: 1, tags: ['skill', 'score'], animationClass: 'defensive', rarity: 'uncommon',
    description: 'Gain 4 Block, draw 1, and gain 80 score.',
    effects: [{ type: 'block', amount: 4 }, { type: 'draw', amount: 1 }, { type: 'score', amount: 80 }],
  }),
  berserk: card({
    id: 'berserk', name: 'Berserk', cost: 1, tags: ['attack', 'risk'], animationClass: 'melee', rarity: 'uncommon',
    description: 'Lose 2 HP. Deal 5 twice. Build 2 Combo.', comboGain: 2,
    effects: [{ type: 'selfDamage', amount: 2 }, { type: 'damage', amount: 5, hits: 2 }],
  }),
  cleanFinish: card({
    id: 'clean-finish', name: 'Clean Finish', cost: 2, tags: ['attack', 'score'], animationClass: 'melee', rarity: 'rare',
    description: 'Deal 14. If this kills while undamaged this fight, gain 700 score.', comboGain: 1,
    effects: [{ type: 'damage', amount: 14, perfectKillScore: 700 }],
  }),
};

const CARD_BY_ID = Object.fromEntries(
  Object.values(CARD_LIBRARY).map((cardData) => [cardData.id, cardData]),
);

export function getCard(id) {
  return CARD_BY_ID[id];
}


const TARGETED_EFFECTS = new Set([
  'damage',
  'damagePerCombo',
  'damageFromBlock',
  'poison',
  'doublePoison',
  'scorePerPoison',
]);

export function cardNeedsEnemyTarget(card) {
  return Boolean(card?.effects?.some((effect) => TARGETED_EFFECTS.has(effect.type)));
}
