# 개발 노트 (새 채팅에서 이어서 작업할 때 참고)

이 폴더 전체가 프로젝트예요: `game.js`(게임 전체, 단일 파일), `README.md`(플레이어용 설명), `fonts/`, `textures/`, `harness.html`(로컬 테스트용 페이지).

## 구조 요약 (game.js)

- GAME HUB 플러그인: 파일 끝 `window.GameHub.registerGame({ id: 7, mount(container, ctx) … })`. `ctx`는 `on`, `timeout`, `setPaused`, `onCleanup`, `save`, `savedData`, `muted`, `reportError`를 제공.
- 순수 WebGL 1 렌더러. 청크 메시는 정점당 16바이트(위치 int16×4 / UV uint16×2 / 빛 uint8×4, 모든 속성 4바이트 정렬 — 모바일 GPU 호환 때문에 바꾸지 말 것). 셰이더의 빛 곡선 `cv()`는 NaN이 나지 않도록 clamp + pow 미사용.
- 텍스처는 512×512 아틀라스에 코드로 그림(`paintAll`). 캐릭터 스킨 타일(`pl_*`)은 `paintCharacter()`가 실행 중에 다시 그리고 GPU에 다시 올림.
- 주요 상태: `G`(게임: inv 36칸, `armor` 4칸, `off` 왼손, ui, mode…), `W`(월드: chunks, mobs, items, arrows, particles…), `P`(플레이어), `SAVE.settings`(설정).
- 손: `HSEL`(0 오른손/1 왼손)과 `held()`/`setHeld()`/`withHand()` — 사용·소모·내구도 함수는 HSEL 손에 적용. 사용은 `pickUseHand()`가 오른손 우선, 쓸 게 없으면 왼손.
- 전투: `attack()` / `attackStrength()` / `WEAPON_STATS` (원작 1.9+ 수치). 한 번 몹을 때린 누름 동안은 `P.mineLock`으로 블록 캐기 금지.
- 1인칭 손/아이템: `Pose`(3×4 행렬 스택)로 원작 변환식을 그대로 재현. 아이템은 1픽셀 두께 입체(`itemMesh`).
- 3인칭: `camView`(0/1/2), `drawPlayerModel()`.
- 인벤토리 터치: `screenEvents()` 안의 드래그 코드. 길게 누르기·두 번 탭은 이벤트 타임스탬프로 판정(느린 기기에서도 안정적).

## 지형 생성기 버전

저장 파일에는 플레이어가 바꾼 블록만 기록되고 지형은 매번 시드로 다시 만들어요. 그래서 생성기를 바꾸면 기존 월드가 망가지므로 월드마다 `gen`을 저장해요. `gen` 값이 없는 기존 월드는 `W.gen = 1`이 되어 `columnV1`/`generateChunkV1`(world.js)을 쓰고, `gen: 2`, `gen: 3` 월드는 `column2`/`generateChunk2`(terrain.js)를 써요. `gen: 3`(현재 새 월드)은 여기에 마을 부지 평탄화를 더한 버전이에요: 마을 중심 반경 58블록을 부지 평균 높이로 고르고 94블록까지 자연 지형과 섞으며, 그 안에서는 동굴·협곡이 지표를 뚫지 않아요(`villageFlat`, `caveTop2`). 마을 부지 판정은 평탄화 전 지형(`rawColumn`)으로 해요. `gen: 4`(현재 새 월드)는 오버월드는 3과 같고, 네더 요새에 방(fortress.js)과 잉걸꽃이 더해져요. 원점 요새는 네더 도착 공간·귀환 차원문과 겹치지 않도록 금고를 짓지 않아요. 지형이나 구조물 블록을 다시 바꿀 때는 `gen: 5`를 추가하고 이전 버전은 그대로 두세요. (상자 전리품 표는 상자가 처음 생성될 때 굴리므로 버전 없이 바꿔도 돼요.) 동굴·암석 3D 노이즈는 세계 고정 격자에서 4블록마다 샘플링해 보간하므로 어느 청크에서 계산해도 같아요. 나무는 줄기 칸의 값만으로 결정해서 청크 경계에서도 일치해요.

## 이 게임 고유 아이템 (extras.js)

아이템 ID는 500부터 `XI()` 호출 순서대로 붙어요. 저장 파일에 ID가 기록되므로 새 아이템은 항상 파일 끝에만 추가하고, 기존 항목의 순서를 바꾸거나 지우지 마세요. 블록 ID는 255(잉걸꽃)까지 모두 찼어요. 텍스처 아틀라스는 1024칸 중 937칸을 써요. 사용 동작은 `xUseItem`(player.js의 useItem에서 블록 상호작용 다음에 호출), 왼손 부적·자석은 `updateExtras`, 들고 있을 때 표시는 `XGADGET`(ui.js의 updateGadget)에서 처리해요. 단검(등 뒤 2배)과 전투 망치(밀치기 2배·주변 충격)는 player.js의 attack()에 있어요.

## 원작과 다르게 대체한 것

화살 재료 깃털 → 실, 나침반·시계의 레드스톤 → 석탄. 캐릭터 외형은 원작 캐릭터를 복제하지 않고 직접 디자인(체형만 클래식/슬림).

## 테스트 방법

`harness.html`을 정적 서버로 열면(예: 이 폴더에서 `python3 -m http.server`) 허브 없이 게임이 실행돼요. 헤드리스 크롬(Playwright, `--use-angle=swiftshader`)으로 스크린샷·터치(CDP `Input.dispatchTouchEvent`) 테스트를 했어요. 소프트웨어 렌더링은 매우 느려서 시간에 민감한 테스트는 `requestAnimationFrame` 프레임 수로 기다리거나 터치 이벤트에 timestamp를 직접 넣어야 정확해요.
