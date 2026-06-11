import './style.css';
import { mountPhaserGame } from './scenes';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

app.innerHTML = '';
mountPhaserGame(app);
