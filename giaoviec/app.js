import * as CFG from './firebase-config.js';
const { firebaseConfig, LOGIN_DOMAIN } = CFG;
const UPLOAD_URL = CFG.UPLOAD_URL || '';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  setPersistence, inMemoryPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  onSnapshot, writeBatch, runTransaction, deleteField,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clone = o => JSON.parse(JSON.stringify(o));
function rid(n = 10, A = 'abcdefghijkmnpqrstuvwxyz23456789') {
  const r = crypto.getRandomValues(new Uint8Array(n)); let s = '';
  for (const x of r) s += A[x % A.length]; return s;
}
function ymd(d = new Date()) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function parseD(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n, work) {
  const dt = parseD(s); n = Math.max(0, Math.round(+n || 0));
  if (!work) { dt.setDate(dt.getDate() + n); return ymd(dt); }
  while (n > 0) { dt.setDate(dt.getDate() + 1); const w = dt.getDay(); if (w !== 0 && w !== 6) n--; }
  return ymd(dt);
}
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
function fmtD(s) { if (!s) return '—'; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
function fmtT(ts) { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2800); }
const toEmail = x => { x = (x || '').trim().toLowerCase(); return x.includes('@') ? x : `${x}@${LOGIN_DOMAIN}`; };
const initials = n => (n || '?').trim().split(/\s+/).slice(-1)[0].slice(0, 1).toUpperCase();
const LOGO = '/assets/img/logo-white.svg', LOGO_DARK = '/assets/img/logo.svg';

const ERR = {
  'auth/invalid-credential': 'Sai tên đăng nhập hoặc mật khẩu.',
  'auth/wrong-password': 'Sai tên đăng nhập hoặc mật khẩu.',
  'auth/user-not-found': 'Sai tên đăng nhập hoặc mật khẩu.',
  'auth/invalid-email': 'Tên đăng nhập / email không hợp lệ.',
  'auth/too-many-requests': 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút.',
  'auth/network-request-failed': 'Không có kết nối mạng.',
  'auth/email-already-in-use': 'Tên đăng nhập / email này đã có tài khoản.',
  'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
  'auth/requires-recent-login': 'Vui lòng đăng nhập lại rồi thử lại.',
  'permission-denied': 'Bạn không có quyền thực hiện thao tác này.',
  'unavailable': 'Mất kết nối máy chủ, vui lòng thử lại.',
};
const errMsg = e => ERR[e && e.code] || (e && e.message) || 'Có lỗi xảy ra.';

/* ================= constants ================= */
const BUILTIN = [
  { id: 'b-thamdinh', name: 'Thẩm định thiết kế PCCC', builtin: true, steps: [
    { name: 'Tiếp nhận hồ sơ', days: 1 }, { name: 'Kiểm tra thành phần hồ sơ', days: 1 },
    { name: 'Lập bảng đối chiếu', days: 3 }, { name: 'Dự thảo văn bản kiến nghị / báo cáo', days: 2 },
    { name: 'Trình lãnh đạo ký', days: 1 }, { name: 'Trả kết quả', days: 1 }] },
  { id: 'b-thicong', name: 'Thi công lắp đặt hệ thống PCCC', builtin: true, steps: [
    { name: 'Khảo sát hiện trạng', days: 2 }, { name: 'Chuẩn bị vật tư, thiết bị', days: 5 },
    { name: 'Thi công lắp đặt', days: 15 }, { name: 'Chạy thử, nghiệm thu nội bộ', days: 3 },
    { name: 'Bàn giao, hồ sơ hoàn công', days: 2 }] },
  { id: 'b-thietke', name: 'Thiết kế PCCC', builtin: true, steps: [
    { name: 'Khảo sát, nhận hồ sơ kiến trúc', days: 2 }, { name: 'Thiết kế cơ sở / bản vẽ', days: 7 },
    { name: 'Thuyết minh, tính toán', days: 3 }, { name: 'Kiểm tra nội bộ', days: 2 }, { name: 'Nộp hồ sơ thẩm duyệt', days: 1 }] },
  { id: 'b-baotri', name: 'Bảo trì, bảo dưỡng định kỳ', builtin: true, steps: [
    { name: 'Lập kế hoạch bảo trì', days: 1 }, { name: 'Kiểm tra hệ thống', days: 2 },
    { name: 'Khắc phục lỗi, thay thế', days: 3 }, { name: 'Lập biên bản, báo cáo', days: 1 }] },
  { id: 'b-chung', name: 'Công việc chung', builtin: true, steps: [
    { name: 'Tiếp nhận', days: 1 }, { name: 'Thực hiện', days: 5 }, { name: 'Báo cáo kết quả', days: 1 }] },
];
const PRIO = { normal: 'Bình thường', urgent: 'Gấp', hot: 'Hỏa tốc' };
const ST = { doing: 'Đang xử lý', soon: 'Sắp đến hạn', late: 'Quá hạn', done: 'Hoàn thành' };
const ROLE = { admin: 'Quản trị', manager: 'Quản lý', staff: 'Nhân viên' };
const ICON = {
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

/* ================= state ================= */
const S = {
  me: null, users: {}, tasks: [], templates: [], loaded: false,
  route: 'list', param: '', f: { st: 'all', q: '', scope: 'mine' }, lookupQ: '',
  profUnsub: null, dataUnsubs: [], dataRole: null, settingUp: false,
};
const isAdmin = () => S.me && S.me.role === 'admin';
const isMgr = () => S.me && (S.me.role === 'admin' || S.me.role === 'manager');
const uname = (uid, fb) => (S.users[uid] && S.users[uid].name) || fb || '—';
const activeUsers = () => Object.values(S.users).filter(u => u.active).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
const allTemplates = () => [...BUILTIN, ...S.templates];
const getTask = id => S.tasks.find(t => t.id === id);

/* ================= firebase ================= */
const configured = firebaseConfig && firebaseConfig.apiKey && !/DAN_API_KEY/.test(firebaseConfig.apiKey);
let app, auth, db;
if (!configured) {
  $('#root').innerHTML = `<div class="auth"><div class="box"><div class="lg"><img src="${LOGO_DARK}" alt="ARCOTEK" onerror="this.remove()"></div>
    <h1>Chưa cấu hình Firebase</h1><p class="c">Mở file <b>giaoviec/firebase-config.js</b> và dán cấu hình Web app của project Firebase vào, rồi tải lại trang.</p></div></div>`;
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  onAuthStateChanged(auth, onAuth);
}

function stopData() { S.dataUnsubs.forEach(u => { try { u(); } catch {} }); S.dataUnsubs = []; S.dataRole = null; S.loaded = false; }
function stopAll() { stopData(); if (S.profUnsub) { S.profUnsub(); S.profUnsub = null; } S.me = null; S.users = {}; S.tasks = []; S.templates = []; }

async function onAuth(u) {
  stopAll();
  if (!u) {
    let setupDone = true;
    try { setupDone = (await getDoc(doc(db, 'meta', 'setup'))).exists(); } catch { setupDone = true; }
    return setupDone ? viewLogin() : viewSetup();
  }
  authScreen('<p class="c" style="margin:0">Đang tải tài khoản…</p>');
  S.profUnsub = onSnapshot(doc(db, 'users', u.uid), snap => {
    const p = snap.exists() ? snap.data() : null;
    if (!p || !p.active) {
      stopData(); S.me = null;
      if (S.settingUp) return;
      return authScreen(`<h1>${p ? 'Tài khoản đã bị khóa' : 'Tài khoản chưa được kích hoạt'}</h1>
        <p class="c">Vui lòng liên hệ quản trị viên ARCOTEK.</p><button class="btn" style="width:100%" id="lo">Đăng xuất</button>`, b => $('#lo', b).onclick = () => signOut(auth));
    }
    const first = !S.me;
    S.me = { ...p, uid: u.uid, email: u.email };
    if (S.dataRole !== p.role) startData();
    if (first) { buildShell(); route(); } else { buildHeader(); rerender(); }
  }, e => authScreen(`<h1>Không tải được tài khoản</h1><p class="c">${esc(errMsg(e))}</p><button class="btn" style="width:100%" id="lo">Đăng xuất</button>`, b => $('#lo', b).onclick = () => signOut(auth)));
}

function startData() {
  stopData(); S.dataRole = S.me.role;
  let got = 0; const need = 3;
  const ready = () => { if (++got >= need && !S.loaded) { S.loaded = true; rerender(true); } };
  const onErr = e => { toast(errMsg(e)); ready(); };
  let f1 = false, f2 = false, f3 = false;
  S.dataUnsubs.push(onSnapshot(collection(db, 'users'), snap => {
    S.users = {}; snap.docs.forEach(d => S.users[d.id] = { ...d.data(), uid: d.id });
    if (!f1) { f1 = true; ready(); } else rerender();
  }, onErr));
  S.dataUnsubs.push(onSnapshot(collection(db, 'templates'), snap => {
    S.templates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (!f2) { f2 = true; ready(); } else if (S.route === 'tpl') render();
    const sel = $('#tplSel'); if (sel) fillTplSelect(sel, sel.value);
  }, onErr));
  const q = isMgr() ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('memberUids', 'array-contains', S.me.uid));
  S.dataUnsubs.push(onSnapshot(q, snap => {
    S.tasks = snap.docs.map(d => ({ ...clone(d.data()), id: d.id }));
    if (!f3) { f3 = true; ready(); } else rerender();
  }, onErr));
}

