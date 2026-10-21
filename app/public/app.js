const COLS = ['todo', 'in_progress', 'done'];
const LABEL = { todo: 'Cần làm', in_progress: 'Đang làm', done: 'Hoàn thành' };

async function api(url, opts) {
  const r = await fetch(url, opts && { ...opts, headers: { 'Content-Type': 'application/json' } });
  if (r.status === 204) return null;
  return r.json();
}

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text) e.textContent = text;     // textContent: chong XSS
  if (cls) e.className = cls;
  return e;
}

function card(t) {
  const c = el('div', null, `card ${t.priority}${t.overdue ? ' overdue' : ''}`);
  c.appendChild(el('strong', t.title));
  const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('vi-VN') : 'Không có';
  c.appendChild(el('small', `Hạn: ${dl}`, 'dl'));
  c.appendChild(el('small', `${t.project_name || '-'} | ${t.assignee_name || '-'}`));
  COLS.filter((s) => s !== t.status).forEach((s) => {
    const b = el('button', `→ ${LABEL[s]}`);
    b.onclick = async () => { await api(`/api/tasks/${t.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: s }) }); load(); };
    c.appendChild(b);
  });
  const d = el('button', 'Xóa');
  d.onclick = async () => { if (confirm('Xóa task này?')) { await api(`/api/tasks/${t.id}`, { method: 'DELETE' }); load(); } };
  c.appendChild(d);
  return c;
}

async function load() {
  const tasks = await api('/api/tasks');
  COLS.forEach((s) => {
    const col = document.getElementById(s);
    col.replaceChildren(...tasks.filter((t) => t.status === s).map(card));
  });
  const st = await api('/api/stats');
  document.getElementById('stats').textContent = `Quá hạn: ${st.overdue} | Tổng: ${tasks.length}`;
}

async function loadOptions() {
  const fill = (id, items, label) => items.forEach((i) => {
    const o = el('option', label(i)); o.value = i.id; document.getElementById(id).appendChild(o);
  });
  fill('project', await api('/api/projects'), (p) => p.name);
  fill('assignee', await api('/api/users'), (u) => u.full_name);
}

document.getElementById('taskForm').onsubmit = async (e) => {
  e.preventDefault();
  const v = (id) => document.getElementById(id).value || null;
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({
    title: v('title'), deadline: v('deadline'), priority: v('priority'),
    project_id: v('project'), assignee_id: v('assignee') }) });
  e.target.reset();
  load();
};

loadOptions();
load();
