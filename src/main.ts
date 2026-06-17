const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('#app element not found');
}

app.innerHTML = `
  <main class="game-placeholder">
    <p>ElvenBattle 게임 부트스트랩이 여기에 들어갑니다.</p>
    <p>카드 텍스트 툴은 <code>/tools/card-text/</code>에서 열 수 있습니다.</p>
  </main>
`;
