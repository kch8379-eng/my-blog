const root = document.documentElement;
const button = document.getElementById('theme-toggle');
const query = window.matchMedia('(prefers-color-scheme: dark)');

const currentTheme = () => root.dataset.theme || (query.matches ? 'dark' : 'light');

function sync() {
  button?.setAttribute('aria-pressed', String(currentTheme() === 'dark'));
}

button?.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch (error) {
    // 저장소를 쓸 수 없어도 현재 페이지에서는 테마가 바뀐다.
  }
  sync();
});

query.addEventListener('change', sync);
sync();
