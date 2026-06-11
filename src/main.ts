import './style.css';
import { ENGINE_VERSION, RULE_VERSION } from './core';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root element.');
}

function renderBootScreen(root: HTMLDivElement): void {
  root.innerHTML = `
    <main class="shell">
      <section class="status-panel" aria-label="engine status">
        <p class="eyebrow">Phase 2</p>
        <h1>Elven Battle</h1>
        <dl>
          <div>
            <dt>Engine</dt>
            <dd>${ENGINE_VERSION}</dd>
          </div>
          <div>
            <dt>Rules</dt>
            <dd>${RULE_VERSION}</dd>
          </div>
        </dl>
      </section>
    </main>
  `;
}

// Phase 13 will attach the Phaser scene tree here. Rule-engine modules stay UI agnostic.
renderBootScreen(app);
