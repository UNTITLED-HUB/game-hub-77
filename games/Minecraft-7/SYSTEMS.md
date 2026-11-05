# Minecraft Mini 시스템 편집

`game.js`는 배포용 묶음입니다. 기능 수정은 아래 원본 파일에서 하고 `node build-game.mjs`로 다시 생성하세요. 외부 패키지 설치가 필요하지 않습니다. 원본은 순서가 있는 공유 스코프 방식이며 개별 파일을 브라우저에서 직접 실행하지 않습니다.

| 파일 | 담당 |
|---|---|
| core.js | 높이·좌표·난수·노이즈 |
| item.js | 블록·아이템·갑옷·네더라이트·제작·화로 |
| texture.js | 텍스처 등록·이미지 시트·아이콘 |
| world.js | 차원·지형·마을 부지·요새·포탈·빛·유체·저장 인코딩 |
| renderer.js | 청크 메시·물/용암 투명도·셰이더 |
| entity.js | 충돌·드롭·화살·갑옷 방어·폭발 |
| mob.js | 몹 등록·생성·AI·모델·불덩이 |
| player.js | 플레이어·공격·채굴·사용·이동·생존 |
| ui.js | 인벤토리·메뉴·치트 토글·설정 |
| command.js | 명령어·선택자·실행 컨텍스트·상태 효과 |
| touch.js | 모바일 조작·배치 편집 |
| runtime.js | 저장·청크 스트리밍·루프·3인칭·갑옷 착용·입력 |

```sh
node build-game.mjs
node build-game.mjs --check
node test-world.cjs game.js
node test-command.cjs game.js
```

## 치트와 명령어

새 월드의 월드 탭에서 치트를 켭니다. 기존 월드는 일시정지 메뉴의 치트 허용 버튼으로 변경합니다. `/help`는 실제 지원하는 명령 목록을 출력합니다. 영문 아이템 식별자, `minecraft:` 접두사, 한국어 이름, 숫자 ID를 사용할 수 있습니다.

```text
/give @s netherite_sword 1
/give @s netherite_chestplate 1
/effect give @s night_vision 300 0
/effect clear @s
/execute as @e[type=pig] at @s run setblock ~ ~-1 ~ stone
/execute if block ~ ~-1 ~ grass_block run give @s diamond 1
/summon ghast ~ ~8 ~
/fill ~-2 ~-1 ~-2 ~2 ~-1 ~2 stone
/gamerule keepInventory true
/locate structure fortress
```

지원 대상: `@s`, `@p`, `@a`, `@r`, `@e`; 조건: type, tag, distance, limit, sort=nearest. 싱글플레이이므로 플레이어는 한 명입니다. 상대좌표 `~`를 지원하며 `^` 로컬 좌표는 지원하지 않습니다.

`execute`는 as, at, positioned, if/unless entity, if/unless block, run과 현재 차원의 in을 지원합니다. 다른 차원에 원격 실행하지 않습니다. fill/clone은 32768블록 한도입니다. 인벤토리 대상 명령은 플레이어만 지원합니다. enchant는 sharpness/efficiency/unbreaking/protection을 지원합니다. 원작의 서버 관리·NBT·데이터팩·모든 execute 문법을 지원하는 것은 아닙니다. 미지원 명령이나 조건은 오류를 표시합니다.

## 콘텐츠

갑옷 6재질(가죽·금·철·다이아몬드·사슬·네더라이트), 재질별 4부위 착용 텍스처. 투구는 앞면을 막는 한 장의 상자가 아닌 왕관·뒤·옆 부분으로 구성합니다. 아이콘은 CSS에서 정사각형과 object-fit:contain을 고정합니다.

네더라이트: 고대 잔해를 화로에서 조각으로 만들고 조각 4개+금 4개로 주괴를 제작합니다. 다이아몬드 장비+주괴의 간소화 조합으로 업그레이드합니다. 도구 내구도 2031, 갑옷 강인함 3과 부위별 밀치기 저항을 적용합니다.

방패는 사용 버튼으로 전방 공격을 줄입니다. 겉날개는 흉갑 슬롯에 장착하고 공중에서 점프 버튼을 누르는 동안 간소화 활공을 합니다. 불사의 토템은 손/왼손에 들었을 때 치명적 피해에서 한 번 구합니다. 치유·신속·화염 저항 물약을 사용할 수 있고 빈 유리병이 돌아옵니다. 엔드 유적 상자에서 겉날개와 토템을 얻습니다.

추가 몹: 가스트·호글린·조글린·스트라이더·피글린 야수·엔더 드래곤·좀벌레·엔더마이트. 생성 알과 summon을 지원하며 네더 몹은 자연 생성 목록에 포함됩니다. 드래곤과 가스트에는 비행과 폭발성 발사체가 있습니다. 보스 전투, 주민 거래, AI와 구조물은 원작을 전부 복제한 것이 아닌 간소화 구현입니다.

생성 방식 변경은 새로 생성된 지형에 적용됩니다. 지형·플레이어 변경 기록은 유지합니다. 오래된 월드에서는 경계가 어색할 수 있어 새 월드에서 전체 배치를 확인하는 것이 좋습니다.

## 검증 범위

Node VM 검사로 명령 실행·치트·효과·저장·좌표·포탈·청크 메시·조명·유체 반응을 확인합니다. 이 환경의 클라우드 브라우저는 WebGL을 사용할 수 없어 실제 GPU 화면과 모바일 기기 조작은 검증하지 못했습니다.