/* ================= auth screens ================= */
function authScreen(inner, mount) {
  $('#root').innerHTML = `<div class="auth"><div class="box"><div class="lg"><img src="${LOGO_DARK}" alt="ARCOTEK" onerror="this.remove()"></div>${inner}</div></div>`;
  mount && mount($('#root'));
}
function viewLogin() {
  authScreen(`<h1>Hệ thống giao việc</h1><p class="c">Đăng nhập bằng tài khoản được cấp</p>
    <form id="lf" class="grid">
      <div><label class="f">Tên đăng nhập hoặc email</label><input class="in" name="u" autocomplete="username" autocapitalize="none" required></div>
      <div><label class="f">Mật khẩu</label><input class="in" type="password" name="p" autocomplete="current-password" required></div>
      <div class="err" id="le"></div>
      <button class="btn" type="submit" style="width:100%">Đăng nhập</button>
      <p class="hint" style="text-align:center;margin:0">Quên mật khẩu? Liên hệ quản trị viên để được cấp lại.</p>
    </form>`, r => {
    const f = $('#lf', r); f.u.focus();
    f.onsubmit = async e => {
      e.preventDefault(); $('#le').textContent = ''; const b = f.querySelector('button'); b.disabled = true;
      try { await signInWithEmailAndPassword(auth, toEmail(f.u.value), f.p.value); }
      catch (err) { $('#le').textContent = errMsg(err); b.disabled = false; }
    };
  });
}
function viewSetup() {
  authScreen(`<h1>Thiết lập lần đầu</h1><p class="c">Tạo tài khoản <b>quản trị</b> đầu tiên. Bước này chỉ làm một lần.</p>
    <form id="sf" class="grid">
      <div><label class="f">Họ tên</label><input class="in" name="n" required></div>
      <div><label class="f">Tên đăng nhập hoặc email</label><input class="in" name="u" autocapitalize="none" required><div class="hint">Gõ tên không có @ sẽ thành <i>tên@${esc(LOGIN_DOMAIN)}</i></div></div>
      <div><label class="f">Mật khẩu (≥ 6 ký tự)</label><input class="in" type="password" name="p" minlength="6" required></div>
      <div class="err" id="se"></div>
      <button class="btn" type="submit" style="width:100%">Tạo tài khoản quản trị</button>
    </form>`, r => {
    const f = $('#sf', r);
    f.onsubmit = async e => {
      e.preventDefault(); $('#se').textContent = ''; const b = f.querySelector('button'); b.disabled = true;
      const name = f.n.value.trim(); if (!name) { $('#se').textContent = 'Nhập họ tên.'; b.disabled = false; return; }
      S.settingUp = true;
      try {
        const cred = await createUserWithEmailAndPassword(auth, toEmail(f.u.value), f.p.value);
        const batch = writeBatch(db);
        batch.set(doc(db, 'users', cred.user.uid), { name, email: cred.user.email, role: 'admin', active: true, unit: 'Ban giám đốc', createdAt: Date.now() });
        batch.set(doc(db, 'meta', 'setup'), { by: cred.user.uid, at: Date.now() });
        await batch.commit();
        S.settingUp = false;
      } catch (err) {
        S.settingUp = false;
        const el = $('#se');
        if (el) { el.textContent = errMsg(err); b.disabled = false; }
        else { toast('Thiết lập chưa xong: ' + errMsg(err)); if (auth.currentUser) signOut(auth); }
      }
    };
  });
}

/* ================= shell & routing ================= */
function buildShell() {
  $('#root').innerHTML = `
    <header class="top"><div class="wrap top-in" id="hdr"></div></header>
    <nav class="nav"><div class="wrap nav-in" id="nav"></div></nav>
    <main class="wrap" id="app"></main>`;
  buildHeader();
}
function buildHeader() {
  if (!$('#hdr')) return;
  $('#hdr').innerHTML = `
    <a class="brand" href="#viec-cua-toi"><img src="${LOGO}" alt="ARCOTEK" onerror="this.style.display='none'"><span class="sep"></span>
      <span class="tx"><div class="t1">Hệ thống giao việc</div><div class="t2">Giao nhiệm vụ · Báo cáo tiến độ</div></span></a>
    <div class="who"><button id="whoBtn" type="button"><span class="av">${esc(initials(S.me.name))}</span><span class="nm">${esc(S.me.name)}</span></button></div>`;
  $('#whoBtn').onclick = e => { e.stopPropagation(); toggleMenu(); };
  const items = [['viec-cua-toi', 'list', 'Công việc'], isMgr() && ['giao-viec', 'new', 'Giao việc mới'], ['tra-cuu', 'lookup', 'Tra cứu'], ['mau-quy-trinh', 'tpl', 'Mẫu quy trình'], isAdmin() && ['tai-khoan', 'users', 'Tài khoản']].filter(Boolean);
  $('#nav').innerHTML = items.map(([h, r, l]) => `<a href="#${h}" data-r="${r}">${l}</a>`).join('');
  markNav();
}
function toggleMenu(force) {
  const ex = $('.menu'); if (ex || force === false) { ex && ex.remove(); return; }
  const m = document.createElement('div'); m.className = 'menu';
  m.innerHTML = `<div class="mh"><b>${esc(S.me.name)}</b>${esc(S.me.email)}<br>${ROLE[S.me.role]}${S.me.unit ? ' · ' + esc(S.me.unit) : ''}</div>
    <button data-m="pw">Đổi mật khẩu</button><button data-m="out" style="color:var(--late)">Đăng xuất</button>`;
  $('.top').appendChild(m);
  m.onclick = e => e.stopPropagation();
  $('[data-m=pw]', m).onclick = () => { toggleMenu(false); pwDialog(); };
  $('[data-m=out]', m).onclick = () => { toggleMenu(false); signOut(auth); location.hash = ''; };
}
document.addEventListener('click', () => toggleMenu(false));

const HASH = { 'giao-viec': 'new', 'tra-cuu': 'lookup', 'mau-quy-trinh': 'tpl', 'tai-khoan': 'users' };
function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (h.startsWith('hs-')) return ['detail', h.slice(3)];
  return [HASH[h] || 'list', ''];
}
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
function markNav() { $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === S.route || (S.route === 'detail' && a.dataset.r === 'list'))); }
function route() {
  if (!S.me) return;
  let [r, p] = parseHash();
  if ((r === 'new' && !isMgr()) || (r === 'users' && !isAdmin())) r = 'list';
  S.route = r; S.param = p; markNav(); render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
function rerender(force) { if (S.me && (force || ['list', 'detail', 'lookup', 'users'].includes(S.route))) render(); }
function render() {
  const a = $('#app'); if (!a) return;
  if (!S.loaded) { a.innerHTML = '<div class="empty">Đang tải dữ liệu…</div>'; return; }
  ({ list: vList, new: vNew, lookup: vLookup, tpl: vTpl, detail: vDetail, users: vUsers })[S.route](a);
}

/* ================= task logic ================= */
function info(t) {
  const steps = t.steps || []; const total = steps.length;
  const doneN = steps.filter(s => s.status === 'done').length;
  const curIdx = steps.findIndex(s => s.status !== 'done');
  const cur = curIdx >= 0 ? steps[curIdx] : null;
  const pct = total ? Math.round(((doneN + (cur ? (+cur.pct || 0) / 100 : 0)) / total) * 100) : 0;
  const td = ymd(); const left = t.due ? diffDays(td, t.due) : null;
  let st;
  if (total && doneN === total) st = 'done';
  else if (left !== null && left < 0) st = 'late';
  else if (left !== null && left <= 2) st = 'soon';
  else st = 'doing';
  const stepLate = !!(cur && cur.due && cur.due < td);
  const onTime = st === 'done' && t.completedAt && t.due ? ymd(new Date(t.completedAt)) <= t.due : null;
  return { total, doneN, curIdx, cur, pct, st, left, stepLate, onTime };
}
function recompute(t) {
  let d = t.start || ymd();
  (t.steps || []).forEach(s => { d = addDays(d, s.days, t.workdays); s.due = d; });
  t.due = t.steps && t.steps.length ? t.steps[t.steps.length - 1].due : t.start;
  t.memberUids = [...new Set([t.assignerUid, t.assigneeUid, ...(t.steps || []).map(s => s.ownerUid)].filter(Boolean))];
}
function newCode() {
  const d = new Date();
  return 'GV' + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + rid(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
}
const isMine = t => t.assigneeUid === S.me.uid || (t.steps || []).some(s => s.ownerUid === S.me.uid);
const canAct = t => isMgr() || (t.memberUids || []).includes(S.me.uid);

const STAFF_KEYS = ['steps', 'log', 'completedAt', 'updatedAt'];
async function mutateTask(id, fn, keys = STAFF_KEYS) {
  const ref = doc(db, 'tasks', id);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref); if (!snap.exists()) throw new Error('Công việc không còn tồn tại.');
    const t = clone(snap.data()); fn(t);
    t.updatedAt = Date.now();
    if (t.log) t.log = t.log.slice(0, 300);
    const upd = {}; keys.forEach(k => upd[k] = t[k] === undefined ? deleteField() : t[k]);
    tx.update(ref, upd);
  });
}
const logEntry = (type, text, extra = {}) => ({ id: rid(6), t: Date.now(), byUid: S.me.uid, by: S.me.name, type, text, ...extra });

