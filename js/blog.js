import { parseFrontmatter, render } from './markdown.js';

const SLUG = /^[\p{L}\p{N}_-]+$/u;
const SITE_TITLE = 'My Blog';
const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}

function timeElement(value) {
  const time = document.createElement('time');
  const date = new Date(value);
  time.dateTime = value;
  time.textContent = Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
  return time;
}

function tagList(tags) {
  const list = document.createElement('ul');
  list.className = 'tags';
  for (const tag of Array.isArray(tags) ? tags : []) {
    const item = document.createElement('li');
    item.textContent = tag;
    list.append(item);
  }
  return list;
}

function showStatus(container, message) {
  const item = document.createElement('li');
  item.className = 'status';
  item.textContent = message;
  container.replaceChildren(item);
}

function postCard(post) {
  const item = document.createElement('li');
  const card = document.createElement('article');
  const heading = document.createElement('h2');
  const link = document.createElement('a');
  const meta = document.createElement('div');
  const summary = document.createElement('p');

  card.className = 'post-card';
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  link.textContent = post.title;
  heading.append(link);

  meta.className = 'meta';
  meta.append(timeElement(post.date), tagList(post.tags));
  summary.textContent = post.summary ?? '';

  card.append(heading, meta, summary);
  item.append(card);
  return item;
}

async function showList(container) {
  try {
    const posts = JSON.parse(await fetchText('posts/index.json'));
    posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (posts.length) {
      container.replaceChildren(...posts.map(postCard));
    } else {
      showStatus(container, '아직 글이 없습니다.');
    }
  } catch (error) {
    console.error(error);
    showStatus(container, '글 목록을 불러오지 못했습니다.');
  }
}

function showMissing() {
  document.title = `글을 찾을 수 없습니다 · ${SITE_TITLE}`;
  document.getElementById('post-title').textContent = '글을 찾을 수 없습니다';
  document.getElementById('post-content').textContent = '주소를 확인하거나 목록으로 돌아가 주세요.';
}

async function showPost() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug || !SLUG.test(slug)) {
    showMissing();
    return;
  }

  try {
    const { data, body } = parseFrontmatter(await fetchText(`posts/${slug}.md`));
    const title = data.title || slug;
    document.title = `${title} · ${SITE_TITLE}`;
    document.getElementById('post-title').textContent = title;
    if (data.date) document.getElementById('post-meta').append(timeElement(data.date));
    document.getElementById('post-meta').append(tagList(data.tags));
    document.getElementById('post-content').innerHTML = render(body);
  } catch (error) {
    console.error(error);
    showMissing();
  }
}

const list = document.getElementById('post-list');
if (list) {
  showList(list);
} else if (document.getElementById('post')) {
  showPost();
}
