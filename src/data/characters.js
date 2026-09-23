export const CHARACTERS = {
  viper: {
    id: 'viper',
    name: 'Viper',
    archetype: 'Poison',
    maxHp: 44,
    art: null,
    description: 'Stack Poison, let it tick before enemies act, then cash in on long fights.',
    startingDeck: ['toxic-cut', 'toxic-cut', 'toxic-cut', 'envenom', 'envenom', 'quick-stab', 'evade', 'catalyst'],
    rewardPool: ['venom-bloom', 'toxic-payoff', 'precision', 'adrenaline', 'execution', 'momentum', 'redline', 'second-wind', 'jackpot', 'chain-reaction'],
  },
  bastion: {
    id: 'bastion',
    name: 'Bastion',
    archetype: 'Block',
    maxHp: 58,
    art: null,
    description: 'Build heavy Block, turn defense into damage, and outlast escalating enemy pressure.',
    startingDeck: ['shield-strike', 'shield-strike', 'shield-strike', 'fortify', 'fortify', 'shield-bash', 'brace', 'cashin'],
    rewardPool: ['iron-wall', 'counterweight', 'insurance', 'vault', 'uppercut', 'momentum', 'second-wind', 'clean-finish', 'jackpot', 'all-in'],
  },
};

export const DEFAULT_CHARACTER_ID = 'viper';

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS[DEFAULT_CHARACTER_ID];
}
