# GAME HUB

한국어 정적 미니게임 허브입니다. `index.html`에 허브 UI·검색·즐겨찾기·설정·실행/정리 로더가 들어 있고, 게임은 각 폴더에서 실행할 때만 불러옵니다. 플레이 가능한 게임은 Minecraft Mini, Geometry Dash Mini, Tetris입니다.

## 구조

```text
index.html
games/
  Minecraft-7/
    launcher.js
    README.md
    game.js
    textures/blocks.png
    textures/items.png
  Geometry-Dash-8/
    launcher.js
    README.md
    game.js
  Tetris-2/
    launcher.js
    README.md
    game.js
```

## 새 게임 추가

1. `games/<영문이름>-<번호>/` 폴더를 만들고 `launcher.js`, `README.md`, 게임 스크립트와 필요한 에셋을 둡니다.
2. launcher는 게임 코드를 동적으로 불러온 뒤 `window.GameHub.launcherReady()`를 호출해야 합니다. 현재 예시는 같은 폴더의 `game.js`를 로드합니다.
3. `index.html`의 `games` 배열에 `id`, 이름, 설명, `file: 'games/<영문이름>-<번호>/launcher.js'`, `readme: 'games/<영문이름>-<번호>/README.md'`, 장르, `status: 'ready'`를 등록합니다. 중복 ID, 중복 경로, 잘못된 폴더명은 제외됩니다.
4. 게임 스크립트는 `window.GameHub.registerGame({id, mount(container, context), unmount(), pause(), resume(), setMuted()})` 규약을 사용합니다. 폴더명 끝의 번호와 게임 ID가 같아야 합니다.

게임 목록은 정적 호스팅에서 폴더를 자동 검색할 수 없으므로 명시적으로 등록합니다. 준비 중 항목에는 실행 가능한 파일이 있다고 표시하지 않습니다. 설명서는 `README.md`에서 불러오며 허브가 제목, 문단, 목록을 안전하게 표시합니다.

## Minecraft 텍스처

새로 생성한 `textures/blocks.png`는 게임의 60개 블록 아이콘(8×8 시트), `textures/items.png`는 광물·음식·양동이·20종 도구를 포함한 40개 아이템 아이콘(8×8 시트)입니다. 생존·크리에이티브 인벤토리, 핫바, 제작 목록의 모든 등록 아이콘에 연결했습니다. 3D 월드 표면과 몹은 기존 내장 절차형 픽셀 텍스처로 계속 렌더링합니다.

## 실행과 배포

`index.html`을 열면 허브를 볼 수 있습니다. 게임과 README 로딩은 HTTP(S) 정적 호스팅에서 확인하세요. GitHub Pages는 Settings → Pages → Deploy from a branch → `main` → `/(root)`를 사용합니다. Cloudflare Pages는 프레임워크 없음, 빌드 명령 없음, 출력 폴더 `/`로 배포합니다.

각 게임은 별도 sandbox iframe에서 실행됩니다. 게임 종료 시 프레임을 폐기해 이벤트, 타이머, RAF, 오디오 등 실행 문서 리소스를 정리합니다. 신뢰하는 자체 게임 코드만 등록하세요.
