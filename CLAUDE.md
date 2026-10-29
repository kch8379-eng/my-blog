# my-blog

마크다운(`.md`) 파일을 읽어 블로그 웹사이트로 변환하는 프로젝트. 프레임워크 없이 순수 HTML, CSS, JavaScript만 사용한다.

> 현재 저장소는 비어 있는 상태이며, 아래 구조와 규칙은 앞으로 만들 코드의 기준이다. 구조를 바꾸면 이 문서도 함께 갱신한다.

## 기술 제약 (반드시 지킬 것)

- 프레임워크/라이브러리 금지: React, Vue, jQuery, Tailwind, Bootstrap 등을 쓰지 않는다.
- 마크다운 파서도 외부 패키지(marked, markdown-it 등)를 쓰지 않고 `js/markdown.js`에 직접 구현한다.
- 번들러, 트랜스파일러, 패키지 매니저 없이 동작해야 한다. `package.json`과 빌드 단계를 만들지 않는다.
- 바닐라 JS(ES 모듈, `fetch`, `async/await`)만 쓴다. 최신 브라우저 기준이며 IE는 지원하지 않는다.
- 웹 폰트나 CDN 등 외부 네트워크 의존을 피한다. 시스템 폰트 스택을 사용한다.

## 프로젝트 구조

```
my-blog/
├── index.html          # 글 목록 페이지
├── post.html           # 글 상세 페이지 (post.html?slug=파일이름)
├── css/
│   ├── style.css       # 레이아웃, 타이포그래피, 컴포넌트
│   └── theme.css       # 라이트/다크 색상 변수
├── js/
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   ├── blog.js         # 글 목록/상세 렌더링
│   └── theme.js        # 다크 모드 토글
├── images/             # 글에 넣는 이미지 (글에서는 images/파일명 으로 참조)
└── posts/
    ├── index.json      # 글 목록 (제목, 날짜, 요약, slug)
    └── *.md            # 블로그 글 원본
```

## 동작 방식

1. 글은 `posts/*.md`에 마크다운으로 작성한다. 맨 위에 frontmatter(`title`, `date`, `summary`, `tags`)를 둔다.
2. `posts/index.json`에 글 메타데이터를 나열한다. 브라우저는 디렉터리를 읽을 수 없으므로 새 글을 추가하면 이 파일에도 항목을 추가해야 한다.
3. `blog.js`가 `fetch`로 `.md`를 불러오고 `markdown.js`로 HTML로 바꿔 페이지에 넣는다.
4. 변환된 HTML에 사용자 입력이 섞이므로 `markdown.js`는 원본 텍스트를 먼저 이스케이프하고, 링크의 `javascript:` 스킴을 차단한다.

`fetch`는 `file://`에서 동작하지 않는다. 로컬에서는 정적 서버로 확인한다.

```bash
python -m http.server 8000
```

Windows에서는 `start.bat`을 더블클릭하면 서버가 켜지고 브라우저가 열린다. 서버 창을 닫으면 꺼진다.

## 마크다운 지원 범위

제목(`#`~`######`), 문단, 굵게/기울임/취소선, 인라인 코드, 코드 블록(언어 표기 포함), 링크, 이미지, 순서/비순서 목록, 인용문, 수평선, 표.
범위를 넓힐 때는 `markdown.js`에 먼저 추가하고 위 목록도 고친다.

## 디자인 원칙

- 깔끔하고 읽기 좋게: 본문 폭 약 `65ch`, 줄 간격 `1.7` 이상, 본문 글자 크기 `1rem` 이상(16px 미만 금지), 여백은 넉넉하게.
- 장식은 최소화한다. 강조색은 하나만 쓰고 링크와 포인트에만 사용한다.
- 한글 가독성을 위해 `word-break: keep-all`과 `overflow-wrap: break-word`를 본문에 적용한다.
- 폰트: `system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`. 코드는 `ui-monospace, Consolas, monospace`.

### 다크 모드

- 색상은 모두 `css/theme.css`의 CSS 변수(`--bg`, `--text`, `--muted`, `--accent`, `--border`, `--code-bg` 등)로 정의한다. 컴포넌트 CSS에 색상 값을 직접 쓰지 않는다.
- 기본값은 `prefers-color-scheme`을 따른다. 사용자가 토글로 바꾸면 `<html data-theme="light|dark">`로 덮어쓰고 `localStorage`에 저장한다.
- 깜빡임(FOUC)을 막기 위해 테마를 정하는 작은 인라인 스크립트를 `<head>` 안에서 CSS보다 먼저 실행한다.
- 라이트/다크 모두 본문 대비비 WCAG AA(4.5:1) 이상을 유지한다. 코드 블록 배경도 두 테마에서 따로 확인한다.

### 모바일 대응

- `<meta name="viewport" content="width=device-width, initial-scale=1">`를 모든 페이지에 넣는다.
- 모바일 우선으로 작성하고, `min-width` 미디어 쿼리로 넓은 화면을 확장한다.
- 가로 스크롤이 생기지 않아야 한다. 이미지는 `max-width: 100%`, 코드 블록과 표는 자체 `overflow-x: auto`로 감싼다.
- 터치 대상(토글 버튼, 링크 목록)은 최소 44×44px.
- 375px 폭에서 확인하는 것을 기본으로 한다.

## 코딩 규칙

- 들여쓰기는 공백 2칸, JS는 세미콜론 사용, 문자열은 작은따옴표.
- 클래스 이름은 `kebab-case`, JS 변수와 함수는 `camelCase`.
- 시맨틱 태그(`header`, `main`, `article`, `nav`, `footer`, `time`)를 쓰고, 이미지에는 `alt`를 넣는다.
- DOM에 넣는 텍스트는 `textContent`를 우선 쓰고, `innerHTML`은 `markdown.js`가 만든 결과에만 쓴다.
- 한 파일은 한 가지 역할만 맡는다. 전역 변수를 만들지 않고 ES 모듈(`<script type="module">`)로 연결한다.
- 주석과 문서는 한국어로 쓰되, 코드 식별자는 영어로 쓴다.

## 새 글 추가 절차

1. `posts/` 아래에 `영문-소문자-slug.md`를 만든다 (파일명이 URL의 slug가 된다).
2. frontmatter와 본문을 작성한다.
3. `posts/index.json`에 항목을 추가한다 (최신 글이 위로 오도록).
4. 로컬 서버에서 목록과 상세 페이지를 열어 확인한다.

## 확인 체크리스트

변경을 마치기 전에 브라우저에서 직접 확인한다. 자동 테스트 도구는 도입하지 않는다.

- [ ] 라이트/다크 전환이 되고, 새로고침해도 유지되며, 깜빡임이 없다.
- [ ] 375px 폭에서 가로 스크롤 없이 읽힌다. 표와 긴 코드 줄도 확인한다.
- [ ] 마크다운 지원 범위의 모든 요소가 두 테마에서 올바르게 보인다.
- [ ] 콘솔 에러가 없고, 존재하지 않는 slug는 안내 메시지를 보여 준다.
