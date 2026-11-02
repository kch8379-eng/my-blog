# Build 서브에이전트 지침: 픽셀 아트 에디터

## 역할
승인된 계획서 `apps/pixel-art/spec.md`대로 픽셀 아트 에디터 웹앱을 **구현**한다.

## 수정 허용 범위 (이 범위만 수정한다)
새로 만들 파일은 정확히 아래 다섯 개다.
- `apps/pixel-art/index.html`
- `apps/pixel-art/style.css`
- `apps/pixel-art/editor.js`
- `apps/pixel-art/export.js`
- `apps/pixel-art/main.js`

그 밖의 모든 파일은 읽기만 한다. 특히 아래는 수정하거나 지우지 않는다.
- 블로그 파일: `index.html`(루트), `post.html`, `css/`, `js/`, `posts/`, `images/`
- `CLAUDE.md`, `.claude/`, `apps/2048/` 전체, `apps/pixel-art/spec.md`, `apps/pixel-art/agent-*.md`
- `apps/pixel-art/review.md`는 만들지 않는다 (Review 단계에서 다른 에이전트가 쓴다).

## 하지 않을 것
- 서버를 시작하지 않는다. 브라우저 검증은 Review 단계에서 한다.
- git 명령을 실행하지 않는다.
- 파일을 삭제하지 않는다.
- 외부 라이브러리, CDN, 웹 폰트를 쓰지 않는다.

## 먼저 읽을 것
- `apps/pixel-art/spec.md` (전체. 특히 확정된 결정, 2~8장)
- `CLAUDE.md` (웹앱 규칙)
- `apps/2048/index.html`, `apps/2048/style.css`, `apps/2048/main.js`, `apps/2048/review.md` (같은 사이클로 만든 앱. 테마 초기화, `?preview` 모드, 색상 변수 구조, 리뷰에서 나온 교훈을 따른다)

## 확정된 결정 (spec.md 상단과 같음)
1. PNG 출력 크기는 512×512 고정이다.
2. PNG 배경은 투명 고정이다.
3. 모두 지우기는 확인창 없이 즉시 지우고, 되돌리기로 복구할 수 있다.
4. 진행 중인 그림 자동 저장을 포함한다(`localStorage` 키 `pixel-art:draft`). 불러올 때 형식을 검증하고, 잘못된 값이면 빈 그림으로 시작한다. 저장소 접근 실패는 `try/catch`로 무시한다.
5. 키보드로 칸을 그리는 기능은 만들지 않는다. 도구, 팔레트, 저장, 되돌리기 등 모든 버튼은 키보드(탭, Enter, Space)로 조작할 수 있어야 한다.
6. 블로그 카드용 `?preview` 모드를 구현한다. 헤더·도구·팔레트·저장 영역을 숨기고 캔버스와 고정된 예시 그림만 보여 주며, 입력과 `localStorage`를 읽지도 쓰지도 않는다.
7. 격자는 16×16 고정이다.

## 구현 요구사항
- spec.md의 기능 목록(P0 → P1 → P2 → P3 순서), 그리기 동작, 팔레트, PNG 저장, 화면 설계, 핵심 로직 설계를 따른다.
- `editor.js`는 DOM에 접근하지 않고 아무것도 가져오지 않는 순수 로직이다. `export.js`는 데이터에서 PNG Blob을 만든다. `main.js`가 화면, 입력(Pointer Events), 자동 저장, 다운로드 실행을 맡는다. 의존 방향은 `main.js` → `editor.js`, `export.js` 한 방향이다.
- 세 파일은 ES 모듈로 연결하고 전역 변수를 만들지 않는다.
- PNG는 화면 캔버스를 복사하지 않고, 별도 오프스크린 캔버스에 칸마다 `fillRect`로 칠해 만들어 도트가 흐려지지 않게 한다. 저장 파일의 크기는 512×512, 배경은 투명이다.
- 그리는 중 빠르게 움직여도 칸이 빠지지 않도록 직전 칸에서 현재 칸까지 직선으로 칠한다. 캔버스에는 `touch-action: none`을 주고 포인터 캡처를 쓴다.
- 접근성: 점수가 아닌 상태 변화(예: 저장 완료, 되돌리기)는 `aria-live="polite"` 영역으로 알린다. 도구와 팔레트는 실제 `<button>`이고 선택 상태는 `aria-pressed` 또는 `aria-checked`로 표시한다. **`role="img"` 요소 안에 버튼 같은 조작 요소를 넣지 않는다.**
- 모바일: viewport 메타 필수, 375px 폭에서 가로 스크롤 없음, 터치 대상 44×44px 이상(팔레트 색 칸 포함), 본문 글자 16px 이상.
- 테마: `<head>`에서 CSS보다 먼저 실행하는 인라인 스크립트로 `localStorage['theme']`(`light`/`dark`)를 읽어 `<html data-theme>`에 적용하고, 값이 없으면 `prefers-color-scheme`을 따른다. 블로그의 `css/theme.css`는 참조하지 않고 같은 변수를 `style.css`에 복제한다. 사용자가 그린 그림의 색과 캔버스 바탕(체크무늬)은 테마와 무관한 고정 값이다.
- 앱 상단에 "← 블로그" 링크(`../../index.html`)를 둔다.
- `innerHTML`을 쓰지 않는다(`textContent`, `replaceChildren` 사용).
- 코딩 규칙: 공백 2칸, 세미콜론, 작은따옴표, 클래스 `kebab-case`, 변수·함수 `camelCase`, 주석은 한국어, 식별자는 영어.

## 완료 전 자체 점검 (실행 없이 코드를 다시 읽어서 확인)
- 직선 칠하기가 가로, 세로, 대각선, 한 칸짜리 선, 격자 밖에서 들어오는 선에서 올바른 칸 목록을 돌려주는지
- 같은 칸을 같은 색으로 다시 칠해도 되돌리기 기록이 쌓이지 않는지
- 되돌리기와 다시 실행이 획 단위로 동작하고, 새 획을 그리면 다시 실행 기록이 지워지는지
- 자동 저장 불러오기에서 길이가 256이 아니거나 형식이 잘못된 값을 걸러내는지
- PNG 출력이 512×512이고 투명 칸이 투명으로 남는지
- 스크립트·스타일·링크 경로가 `apps/pixel-art/` 기준으로 올바른지

## 마지막 보고
만든 파일 목록, spec.md와 달라진 점(있다면 이유와 함께), 구현하지 못한 항목을 한국어로 간결하게 적는다.
