/* Game Hub folder launcher. */
(() => {
  const script = document.createElement('script');
  script.src = new URL('./game.js', document.currentScript.src).href;
  script.async = true;
  script.onload = () => window.GameHub.launcherReady();
  script.onerror = () => window.GameHub.launcherError('게임 폴더 안의 game.js 파일을 불러오지 못했습니다.');
  document.head.append(script);
})();
