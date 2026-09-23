const FRAME_LIMIT = 60;

export const ANIMATION_CLASSES = Object.freeze(['magical', 'melee', 'defensive']);

const STATE_TIMING = Object.freeze({
  idle: { fps: 6, duration: 800, loop: true },
  magical: { fps: 12, duration: 620, loop: false },
  melee: { fps: 14, duration: 430, loop: false },
  defensive: { fps: 10, duration: 560, loop: false },
  attack: { fps: 12, duration: 480, loop: false },
  damage: { fps: 14, duration: 320, loop: false },
  death: { fps: 10, duration: 780, loop: false },
});

function framePath(group, id, state, frame) {
  if (group === 'characters') {
    return `./assets/characters/${id}/${state}/${frame}.png`;
  }
  if (group === 'character-effects') {
    return `./assets/characters/${id}/effects/${state}/${frame}.png`;
  }
  if (group === 'enemies') {
    return `./assets/enemies/${id}/${state}/${frame}.png`;
  }
  throw new Error(`Unknown animation group: ${group}`);
}

function loadImage(path) {
  if (typeof Image === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = path;
  });
}

export class AnimationDirector {
  constructor(root) {
    this.root = root;
    this.frameCache = new Map();
    this.timers = new Set();
    this.spriteTokens = new WeakMap();
  }

  reset() {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
  }

  later(callback, delay) {
    if (typeof window === 'undefined') return null;
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
    return timer;
  }

  async discoverFrames(group, id, state) {
    const key = `${group}:${id || 'shared'}:${state}`;
    if (this.frameCache.has(key)) return this.frameCache.get(key);

    const promise = (async () => {
      const frames = [];
      for (let frame = 1; frame <= FRAME_LIMIT; frame += 1) {
        const path = framePath(group, id, state, frame);
        if (!(await loadImage(path))) break;
        frames.push(path);
      }
      return frames;
    })();

    this.frameCache.set(key, promise);
    return promise;
  }

  bindCombatSprites() {
    if (!this.root?.querySelector) return;

    const character = this.root.querySelector('[data-character-sprite]');
    if (character) {
      this.playSprite(character, 'characters', character.dataset.characterSprite, 'idle', { loop: true });
    }

    for (const enemy of this.root.querySelectorAll('[data-enemy-sprite]')) {
      this.playSprite(enemy, 'enemies', enemy.dataset.enemySprite, 'idle', { loop: true });
    }
  }

  playEvents(events = []) {
    let delay = 0;
    for (const event of events) {
      this.later(() => this.playEvent(event), delay);
      delay += event.type === 'enemyAttack' ? 170 : 90;
    }
  }

  playEvent(event) {
    if (!event || !this.root?.querySelector) return;

    if (event.type === 'cardPlay') {
      const player = this.root.querySelector('[data-character-sprite]');
      if (player) {
        this.playSprite(player, 'characters', event.characterId, event.animationClass);
      }
      this.playCardEffect(event);
      return;
    }

    if (event.type === 'enemyAttack') {
      const enemy = this.root.querySelector(`[data-enemy-instance="${event.instanceId}"] [data-enemy-sprite]`);
      if (enemy) this.playSprite(enemy, 'enemies', event.enemyId, 'attack', { resumeState: 'idle' });
      return;
    }

    if (['enemyDamage', 'enemyHit', 'enemyDeath'].includes(event.type)) {
      const enemy = this.root.querySelector(`[data-enemy-instance="${event.instanceId}"] [data-enemy-sprite]`);
      if (enemy) {
        this.playSprite(
          enemy,
          'enemies',
          event.enemyId,
          event.type === 'enemyDeath' ? 'death' : 'damage',
        );
      }
      return;
    }

    if (['playerDamage', 'playerHit', 'playerDeath'].includes(event.type)) {
      const player = this.root.querySelector('[data-character-sprite]');
      if (player) {
        this.playSprite(
          player,
          'characters',
          event.characterId,
          event.type === 'playerDeath' ? 'death' : 'damage',
        );
      }
    }
  }

  playCardEffect(event) {
    const layer = this.root.querySelector('[data-card-effect-layer]');
    if (!layer) return;

    const effect = document.createElement('div');
    effect.className = `card-play-fx card-play-fx--${event.animationClass}`;

    const target = Number.isInteger(event.targetIndex)
      ? this.root.querySelector(`[data-enemy-index="${event.targetIndex}"]`)
      : null;

    if (target) {
      const targetRect = target.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      effect.style.left = `${targetRect.left - layerRect.left + targetRect.width / 2}px`;
      effect.style.top = `${targetRect.top - layerRect.top + targetRect.height / 2}px`;
    } else {
      effect.style.left = event.animationClass === 'defensive' ? '24%' : '50%';
      effect.style.top = event.animationClass === 'defensive' ? '62%' : '48%';
    }

    effect.innerHTML = '<img data-effect-frame alt="" draggable="false">';
    layer.append(effect);
    this.playEffectFrames(effect, event.characterId, event.animationClass);
    this.later(() => effect.remove(), 760);
  }

  async playEffectFrames(effect, characterId, animationClass) {
    const frames = await this.discoverFrames('character-effects', characterId, animationClass);
    if (!frames.length || !effect.isConnected) return;

    const image = effect.querySelector('[data-effect-frame]');
    if (!image) return;
    effect.classList.add('has-frame-animation');

    const timing = STATE_TIMING[animationClass] || STATE_TIMING.magical;
    const frameMs = 1000 / timing.fps;
    frames.forEach((path, index) => {
      this.later(() => {
        if (image.isConnected) image.src = path;
      }, index * frameMs);
    });
  }

  async playSprite(element, group, id, state, overrides = {}) {
    if (!element || !id || !state) return;

    const token = Symbol(state);
    this.spriteTokens.set(element, token);
    const { resumeState = null, ...timingOverrides } = overrides;
    const timing = { ...(STATE_TIMING[state] || STATE_TIMING.idle), ...timingOverrides };
    const stateClass = `anim-state--${state}`;

    for (const className of [...element.classList]) {
      if (className.startsWith('anim-state--') && className !== 'anim-state--idle') {
        element.classList.remove(className);
      }
    }
    element.classList.add(stateClass);

    const frames = await this.discoverFrames(group, id, state);
    if (this.spriteTokens.get(element) !== token || !element.isConnected) return;

    if (!frames.length) {
      if (!timing.loop) {
        this.later(() => {
          if (element.isConnected) element.classList.remove(stateClass);
        }, timing.duration);
      }
      return;
    }

    const image = element.querySelector('[data-animation-frame]');
    if (!image) return;

    element.classList.add('has-frame-animation');
    image.hidden = false;
    const frameMs = 1000 / timing.fps;
    const startedAt = performance.now();

    const step = () => {
      if (this.spriteTokens.get(element) !== token || !element.isConnected) return;

      const elapsed = performance.now() - startedAt;
      const frameIndex = Math.floor(elapsed / frameMs);
      if (!timing.loop && frameIndex >= frames.length) {
        image.hidden = true;
        element.classList.remove('has-frame-animation', stateClass);
        if (resumeState && this.spriteTokens.get(element) === token) {
          this.playSprite(element, group, id, resumeState, { loop: true });
        }
        return;
      }

      image.src = frames[frameIndex % frames.length];
      this.later(step, frameMs);
    };

    step();
  }
}

export function animationFramePath(group, id, state, frame = 1) {
  return framePath(group, id, state, frame);
}
