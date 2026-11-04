# GAME HUB

설치와 빌드 없이 실행하는 한국어 미니게임 허브입니다. HTML, CSS, JavaScript는 `index.html` 하나에 들어 있습니다. **Minecraft Mini, Geometry Dash Mini, Tetris** 세 게임을 바로 실행할 수 있습니다. 나머지 예시 카드는 준비 중입니다. 원작의 핵심 플레이를 참고한 독립 미니 구현이며 공식 게임이나 완전판이 아닙니다. 외부 텍스처·음원·라이브러리를 사용하지 않습니다.

## 파일 구조

```
index.html
README.md
games/
  minecraft_7.js
  geometrydash_8.js
  tetris_2.js
```

각 게임은 독립적인 JavaScript 파일이며 실행할 때만 로드합니다.

## 실행과 배포

UI는 index.html을 열어 확인할 수 있습니다. 게임 스크립트의 안정적인 로딩은 HTTP(S) 정적 호스팅에서 확인하세요. 로컬 테스트에는 `python3 -m http.server 8000` 후 http://localhost:8000 을 사용할 수 있습니다. Node.js나 빌드 과정은 필요 없습니다.

GitHub Pages: Settings → Pages → Deploy from a branch → main → /(root) → Save.
Cloudflare Pages: 저장소 연결 후 프레임워크 없음, 빌드 명령 없음, 출력 디렉터리를 저장소 루트로 지정합니다.

## 게임 추가: 두 단계

1. `games/snake_1.js`처럼 영문 소문자 식별자와 고유 정수 ID를 사용해 신뢰할 수 있는 자체 게임 파일을 추가합니다.
2. index.html의 `games` 배열에 등록하고 `status: 'ready'`로 설정합니다. 기존 예시를 완성했다면 해당 항목을 수정합니다.

필수 메타데이터: id, name, file, description, category, status. 선택: featured, addedAt(YYYY-MM-DD), controls, glyph, tone, ink.
`category`는 Arcade, Puzzle, Casual, Sandbox을 기본 지원합니다. 새 장르 필터는 HTML에 data-category 버튼을 추가하세요. 썸네일은 현재 CSS/문자 아트이며 외부 이미지나 CDN이 필요 없습니다.
중복 ID, 중복 경로, 파일 이름의 ID 불일치, 외부 URL 및 상위 경로는 목록에서 제외됩니다. 파일 존재 여부를 자동으로 탐색하지 않으며 `ready` 파일이 누락되면 실행 화면에서 오류를 안전하게 표시합니다.

## 게임 인터페이스

아래는 인터페이스 예시일 뿐 제공된 실행 게임이 아닙니다.

```javascript
window.GameHub.registerGame({
  id: 1,
  async mount(container, context) {
    // DOM/Canvas를 container 안에 만들고 초기화 완료 후 반환합니다.
    // context.muted를 오디오를 재생하기 전부터 적용하세요.
    context.on(window, 'keydown', event => {
      // 필요한 키에만 preventDefault(); 허브와 별도 프레임에서 실행됩니다.
    });
    context.onCleanup(() => { /* 추가 리소스 해제 */ });
  },
  async unmount() { /* 오디오, WebSocket, Worker 등 명시적으로 정리 */ },
  async pause() { /* 게임 루프 및 오디오 정지 */ },
  async resume() { /* 게임 루프 재개 */ },
  async setMuted(muted) { /* 모든 오디오에 적용 */ }
});
```

- registerGame은 스크립트의 최상위 실행에서 정확히 한 번 호출합니다. 비동기 등록은 지원하지 않습니다.
- id는 메타데이터와 일치해야 합니다. mount와 unmount는 필수이며 Promise를 반환할 수 있습니다.
- pause/resume는 함께 구현합니다. 없는 경우 허브 버튼은 비활성화됩니다.
- setMuted가 없는 게임은 음소거 버튼이 비활성화됩니다. 오디오가 있는 게임은 반드시 구현하세요.
- mount의 container는 프레임의 전체 영역입니다. ResizeObserver나 상대 크기로 화면 변화에 대응하세요.
- 포인터/터치 이벤트와 키보드는 게임이 구현해야 합니다. 허브는 포커스 가능한 격리 실행 영역을 제공합니다.
- 별도 iframe의 window.GameHub를 사용합니다. 부모 페이지의 전역 객체에 접근하지 마세요.

### context

| API | 계약 |
| --- | --- |
| signal | unmount 시작 시 중단되는 AbortSignal. fetch 등에 연결 |
| muted | 시작/변경 시 음소거 상태 |
| on(target,type,callback,options) | 리스너 등록 및 종료 시 제거; 감싼 callback 반환 |
| timeout(callback,ms) | 정리 가능한 setTimeout, ID 반환 |
| interval(callback,ms) | 정리 가능한 setInterval, ID 반환 |
| raf(callback) | 일회성 requestAnimationFrame, ID 반환 |
| onCleanup(callback) | 종료 시 역순으로 실행할 정리 함수 등록 |
| reportError(error) | 비동기/이벤트 오류를 허브 오류 화면에 전달 |

### 수명주기와 오류 처리

