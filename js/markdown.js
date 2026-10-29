const FENCE = /^\s*(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const HR = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?/;
const LIST = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { data: {}, body: text };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^(\w+)\s*:\s*(.*)$/.exec(line);
    if (!pair) continue;
    const value = pair[2].trim();
    data[pair[1]] = value.startsWith('[') && value.endsWith(']')
      ? value.slice(1, -1).split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : value.replace(/^["']|["']$/g, '');
  }
  return { data, body: text.slice(match[0].length) };
}

export function render(markdown) {
  return renderBlocks(markdown.replace(/\r\n?/g, '\n').split('\n'));
}

// 이스케이프된 URL만 받는다. http(s), mailto, 상대 경로만 허용한다.
function safeUrl(url) {
  const compact = url.replace(/[\u0000- ]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (scheme && !['http', 'https', 'mailto'].includes(scheme[1].toLowerCase())) return null;
  return url;
}

function format(escaped, stash) {
  const hold = (html) => {
    stash.push(html);
    return `\u0000${stash.length - 1}\u0000`;
  };
  let s = escaped;

  s = s.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, alt, url, title) => {
    const safe = safeUrl(url);
    if (!safe) return alt;
    return hold(`<img src="${safe}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;(.*?)&quot;)?\)/g, (_, label, url, title) => {
    const safe = safeUrl(url);
    const text = format(label, stash);
    if (!safe) return text;
    const external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return hold(`<a href="${safe}"${title ? ` title="${title}"` : ''}${external}>${text}</a>`);
  });

  s = s.replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`);
  s = s.replace(/~~(.+?)~~/g, '<del>$1</del>');
  s = s.replace(/\*(?!\s)(.+?)(?<!\s)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
  return s;
}

function inline(text) {
  const stash = [];
  const restore = (html) => html.replace(/\u0000(\d+)\u0000/g, (_, index) => restore(stash[index]));
  return restore(format(escapeHtml(text), stash));
}

const indentOf = (line) => /^\s*/.exec(line)[0].length;
const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length
    && lines[i + 1].includes('|') && TABLE_SEP.test(lines[i + 1]);
}

function isBlockStart(lines, i) {
  const line = lines[i];
  return FENCE.test(line) || HEADING.test(line) || HR.test(line)
    || QUOTE.test(line) || LIST.test(line) || isTableStart(lines, i);
}

function codeBlock(code, lang) {
  return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code)}</code></pre>`;
}

function renderTable(lines, start) {
  const header = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    return cell.startsWith(':') ? 'left' : '';
  });
  const rows = [];
  let i = start + 2;
  while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));

  const cell = (tag, text, index) =>
    `<${tag}${aligns[index] ? ` style="text-align:${aligns[index]}"` : ''}>${inline(text)}</${tag}>`;
  const head = `<thead><tr>${header.map((text, k) => cell('th', text, k)).join('')}</tr></thead>`;
  const body = `<tbody>${rows.map((row) => `<tr>${row.map((text, k) => cell('td', text, k)).join('')}</tr>`).join('')}</tbody>`;
  return { html: `<div class="table-wrap"><table>${head}${body}</table></div>`, next: i };
}

function renderList(lines, start) {
  const first = LIST.exec(lines[start]);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const sameList = (m) => m && m[1].length === baseIndent && /\d/.test(m[2]) === ordered;
  const items = [];
  let i = start;

  while (i < lines.length) {
    const m = LIST.exec(lines[i]);
    if (!sameList(m)) break;
    const item = { text: [m[3]], nested: [] };
    i++;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        let j = i;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && indentOf(lines[j]) > baseIndent) {
          item.nested.push('');
          i++;
          continue;
        }
        break;
      }
      if (indentOf(line) > baseIndent) {
        item.nested.push(line);
      } else if (!isBlockStart(lines, i)) {
        item.text.push(line.trim());
      } else {
        break;
      }
      i++;
    }
    items.push(item);

    let j = i;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j > i && j < lines.length && sameList(LIST.exec(lines[j]))) i = j;
  }

  const html = items.map(({ text, nested }) => {
    let content = text.join(' ');
    let checkbox = '';
    const task = /^\[([ xX])\]\s+/.exec(content);
    if (task) {
      checkbox = `<input type="checkbox" disabled${task[1] === ' ' ? '' : ' checked'}>`;
      content = content.slice(task[0].length);
    }
    return `<li>${checkbox}${inline(content)}${nested.length ? renderBlocks(nested) : ''}</li>`;
  }).join('');

  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  const open = ordered ? `<ol${startNumber !== 1 ? ` start="${startNumber}"` : ''}>` : '<ul>';
  return { html: `${open}${html}</${ordered ? 'ol' : 'ul'}>`, next: i };
}

function renderBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    let m = FENCE.exec(line);
    if (m) {
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(m[1])) body.push(lines[i++]);
      i++;
      out.push(codeBlock(body.join('\n'), m[2]));
      continue;
    }

    m = HEADING.exec(line);
    if (m) {
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
      continue;
    }

    if (HR.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const quote = [];
      while (i < lines.length && QUOTE.test(lines[i])) quote.push(lines[i++].replace(QUOTE, ''));
      out.push(`<blockquote>${renderBlocks(quote)}</blockquote>`);
      continue;
    }

    if (LIST.test(line)) {
      const result = renderList(lines, i);
      out.push(result.html);
      i = result.next;
      continue;
    }

    if (isTableStart(lines, i)) {
      const result = renderTable(lines, i);
      out.push(result.html);
      i = result.next;
      continue;
    }

    const paragraph = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines, i)) paragraph.push(lines[i++].trim());
    out.push(`<p>${inline(paragraph.join('\n'))}</p>`);
  }

  return out.join('\n');
}
