import { Game } from './game/game.js';
import { Renderer } from './ui/render.js';

const root = document.querySelector('#app');
const game = new Game();
const renderer = new Renderer(root, game);

game.subscribe((state) => renderer.render(state));
renderer.render(game.state);

setInterval(() => {
  game.tick();
  renderer.updateTimer();
}, 250);