실행마다 sandbox="allow-scripts allow-pointer-lock" iframe을 새로 생성합니다. 같은 게임의 중복 시작은 무시하며 이전 프레임을 제거한 뒤 다음 게임을 실행합니다. 메시지는 프레임의 source와 실행 세션 번호를 모두 확인합니다. 게임 파일은 해당 실행에 한 번만 로드됩니다. 재시작은 새 프레임에서 다시 로드하며 브라우저 HTTP 캐시를 사용할 수 있습니다.

파일 로드, 등록, 초기화에 15초 제한이 있고 제어 응답에는 8초 제한이 있습니다. 종료는 unmount 완료를 기다리되 1.5초 후 프레임을 강제 제거합니다. 프레임 제거는 해당 문서의 이벤트/타이머/애니메이션을 함께 제거합니다. 오류 발생 시 프레임을 폐기하고 재시도/복귀 UI를 표시합니다. 최근 기록은 mount 성공 후에만 저장합니다.

sandbox 프레임은 opaque origin이므로 게임 내부의 localStorage 및 부모 DOM 접근은 허용되지 않습니다. 게임의 fetch는 대상 서버 CORS 정책을 따라야 합니다. 게임의 무한 동기 루프처럼 브라우저 메인 스레드를 막는 코드는 iframe만으로 보호할 수 없습니다. 검토한 자체 코드만 등록하세요. Worker나 네트워크 연결 등은 unmount에서 명시적으로 종료하세요.

## 저장 및 접근성

`gamehub.v1` 키 하나에 테마, 애니메이션 감소, 기본 음소거, 즐겨찾기, 최근 10개 게임을 저장합니다. 저장 불가/손상 시 기본값으로 작동합니다. 초기화는 허브 데이터만 바꾸며 다른 앱의 저장 데이터를 지우지 않습니다. 인기 통계는 생성하지 않고 추천순으로 대체한다고 안내합니다.

키보드 포커스, 버튼 레이블, 즐겨찾기 aria-pressed, 검색 결과/오류 상태 알림, 모달 설정, 시스템의 reduced-motion을 지원합니다. 전체화면 API가 없는 브라우저에서는 안내를 표시합니다.


## 플레이 가능한 게임 (2026-11-04)

| 게임 | 구현 범위 | PC 조작 | 모바일 조작 |
| --- | --- | --- | --- |
| Minecraft Mini | 40×40×24 블록 월드, 지형·나무, 1인칭 3D, 파괴·설치, 8종 무한 블록, 충돌·점프, 비행, 새 월드 | WASD/방향키 이동, 마우스 시점, 좌클릭/E 파괴, 우클릭/Q 설치, 1–8/휠 선택, Space 점프·상승, F 비행, Shift 하강, Ctrl 빠른 이동 | 방향 버튼, 화면 드래그 시점, 파괴·설치·점프·하강 버튼 |
| Geometry Dash Mini | 3개 고정 코스, 자동 이동, 회전 점프, 가시·단차·점프 패드, 진행률, 즉시 재도전, 연습 체크포인트, 자체 합성 리듬 | Space/↑/W 점프, 누르고 있으면 연속 점프, P 일시정지 | 게임 화면 누르기/누르고 있기 |
| Tetris | 7-bag, SRS 회전 보정, 홀드, 고스트, 다음 4개, 소프트·하드 드롭, 줄 삭제, 점수·레벨·잠금 지연 | ←→ 이동, ↑/X 회전, Z 반대 회전, ↓ 소프트 드롭, Space 하드 드롭, C/Shift 홀드, P 일시정지 | 하단 조작 버튼, 이동·하강 버튼 길게 누르기 |

게임의 시작 버튼을 눌러 플레이합니다. 허브 기본값은 음소거이며 허브 상단의 **소리 켜기**로 자체 합성 효과음/리듬을 들을 수 있습니다. 모든 게임이 허브의 일시정지·재개·재시작·음소거·종료 인터페이스를 구현합니다. 탭이 숨겨지면 플레이가 일시정지됩니다.

Minecraft Mini는 WebGL이 필요합니다. 데스크톱에서 시작 버튼을 누르면 마우스 잠금을 요청하며 Esc로 풀 수 있습니다. 마우스 잠금이 지원되지 않는 환경에서는 드래그 시점과 E/Q 편집을 사용할 수 있습니다. 월드 저장, 조합, 몬스터, 멀티플레이는 이 미니 버전에 포함되지 않습니다. 새 월드는 3초 이내 버튼을 두 번 눌러 생성합니다. 게임 종료/허브 재시작 시 월드와 게임 점수는 초기화됩니다. 즐겨찾기·허브 설정·최근 플레이만 지속 저장됩니다.

Geometry Dash의 코스별 최고 진행률과 Tetris의 최고 점수는 현재 실행 세션 동안만 유지됩니다. 연습 모드는 안전한 지상 구간에서 자동 체크포인트를 기록합니다. 원작 레벨·음원은 사용하지 않으며 자체 제작 코스와 합성 음원을 사용합니다.

## 검증

게임 등록/수명주기와 오류 처리, 테트리스 7-bag·홀드 제한·줄 삭제 점수·회전 보정, 대쉬 코스·점프·재시도·연습 체크포인트, 블록 지형·충돌·시작 위치·타깃 선택을 로컬 로직 테스트로 확인했습니다. 실제 모바일 기기의 성능과 모든 브라우저 조합은 별도 확인이 필요합니다.