/* ================= file upload (Google Drive via Apps Script) ================= */
const MAX_UPLOAD = 30 * 1024 * 1024;
const fmtSize = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
async function prepFile(f) {
  if (/^image\/(jpeg|png|webp|heic)$/.test(f.type) && f.size > 1.5e6) {
    try {
      const bmp = await createImageBitmap(f);
      const sc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      if (b && b.size < f.size) return { blob: b, name: f.name.replace(/\.\w+$/, '') + '.jpg', type: 'image/jpeg' };
    } catch {}
  }
  return { blob: f, name: f.name, type: f.type || 'application/octet-stream' };
}
const toB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new Error('Không đọc được file.')); r.readAsDataURL(blob); });
async function uploadFile(taskId, f) {
  const p = await prepFile(f);
  if (p.blob.size > MAX_UPLOAD) throw new Error(`"${f.name}" vượt quá 30 MB.`);
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: JSON.stringify({ idToken, taskId, name: p.name, mime: p.type, data: await toB64(p.blob) }) });
  let j; try { j = await res.json(); } catch { throw new Error('Máy chủ lưu file không phản hồi.'); }
  if (j.error) throw new Error(j.error);
  return { id: j.id, name: j.name, size: j.size, mime: j.mime, url: j.url };
}
const fileIcon = m => /^image\//.test(m) ? '🖼️' : /pdf/.test(m) ? '📄' : /sheet|excel|csv/.test(m) ? '📊' : /word|document/.test(m) ? '📝' : /dwg|dxf|acad/.test(m) ? '📐' : '📎';
const filesHTML = fs => (fs && fs.length) ? `<div class="files">${fs.map(f => `<a class="file" href="${esc(f.url)}" target="_blank" rel="noopener"><span>${fileIcon(f.mime || '')}</span><span class="fn">${esc(f.name)}</span><span class="fs">${fmtSize(f.size || 0)}</span></a>`).join('')}</div>` : '';
function filePicker() {
  if (!UPLOAD_URL) return '';
  return `<div><label class="f">Đính kèm file (ảnh, PDF, bản vẽ… ≤ 30 MB/file)</label>
    <label class="btn ghost sm" style="cursor:pointer"><input type="file" id="mF" multiple hidden> + Chọn file</label>
    <div id="mFL" class="hint"></div></div>`;
}
function wirePicker(b) {
  const inp = b.querySelector('#mF'); if (!inp) return () => [];
  const picked = [];
  const draw = () => { b.querySelector('#mFL').innerHTML = picked.map((f, i) => `<div>${fileIcon(f.type)} ${esc(f.name)} (${fmtSize(f.size)}) <a href="#" data-rm="${i}">bỏ</a></div>`).join(''); $$('[data-rm]', b).forEach(a => a.onclick = e => { e.preventDefault(); picked.splice(+a.dataset.rm, 1); draw(); }); };
  inp.onchange = () => { [...inp.files].forEach(f => picked.push(f)); inp.value = ''; draw(); };
  return () => picked;
}
async function notify(taskId, type) {
  if (!UPLOAD_URL) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch(UPLOAD_URL, { method: 'POST', body: JSON.stringify({ action: 'notify', type, idToken, taskId }) });
    const j = await r.json();
    if (j.sent) setTimeout(() => toast(`Đã gửi email thông báo cho ${j.sent} người.`), 1500);
  } catch {}
}
async function uploadAll(taskId, list, btn) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    btn.textContent = `Đang tải file ${i + 1}/${list.length}…`;
    out.push(await uploadFile(taskId, list[i]));
  }
  return out;
}

/* ================= shared UI bits ================= */
function stBadge(i) {
  if (i.st === 'done') return `<span class="badge st-done">${i.onTime === false ? 'Hoàn thành (trễ hạn)' : 'Hoàn thành'}</span>`;
  return `<span class="badge st-${i.st}">${ST[i.st]}</span>`;
}
const prioBadge = p => p === 'hot' ? '<span class="badge pr-hot">Hỏa tốc</span>' : p === 'urgent' ? '<span class="badge pr-gap">Gấp</span>' : '';
const barCls = i => i.st === 'done' ? 'done' : i.st === 'late' ? 'late' : '';
function leftText(i) {
  if (i.st === 'done') return 'Đã hoàn thành';
  if (i.left === null) return '';
  if (i.left < 0) return `Quá hạn ${-i.left} ngày`;
  if (i.left === 0) return 'Hết hạn hôm nay';
  return `Còn ${i.left} ngày`;
}
function stepperHTML(t, i) {
  return `<ol class="stepper">${(t.steps || []).map((s, k) => {
    const c = s.status === 'done' ? 'done' : k === i.curIdx ? 'cur' + (i.stepLate ? ' late' : '') : '';
    return `<li class="${c}"><span class="dot">${s.status === 'done' ? '✓' : k + 1}</span><span class="lbl">${esc(s.name)}</span></li>`;
  }).join('')}</ol>`;
}
const userOptions = (sel, empty) => (empty ? `<option value="">${empty}</option>` : '') +
  activeUsers().map(u => `<option value="${esc(u.uid)}" ${u.uid === sel ? 'selected' : ''}>${esc(u.name)}${u.unit ? ' – ' + esc(u.unit) : ''}</option>`).join('');

