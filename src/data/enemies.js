const ENEMY_ANIMATIONS = Object.freeze({
  idle: { loop: true },
  attack: { loop: false },
  hit: { loop: false },
  death: { loop: false },
});

const enemy = (config) => ({ art: null, animations: ENEMY_ANIMATIONS, elite: false, boss: false, scaling: 0, ...config });

export const ENEMIES = {
  scrapper: enemy({ id: 'scrapper', name: 'Scrapper', hp: 26, damage: 6, reward: 220, tagline: 'Quick, mean, disposable.' }),
  bulwark: enemy({ id: 'bulwark', name: 'Bulwark', hp: 36, damage: 5, reward: 280, tagline: 'A thick target for greedy overkill setups.' }),
  berserker: enemy({ id: 'berserker', name: 'Berserker', hp: 30, damage: 5, scaling: 2, reward: 300, tagline: 'Gets stronger every turn.' }),
  parasite: enemy({ id: 'parasite', name: 'Score Leech', hp: 25, damage: 5, reward: 320, trait: 'drain', tagline: 'Landing damage also drains your multiplier.' }),
  bomber: enemy({ id: 'bomber', name: 'Bomber', hp: 24, damage: 4, reward: 340, trait: 'burst', burstTurn: 3, burstBonus: 9, tagline: 'Turn three hurts. A lot.' }),
  enforcer: enemy({ id: 'enforcer', name: 'Enforcer', hp: 48, damage: 8, scaling: 1, reward: 520, elite: true, tagline: 'An elite score pinata with teeth.' }),
  collector: enemy({ id: 'collector', name: 'Collector', hp: 44, damage: 7, reward: 560, elite: true, trait: 'drain', tagline: 'Hits your HP and your multiplier.' }),
  auditor: enemy({ id: 'auditor', name: 'The Auditor', hp: 100, damage: 8, scaling: 1, reward: 1600, boss: true, tagline: 'A recurring audit. Survive it and keep climbing.' }),
};

export const NORMAL_ENEMIES = ['scrapper', 'bulwark', 'berserker', 'parasite', 'bomber'];
export const ELITE_ENEMIES = ['enforcer', 'collector'];
export const BOSS_ID = 'auditor';
