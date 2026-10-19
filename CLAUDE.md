# dotori-isle — 작업 규칙

기능 설명은 [README.md](README.md) 에 있습니다. 이 파일은 저장소를 고칠 때 지킬 규칙만 적습니다.

## 공개 저장소 — main push 가 곧 배포

- 원격 `gook-lab/dotori-isle` 은 공개 저장소입니다. Vercel 이 git 에 연결되어 있어 `main` 에 push 하면 https://dotori-isle.vercel.app 에 바로 배포됩니다.
- push 는 사용자 확인을 받은 뒤에만 합니다. 인증은 메모리 `gook-lab-push-auth` 의 토큰 URL 방식을 씁니다. `origin` 에는 토큰 없는 주소만 둡니다.
- 커밋 작성자는 저장소 로컬 git 설정(gook-lab noreply)을 그대로 씁니다. 회사 이메일을 붙이지 않습니다.
- 로컬 브랜치 `archive/private-history` 는 공개 전 기록입니다. 원작 캐릭터 이름과 회사 이메일이 남아 있어 push 하지 않습니다.

## 캐릭터와 이름 — 직접 만든 것만

- 다른 작품의 캐릭터 이름·생김새·고유 말버릇·상호를 넣지 않습니다.
- 꼬마 주민 여섯은 솜이·소다·유자·보리·마로·코코(id `somi`·`soda`·`yuja`·`bori`·`maro`·`coco`)입니다.

## 저장 호환 — 주민 id 이행

- 주민 id 를 바꾸면 `src/core/villagerIds.ts` 의 `LEGACY_VILLAGER_IDS` 에 옛 id → 새 id 를 더합니다. `loadSave` 와 `mergeSave` 가 둘 다 이 함수를 거칩니다(같은 버전 저장은 migrate 를 건너뛰기 때문입니다).
- id 를 바꾸면 id 해시로 정해지는 결과(상점 손님, 생일 등)도 바뀝니다. 테스트는 특정 해시 결과가 아니라 불변식을 확인하게 씁니다.
- 저장 버전과 백업 규칙은 README 의 '저장 이행 안전장치 — 버전 29 · 실패 때 백업 키 · 최근 세 개' 절을 따릅니다.

## 화면 확인 — 헤드리스 WebGL

README 의 '브라우저 확인 — 헤드리스 WebGL' 절과 메모리 `headless-webgl-swiftshader` 를 따릅니다. README 캡처(`docs/screenshots/`)는 HUD 를 CSS 로 숨기고 찍습니다.