/* ================= LIST ================= */
function scoped() {
  const sc = isMgr() ? S.f.scope : 'mine';
  return S.tasks.filter(t => sc === 'all' ? true : sc === 'given' ? t.assignerUid === S.me.uid : isMine(t));
}
function vList(a) {
  const base = scoped().map(t => ({ t, i: info(t) }));
  const cnt = { all: base.length, doing: 0, soon: 0, late: 0, done: 0 };
  base.forEach(x => cnt[x.i.st]++);
  const stat = (k, l, c) => `<button class="stat${S.f.st === k ? ' on' : ''}" data-f="${k}" style="--c:${c}"><div class="n">${cnt[k]}</div><div class="l">${l}</div></button>`;
  a.innerHTML = `
    <h2 class="pg">Xin chào, ${esc(S.me.name)}</h2>
    <p class="sub">Theo dõi tình hình xử lý công việc.</p>
    ${isMgr() ? `<div class="scope">${[['mine', 'Việc của tôi'], ['given', 'Việc tôi giao'], ['all', 'Tất cả']].map(([k, l]) => `<button data-sc="${k}" class="${S.f.scope === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
    <div class="stats">
      ${stat('all', 'Tổng số', '#1b2433')}${stat('doing', 'Đang xử lý', 'var(--blue)')}
      ${stat('soon', 'Sắp đến hạn (≤ 2 ngày)', 'var(--amber)')}${stat('late', 'Quá hạn', 'var(--late)')}${stat('done', 'Hoàn thành', 'var(--green)')}
    </div>
    <div class="toolbar">
      <input class="in" id="q" type="search" placeholder="Tìm theo mã, tên việc, người thực hiện…" value="${esc(S.f.q)}">
      <button class="btn ghost" id="copyRep" type="button">Sao chép báo cáo</button>
      ${isMgr() ? '<a class="btn" href="#giao-viec">+ Giao việc mới</a>' : ''}
    </div>
    <div class="items" id="items"></div>`;
  $$('.stat', a).forEach(b => b.onclick = () => { S.f.st = b.dataset.f; vList(a); });
  $$('[data-sc]', a).forEach(b => b.onclick = () => { S.f.scope = b.dataset.sc; S.f.st = 'all'; vList(a); });
  $('#q').oninput = e => { S.f.q = e.target.value; drawItems(); };
  $('#copyRep').onclick = copyReport;
  drawItems();
}
function filtered() {
  const q = S.f.q.trim().toLowerCase();
  return scoped().map(t => ({ t, i: info(t) }))
    .filter(x => S.f.st === 'all' || x.i.st === S.f.st)
    .filter(x => !q || [x.t.code, x.t.title, uname(x.t.assigneeUid, x.t.assigneeName), x.t.unit].join(' ').toLowerCase().includes(q))
    .sort((a, b) => {
      const ad = a.i.st === 'done', bd = b.i.st === 'done';
      if (ad !== bd) return ad ? 1 : -1;
      if (ad) return (b.t.completedAt || 0) - (a.t.completedAt || 0);
      return (a.t.due || '9').localeCompare(b.t.due || '9');
    });
}
function drawItems() {
  const box = $('#items'); if (!box) return;
  const rows = filtered();
  if (!rows.length) { box.innerHTML = `<div class="card empty">${scoped().length ? 'Không có công việc phù hợp bộ lọc.' : 'Chưa có công việc nào.'}</div>`; return; }
  box.innerHTML = rows.map(({ t, i }) => `
    <a class="card task" href="#hs-${esc(t.id)}">
      <div class="row1"><span class="code">${esc(t.code)}</span>${stBadge(i)}${prioBadge(t.priority)}${i.stepLate && i.st !== 'late' ? '<span class="badge st-late">Bước trễ hạn</span>' : ''}</div>
      <div class="ttl">${esc(t.title)}</div>
      <div class="meta">
        <span>Thực hiện: <b>${esc(uname(t.assigneeUid, t.assigneeName))}</b></span>
        <span>Hạn: <b>${fmtD(t.due)}</b> · ${leftText(i)}</span>
        ${i.cur ? `<span>Bước ${i.curIdx + 1}/${i.total}: <b>${esc(i.cur.name)}</b>${i.cur.ownerUid ? ' (' + esc(uname(i.cur.ownerUid, i.cur.ownerName)) + ')' : ''}</span>` : ''}
      </div>
      <div class="dots">${(t.steps || []).map((s, k) => `<span class="${s.status === 'done' ? 'd' : k === i.curIdx ? 'c' + (i.stepLate ? ' l' : '') : ''}"></span>`).join('')}</div>
      <div class="prog"><div class="bar ${barCls(i)}"><i style="width:${i.pct}%"></i></div><span class="p">${i.pct}%</span></div>
    </a>`).join('');
}
async function copyReport() {
  const rows = filtered();
  const lines = [`BÁO CÁO TIẾN ĐỘ CÔNG VIỆC – ARCOTEK – ${fmtD(ymd())}`, ''];
  rows.forEach(({ t, i }, k) => {
    lines.push(`${k + 1}. [${t.code}] ${t.title}`);
    lines.push(`   - Người thực hiện: ${uname(t.assigneeUid, t.assigneeName)} | Hạn: ${fmtD(t.due)} | ${ST[i.st]} (${i.pct}%)`);
    if (i.cur) lines.push(`   - Đang ở bước ${i.curIdx + 1}/${i.total}: ${i.cur.name}${i.stepLate ? ' (trễ hạn bước)' : ''}`);
    const last = (t.log || []).find(l => l.type === 'report');
    if (last) lines.push(`   - Báo cáo gần nhất (${fmtT(last.t)}, ${last.by}): ${last.text}`);
  });
  try { await navigator.clipboard.writeText(lines.join('\n')); toast('Đã sao chép báo cáo — dán vào Zalo/email.'); }
  catch { openModal(`<h3>Báo cáo tiến độ</h3><textarea class="in" style="min-height:300px">${esc(lines.join('\n'))}</textarea><div class="mact"><button class="btn" data-x>Đóng</button></div>`, b => b.querySelector('[data-x]').onclick = closeModal); }
}

/* ================= STEP EDITOR ================= */
function stepEditor(box, rows, getStart, getWork, withOwner = true) {
  const dueList = () => { let d = getStart() || ymd(); return rows.map(r => (d = addDays(d, r.days, getWork()))); };
  function updDue() {
    const dl = dueList();
    $$('.se-row', box).forEach((el, k) => { const x = el.querySelector('.due b'); if (x) x.textContent = fmtD(dl[k]); });
    box.dispatchEvent(new CustomEvent('duechange', { detail: dl[dl.length - 1] }));
  }
  function draw() {
    const dl = dueList();
    box.innerHTML = `
      <div class="se-head"><span>#</span><span>Tên bước xử lý</span><span>${withOwner ? 'Người phụ trách' : ''}</span><span>Số ngày</span><span>Hạn bước</span><span></span></div>
      <div class="se">${rows.map((r, k) => `
        <div class="se-row${r.status === 'done' ? ' locked' : ''}" data-k="${k}">
          <span class="no">${k + 1}</span>
          <input class="in nm" data-fld="name" placeholder="Tên bước" value="${esc(r.name)}">
          ${withOwner ? `<select class="in ow" data-fld="ownerUid">${userOptions(r.ownerUid, '— Người thực hiện chính —')}</select>` : '<span class="ow"></span>'}
          <input class="in dy" data-fld="days" type="number" min="0" inputmode="numeric" value="${esc(r.days)}" title="Số ngày xử lý">
          <span class="due">${r.status === 'done' ? 'Đã xong' : 'Hạn'}<b>${fmtD(dl[k])}</b></span>
          <span class="tools">
            <button type="button" class="ib" data-a="up" title="Lên" ${k === 0 ? 'disabled' : ''}>${ICON.up}</button>
            <button type="button" class="ib" data-a="down" title="Xuống" ${k === rows.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
            <button type="button" class="ib del" data-a="del" title="Xóa bước" ${r.status === 'done' ? 'disabled' : ''}>${ICON.x}</button>
          </span>
        </div>`).join('')}
      </div>
      <button type="button" class="btn ghost sm" data-a="add" style="margin-top:10px">+ Thêm bước</button>`;
    $$('.se-row .in', box).forEach(inp => {
      const ev = inp.tagName === 'SELECT' ? 'onchange' : 'oninput';
      inp[ev] = () => {
        const k = +inp.closest('.se-row').dataset.k, f = inp.dataset.fld;
        rows[k][f] = f === 'days' ? Math.max(0, parseInt(inp.value || '0', 10) || 0) : inp.value;
        if (f === 'days') updDue();
      };
    });
    $$('[data-a]', box).forEach(b => b.onclick = () => {
      const a = b.dataset.a, row = b.closest('.se-row'), k = row ? +row.dataset.k : -1;
      if (a === 'add') rows.push({ id: rid(6), name: '', ownerUid: '', days: 1, status: 'pending' });
      if (a === 'del') rows.splice(k, 1);
      if (a === 'up' && k > 0) [rows[k - 1], rows[k]] = [rows[k], rows[k - 1]];
      if (a === 'down' && k < rows.length - 1) [rows[k + 1], rows[k]] = [rows[k], rows[k + 1]];
      draw(); if (a === 'add') { const l = $$('.se-row .nm', box).pop(); l && l.focus(); }
    });
    updDue();
  }
  draw();
  return { redraw: draw, updDue };
}
function fillTplSelect(sel, val) {
  sel.innerHTML = '<option value="">— Chọn mẫu quy trình —</option>' + allTemplates().map(t => `<option value="${esc(t.id)}">${esc(t.name)}${t.builtin ? '' : ' (mẫu riêng)'}</option>`).join('');
  sel.value = val || '';
}
const validSteps = rows => rows.map(r => ({ ...r, name: (r.name || '').trim() })).filter(r => r.name);
const packSteps = steps => steps.map(s => ({
  id: s.id || rid(6), name: s.name, ownerUid: s.ownerUid || '', ownerName: s.ownerUid ? uname(s.ownerUid) : '',
  days: +s.days || 0, status: s.status || 'pending', pct: +s.pct || 0,
  ...(s.doneAt ? { doneAt: s.doneAt, doneBy: s.doneBy || '' } : {}),
}));

/* ================= NEW TASK ================= */
function vNew(a) {
  const rows = BUILTIN[4].steps.map(s => ({ id: rid(6), name: s.name, ownerUid: '', days: s.days, status: 'pending' }));
  a.innerHTML = `
    <h2 class="pg">Giao việc mới</h2>
    <p class="sub">Nhập thông tin và thiết lập quy trình các bước xử lý riêng cho công việc.</p>
    <form id="fNew" class="grid" novalidate>
      <div class="card pad grid">
        <div class="sec-h"><h3>1. Thông tin công việc</h3></div>
        <div><label class="f">Tên công việc <span class="req">*</span></label><input class="in" name="title" placeholder="VD: Thiết kế PCCC – Nhà xưởng ABC"></div>
        <div><label class="f">Nội dung, yêu cầu</label><textarea class="in" name="desc" placeholder="Mô tả, yêu cầu kết quả, tài liệu kèm theo…"></textarea></div>
        <div class="grid g3">
          <div><label class="f">Người thực hiện chính <span class="req">*</span></label><select class="in" name="assignee">${userOptions('', '— Chọn người —')}</select></div>
          <div><label class="f">Mức độ</label><select class="in" name="priority">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div><label class="f">Ngày giao / bắt đầu</label><input class="in" type="date" name="start" value="${ymd()}"></div>
        </div>
        <div class="grid g2">
          <div><label class="f">Hạn hoàn thành</label><input class="in" id="dueOut" readonly><div class="hint">Tự tính theo tổng số ngày các bước.</div></div>
          <div style="align-self:center"><label class="chk"><input type="checkbox" name="workdays" checked> Chỉ tính ngày làm việc (trừ T7, CN)</label></div>
        </div>
      </div>
      <div class="card pad">
        <div class="sec-h"><h3>2. Quy trình xử lý</h3><select class="in" id="tplSel" style="max-width:280px"></select></div>
        <div id="se"></div>
        <p class="hint">Mỗi bước có thể giao cho một người phụ trách khác; người đó sẽ thấy công việc trong mục "Việc của tôi"${UPLOAD_URL ? ' và nhận email thông báo' : ''}.</p>
        <button type="button" class="btn ghost sm" id="saveTpl">Lưu quy trình này làm mẫu</button>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <a class="btn ghost" href="#viec-cua-toi">Hủy</a><button class="btn" type="submit">Giao việc</button>
      </div>
    </form>`;
  const f = $('#fNew');
  const getStart = () => f.start.value || ymd(), getWork = () => f.workdays.checked;
  const seBox = $('#se');
  seBox.addEventListener('duechange', e => { $('#dueOut').value = fmtD(e.detail); });
  const ed = stepEditor(seBox, rows, getStart, getWork);
  f.start.onchange = ed.updDue; f.workdays.onchange = ed.updDue;
  const sel = $('#tplSel'); fillTplSelect(sel, 'b-chung');
  sel.onchange = () => {
    const tp = allTemplates().find(x => x.id === sel.value); if (!tp) return;
    rows.length = 0; tp.steps.forEach(s => rows.push({ id: rid(6), name: s.name, ownerUid: '', days: s.days, status: 'pending' }));
    ed.redraw();
  };
  $('#saveTpl').onclick = () => saveTemplateDialog(validSteps(rows));
  f.onsubmit = async e => {
    e.preventDefault();
    const title = f.title.value.trim(), assigneeUid = f.assignee.value, steps = validSteps(rows);
    if (!title) { toast('Vui lòng nhập tên công việc.'); f.title.focus(); return; }
    if (!assigneeUid) { toast('Vui lòng chọn người thực hiện.'); f.assignee.focus(); return; }
    if (!steps.length) { toast('Quy trình cần ít nhất 1 bước.'); return; }
    const t = {
      code: newCode(), title, desc: f.desc.value.trim(),
      assignerUid: S.me.uid, assignerName: S.me.name, assigneeUid, assigneeName: uname(assigneeUid),
      unit: (S.users[assigneeUid] || {}).unit || '', priority: f.priority.value,
      start: getStart(), workdays: getWork(), createdAt: Date.now(), updatedAt: Date.now(),
      steps: packSteps(steps.map(s => ({ ...s, status: 'pending', pct: 0 }))),
      log: [logEntry('create', `Giao việc cho ${uname(assigneeUid)}. Quy trình ${steps.length} bước.`)],
    };
    recompute(t);
    const id = rid(14); const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { await setDoc(doc(db, 'tasks', id), t); toast(`Đã giao việc · Mã ${t.code}`); go('hs-' + id); notify(id, 'assign'); }
    catch (err) { toast(errMsg(err)); btn.disabled = false; }
  };
}
function saveTemplateDialog(steps) {
  if (!steps.length) { toast('Quy trình đang trống.'); return; }
  openModal(`<h3>Lưu làm mẫu quy trình</h3>
    <label class="f" style="margin-top:12px">Tên mẫu</label><input class="in" id="tplName" placeholder="VD: Nghiệm thu PCCC">
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Lưu mẫu</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal; b.querySelector('#tplName').focus();
    b.querySelector('[data-ok]').onclick = async () => {
      const name = b.querySelector('#tplName').value.trim(); if (!name) { toast('Nhập tên mẫu.'); return; }
      closeModal();
      try { await setDoc(doc(db, 'templates', rid(10)), { name, steps: steps.map(s => ({ name: s.name, days: +s.days || 0 })), createdAt: Date.now(), by: S.me.uid }); toast('Đã lưu mẫu quy trình.'); }
      catch (err) { toast(errMsg(err)); }
    };
  });
}

/* ================= DETAIL ================= */
function vDetail(a) {
  const t = getTask(S.param);
  if (!t) { a.innerHTML = `<div class="crumb"><a href="#viec-cua-toi">← Công việc</a></div><div class="card empty">Không tìm thấy công việc này, hoặc bạn không có quyền xem.</div>`; return; }
  const i = info(t), act = canAct(t), mgr = isMgr();
  const LOGT = { report: 'Báo cáo', done: 'Hoàn thành bước', return: 'Trả lại', create: 'Giao việc', edit: 'Chỉnh sửa' };
  a.innerHTML = `
    <div class="crumb"><a href="#viec-cua-toi">← Công việc</a> / Chi tiết</div>
    <div class="card dhead">
      <div class="row1"><span class="code">${esc(t.code)}</span><button class="btn ghost sm" id="cpCode" type="button">Sao chép mã</button>${stBadge(i)}${prioBadge(t.priority)}</div>
      <h1>${esc(t.title)}</h1>
      ${t.desc ? `<p class="desc">${esc(t.desc)}</p>` : ''}
      <div class="info">
        <div><div class="k">Người giao</div><div class="v">${esc(uname(t.assignerUid, t.assignerName))}</div></div>
        <div><div class="k">Người thực hiện</div><div class="v">${esc(uname(t.assigneeUid, t.assigneeName))}${t.unit ? ` <span style="font-weight:400;color:var(--mut)">· ${esc(t.unit)}</span>` : ''}</div></div>
        <div><div class="k">Ngày giao</div><div class="v">${fmtD(t.start)}</div></div>
        <div><div class="k">Hạn hoàn thành</div><div class="v" style="color:${i.st === 'late' ? 'var(--late)' : 'inherit'}">${fmtD(t.due)} <span style="font-weight:400;color:var(--mut);font-size:13px">· ${leftText(i)}</span></div></div>
      </div>
      <div class="prog"><div class="bar ${barCls(i)}"><i style="width:${i.pct}%"></i></div><span class="p">${i.pct}%</span></div>
      ${act ? `<div class="actions">
        ${i.cur ? `<button class="btn" id="aRep">Báo cáo tiến độ</button><button class="btn green" id="aDone">Hoàn thành bước ${i.curIdx + 1}</button>` : ''}
        ${i.doneN > 0 ? '<button class="btn warn" id="aBack">Trả lại bước trước</button>' : ''}
        ${mgr ? '<button class="btn ghost" id="aEdit">Chỉnh sửa / quy trình</button><button class="btn dghost" id="aDel">Xóa</button>' : ''}
      </div>` : ''}
    </div>
    <div class="cols">
      <div class="card pad">
        <div class="sec-h"><h3>Quá trình xử lý</h3><span class="hint">${i.doneN}/${i.total} bước hoàn thành</span></div>
        ${stepperHTML(t, i)}
        <ol class="tl" style="margin-top:14px">${(t.steps || []).map((s, k) => {
          const isCur = k === i.curIdx, late = s.status !== 'done' && s.due && s.due < ymd();
          const cls = s.status === 'done' ? 'done' : isCur ? 'cur' + (late ? ' late' : '') : '';
          const badge = s.status === 'done' ? '<span class="badge st-done">Đã hoàn thành</span>' : isCur ? `<span class="badge ${late ? 'st-late' : 'st-doing'}">${late ? 'Đang xử lý – trễ hạn' : 'Đang xử lý'}</span>` : '<span class="badge st-pend">Chờ xử lý</span>';
          const owner = s.ownerUid ? uname(s.ownerUid, s.ownerName) : uname(t.assigneeUid, t.assigneeName);
          return `<li class="${cls}"><span class="n">${s.status === 'done' ? '✓' : k + 1}</span><div class="b">
            <div class="h"><b>${esc(s.name)}</b>${badge}</div>
            <div class="m">Phụ trách: ${esc(owner)} · ${s.days} ngày · Hạn ${fmtD(s.due)}${s.status === 'done' && s.doneAt ? ` · Xong ${fmtT(s.doneAt)}${s.doneBy ? ' bởi ' + esc(s.doneBy) : ''}` : ''}</div>
            ${isCur ? `<div class="mini"><div class="bar ${late ? 'late' : ''}"><i style="width:${+s.pct || 0}%"></i></div><span class="hint" style="margin:0">${+s.pct || 0}%</span></div>` : ''}
          </div></li>`;
        }).join('')}</ol>
      </div>
      <div class="card pad">
        <div class="sec-h"><h3>Nhật ký báo cáo</h3><span class="hint">${(t.log || []).length} mục</span></div>
        <ul class="log">${(t.log || []).map(l => `<li>
          <div class="lh"><span class="tag ${esc(l.type)}">${LOGT[l.type] || 'Ghi chú'}</span><b>${esc(l.by || '')}</b><span>${fmtT(l.t)}</span></div>
          ${l.step ? `<div class="hint" style="margin:2px 0 0">Bước: ${esc(l.step)}${l.type === 'report' && l.pct != null ? ` · ${l.pct}%` : ''}</div>` : ''}
          ${l.text ? `<div class="lt">${esc(l.text)}</div>` : ''}
          ${filesHTML(l.files)}
        </li>`).join('') || '<li class="hint">Chưa có báo cáo.</li>'}</ul>
      </div>
    </div>
    ${(() => { const all = (t.log || []).flatMap(l => (l.files || []).map(f => ({ ...f, by: l.by, t: l.t, step: l.step }))); return `<div class="card pad" style="margin-top:16px">
      <div class="sec-h"><h3>Tài liệu đính kèm</h3><span class="hint">${all.length} file</span></div>
      ${all.length ? `<div class="files">${all.map(f => `<a class="file" href="${esc(f.url)}" target="_blank" rel="noopener"><span>${fileIcon(f.mime || '')}</span><span class="fn">${esc(f.name)}<small>${esc(f.by || '')} · ${fmtT(f.t)}${f.step ? ' · ' + esc(f.step) : ''}</small></span><span class="fs">${fmtSize(f.size || 0)}</span></a>`).join('')}</div>` : `<p class="hint" style="margin:0">Chưa có file nào.${UPLOAD_URL && act && i.cur ? ' Đính kèm file khi bấm "Báo cáo tiến độ".' : ''}</p>`}
    </div>`; })()}`;
  $('#cpCode').onclick = async () => { try { await navigator.clipboard.writeText(t.code); toast('Đã sao chép mã ' + t.code); } catch { toast('Mã: ' + t.code); } };
  if (!act) return;
  $('#aRep') && ($('#aRep').onclick = () => reportDialog(t.id, false));
  $('#aDone') && ($('#aDone').onclick = () => reportDialog(t.id, true));
  $('#aBack') && ($('#aBack').onclick = () => returnDialog(t.id));
  $('#aEdit') && ($('#aEdit').onclick = () => editDialog(t.id));
  $('#aDel') && ($('#aDel').onclick = async () => {
    if (await confirmBox('Xóa công việc?', `Công việc ${t.code} và toàn bộ nhật ký sẽ bị xóa vĩnh viễn.`, 'Xóa', true)) {
      try { await deleteDoc(doc(db, 'tasks', t.id)); toast('Đã xóa công việc.'); go('viec-cua-toi'); } catch (err) { toast(errMsg(err)); }
    }
  });
}

function reportDialog(id, completing) {
  const t0 = getTask(id); if (!t0) return; const i0 = info(t0); const cur = i0.cur; if (!cur) return;
  openModal(`<h3>${completing ? 'Hoàn thành bước' : 'Báo cáo tiến độ'}</h3>
    <p class="hint">Bước ${i0.curIdx + 1}/${i0.total}: <b>${esc(cur.name)}</b> · Hạn ${fmtD(cur.due)} · Người báo cáo: <b>${esc(S.me.name)}</b></p>
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Nội dung ${completing ? '(tùy chọn)' : '<span class="req">*</span>'}</label><textarea class="in" id="mTx" placeholder="${completing ? 'Kết quả, ghi chú khi hoàn thành' : 'Đã làm được gì, vướng mắc, kế hoạch tiếp theo…'}"></textarea></div>
      ${completing ? '' : `<div><label class="f">Mức độ hoàn thành bước: <span id="pv">${+cur.pct || 0}%</span></label><input type="range" id="mPct" min="0" max="100" step="5" value="${+cur.pct || 0}" style="width:100%"></div>
      <label class="chk"><input type="checkbox" id="mDone"> Đánh dấu hoàn thành bước này, chuyển bước tiếp theo</label>`}
      ${filePicker()}
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn ${completing ? 'green' : ''}" data-ok>${completing ? 'Xác nhận hoàn thành' : 'Gửi báo cáo'}</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal;
    const pr = b.querySelector('#mPct'); if (pr) pr.oninput = () => b.querySelector('#pv').textContent = pr.value + '%';
    b.querySelector('#mTx').focus();
    const getPicked = wirePicker(b);
    b.querySelector('[data-ok]').onclick = async e => {
      const text = b.querySelector('#mTx').value.trim();
      const done = completing || b.querySelector('#mDone').checked;
      const picked = getPicked();
      if (!completing && !text && !done && !picked.length) { toast('Vui lòng nhập nội dung báo cáo.'); return; }
      const btn = e.target, label = btn.textContent; btn.disabled = true;
      try {
        let files = [];
        if (picked.length) {
          try { files = await uploadAll(id, picked, btn); }
          catch (err) { btn.disabled = false; btn.textContent = label; toast(err.message || 'Tải file thất bại.'); return; }
          btn.textContent = 'Đang lưu…';
        }
        let finished = false;
        await mutateTask(id, t => {
          const k = t.steps.findIndex(s => s.status !== 'done'); if (k < 0) return;
          const s = t.steps[k]; const now = Date.now(); t.log = t.log || [];
          const fx = files.length ? { files } : {};
          const repHere = !completing && (text || !done || files.length);
          if (repHere) {
            s.pct = done ? 100 : +pr.value;
            t.log.unshift(logEntry('report', text, { step: s.name, pct: s.pct, ...fx }));
          }
          if (done) {
            s.status = 'done'; s.pct = 100; s.doneAt = now; s.doneBy = S.me.name;
            t.log.unshift({ ...logEntry('done', completing ? text : '', { step: s.name, ...(repHere ? {} : fx) }), t: now + 1 });
            if (t.steps.every(x => x.status === 'done')) { t.completedAt = now; finished = true; }
          }
        });
        closeModal(); toast(done ? (finished ? 'Công việc đã hoàn thành!' : 'Đã chuyển sang bước tiếp theo.') : 'Đã gửi báo cáo.');
        if (done) notify(id, finished ? 'done' : 'next');
      } catch (err) { btn.disabled = false; btn.textContent = label; toast(errMsg(err)); }
    };
  });
}
function returnDialog(id) {
  const t0 = getTask(id); if (!t0) return;
  const last = t0.steps.map((s, k) => [s, k]).filter(([s]) => s.status === 'done').pop(); if (!last) return;
  openModal(`<h3>Trả lại bước trước</h3><p class="hint">Bước <b>${esc(last[0].name)}</b> sẽ chuyển về trạng thái đang xử lý.</p>
    <div style="margin-top:12px"><label class="f">Lý do trả lại <span class="req">*</span></label><textarea class="in" id="mTx" placeholder="Nội dung cần bổ sung, chỉnh sửa…"></textarea></div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn warn" data-ok>Trả lại</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal;
    b.querySelector('[data-ok]').onclick = async e => {
      const text = b.querySelector('#mTx').value.trim(); if (!text) { toast('Vui lòng nhập lý do.'); return; }
      e.target.disabled = true;
      try {
        await mutateTask(id, t => {
          const k = t.steps.map(s => s.status).lastIndexOf('done'); if (k < 0) return;
          const s = t.steps[k]; s.status = 'pending'; s.pct = 50; delete s.doneAt; delete s.doneBy; delete t.completedAt;
          t.log = [logEntry('return', text, { step: s.name }), ...(t.log || [])];
        });
        closeModal(); toast('Đã trả lại bước ' + last[0].name);
      } catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  });
}
function editDialog(id) {
  const t0 = clone(getTask(id)); if (!t0) return;
  const rows = t0.steps.map(s => ({ ...s }));
  openModal(`<h3>Chỉnh sửa công việc</h3><p class="hint">Các bước đã hoàn thành được giữ nguyên trạng thái.</p>
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Tên công việc</label><input class="in" id="eT" value="${esc(t0.title)}"></div>
      <div><label class="f">Nội dung, yêu cầu</label><textarea class="in" id="eD">${esc(t0.desc || '')}</textarea></div>
      <div class="grid g3">
        <div><label class="f">Người thực hiện</label><select class="in" id="eA">${userOptions(t0.assigneeUid)}</select></div>
        <div><label class="f">Mức độ</label><select class="in" id="eP">${Object.entries(PRIO).map(([k, v]) => `<option value="${k}" ${t0.priority === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label class="f">Ngày bắt đầu</label><input class="in" type="date" id="eS" value="${esc(t0.start)}"></div>
      </div>
      <label class="chk"><input type="checkbox" id="eW" ${t0.workdays ? 'checked' : ''}> Chỉ tính ngày làm việc</label>
      <div><label class="f">Quy trình xử lý · Hạn hoàn thành: <span id="eDue"></span></label><div id="eSe"></div></div>
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Lưu thay đổi</button></div>`, b => {
    b.classList.add('wide');
    const se = b.querySelector('#eSe');
    se.addEventListener('duechange', e => b.querySelector('#eDue').textContent = fmtD(e.detail));
    const ed = stepEditor(se, rows, () => b.querySelector('#eS').value || ymd(), () => b.querySelector('#eW').checked);
    b.querySelector('#eS').onchange = ed.updDue; b.querySelector('#eW').onchange = ed.updDue;
    b.querySelector('[data-x]').onclick = closeModal;
    b.querySelector('[data-ok]').onclick = async e => {
      const steps = validSteps(rows); if (!steps.length) { toast('Quy trình cần ít nhất 1 bước.'); return; }
      const title = b.querySelector('#eT').value.trim(); if (!title) { toast('Nhập tên công việc.'); return; }
      const v = { title, desc: b.querySelector('#eD').value.trim(), assigneeUid: b.querySelector('#eA').value, priority: b.querySelector('#eP').value, start: b.querySelector('#eS').value, workdays: b.querySelector('#eW').checked };
      e.target.disabled = true;
      try {
        await mutateTask(id, t => {
          Object.assign(t, v); if (!t.start) t.start = ymd();
          t.assigneeName = uname(t.assigneeUid, t.assigneeName); t.unit = (S.users[t.assigneeUid] || {}).unit || t.unit || '';
          // keep live step status from server where step ids match
          const live = Object.fromEntries((t.steps || []).map(s => [s.id, s]));
          t.steps = packSteps(steps.map(s => { const l = live[s.id]; return l ? { ...s, status: l.status, pct: l.pct, doneAt: l.doneAt, doneBy: l.doneBy } : { ...s, status: 'pending', pct: 0 }; }));
          if (t.steps.every(x => x.status === 'done')) t.completedAt = t.completedAt || Date.now(); else delete t.completedAt;
          recompute(t);
          t.log = [logEntry('edit', `Cập nhật thông tin / quy trình (${t.steps.length} bước, hạn ${fmtD(t.due)}).`), ...(t.log || [])];
        }, ['title', 'desc', 'assigneeUid', 'assigneeName', 'unit', 'priority', 'start', 'workdays', 'steps', 'due', 'memberUids', 'log', 'completedAt', 'updatedAt']);
        closeModal(); toast('Đã lưu thay đổi.');
        if (v.assigneeUid && v.assigneeUid !== t0.assigneeUid) notify(id, 'assign');
      } catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  });
}

/* ================= LOOKUP ================= */
function vLookup(a) {
  a.innerHTML = `
    <div class="lk"><div class="card">
      <h2 class="pg">Tra cứu tiến độ công việc</h2>
      <p class="sub" style="margin:0">Nhập mã công việc được cấp khi giao việc.</p>
      <form id="lkF"><input class="in" id="lkQ" placeholder="VD: GV261119-K7QM" value="${esc(S.lookupQ)}" autocapitalize="characters"><button class="btn" type="submit">Tra cứu</button></form>
    </div></div><div class="lk-res" id="lkR"></div>`;
  const draw = () => {
    const q = S.lookupQ.trim().toUpperCase(), box = $('#lkR'); if (!q) { box.innerHTML = ''; return; }
    const t = S.tasks.find(x => (x.code || '').toUpperCase() === q);
    if (!t) { box.innerHTML = `<div class="card empty">Không tìm thấy công việc mã <b>${esc(q)}</b> trong phạm vi bạn được xem.</div>`; return; }
    const i = info(t);
    box.innerHTML = `<div class="card pad">
      <div class="row1"><span class="code">${esc(t.code)}</span>${stBadge(i)}</div>
      <div class="ttl">${esc(t.title)}</div>
      <div class="meta" style="margin-bottom:14px"><span>Thực hiện: <b>${esc(uname(t.assigneeUid, t.assigneeName))}</b></span><span>Hạn: <b>${fmtD(t.due)}</b> · ${leftText(i)}</span><span>Tiến độ: <b>${i.pct}%</b></span></div>
      ${stepperHTML(t, i)}
      <div style="margin-top:14px;text-align:right"><a class="btn ghost" href="#hs-${esc(t.id)}">Xem chi tiết →</a></div></div>`;
  };
  $('#lkF').onsubmit = e => { e.preventDefault(); S.lookupQ = $('#lkQ').value; draw(); };
  draw();
}

/* ================= TEMPLATES ================= */
function vTpl(a) {
  const w = isMgr();
  a.innerHTML = `
    <div class="sec-h" style="margin-bottom:4px"><h2 class="pg" style="margin:0">Mẫu quy trình</h2>${w ? '<button class="btn" id="nTpl">+ Tạo mẫu mới</button>' : ''}</div>
    <p class="sub">Khi giao việc, chọn mẫu rồi tùy chỉnh thêm bước riêng.</p>
    <div class="tpls">${allTemplates().map(tp => `
      <div class="card tpl">
        <div class="sec-h" style="margin:0"><h3>${esc(tp.name)}</h3>${tp.builtin ? '<span class="badge st-pend">Có sẵn</span>' : (w ? `<button class="btn dghost sm" data-del="${esc(tp.id)}">Xóa</button>` : '')}</div>
        <div class="hint">${tp.steps.length} bước · ${tp.steps.reduce((s, x) => s + (+x.days || 0), 0)} ngày</div>
        <ol>${tp.steps.map(s => `<li>${esc(s.name)} <span>(${s.days} ngày)</span></li>`).join('')}</ol>
      </div>`).join('')}</div>`;
  $$('[data-del]', a).forEach(b => b.onclick = async () => {
    const tp = S.templates.find(x => x.id === b.dataset.del); if (!tp) return;
    if (await confirmBox('Xóa mẫu?', `Xóa mẫu "${tp.name}"? Các việc đã giao không bị ảnh hưởng.`, 'Xóa', true)) {
      try { await deleteDoc(doc(db, 'templates', tp.id)); toast('Đã xóa mẫu.'); } catch (err) { toast(errMsg(err)); }
    }
  });
  const nb = $('#nTpl'); if (nb) nb.onclick = () => {
    const rows = [{ id: rid(6), name: '', days: 1, status: 'pending' }];
    openModal(`<h3>Tạo mẫu quy trình</h3>
      <div class="grid" style="margin-top:12px"><div><label class="f">Tên mẫu</label><input class="in" id="tN" placeholder="VD: Nghiệm thu hệ thống PCCC"></div><div id="tSe"></div></div>
      <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Lưu mẫu</button></div>`, b => {
      b.classList.add('wide');
      stepEditor(b.querySelector('#tSe'), rows, () => ymd(), () => true, false);
      b.querySelector('#tN').focus(); b.querySelector('[data-x]').onclick = closeModal;
      b.querySelector('[data-ok]').onclick = async () => {
        const name = b.querySelector('#tN').value.trim(), steps = validSteps(rows);
        if (!name) { toast('Nhập tên mẫu.'); return; } if (!steps.length) { toast('Cần ít nhất 1 bước.'); return; }
        closeModal();
        try { await setDoc(doc(db, 'templates', rid(10)), { name, steps: steps.map(s => ({ name: s.name, days: +s.days || 0 })), createdAt: Date.now(), by: S.me.uid }); toast('Đã lưu mẫu.'); }
        catch (err) { toast(errMsg(err)); }
      };
    });
  };
}

/* ================= USERS (admin) ================= */
let secAuth = null;
async function getSecAuth() {
  if (secAuth) return secAuth;
  const sec = initializeApp(firebaseConfig, 'secondary');
  secAuth = getAuth(sec); await setPersistence(secAuth, inMemoryPersistence);
  return secAuth;
}
function vUsers(a) {
  const list = Object.values(S.users).sort((x, y) => (y.active - x.active) || x.name.localeCompare(y.name, 'vi'));
  a.innerHTML = `
    <div class="sec-h" style="margin-bottom:4px"><h2 class="pg" style="margin:0">Tài khoản</h2><button class="btn" id="nU">+ Cấp tài khoản</button></div>
    <p class="sub">${list.filter(u => u.active).length} tài khoản đang hoạt động. Quản lý: giao việc & xem tất cả · Nhân viên: chỉ thấy và báo cáo việc của mình.</p>
    <div class="ulist">${list.map(u => `
      <div class="card urow ${u.active ? '' : 'off'}">
        <span class="av">${esc(initials(u.name))}</span>
        <div class="ui"><b>${esc(u.name)}</b><span>${esc(u.email)}${u.unit ? ' · ' + esc(u.unit) : ''}</span></div>
        <span class="badge role-${esc(u.role)}">${ROLE[u.role] || u.role}</span>
        ${u.active ? '' : '<span class="badge st-pend">Đã khóa</span>'}
        <button class="btn ghost sm" data-ed="${esc(u.uid)}">Sửa</button>
      </div>`).join('')}</div>`;
  $('#nU').onclick = newUserDialog;
  $$('[data-ed]', a).forEach(b => b.onclick = () => editUserDialog(b.dataset.ed));
}
const roleSelect = r => `<select class="in" id="uR">${Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
function newUserDialog() {
  openModal(`<h3>Cấp tài khoản mới</h3>
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Họ tên <span class="req">*</span></label><input class="in" id="uN"></div>
      <div><label class="f">Tên đăng nhập hoặc email <span class="req">*</span></label><input class="in" id="uE" autocapitalize="none">
        <div class="hint">Gõ <b>linh</b> → đăng nhập bằng <i>linh@${esc(LOGIN_DOMAIN)}</i>. Nên dùng email thật nếu muốn tự đặt lại mật khẩu qua email.</div></div>
      <div><label class="f">Mật khẩu ban đầu <span class="req">*</span></label><input class="in" id="uP" value="${rid(8, 'abcdefghjkmnpqrstuvwxyz23456789')}"><div class="hint">Gửi cho nhân viên; họ có thể tự đổi sau khi đăng nhập.</div></div>
      <div class="grid g2"><div><label class="f">Vai trò</label>${roleSelect('staff')}</div><div><label class="f">Bộ phận</label><input class="in" id="uU" placeholder="VD: Thiết kế, Thi công"></div></div>
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Tạo tài khoản</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal; b.querySelector('#uN').focus();
    b.querySelector('[data-ok]').onclick = async e => {
      const name = b.querySelector('#uN').value.trim(), login = b.querySelector('#uE').value.trim(), pw = b.querySelector('#uP').value;
      if (!name || !login) { toast('Nhập họ tên và tên đăng nhập.'); return; }
      if (pw.length < 6) { toast('Mật khẩu cần ít nhất 6 ký tự.'); return; }
      const email = toEmail(login); e.target.disabled = true;
      try {
        const sa = await getSecAuth();
        const cred = await createUserWithEmailAndPassword(sa, email, pw);
        const uid = cred.user.uid; await signOut(sa);
        await setDoc(doc(db, 'users', uid), { name, email, role: b.querySelector('#uR').value, unit: b.querySelector('#uU').value.trim(), active: true, createdAt: Date.now(), createdBy: S.me.uid });
        closeModal();
        const msg = `Tài khoản hệ thống giao việc ARCOTEK\nTrang: ${location.origin}${location.pathname}\nĐăng nhập: ${login.includes('@') ? email : login}\nMật khẩu: ${pw}`;
        openModal(`<h3>Đã tạo tài khoản</h3><p class="hint">Gửi thông tin này cho ${esc(name)} (qua Zalo):</p>
          <textarea class="in" id="cpT" style="min-height:120px">${esc(msg)}</textarea>
          <div class="mact"><button class="btn ghost" data-x>Đóng</button><button class="btn" data-c>Sao chép</button></div>`, b2 => {
          b2.querySelector('[data-x]').onclick = closeModal;
          b2.querySelector('[data-c]').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Đã sao chép.'); } catch { b2.querySelector('#cpT').select(); } };
        });
      } catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  });
}
function editUserDialog(uid) {
  const u = S.users[uid]; if (!u) return; const self = uid === S.me.uid;
  openModal(`<h3>Sửa tài khoản</h3><p class="hint">${esc(u.email)}</p>
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Họ tên</label><input class="in" id="uN" value="${esc(u.name)}"></div>
      <div class="grid g2"><div><label class="f">Vai trò</label>${self ? `<input class="in" value="${ROLE[u.role]}" disabled>` : roleSelect(u.role)}</div><div><label class="f">Bộ phận</label><input class="in" id="uU" value="${esc(u.unit || '')}"></div></div>
      ${self ? '' : `<label class="chk"><input type="checkbox" id="uA" ${u.active ? '' : 'checked'}> Khóa tài khoản (không đăng nhập, không xem được dữ liệu)</label>`}
      <div><button class="btn ghost sm" id="uRs" type="button">Gửi email đặt lại mật khẩu</button><div class="hint">Chỉ dùng được khi tài khoản là email thật.</div></div>
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Lưu</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal;
    b.querySelector('#uRs').onclick = async () => { try { await sendPasswordResetEmail(auth, u.email); toast('Đã gửi email đặt lại mật khẩu tới ' + u.email); } catch (err) { toast(errMsg(err)); } };
    b.querySelector('[data-ok]').onclick = async e => {
      const upd = { name: b.querySelector('#uN').value.trim() || u.name, unit: b.querySelector('#uU').value.trim() };
      if (!self) { upd.role = b.querySelector('#uR').value; upd.active = !b.querySelector('#uA').checked; }
      e.target.disabled = true;
      try { await updateDoc(doc(db, 'users', uid), upd); closeModal(); toast('Đã lưu.'); } catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  });
}
function pwDialog() {
  openModal(`<h3>Đổi mật khẩu</h3>
    <div class="grid" style="margin-top:12px">
      <div><label class="f">Mật khẩu hiện tại</label><input class="in" type="password" id="p0" autocomplete="current-password"></div>
      <div><label class="f">Mật khẩu mới (≥ 6 ký tự)</label><input class="in" type="password" id="p1" autocomplete="new-password"></div>
      <div><label class="f">Nhập lại mật khẩu mới</label><input class="in" type="password" id="p2" autocomplete="new-password"></div>
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Đổi mật khẩu</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal; b.querySelector('#p0').focus();
    b.querySelector('[data-ok]').onclick = async e => {
      const p0 = b.querySelector('#p0').value, p1 = b.querySelector('#p1').value, p2 = b.querySelector('#p2').value;
      if (p1.length < 6) { toast('Mật khẩu mới cần ít nhất 6 ký tự.'); return; }
      if (p1 !== p2) { toast('Mật khẩu nhập lại không khớp.'); return; }
      e.target.disabled = true;
      try {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, p0));
        await updatePassword(auth.currentUser, p1); closeModal(); toast('Đã đổi mật khẩu.');
      } catch (err) { e.target.disabled = false; toast(errMsg(err)); }
    };
  });
}

/* ================= modal ================= */
function openModal(html, mount) {
  const m = $('#modal'), b = m.querySelector('.mbox');
  b.className = 'mbox'; b.innerHTML = html; m.hidden = false; document.body.classList.add('noscroll');
  mount && mount(b);
}
function closeModal() { $('#modal').hidden = true; document.body.classList.remove('noscroll'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
function confirmBox(title, msg, ok, danger) {
  return new Promise(res => openModal(`<h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn ${danger ? 'danger' : ''}" data-ok>${esc(ok)}</button></div>`, b => {
    b.querySelector('[data-x]').onclick = () => { closeModal(); res(false); };
    b.querySelector('[data-ok]').onclick = () => { closeModal(); res(true); };
  }));
}
