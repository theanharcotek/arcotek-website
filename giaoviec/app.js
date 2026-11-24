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
  onSnapshot, writeBatch, runTransaction, deleteField, orderBy, limit,
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
  me: null, users: {}, tasks: [], templates: [], items: {}, moves: [], loaded: false,
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
function stopAll() { stopData(); if (S.profUnsub) { S.profUnsub(); S.profUnsub = null; } S.me = null; S.users = {}; S.tasks = []; S.templates = []; S.items = {}; S.moves = []; S.f = { st: 'all', q: '', scope: 'mine' }; }

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
  let got = 0; const need = 5;
  const ready = () => { if (++got >= need && !S.loaded) { S.loaded = true; rerender(true); } };
  const onErr = e => { toast(errMsg(e)); ready(); };
  let f1 = false, f2 = false, f3 = false, f4 = false, f5 = false;
  S.dataUnsubs.push(onSnapshot(collection(db, 'users'), snap => {
    S.users = {}; snap.docs.forEach(d => S.users[d.id] = { ...d.data(), uid: d.id });
    if (!f1) { f1 = true; ready(); } else rerender();
  }, onErr));
  S.dataUnsubs.push(onSnapshot(collection(db, 'templates'), snap => {
    S.templates = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (!f2) { f2 = true; ready(); } else if (S.route === 'tpl') render();
    const sel = $('#tplSel'); if (sel) fillTplSelect(sel, sel.value);
  }, onErr));
  S.dataUnsubs.push(onSnapshot(collection(db, 'items'), snap => {
    S.items = {}; snap.docs.forEach(d => S.items[d.id] = { ...d.data(), uid: d.id });
    if (!f4) { f4 = true; ready(); } else rerender();
  }, onErr));
  S.dataUnsubs.push(onSnapshot(query(collection(db, 'stock_moves'), orderBy('createdAt', 'desc'), limit(500)), snap => {
    S.moves = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    if (!f5) { f5 = true; ready(); } else rerender();
  }, onErr));
  let own = [], kt = [];
  const mergeTasks = () => { const m = new Map(); [...kt, ...own].forEach(t => m.set(t.id, t)); S.tasks = [...m.values()]; };
  if (!isMgr() && S.me.kho) {
    S.dataUnsubs.push(onSnapshot(query(collection(db, 'tasks'), where('formType', 'in', ['mua', 'vattu'])), snap => {
      kt = snap.docs.map(d => ({ ...clone(d.data()), id: d.id })); mergeTasks(); rerender();
    }, () => {}));
  }
  const q = isMgr() ? collection(db, 'tasks') : query(collection(db, 'tasks'), where('memberUids', 'array-contains', S.me.uid));
  S.dataUnsubs.push(onSnapshot(q, snap => {
    own = snap.docs.map(d => ({ ...clone(d.data()), id: d.id })); mergeTasks();
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
  const items = [['viec-cua-toi', 'list', 'Công việc'], ['don-tu', 'forms', 'Đơn từ <span class="nbadge" id="navBadge" hidden></span>'], ['kho', 'kho', 'Kho'], isMgr() && ['giao-viec', 'new', 'Giao việc mới'], ['tra-cuu', 'lookup', 'Tra cứu'], ['mau-quy-trinh', 'tpl', 'Mẫu quy trình'], isAdmin() && ['tai-khoan', 'users', 'Tài khoản']].filter(Boolean);
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

const HASH = { 'giao-viec': 'new', 'tra-cuu': 'lookup', 'mau-quy-trinh': 'tpl', 'tai-khoan': 'users', 'don-tu': 'forms', 'kho': 'kho' };
function parseHash() {
  const h = (location.hash || '').replace(/^#/, '');
  if (h.startsWith('hs-')) return ['detail', h.slice(3)];
  if (h.startsWith('don-moi-')) return ['formnew', h.slice(8)];
  if (h.startsWith('in-')) return ['print', h.slice(3)];
  if (h.startsWith('pk-')) return ['movep', h.slice(3)];
  return [HASH[h] || 'list', ''];
}
function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }
function markNav() {
  const r = S.route === 'movep' ? 'kho' : ['formnew', 'print'].includes(S.route) || (S.route === 'detail' && isForm(getTask(S.param))) ? 'forms' : S.route === 'detail' ? 'list' : S.route;
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  updateBadge();
}
function updateBadge() { const b = $('#navBadge'); if (!b || !S.me) return; const n = myPending().length; b.textContent = n; b.hidden = !n; }
function route() {
  if (!S.me) return;
  let [r, p] = parseHash();
  if ((r === 'new' && !isMgr()) || (r === 'users' && !isAdmin())) r = 'list';
  S.route = r; S.param = p; markNav(); render(); window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
function rerender(force) { if (S.me) { updateBadge(); if (force || ['list', 'detail', 'lookup', 'users', 'forms', 'print', 'kho', 'movep'].includes(S.route)) render(); } }
function render() {
  const a = $('#app'); if (!a) return;
  if (!S.loaded) { a.innerHTML = '<div class="empty">Đang tải dữ liệu…</div>'; return; }
  ({ list: vList, new: vNew, lookup: vLookup, tpl: vTpl, detail: vDetail, users: vUsers, forms: vForms, formnew: vFormNew, print: vPrint, kho: vKho, movep: vMovePrint })[S.route](a);
  markNav();
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
const SMALL_MAX = 20 * 1024 * 1024;          // ≤ 20 MB: gửi 1 lần qua script
const BIG_MAX = 2 * 1024 * 1024 * 1024;       // tối đa 2 GB/file
const CHUNK = 8 * 1024 * 1024;                // 8 MB mỗi phần (bội số 256 KB)
async function callScript(body) {
  const idToken = await auth.currentUser.getIdToken();
  const res = await fetch(UPLOAD_URL, { method: 'POST', body: JSON.stringify({ ...body, idToken }) });
  let j; try { j = await res.json(); } catch { throw new Error('Máy chủ lưu file không phản hồi.'); }
  if (j.error) throw new Error(j.error);
  return j;
}
function putChunk(url, blob, start, total, onProg) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    if (blob) x.setRequestHeader('Content-Range', `bytes ${start}-${start + blob.size - 1}/${total}`);
    else x.setRequestHeader('Content-Range', `bytes */${total}`);
    if (blob && onProg) x.upload.onprogress = e => onProg(start + e.loaded);
    x.onload = () => {
      if (x.status === 200 || x.status === 201) { try { resolve({ done: true, file: JSON.parse(x.responseText) }); } catch { reject(new Error('Phản hồi Drive không hợp lệ.')); } }
      else if (x.status === 308) { const r = x.getResponseHeader('Range'); resolve({ done: false, next: r ? +r.split('-')[1] + 1 : 0 }); }
      else reject(Object.assign(new Error('Drive báo lỗi ' + x.status), { status: x.status }));
    };
    x.onerror = () => reject(Object.assign(new Error('Mất kết nối mạng.'), { net: true }));
    x.send(blob || null);
  });
}
async function bigUpload(taskId, p, onProg) {
  const { uploadUrl } = await callScript({ action: 'start', taskId, name: p.name, mime: p.type, size: p.blob.size });
  const total = p.blob.size; let pos = 0, fails = 0, file = null;
  while (!file) {
    try {
      const r = await putChunk(uploadUrl, p.blob.slice(pos, Math.min(pos + CHUNK, total)), pos, total, onProg);
      if (r.done) file = r.file; else pos = r.next;
      fails = 0; onProg(pos);
    } catch (err) {
      if (err.status && err.status < 500) throw err;
      if (++fails > 6) throw new Error('Mạng không ổn định, tải file thất bại.');
      await new Promise(r => setTimeout(r, 1500 * fails));
      try { const q = await putChunk(uploadUrl, null, 0, total); if (q.done) file = q.file; else pos = q.next; } catch {}
    }
  }
  return await callScript({ action: 'finish', taskId, fileId: file.id });
}
async function uploadFile(taskId, f, onProg = () => {}) {
  const p = await prepFile(f);
  if (p.blob.size > BIG_MAX) throw new Error(`"${f.name}" vượt quá 2 GB.`);
  if (p.blob.size > SMALL_MAX) {
    const j = await bigUpload(taskId, p, b => onProg(b / p.blob.size));
    return { id: j.id, name: j.name, size: j.size, mime: j.mime, url: j.url };
  }
  onProg(0.3);
  const j = await callScript({ taskId, name: p.name, mime: p.type, data: await toB64(p.blob) });
  onProg(1);
  return { id: j.id, name: j.name, size: j.size, mime: j.mime, url: j.url };
}
const fileIcon = m => /^image\//.test(m) ? '🖼️' : /pdf/.test(m) ? '📄' : /sheet|excel|csv/.test(m) ? '📊' : /word|document/.test(m) ? '📝' : /dwg|dxf|acad/.test(m) ? '📐' : '📎';
const dlUrl = id => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download`;
const DL_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14"/></svg>';
const fileRow = (f, sub = '') => `<div class="file"><a class="fopen" href="${esc(f.url)}" target="_blank" rel="noopener" title="Xem file"><span>${fileIcon(f.mime || '')}</span><span class="fn">${esc(f.name)}${sub}</span><span class="fs">${fmtSize(f.size || 0)}</span></a>${f.id ? `<a class="fdl" href="${dlUrl(f.id)}" target="_blank" rel="noopener" title="Tải về">${DL_ICON}<span>Tải về</span></a>` : ''}</div>`;
const filesHTML = fs => (fs && fs.length) ? `<div class="files">${fs.map(f => fileRow(f)).join('')}</div>` : '';
const BIG_DL = 95 * 1024 * 1024; // Drive hỏi xác nhận quét virus với file > ~100 MB
function downloadAll(files) {
  const small = files.filter(f => f.id && (f.size || 0) <= BIG_DL), big = files.filter(f => f.id && (f.size || 0) > BIG_DL);
  small.forEach((f, i) => setTimeout(() => {
    const ifr = document.createElement('iframe'); ifr.style.display = 'none'; ifr.src = dlUrl(f.id);
    document.body.appendChild(ifr); setTimeout(() => ifr.remove(), 120000);
  }, i * 1500));
  let msg = small.length ? `Đang tải ${small.length} file… Nếu trình duyệt hỏi "tải nhiều file", hãy bấm Cho phép.` : '';
  if (big.length) msg += ` ${big.length} file trên 100 MB cần bấm "Tải về" riêng hoặc tải cả thư mục Drive.`;
  toast(msg.trim());
}
async function openFolder(taskId) {
  const w = window.open('', '_blank');
  try {
    const j = await callScript({ action: 'folder', taskId });
    if (w) w.location = j.url; else location.href = j.url;
  } catch (err) { if (w) w.close(); toast(err.message || 'Không mở được thư mục.'); }
}
function filePicker() {
  if (!UPLOAD_URL) return '';
  return `<div><label class="f">Đính kèm file (ảnh, PDF, bản vẽ, video… tối đa 2 GB/file)</label>
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
async function notify(taskId, type, extra = {}) {
  if (!UPLOAD_URL) return;
  try {
    const idToken = await auth.currentUser.getIdToken();
    const r = await fetch(UPLOAD_URL, { method: 'POST', body: JSON.stringify({ ...extra, action: 'notify', type, idToken, taskId }) });
    const j = await r.json();
    if (j.sent) setTimeout(() => toast(`Đã gửi email thông báo cho ${j.sent} người.`), 1500);
  } catch {}
}
async function uploadAll(taskId, list, btn) {
  const out = [];
  const guard = e => { e.preventDefault(); e.returnValue = ''; };
  window.addEventListener('beforeunload', guard);
  try {
    for (let i = 0; i < list.length; i++) {
      const pre = list.length > 1 ? `file ${i + 1}/${list.length}: ` : '';
      btn.textContent = `Đang tải ${pre}0%`;
      out.push(await uploadFile(taskId, list[i], fr => { btn.textContent = `Đang tải ${pre}${Math.min(100, Math.floor(fr * 100))}%`; }));
    }
  } finally { window.removeEventListener('beforeunload', guard); }
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
  return S.tasks.filter(t => !isForm(t)).filter(t => sc === 'all' ? true : sc === 'given' ? t.assignerUid === S.me.uid : isMine(t));
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
        ${filePicker()}
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
  const getPicked = wirePicker(f);
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
    const id = rid(14); const btn = f.querySelector('[type=submit]'); const label = btn.textContent; btn.disabled = true;
    try { await setDoc(doc(db, 'tasks', id), t); }
    catch (err) { toast(errMsg(err)); btn.disabled = false; return; }
    const picked = getPicked();
    if (picked.length) {
      try {
        const files = await uploadAll(id, picked, btn);
        btn.textContent = 'Đang lưu…';
        await mutateTask(id, x => { x.log = (x.log || []).map(l => l.type === 'create' ? { ...l, files: [...(l.files || []), ...files] } : l); }, ['log', 'updatedAt']);
      } catch (err) {
        btn.textContent = label;
        toast(`Đã giao việc ${t.code} nhưng chưa đính kèm được file: ${err.message || errMsg(err)} – có thể đính kèm lại khi báo cáo.`);
        go('hs-' + id); notify(id, 'assign'); return;
      }
    }
    toast(`Đã giao việc · Mã ${t.code}`); go('hs-' + id); notify(id, 'assign');
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
  if (isForm(t)) return vFormDetail(a, t);
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
      <div class="sec-h"><h3>Tài liệu đính kèm <span class="hint" style="font-weight:400">· ${all.length} file</span></h3>${all.length ? `<div class="dlbar"><button class="btn sm" id="dlAll" type="button">${DL_ICON} Tải tất cả</button>${UPLOAD_URL ? '<button class="btn ghost sm" id="dlFolder" type="button">Thư mục Drive (.zip)</button>' : ''}</div>` : ''}</div>
      ${all.length ? `<div class="files">${all.map(f => fileRow(f, `<small>${esc(f.by || '')} · ${fmtT(f.t)}${f.step ? ' · ' + esc(f.step) : ''}</small>`)).join('')}</div>` : `<p class="hint" style="margin:0">Chưa có file nào.${UPLOAD_URL && act && i.cur ? ' Đính kèm file khi bấm "Báo cáo tiến độ".' : ''}</p>`}
    </div>`; })()}`;
  const allFiles = (t.log || []).flatMap(l => l.files || []);
  $('#dlAll') && ($('#dlAll').onclick = () => downloadAll(allFiles));
  $('#dlFolder') && ($('#dlFolder').onclick = () => openFolder(t.id));
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
        <span class="badge role-${esc(u.role)}">${ROLE[u.role] || u.role}</span>${u.kho ? '<span class="badge st-done">Thủ kho</span>' : ''}
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
      <label class="chk"><input type="checkbox" id="uK" ${u.kho ? 'checked' : ''}> Thủ kho (được nhập, xuất kho và kiểm kê)</label>
      ${self ? '' : `<label class="chk"><input type="checkbox" id="uA" ${u.active ? '' : 'checked'}> Khóa tài khoản (không đăng nhập, không xem được dữ liệu)</label>`}
      <div><button class="btn ghost sm" id="uRs" type="button">Gửi email đặt lại mật khẩu</button><div class="hint">Chỉ dùng được khi tài khoản là email thật.</div></div>
    </div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn" data-ok>Lưu</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal;
    b.querySelector('#uRs').onclick = async () => { try { await sendPasswordResetEmail(auth, u.email); toast('Đã gửi email đặt lại mật khẩu tới ' + u.email); } catch (err) { toast(errMsg(err)); } };
    b.querySelector('[data-ok]').onclick = async e => {
      const upd = { name: b.querySelector('#uN').value.trim() || u.name, unit: b.querySelector('#uU').value.trim(), kho: b.querySelector('#uK').checked };
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

/* ================= ĐƠN TỪ – ĐỀ XUẤT (biểu mẫu + luồng duyệt) ================= */
const COMPANY = { name: 'CÔNG TY TNHH XÂY DỰNG KỸ THUẬT ARCOTEK', addr: 'Số 100, đường Đồng Khởi, phường Trảng Dài, thành phố Đồng Nai' };
const PAY = ['Chuyển khoản', 'Tiền mặt'];
const COLS = {
  mua: [{ k: 'ten', l: 'Tên hàng hóa / quy cách', t: 'text', w: '38%' }, { k: 'dvt', l: 'ĐVT', t: 'text', w: '9%' }, { k: 'sl', l: 'SL', t: 'num', w: '9%' }, { k: 'gia', l: 'Đơn giá', t: 'money', w: '17%' }, { k: 'tt', l: 'Thành tiền', t: 'calc', w: '17%' }],
  vattu: [{ k: 'ten', l: 'Tên vật tư', t: 'text', w: '36%' }, { k: 'qc', l: 'Quy cách / mã', t: 'text', w: '26%' }, { k: 'dvt', l: 'ĐVT', t: 'text', w: '12%' }, { k: 'sl', l: 'SL', t: 'num', w: '12%' }],
  chungtu: [{ k: 'nd', l: 'Nội dung chi', t: 'text', w: '40%' }, { k: 'so', l: 'Số HĐ / chứng từ', t: 'text', w: '18%' }, { k: 'ngay', l: 'Ngày', t: 'date', w: '16%' }, { k: 'tien', l: 'Số tiền', t: 'money', w: '18%' }],
};
const FORMS = {
  mua: {
    name: 'Đề nghị mua hàng', icon: '🛒', desc: 'Mua vật tư, thiết bị, dụng cụ, văn phòng phẩm. Kèm ảnh báo giá / hóa đơn.',
    steps: ['Trưởng bộ phận duyệt', 'Giám đốc duyệt', 'Kế toán thanh toán'],
    fields: [
      { k: 'congtrinh', l: 'Công trình / mục đích sử dụng', t: 'text', req: 1, ph: 'VD: Nhà xưởng ABC – KCN Amata' },
      { k: 'ncc', l: 'Nhà cung cấp đề xuất', t: 'text', ph: 'Tên cửa hàng / công ty, SĐT' },
      { k: 'items', l: 'Danh sách hàng cần mua', t: 'items', cols: 'mua', req: 1, full: 1 },
      { k: 'canngay', l: 'Cần có trước ngày', t: 'date' },
      { k: 'thanhtoan', l: 'Hình thức thanh toán', t: 'select', o: ['Chuyển khoản', 'Tiền mặt', 'Công nợ'] },
      { k: 'lydo', l: 'Lý do / ghi chú', t: 'textarea', full: 1 },
    ],
    files: 'Ảnh báo giá / hóa đơn', total: d => sumItems(d.items, 'mua'),
    sub: d => `${(d.items || []).length} mặt hàng · ${fmtMoney(sumItems(d.items, 'mua'))}`,
  },
  nghi: {
    name: 'Đơn xin nghỉ phép', icon: '🌴', desc: 'Nghỉ phép năm, nghỉ ốm, việc riêng… Tự tính số ngày nghỉ.',
    steps: ['Trưởng bộ phận duyệt', 'Giám đốc duyệt'],
    fields: [
      { k: 'loai', l: 'Loại nghỉ', t: 'select', req: 1, o: ['Nghỉ phép năm', 'Nghỉ ốm', 'Nghỉ việc riêng có lương (cưới, tang…)', 'Nghỉ không lương', 'Khác'] },
      { k: 'songay', l: 'Số ngày nghỉ (không tính Chủ nhật)', t: 'calc', f: d => leaveDays(d) ? leaveDays(d) + ' ngày' : '—' },
      { k: 'tu', l: 'Từ ngày', t: 'date', req: 1 }, { k: 'tubuoi', l: 'Bắt đầu từ buổi', t: 'select', o: ['Sáng', 'Chiều'] },
      { k: 'den', l: 'Đến hết ngày', t: 'date', req: 1 }, { k: 'denbuoi', l: 'Đến hết buổi', t: 'select', o: ['Chiều', 'Sáng'] },
      { k: 'lydo', l: 'Lý do', t: 'textarea', req: 1, full: 1 },
      { k: 'bangiao', l: 'Người nhận bàn giao công việc', t: 'user' },
      { k: 'lienhe', l: 'SĐT liên hệ khi nghỉ', t: 'text', ph: '09xx xxx xxx' },
    ],
    files: 'Giấy tờ kèm theo (giấy khám bệnh, thiệp cưới…)',
    check: d => (d.tu && d.den && d.den < d.tu) ? '"Đến ngày" phải sau "Từ ngày".' : (leaveDays(d) <= 0 ? 'Số ngày nghỉ không hợp lệ.' : ''),
    sub: d => `${fmtD(d.tu)} → ${fmtD(d.den)} · ${leaveDays(d)} ngày`,
  },
  tamung: {
    name: 'Đề nghị tạm ứng', icon: '💵', desc: 'Tạm ứng tiền mua vật tư, chi phí công trình, công tác…',
    steps: ['Trưởng bộ phận duyệt', 'Giám đốc duyệt', 'Kế toán chi tiền'],
    fields: [
      { k: 'sotien', l: 'Số tiền đề nghị tạm ứng', t: 'money', req: 1 },
      { k: 'bangchu', l: 'Bằng chữ', t: 'calc', f: d => d.sotien ? docSo(d.sotien) : '—' },
      { k: 'mucdich', l: 'Mục đích tạm ứng', t: 'textarea', req: 1, full: 1 },
      { k: 'congtrinh', l: 'Công trình', t: 'text' },
      { k: 'hanhoan', l: 'Hạn hoàn ứng / quyết toán', t: 'date' },
      { k: 'hinhthuc', l: 'Hình thức nhận', t: 'select', o: PAY },
      { k: 'stk', l: 'Số tài khoản nhận (nếu chuyển khoản)', t: 'text', ph: 'Số TK – Ngân hàng – Tên chủ TK' },
    ],
    total: d => +d.sotien || 0, sub: d => fmtMoney(d.sotien),
  },
  thanhtoan: {
    name: 'Đề nghị thanh toán / hoàn ứng', icon: '🧾', desc: 'Thanh toán chi phí đã chi, quyết toán tạm ứng. Kèm ảnh hóa đơn, chứng từ.',
    steps: ['Trưởng bộ phận duyệt', 'Giám đốc duyệt', 'Kế toán thanh toán'],
    fields: [
      { k: 'noidung', l: 'Nội dung thanh toán', t: 'text', req: 1, ph: 'VD: Hoàn ứng mua vật tư công trình ABC' },
      { k: 'congtrinh', l: 'Công trình', t: 'text' },
      { k: 'items', l: 'Bảng kê chứng từ', t: 'items', cols: 'chungtu', req: 1, full: 1 },
      { k: 'datamung', l: 'Số tiền đã tạm ứng (nếu có)', t: 'money' },
      { k: 'chenhlech', l: 'Còn phải thanh toán / (hoàn lại)', t: 'calc', f: d => { const x = sumItems(d.items, 'chungtu') - (+d.datamung || 0); return x >= 0 ? fmtMoney(x) : `(${fmtMoney(-x)}) – nộp lại công ty`; } },
      { k: 'hinhthuc', l: 'Hình thức nhận', t: 'select', o: PAY },
      { k: 'stk', l: 'Số tài khoản nhận (nếu chuyển khoản)', t: 'text', ph: 'Số TK – Ngân hàng – Tên chủ TK' },
    ],
    files: 'Ảnh hóa đơn, chứng từ', filesReq: 1, total: d => sumItems(d.items, 'chungtu'),
    sub: d => `${(d.items || []).length} chứng từ · ${fmtMoney(sumItems(d.items, 'chungtu'))}`,
  },
  vattu: {
    name: 'Đề nghị xuất vật tư', icon: '📦', desc: 'Xuất vật tư, thiết bị PCCC từ kho cho công trình.',
    steps: ['Chỉ huy trưởng / TBP duyệt', 'Thủ kho xuất kho'],
    fields: [
      { k: 'congtrinh', l: 'Công trình nhận', t: 'text', req: 1 },
      { k: 'ngaynhan', l: 'Ngày cần nhận', t: 'date', req: 1 },
      { k: 'items', l: 'Danh sách vật tư', t: 'items', cols: 'vattu', req: 1, full: 1 },
      { k: 'nguoinhan', l: 'Người nhận tại công trình', t: 'text' },
      { k: 'ghichu', l: 'Ghi chú (giao tận nơi, phương tiện…)', t: 'textarea', full: 1 },
    ],
    sub: d => `${d.congtrinh || ''} · ${(d.items || []).length} loại vật tư`,
  },
  congtac: {
    name: 'Đề nghị đi công tác', icon: '🚗', desc: 'Đi khảo sát, thi công, nghiệm thu ngoài tỉnh / xa văn phòng.',
    steps: ['Trưởng bộ phận duyệt', 'Giám đốc duyệt'],
    fields: [
      { k: 'diadiem', l: 'Nơi công tác', t: 'text', req: 1 },
      { k: 'nguoidi', l: 'Người đi cùng', t: 'text', ph: 'Họ tên những người đi cùng' },
      { k: 'tu', l: 'Từ ngày', t: 'date', req: 1 }, { k: 'den', l: 'Đến ngày', t: 'date', req: 1 },
      { k: 'mucdich', l: 'Mục đích, nội dung công việc', t: 'textarea', req: 1, full: 1 },
      { k: 'phuongtien', l: 'Phương tiện', t: 'select', o: ['Xe công ty', 'Xe cá nhân', 'Xe khách / taxi', 'Máy bay', 'Khác'] },
      { k: 'chiphi', l: 'Dự trù chi phí', t: 'money' },
    ],
    check: d => (d.tu && d.den && d.den < d.tu) ? '"Đến ngày" phải sau "Từ ngày".' : '',
    total: d => +d.chiphi || 0, sub: d => `${d.diadiem || ''} · ${fmtD(d.tu)} → ${fmtD(d.den)}`,
  },
};
const FORM_ORDER = ['mua', 'nghi', 'tamung', 'thanhtoan', 'vattu', 'congtac'];
const FORM_KEYS = ['steps', 'log', 'completedAt', 'updatedAt', 'rejected', 'cancelled'];

/* ---------- helpers ---------- */
const fmtMoney = n => (Math.round(+n || 0)).toLocaleString('vi-VN') + ' đ';
const parseMoney = s => +String(s || '').replace(/[^\d]/g, '') || 0;
const lineTotal = (r, c) => c === 'mua' ? (+r.sl || 0) * (+r.gia || 0) : c === 'chungtu' ? (+r.tien || 0) : 0;
const sumItems = (rows, c) => (rows || []).reduce((s, r) => s + lineTotal(r, c), 0);
function leaveDays(d) {
  if (!d.tu || !d.den || d.den < d.tu) return 0;
  let n = 0; for (let x = d.tu; x <= d.den; x = addDays(x, 1)) if (parseD(x).getDay() !== 0) n += 2;
  if (parseD(d.tu).getDay() !== 0 && d.tubuoi === 'Chiều') n -= 1;
  if (parseD(d.den).getDay() !== 0 && d.denbuoi === 'Sáng') n -= 1;
  return Math.max(0, n) / 2;
}
function docSo(num) {
  num = Math.round(+num || 0); if (!num) return 'Không đồng';
  const ch = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const doc3 = (x, full) => {
    const t = Math.floor(x / 100), c = Math.floor(x % 100 / 10), d = x % 10, s = [];
    if (full || t) s.push(ch[t] + ' trăm');
    if (c > 1) { s.push(ch[c] + ' mươi'); if (d === 1) s.push('mốt'); else if (d === 4) s.push('tư'); else if (d === 5) s.push('lăm'); else if (d) s.push(ch[d]); }
    else if (c === 1) { s.push('mười'); if (d === 5) s.push('lăm'); else if (d) s.push(ch[d]); }
    else if (d) { if (full || t) s.push('lẻ'); s.push(ch[d]); }
    return s.join(' ');
  };
  const g = []; for (let x = num; x > 0; x = Math.floor(x / 1000)) g.push(x % 1000);
  const unit = i => i === 0 ? '' : i % 3 === 1 ? ' nghìn' : i % 3 === 2 ? ' triệu' : ' tỷ';
  const parts = [];
  for (let i = g.length - 1; i >= 0; i--) { if (!g[i]) { if (i % 3 === 0 && i > 0 && parts.length) parts.push('tỷ'); continue; } parts.push(doc3(g[i], i < g.length - 1) + unit(i)); }
  const s = parts.join(' ').replace(/\s+/g, ' ').replace(/(tỷ )+tỷ/g, 'tỷ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1) + ' đồng';
}
const isForm = t => t && t.kind === 'form';
function fstat(t) {
  const i = info(t);
  if (t.cancelled) return { k: 'cancel', l: 'Đã hủy', c: 'st-pend', i };
  if (t.rejected) return { k: 'reject', l: 'Bị từ chối', c: 'st-late', i };
  if (i.st === 'done') return { k: 'ok', l: 'Đã duyệt', c: 'st-done', i };
  return { k: 'wait', l: `Chờ duyệt ${i.curIdx + 1}/${i.total}`, c: 'st-soon', i };
}
const fClosed = t => !!(t.cancelled || t.rejected || info(t).st === 'done');
const myPending = () => S.tasks.filter(t => isForm(t) && !fClosed(t) && (info(t).cur || {}).ownerUid === S.me.uid);
function fieldText(f, d) {
  const v = d[f.k];
  if (f.t === 'calc') return f.f(d);
  if (f.t === 'money') return v ? fmtMoney(v) : '';
  if (f.t === 'date') return v ? fmtD(v) : '';
  if (f.t === 'user') return v ? uname(v) : '';
  return v == null ? '' : String(v);
}
function itemsText(rows, c) {
  const cols = COLS[c];
  return (rows || []).map((r, i) => `${i + 1}. ` + cols.filter(x => x.t !== 'calc').map(x => x.t === 'money' ? fmtMoney(r[x.k]) : x.t === 'date' ? fmtD(r[x.k]) : (r[x.k] || '')).filter(Boolean).join(' · ') + (c === 'mua' ? ` = ${fmtMoney(lineTotal(r, c))}` : '')).join('\n') +
    (c !== 'vattu' && rows && rows.length ? `\nTổng cộng: ${fmtMoney(sumItems(rows, c))}` : '');
}
function formSummary(type, d) {
  const F = FORMS[type];
  return F.fields.map(f => ({ k: f.l, v: f.t === 'items' ? itemsText(d[f.k], f.cols) : fieldText(f, d) })).filter(x => x.v && x.v !== '—');
}

/* ---------- ITEMS TABLE ---------- */
function itemsEditor(box, rows, c, onChange) {
  const cols = COLS[c];
  if (!rows.length) rows.push({});
  function cell(col, r, i) {
    if (col.t === 'calc') return `<td class="num tcalc" data-l="${col.l}" data-calc="${i}">${fmtMoney(lineTotal(r, c))}</td>`;
    const val = col.t === 'money' ? (r[col.k] ? (+r[col.k]).toLocaleString('vi-VN') : '') : esc(r[col.k] || '');
    const type = col.t === 'date' ? 'date' : 'text', im = col.t === 'num' || col.t === 'money' ? 'decimal' : 'text';
    return `<td data-l="${col.l}" class="c-${col.k}"><input ${c === 'vattu' && col.k === 'ten' ? 'list="dlItems" ' : ''}class="in ${col.t === 'money' || col.t === 'num' ? 'num' : ''}" data-i="${i}" data-c="${col.k}" data-t="${col.t}" type="${type}" inputmode="${im}" value="${val}" placeholder="${col.t === 'text' ? esc(col.l) : ''}"></td>`;
  }
  function draw() {
    const hasTotal = c !== 'vattu';
    box.innerHTML = `<div class="itbl-wrap"><table class="itbl edit it-${c}"><thead><tr><th style="width:4%">#</th>${cols.map(col => `<th style="width:${col.w}">${col.l}</th>`).join('')}<th style="width:5%"></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr><td class="no">${i + 1}</td>${cols.map(col => cell(col, r, i)).join('')}<td class="tdel"><button type="button" class="ib del" data-del="${i}" title="Xóa dòng">${ICON.x}</button></td></tr>`).join('')}</tbody>
      ${hasTotal ? `<tfoot><tr><td colspan="${cols.length}" class="num"><b>Tổng cộng</b></td><td colspan="2" class="num"><b id="itTotal">${fmtMoney(sumItems(rows, c))}</b></td></tr></tfoot>` : ''}</table></div>
      <button type="button" class="btn ghost sm" data-add style="margin-top:8px">+ Thêm dòng</button>`;
    $$('input', box).forEach(inp => inp.oninput = () => {
      const r = rows[+inp.dataset.i], t = inp.dataset.t;
      if (t === 'money') { const n = parseMoney(inp.value); r[inp.dataset.c] = n; inp.value = n ? n.toLocaleString('vi-VN') : ''; }
      else if (t === 'num') { r[inp.dataset.c] = inp.value.replace(',', '.'); }
      else r[inp.dataset.c] = inp.value;
      if (c === 'vattu' && inp.dataset.c === 'ten') {
        const it = findItem(inp.value); r.itemId = it ? it.uid : '';
        if (it) { const tr = inp.closest('tr'); r.dvt = it.unit || ''; r.qc = r.qc || it.spec || ''; const u = tr.querySelector('[data-c="dvt"]'), q = tr.querySelector('[data-c="qc"]'); if (u) u.value = r.dvt; if (q && !q.value) q.value = r.qc; inp.title = `Tồn kho: ${fmtQ(it.qty)} ${it.unit || ''}`; }
      }
      const cc = box.querySelector(`[data-calc="${inp.dataset.i}"]`); if (cc) cc.textContent = fmtMoney(lineTotal(r, c));
      const tt = box.querySelector('#itTotal'); if (tt) tt.textContent = fmtMoney(sumItems(rows, c));
      onChange && onChange();
    });
    $$('[data-del]', box).forEach(b => b.onclick = () => { rows.splice(+b.dataset.del, 1); if (!rows.length) rows.push({}); draw(); onChange && onChange(); });
    box.querySelector('[data-add]').onclick = () => { rows.push({}); draw(); const l = $$('tbody tr', box).pop(); l && l.querySelector('input').focus(); };
  }
  draw();
}

/* ---------- LIST ---------- */
function vForms(a) {
  const pend = myPending();
  if (!S.f.fscope) S.f.fscope = pend.length ? 'pending' : 'mine';
  const tabs = [['pending', `Chờ tôi duyệt${pend.length ? ` (${pend.length})` : ''}`], ['mine', 'Đơn của tôi'], ...(isMgr() ? [['all', 'Tất cả']] : [])];
  a.innerHTML = `
    <h2 class="pg">Đơn từ – Đề xuất</h2>
    <p class="sub">Chọn loại đơn, điền vào các ô có sẵn rồi gửi. Đơn được chuyển lần lượt tới người duyệt từng bước.</p>
    <div class="fgrid">${FORM_ORDER.map(k => `<a class="card fcard" href="#don-moi-${k}"><span class="fic">${FORMS[k].icon}</span><b>${FORMS[k].name}</b><span>${FORMS[k].desc}</span></a>`).join('')}</div>
    <div class="scope" style="margin-top:22px">${tabs.map(([k, l]) => `<button data-fs="${k}" class="${S.f.fscope === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="toolbar"><input class="in" id="fq" type="search" placeholder="Tìm theo mã đơn, người đề nghị, nội dung…" value="${esc(S.f.fq || '')}">
      <select class="in" id="ft"><option value="">Tất cả loại đơn</option>${FORM_ORDER.map(k => `<option value="${k}" ${S.f.ftype === k ? 'selected' : ''}>${FORMS[k].name}</option>`).join('')}</select></div>
    <div class="items" id="fitems"></div>`;
  $$('[data-fs]', a).forEach(b => b.onclick = () => { S.f.fscope = b.dataset.fs; vForms(a); });
  $('#fq').oninput = e => { S.f.fq = e.target.value; drawForms(); };
  $('#ft').onchange = e => { S.f.ftype = e.target.value; drawForms(); };
  drawForms();
}
function drawForms() {
  const box = $('#fitems'); if (!box) return;
  const q = (S.f.fq || '').trim().toLowerCase(), sc = S.f.fscope;
  const rows = S.tasks.filter(isForm)
    .filter(t => sc === 'all' ? true : sc === 'pending' ? myPending().includes(t) : t.assigneeUid === S.me.uid)
    .filter(t => !S.f.ftype || t.formType === S.f.ftype)
    .filter(t => !q || [t.code, t.title, uname(t.assigneeUid, t.assigneeName), ...(t.form?.summary || []).map(x => x.v)].join(' ').toLowerCase().includes(q))
    .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
  if (!rows.length) { box.innerHTML = `<div class="card empty">${sc === 'pending' ? 'Không có đơn nào đang chờ bạn duyệt.' : 'Chưa có đơn nào.'}</div>`; return; }
  box.innerHTML = rows.map(t => {
    const s = fstat(t), F = FORMS[t.formType] || {}, cur = s.i.cur;
    return `<a class="card task" href="#hs-${esc(t.id)}">
      <div class="row1"><span class="code">${esc(t.code)}</span><span class="badge ${s.c}">${s.l}</span>${prioBadge(t.priority)}</div>
      <div class="ttl">${F.icon || ''} ${esc(F.name || t.title)}</div>
      <div class="meta"><span>Người đề nghị: <b>${esc(uname(t.assigneeUid, t.assigneeName))}</b></span><span>Gửi: <b>${fmtT(t.createdAt)}</b></span>
        ${F.sub ? `<span>${esc(F.sub(t.form?.data || {}))}</span>` : ''}
        ${s.k === 'wait' && cur ? `<span>Đang chờ: <b>${esc(uname(cur.ownerUid, cur.ownerName))}</b> (${esc(cur.name)})</span>` : ''}</div>
      <div class="dots">${(t.steps || []).map((st, k) => `<span class="${st.status === 'done' ? 'd' : k === s.i.curIdx && s.k === 'wait' ? 'c' : s.k === 'reject' && k === s.i.curIdx ? 'c l' : ''}"></span>`).join('')}</div>
    </a>`;
  }).join('');
}

/* ---------- NEW FORM ---------- */
function vFormNew(a) {
  const type = S.param, F = FORMS[type];
  if (!F) { go('don-tu'); return; }
  const data = { items: [] };
  let saved = []; try { saved = JSON.parse(localStorage.getItem('gv_appr_' + type) || '[]'); } catch {}
  const others = activeUsers().filter(u => u.uid !== S.me.uid);
  const fieldHTML = f => {
    const req = f.req ? ' <span class="req">*</span>' : '';
    const lab = `<label class="f">${f.l}${req}</label>`;
    let inp = '';
    if (f.t === 'text') inp = `<input class="in" data-k="${f.k}" placeholder="${esc(f.ph || '')}">`;
    else if (f.t === 'textarea') inp = `<textarea class="in" data-k="${f.k}" placeholder="${esc(f.ph || '')}"></textarea>`;
    else if (f.t === 'date') inp = `<input class="in" type="date" data-k="${f.k}">`;
    else if (f.t === 'money') inp = `<div class="money"><input class="in num" data-k="${f.k}" data-t="money" inputmode="numeric" placeholder="0"><span>đ</span></div>`;
    else if (f.t === 'select') inp = `<select class="in" data-k="${f.k}">${f.req ? '<option value="">— Chọn —</option>' : ''}${f.o.map(o => `<option>${esc(o)}</option>`).join('')}</select>`;
    else if (f.t === 'user') inp = `<select class="in" data-k="${f.k}">${userOptions('', '— Chọn người —')}</select>`;
    else if (f.t === 'calc') inp = `<div class="calcv" data-calc-k="${f.k}">—</div>`;
    else if (f.t === 'items') inp = `<div data-items="${f.k}"></div>`;
    return `<div class="${f.full ? 'ffull' : ''}">${lab}${inp}</div>`;
  };
  a.innerHTML = `
    ${type === 'vattu' ? itemsDatalist() : ''}<div class="crumb"><a href="#don-tu">← Đơn từ</a> / Tạo đơn mới</div>
    <h2 class="pg">${F.icon} ${F.name}</h2><p class="sub">${F.desc}</p>
    <form id="fForm" class="grid" novalidate>
      <div class="card pad">
        <div class="ginfo"><div><span>Người đề nghị</span><b>${esc(S.me.name)}</b></div><div><span>Bộ phận</span><b>${esc(S.me.unit || '—')}</b></div><div><span>Ngày lập</span><b>${fmtD(ymd())}</b></div>
          <div><span>Mức độ</span><select class="in" id="fPrio"><option value="normal">Bình thường</option><option value="urgent">Gấp</option><option value="hot">Hỏa tốc</option></select></div></div>
        <div class="fgrid2">${F.fields.map(fieldHTML).join('')}</div>
        ${UPLOAD_URL ? `<div style="margin-top:14px"><label class="f">${F.files || 'Đính kèm file'}${F.filesReq ? ' <span class="req">*</span>' : ''}</label>
          <label class="btn ghost sm" style="cursor:pointer"><input type="file" id="mF" multiple hidden accept="${F.filesReq || F.files?.includes('Ảnh') ? 'image/*,application/pdf,.doc,.docx,.xls,.xlsx' : ''}"> 📷 Chụp / chọn file</label>
          <div id="mFL" class="hint"></div></div>` : ''}
      </div>
      <div class="card pad">
        <div class="sec-h"><h3>Người duyệt</h3><span class="hint">Đơn đi lần lượt từ trên xuống. Để trống bước nào thì bỏ qua bước đó.</span></div>
        <div class="appr">${F.steps.map((n, i) => `<div class="apr"><span class="no">${i + 1}</span><span class="an">${esc(n)}</span>
          <select class="in" data-appr="${i}"><option value="">— Bỏ qua bước này —</option>${others.map(u => `<option value="${esc(u.uid)}" ${saved[i] === u.uid ? 'selected' : ''}>${esc(u.name)}${u.unit ? ' – ' + esc(u.unit) : ''} (${ROLE[u.role] || ''})</option>`).join('')}</select></div>`).join('')}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><a class="btn ghost" href="#don-tu">Hủy</a><button class="btn" type="submit">Gửi đơn</button></div>
    </form>`;
  const f = $('#fForm');
  const read = () => {
    $$('[data-k]', f).forEach(el => { data[el.dataset.k] = el.dataset.t === 'money' ? parseMoney(el.value) : el.value.trim(); });
    $$('[data-calc-k]', f).forEach(el => { const fd = F.fields.find(x => x.k === el.dataset.calcK); el.textContent = fd.f(data); });
  };
  $$('[data-k]', f).forEach(el => {
    el.addEventListener('input', () => { if (el.dataset.t === 'money') { const n = parseMoney(el.value); el.value = n ? n.toLocaleString('vi-VN') : ''; } read(); });
    el.addEventListener('change', read);
  });
  $$('[data-items]', f).forEach(box => { const fd = F.fields.find(x => x.k === box.dataset.items); data[fd.k] = []; itemsEditor(box, data[fd.k], fd.cols, read); });
  const getPicked = wirePicker(f);
  read();
  f.onsubmit = async e => {
    e.preventDefault(); read();
    for (const fd of F.fields) {
      if (!fd.req) continue;
      if (fd.t === 'items') { data[fd.k] = (data[fd.k] || []).filter(r => Object.values(r).some(v => String(v).trim())); if (!data[fd.k].length) { toast(`Vui lòng nhập "${fd.l}".`); return; } }
      else if (!data[fd.k]) { toast(`Vui lòng nhập "${fd.l}".`); const el = f.querySelector(`[data-k="${fd.k}"]`); el && el.focus(); return; }
    }
    for (const fd of F.fields) if (fd.t === 'items') data[fd.k] = (data[fd.k] || []).filter(r => Object.values(r).some(v => String(v).trim()));
    const msg = F.check && F.check(data); if (msg) { toast(msg); return; }
    const picked = getPicked();
    if (F.filesReq && UPLOAD_URL && !picked.length) { toast(`Vui lòng đính kèm ${F.files.toLowerCase()}.`); return; }
    const appr = $$('[data-appr]', f).map(s => s.value);
    if (!appr.some(Boolean)) { toast('Chọn ít nhất 1 người duyệt.'); return; }
    try { localStorage.setItem('gv_appr_' + type, JSON.stringify(appr)); } catch {}
    const steps = F.steps.map((n, i) => ({ n, u: appr[i] })).filter(x => x.u);
    const t = {
      kind: 'form', formType: type, code: 'DT' + newCode().slice(2), title: `${F.name} – ${S.me.name}`, desc: '',
      assignerUid: S.me.uid, assignerName: S.me.name, assigneeUid: S.me.uid, assigneeName: S.me.name, unit: S.me.unit || '',
      priority: $('#fPrio').value, start: ymd(), workdays: true, createdAt: Date.now(), updatedAt: Date.now(),
      form: { type, data: clone(data), summary: formSummary(type, data), total: F.total ? F.total(data) : 0 },
      steps: packSteps(steps.map(x => ({ name: x.n, ownerUid: x.u, days: 1, status: 'pending', pct: 0 }))),
      log: [logEntry('create', `Gửi ${F.name.toLowerCase()}.`)],
    };
    recompute(t);
    const id = rid(14), btn = f.querySelector('[type=submit]'), label = btn.textContent; btn.disabled = true;
    try { await setDoc(doc(db, 'tasks', id), t); }
    catch (err) { toast(errMsg(err)); btn.disabled = false; return; }
    if (picked.length) {
      try {
        const files = await uploadAll(id, picked, btn);
        btn.textContent = 'Đang lưu…';
        await mutateTask(id, x => { x.log = (x.log || []).map(l => l.type === 'create' ? { ...l, files } : l); }, ['log', 'updatedAt']);
      } catch (err) { btn.textContent = label; toast(`Đã gửi đơn nhưng chưa đính kèm được file: ${err.message || errMsg(err)} – có thể bổ sung sau.`); }
    }
    toast(`Đã gửi đơn · Mã ${t.code}`); go('hs-' + id); notify(id, 'next');
  };
}

/* ---------- DETAIL ---------- */
function formContentHTML(t) {
  const F = FORMS[t.formType] || { fields: [] }, d = (t.form && t.form.data) || {};
  const rowsHTML = F.fields.map(f => {
    if (f.t === 'items') {
      const cols = COLS[f.cols], rows = d[f.k] || [];
      return `<tr><td colspan="2" class="fit"><div class="fk">${f.l}</div><div class="itbl-wrap"><table class="itbl view"><thead><tr><th>#</th>${cols.map(c => `<th>${c.l}</th>`).join('')}</tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td class="no">${i + 1}</td>${cols.map(c => `<td class="${['money', 'calc', 'num'].includes(c.t) ? 'num' : ''}">${c.t === 'calc' ? fmtMoney(lineTotal(r, f.cols)) : c.t === 'money' ? fmtMoney(r[c.k]) : c.t === 'date' ? fmtD(r[c.k]) : esc(r[c.k] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
        ${f.cols !== 'vattu' ? `<tfoot><tr><td colspan="${cols.length}" class="num"><b>Tổng cộng</b></td><td class="num"><b>${fmtMoney(sumItems(rows, f.cols))}</b></td></tr><tr><td colspan="${cols.length + 1}" class="num"><i>Bằng chữ: ${docSo(sumItems(rows, f.cols))}</i></td></tr></tfoot>` : ''}</table></div></td></tr>`;
    }
    const v = fieldText(f, d); if (!v || v === '—') return '';
    return `<tr><td class="fk">${f.l}</td><td class="fv">${esc(v)}</td></tr>`;
  }).join('');
  return `<table class="ftbl">${rowsHTML}</table>`;
}
function vFormDetail(a, t) {
  const s = fstat(t), i = s.i, F = FORMS[t.formType] || { name: t.title, icon: '' };
  const me = S.me.uid, closed = fClosed(t), cur = i.cur;
  const canApprove = !closed && cur && (cur.ownerUid === me || isAdmin());
  const isReq = t.assigneeUid === me;
  const files = (t.log || []).flatMap(l => (l.files || []).map(f => ({ ...f, by: l.by, t: l.t })));
  const LOGT = { create: 'Gửi đơn', approve: 'Đã duyệt', done: 'Đã duyệt', reject: 'Từ chối', comment: 'Trao đổi', report: 'Trao đổi', cancel: 'Hủy đơn', return: 'Trả lại', edit: 'Chỉnh sửa' };
  a.innerHTML = `
    <div class="crumb"><a href="#don-tu">← Đơn từ</a> / Chi tiết đơn</div>
    <div class="card dhead">
      <div class="row1"><span class="code">${esc(t.code)}</span><span class="badge ${s.c}">${s.l}</span>${prioBadge(t.priority)}</div>
      <h1>${F.icon} ${esc(F.name)}</h1>
      <div class="info">
        <div><div class="k">Người đề nghị</div><div class="v">${esc(uname(t.assigneeUid, t.assigneeName))}</div></div>
        <div><div class="k">Bộ phận</div><div class="v">${esc(t.unit || '—')}</div></div>
        <div><div class="k">Ngày gửi</div><div class="v">${fmtT(t.createdAt)}</div></div>
        <div><div class="k">${s.k === 'wait' ? 'Đang chờ duyệt' : 'Trạng thái'}</div><div class="v">${s.k === 'wait' && cur ? esc(uname(cur.ownerUid, cur.ownerName)) : s.l}</div></div>
      </div>
      ${t.rejected ? `<div class="alert bad"><b>Từ chối bởi ${esc(t.rejected.by)}</b> (${fmtT(t.rejected.at)}): ${esc(t.rejected.reason)}</div>` : ''}
      ${movesOfTask(t.id).map(m => `<div class="alert ok">${m.type === 'in' ? '📥 Đã nhập kho' : '📤 Đã xuất kho'}: <a href="#pk-${esc(m.id)}">${esc(m.code)}</a> · ${fmtD(m.date)} · ${(m.items || []).length} vật tư · ${esc(m.by || '')}</div>`).join('')}
      ${t.cancelled ? `<div class="alert">Đơn đã được ${esc(t.cancelled.by)} hủy lúc ${fmtT(t.cancelled.at)}.</div>` : ''}
      <div class="actions">
        ${canApprove && t.formType === 'vattu' && i.curIdx === t.steps.length - 1 && isKho() ? `<button class="btn green" id="fExp">✓ Duyệt & xuất kho</button><button class="btn dghost" id="fNo">✗ Từ chối</button><button class="btn warn" id="fAsk">Yêu cầu bổ sung</button>` : canApprove ? `<button class="btn green" id="fOk">✓ Duyệt</button><button class="btn dghost" id="fNo">✗ Từ chối</button><button class="btn warn" id="fAsk">Yêu cầu bổ sung</button>` : ''}
        ${!closed && isReq ? `<button class="btn ghost" id="fAdd">Bổ sung / trao đổi</button><button class="btn dghost" id="fCancel">Hủy đơn</button>` : ''}
        ${!closed && !isReq && !canApprove && (isMgr() || (t.memberUids || []).includes(me)) ? `<button class="btn ghost" id="fAdd">Trao đổi</button>` : ''}
        ${t.formType === 'mua' && s.k === 'ok' && isKho() && !movesOfTask(t.id).some(m => m.type === 'in') ? '<button class="btn green" id="fImp">📥 Nhập kho từ đơn này</button>' : ''}
        <a class="btn ghost" href="#in-${esc(t.id)}">🖨 In / Lưu PDF</a>
        ${isMgr() ? '<button class="btn dghost" id="fDel">Xóa</button>' : ''}
      </div>
    </div>
    <div class="cols">
      <div class="card pad"><div class="sec-h"><h3>Nội dung đơn</h3></div>${formContentHTML(t)}</div>
      <div>
        <div class="card pad">
          <div class="sec-h"><h3>Quy trình duyệt</h3><span class="hint">${i.doneN}/${i.total} bước</span></div>
          <ol class="tl">${(t.steps || []).map((st, k) => {
            const isCur = k === i.curIdx && !closed, rej = t.rejected && k === i.curIdx;
            const cls = st.status === 'done' ? 'done' : rej ? 'cur late' : isCur ? 'cur' : '';
            const badge = st.status === 'done' ? '<span class="badge st-done">Đã duyệt</span>' : rej ? '<span class="badge st-late">Từ chối</span>' : isCur ? '<span class="badge st-soon">Đang chờ</span>' : '<span class="badge st-pend">Chưa tới</span>';
            return `<li class="${cls}"><span class="n">${st.status === 'done' ? '✓' : rej ? '✗' : k + 1}</span><div class="b"><div class="h"><b>${esc(st.name)}</b>${badge}</div>
              <div class="m">${esc(uname(st.ownerUid, st.ownerName))}${st.doneAt ? ' · ' + fmtT(st.doneAt) : ''}</div></div></li>`;
          }).join('')}</ol>
        </div>
        <div class="card pad" style="margin-top:16px">
          <div class="sec-h"><h3>Lịch sử & trao đổi</h3><span class="hint">${(t.log || []).length} mục</span></div>
          <ul class="log">${(t.log || []).map(l => `<li>
            <div class="lh"><span class="tag ${esc(l.type)}">${LOGT[l.type] || 'Ghi chú'}</span><b>${esc(l.by || '')}</b><span>${fmtT(l.t)}</span></div>
            ${l.step ? `<div class="hint" style="margin:2px 0 0">Bước: ${esc(l.step)}</div>` : ''}
            ${l.text ? `<div class="lt">${esc(l.text)}</div>` : ''}${filesHTML(l.files)}</li>`).join('')}</ul>
        </div>
      </div>
    </div>
    <div class="card pad" style="margin-top:16px">
      <div class="sec-h"><h3>Tài liệu đính kèm <span class="hint" style="font-weight:400">· ${files.length} file</span></h3>${files.length ? `<div class="dlbar"><button class="btn sm" id="dlAll" type="button">${DL_ICON} Tải tất cả</button>${UPLOAD_URL ? '<button class="btn ghost sm" id="dlFolder" type="button">Thư mục Drive (.zip)</button>' : ''}</div>` : ''}</div>
      ${files.length ? `<div class="files">${files.map(f => fileRow(f, `<small>${esc(f.by || '')} · ${fmtT(f.t)}</small>`)).join('')}</div>` : '<p class="hint" style="margin:0">Chưa có file nào.</p>'}
    </div>`;
  $('#dlAll') && ($('#dlAll').onclick = () => downloadAll(files));
  $('#dlFolder') && ($('#dlFolder').onclick = () => openFolder(t.id));
  $('#fOk') && ($('#fOk').onclick = () => formActDialog(t.id, 'approve'));
  $('#fExp') && ($('#fExp').onclick = () => exportFromForm(t));
  $('#fImp') && ($('#fImp').onclick = () => importFromForm(t));
  $('#fNo') && ($('#fNo').onclick = () => formActDialog(t.id, 'reject'));
  $('#fAsk') && ($('#fAsk').onclick = () => formActDialog(t.id, 'ask'));
  $('#fAdd') && ($('#fAdd').onclick = () => formActDialog(t.id, 'comment'));
  $('#fCancel') && ($('#fCancel').onclick = async () => {
    if (!await confirmBox('Hủy đơn?', `Đơn ${t.code} sẽ dừng lại và không được duyệt tiếp.`, 'Hủy đơn', true)) return;
    try { await mutateTask(t.id, x => { x.cancelled = { by: S.me.name, byUid: S.me.uid, at: Date.now() }; x.log = [logEntry('cancel', 'Người đề nghị hủy đơn.'), ...(x.log || [])]; }, FORM_KEYS); toast('Đã hủy đơn.'); }
    catch (err) { toast(errMsg(err)); }
  });
  $('#fDel') && ($('#fDel').onclick = async () => {
    if (!await confirmBox('Xóa đơn?', `Đơn ${t.code} và lịch sử duyệt sẽ bị xóa vĩnh viễn.`, 'Xóa', true)) return;
    try { await deleteDoc(doc(db, 'tasks', t.id)); toast('Đã xóa đơn.'); go('don-tu'); } catch (err) { toast(errMsg(err)); }
  });
}
function formActDialog(id, kind) {
  const t0 = getTask(id); if (!t0) return; const cur = info(t0).cur;
  const C = {
    approve: { h: 'Duyệt đơn', p: cur ? `Bước: <b>${esc(cur.name)}</b>` : '', lab: 'Ý kiến (tùy chọn)', req: 0, btn: '✓ Duyệt', cls: 'green' },
    reject: { h: 'Từ chối đơn', p: 'Đơn sẽ dừng lại và báo cho người đề nghị.', lab: 'Lý do từ chối', req: 1, btn: 'Từ chối', cls: 'danger' },
    ask: { h: 'Yêu cầu bổ sung', p: 'Đơn vẫn chờ bạn duyệt; người đề nghị sẽ nhận email để bổ sung.', lab: 'Nội dung cần bổ sung', req: 1, btn: 'Gửi yêu cầu', cls: '' },
    comment: { h: 'Bổ sung / trao đổi', p: 'Người đang duyệt sẽ nhận email.', lab: 'Nội dung', req: 0, btn: 'Gửi', cls: '' },
  }[kind];
  openModal(`<h3>${C.h}</h3><p class="hint">${C.p}</p>
    <div class="grid" style="margin-top:12px"><div><label class="f">${C.lab}${C.req ? ' <span class="req">*</span>' : ''}</label><textarea class="in" id="mTx"></textarea></div>
    ${kind === 'comment' || kind === 'ask' ? filePicker() : ''}</div>
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn ${C.cls}" data-ok>${C.btn}</button></div>`, b => {
    b.querySelector('[data-x]').onclick = closeModal; b.querySelector('#mTx').focus();
    const getPicked = wirePicker(b);
    b.querySelector('[data-ok]').onclick = async e => {
      const text = b.querySelector('#mTx').value.trim(), picked = getPicked();
      if (C.req && !text) { toast(`Vui lòng nhập ${C.lab.toLowerCase()}.`); return; }
      if (kind === 'comment' && !text && !picked.length) { toast('Nhập nội dung hoặc chọn file.'); return; }
      const btn = e.target, label = btn.textContent; btn.disabled = true;
      try {
        let files = [];
        if (picked.length) { try { files = await uploadAll(id, picked, btn); } catch (err) { btn.disabled = false; btn.textContent = label; toast(err.message || 'Tải file thất bại.'); return; } }
        let finished = false;
        await mutateTask(id, t => {
          if (t.cancelled || t.rejected) throw new Error('Đơn đã đóng.');
          const k = t.steps.findIndex(s => s.status !== 'done'), s = t.steps[k], now = Date.now();
          const fx = files.length ? { files } : {};
          if (kind === 'approve') {
            if (!s) throw new Error('Đơn đã duyệt xong.');
            s.status = 'done'; s.pct = 100; s.doneAt = now; s.doneBy = S.me.name;
            t.log = [logEntry('approve', text, { step: s.name }), ...(t.log || [])];
            if (t.steps.every(x => x.status === 'done')) { t.completedAt = now; finished = true; }
          } else if (kind === 'reject') {
            t.rejected = { by: S.me.name, byUid: S.me.uid, at: now, reason: text, step: s ? s.name : '' };
            t.log = [logEntry('reject', text, { step: s ? s.name : '' }), ...(t.log || [])];
          } else {
            t.log = [logEntry('comment', (kind === 'ask' ? 'Yêu cầu bổ sung: ' : '') + text, fx), ...(t.log || [])];
          }
        }, FORM_KEYS);
        closeModal();
        toast(kind === 'approve' ? (finished ? 'Đơn đã được duyệt đầy đủ.' : 'Đã duyệt, chuyển bước tiếp theo.') : kind === 'reject' ? 'Đã từ chối đơn.' : 'Đã gửi.');
        if (kind === 'approve') notify(id, finished ? 'done' : 'next');
        else if (kind === 'reject') notify(id, 'reject');
        else notify(id, 'comment', { to: kind === 'ask' || t0.assigneeUid !== S.me.uid ? 'requester' : 'approver' });
      } catch (err) { btn.disabled = false; btn.textContent = label; toast(err.message && !err.code ? err.message : errMsg(err)); }
    };
  });
}

/* ---------- PRINT ---------- */
function vPrint(a) {
  const t = getTask(S.param);
  if (!t || !isForm(t)) { a.innerHTML = '<div class="card empty">Không tìm thấy đơn.</div>'; return; }
  const F = FORMS[t.formType] || { name: t.title }, s = fstat(t), cd = new Date(t.createdAt);
  const sign = [{ r: 'Người đề nghị', n: uname(t.assigneeUid, t.assigneeName), at: t.createdAt, ok: true }]
    .concat((t.steps || []).map((st, k) => ({ r: st.name, n: uname(st.ownerUid, st.ownerName), at: st.doneAt, ok: st.status === 'done', rej: t.rejected && k === s.i.curIdx })));
  a.innerHTML = `
    <div class="noprint ptool"><a class="btn ghost" href="#hs-${esc(t.id)}">← Quay lại đơn</a><button class="btn" id="pGo">🖨 In / Lưu PDF</button>
      <span class="hint">Trong hộp thoại in, chọn máy in <b>"Lưu dưới dạng PDF"</b> để xuất file PDF.</span></div>
    <div class="sheet">
      <div class="shead"><div><b>${COMPANY.name}</b><br><span>${COMPANY.addr}</span></div>
        <div class="c"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><u>Độc lập – Tự do – Hạnh phúc</u></div></div>
      <div class="sno">Số: ${esc(t.code)}</div>
      <h1 class="stitle">${esc(F.name.toUpperCase())}</h1>
      <p class="sto"><i>Kính gửi: Ban Giám đốc Công ty TNHH Xây dựng Kỹ thuật Arcotek</i></p>
      <table class="ftbl print">
        <tr><td class="fk">Người đề nghị</td><td class="fv">${esc(uname(t.assigneeUid, t.assigneeName))}</td></tr>
        <tr><td class="fk">Bộ phận</td><td class="fv">${esc(t.unit || '—')}</td></tr>
      </table>
      ${formContentHTML(t)}
      ${s.k === 'reject' ? `<p class="sres bad">ĐƠN BỊ TỪ CHỐI – ${esc(t.rejected.by)}: ${esc(t.rejected.reason)}</p>` : s.k === 'cancel' ? '<p class="sres bad">ĐƠN ĐÃ HỦY</p>' : s.k === 'ok' ? '<p class="sres ok">ĐÃ DUYỆT</p>' : ''}
      <p class="sdate"><i>Đồng Nai, ngày ${pad(cd.getDate())} tháng ${pad(cd.getMonth() + 1)} năm ${cd.getFullYear()}</i></p>
      <div class="signs" style="grid-template-columns:repeat(${Math.min(sign.length, 4)},1fr)">${sign.map(x => `<div><b>${esc(x.r.toUpperCase())}</b>
        <div class="sig ${x.ok ? 'ok' : x.rej ? 'bad' : ''}">${x.ok ? `✓ ${x === sign[0] ? 'Đã gửi' : 'Đã duyệt'} điện tử<br><small>${fmtT(x.at)}</small>` : x.rej ? '✗ Từ chối' : ''}</div><span>${esc(x.n)}</span></div>`).join('')}</div>
      <p class="sfoot">Đơn lập trên Hệ thống giao việc ARCOTEK – arcotek.vn/giaoviec · Mã ${esc(t.code)}</p>
    </div>`;
  $('#pGo').onclick = () => window.print();
}

/* ================= KHO VẬT TƯ ================= */
const MV = { in: { l: 'Nhập kho', c: 'st-done', p: 'PN', t: 'PHIẾU NHẬP KHO' }, out: { l: 'Xuất kho', c: 'st-doing', p: 'PX', t: 'PHIẾU XUẤT KHO' }, adjust: { l: 'Kiểm kê', c: 'st-soon', p: 'KK', t: 'BIÊN BẢN ĐIỀU CHỈNH TỒN KHO' } };
const isKho = () => S.me && (S.me.role === 'admin' || S.me.role === 'manager' || S.me.kho === true);
const fmtQ = n => { n = Math.round((+n || 0) * 1000) / 1000; return n.toLocaleString('vi-VN', { maximumFractionDigits: 3 }); };
const parseQ = s => { const n = parseFloat(String(s || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const itemList = () => Object.values(S.items).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
const findItem = name => { const n = (name || '').trim().toLowerCase(); return itemList().find(i => (i.name || '').trim().toLowerCase() === n || (i.code || '').toLowerCase() === n); };
const itemLabel = i => `${i.name}${i.spec ? ' – ' + i.spec : ''}`;
const lowStock = i => (+i.min || 0) > 0 && (+i.qty || 0) <= (+i.min || 0);
const movesOfTask = id => S.moves.filter(m => m.refTask === id);
const itemsDatalist = () => `<datalist id="dlItems">${itemList().map(i => `<option value="${esc(i.name)}">${esc((i.code || '') + (i.spec ? ' · ' + i.spec : '') + ' · tồn ' + fmtQ(i.qty) + ' ' + (i.unit || ''))}</option>`).join('')}</datalist>`;

/** Ghi phiếu kho và cập nhật tồn trong 1 giao dịch. lines: [{itemId?, name, spec, unit, qty, price}] */
async function saveMove(m, lines) {
  // vật tư mới (chưa có trong danh mục) → tạo trước
  for (const l of lines) {
    if (l.itemId && S.items[l.itemId]) continue;
    const ex = findItem(l.name); if (ex) { l.itemId = ex.uid; continue; }
    if (m.type !== 'in') throw new Error(`"${l.name}" chưa có trong danh mục kho.`);
    if (!l.unit) throw new Error(`Nhập đơn vị tính cho vật tư mới "${l.name}".`);
    const id = rid(12);
    await setDoc(doc(db, 'items', id), { code: 'VT' + rid(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), name: l.name.trim(), spec: l.spec || '', unit: l.unit, group: '', min: 0, qty: 0, price: 0, createdAt: Date.now(), updatedAt: Date.now() });
    l.itemId = id;
  }
  const id = rid(14), now = Date.now();
  const move = {
    ...m, code: MV[m.type].p + newCode().slice(2), createdAt: now, byUid: S.me.uid, by: S.me.name,
    items: lines.map(l => ({ itemId: l.itemId, name: l.name, spec: l.spec || '', unit: l.unit || '', qty: +l.qty, price: +l.price || 0 })),
  };
  move.itemIds = [...new Set(move.items.map(x => x.itemId))];
  move.total = move.items.reduce((s, x) => s + x.qty * x.price, 0);
  await runTransaction(db, async tx => {
    const snaps = {}; for (const iid of move.itemIds) snaps[iid] = await tx.get(doc(db, 'items', iid));
    const delta = {}; move.items.forEach(x => delta[x.itemId] = (delta[x.itemId] || 0) + (m.type === 'out' ? -x.qty : x.qty));
    const short = [];
    for (const iid of move.itemIds) {
      if (!snaps[iid].exists()) throw new Error('Vật tư không còn trong danh mục.');
      const cur = +snaps[iid].data().qty || 0, nq = Math.round((cur + delta[iid]) * 1000) / 1000;
      if (m.type === 'out' && nq < 0) short.push(`${snaps[iid].data().name}: tồn ${fmtQ(cur)}, cần ${fmtQ(-delta[iid])}`);
    }
    if (short.length) throw new Error('Không đủ hàng trong kho:\n' + short.join('\n'));
    tx.set(doc(db, 'stock_moves', id), move);
    for (const iid of move.itemIds) {
      const cur = +snaps[iid].data().qty || 0, upd = { qty: Math.round((cur + delta[iid]) * 1000) / 1000, updatedAt: now };
      if (m.type === 'in') { const p = move.items.filter(x => x.itemId === iid && x.price).pop(); if (p) upd.price = p.price; }
      tx.update(doc(db, 'items', iid), upd);
    }
  });
  return { id, code: move.code };
}

/* ---------- PAGE ---------- */
function vKho(a) {
  const items = itemList(), low = items.filter(lowStock), val = items.reduce((s, i) => s + (+i.qty || 0) * (+i.price || 0), 0);
  const month = ymd().slice(0, 7), mCount = S.moves.filter(m => (m.date || '').startsWith(month)).length;
  S.f.ktab = S.f.ktab || 'ton';
  a.innerHTML = `
    <div class="sec-h" style="margin-bottom:4px;flex-wrap:wrap"><h2 class="pg" style="margin:0">Kho vật tư</h2>
      ${isKho() ? `<div class="dlbar"><button class="btn green" id="kIn">+ Nhập kho</button><button class="btn" id="kOut">− Xuất kho</button><button class="btn ghost" id="kNew">+ Vật tư mới</button></div>` : ''}</div>
    <p class="sub">Tồn kho tự cập nhật theo phiếu nhập, phiếu xuất và kiểm kê.${isKho() ? '' : ' Bạn chỉ có quyền xem – muốn lấy vật tư hãy gửi <a href="#don-moi-vattu">Đề nghị xuất vật tư</a>.'}</p>
    <div class="stats k4">
      <div class="stat" style="--c:#1b2433"><div class="n">${items.length}</div><div class="l">Mã vật tư</div></div>
      <button class="stat" id="kLow" style="--c:var(--late)"><div class="n">${low.length}</div><div class="l">Sắp hết / hết hàng</div></button>
      <div class="stat" style="--c:var(--green)"><div class="n" style="font-size:19px">${fmtMoney(val)}</div><div class="l">Giá trị tồn (theo giá nhập gần nhất)</div></div>
      <div class="stat" style="--c:var(--blue)"><div class="n">${mCount}</div><div class="l">Phiếu trong tháng</div></div>
    </div>
    ${isKho() ? (() => { const pend = S.tasks.filter(t => isForm(t) && t.formType === 'mua' && fstat(t).k === 'ok' && !movesOfTask(t.id).some(m => m.type === 'in')); return pend.length ? `<div class="card pad kpend"><div class="sec-h"><h3>📥 Đơn mua đã duyệt – chờ nhập kho (${pend.length})</h3></div>
      ${pend.map(t => `<div class="kprow"><div><a href="#hs-${esc(t.id)}" class="code">${esc(t.code)}</a> <b>${esc(t.assigneeName)}</b> · ${esc(FORMS.mua.sub(t.form?.data || {}))}<div class="hint" style="margin:0">${esc(t.form?.data?.congtrinh || '')}${t.form?.data?.ncc ? ' · NCC: ' + esc(t.form.data.ncc) : ''}</div></div><button class="btn green sm" data-imp="${esc(t.id)}">Nhập kho</button></div>`).join('')}</div>` : ''; })() : ''}
    <div class="scope">${[['ton', 'Tồn kho'], ['phieu', 'Phiếu nhập / xuất']].map(([k, l]) => `<button data-kt="${k}" class="${S.f.ktab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="kBody"></div>`;
  $$('[data-kt]', a).forEach(b => b.onclick = () => { S.f.ktab = b.dataset.kt; vKho(a); });
  $('#kLow').onclick = () => { S.f.ktab = 'ton'; S.f.kfil = 'low'; vKho(a); };
  $('#kIn') && ($('#kIn').onclick = () => stockDialog('in'));
  $('#kOut') && ($('#kOut').onclick = () => stockDialog('out'));
  $('#kNew') && ($('#kNew').onclick = () => itemDialog(null));
  $$('[data-imp]', a).forEach(b => b.onclick = () => importFromForm(getTask(b.dataset.imp)));
  S.f.ktab === 'ton' ? drawTon() : drawPhieu();
}
function drawTon() {
  const box = $('#kBody'); if (!box) return;
  box.innerHTML = `<div class="toolbar"><input class="in" id="kq" type="search" placeholder="Tìm mã, tên, quy cách…" value="${esc(S.f.kq || '')}">
    <select class="in" id="kf"><option value="">Tất cả vật tư</option><option value="low" ${S.f.kfil === 'low' ? 'selected' : ''}>Sắp hết (≤ tồn tối thiểu)</option><option value="zero" ${S.f.kfil === 'zero' ? 'selected' : ''}>Hết hàng</option></select>
    <button class="btn ghost" id="kCsv" type="button">⬇ Xuất Excel</button></div><div id="kTbl"></div>`;
  const draw = () => {
    const q = (S.f.kq || '').trim().toLowerCase();
    const rows = itemList().filter(i => !q || [i.code, i.name, i.spec, i.group].join(' ').toLowerCase().includes(q))
      .filter(i => S.f.kfil === 'low' ? lowStock(i) || (+i.qty || 0) <= 0 : S.f.kfil === 'zero' ? (+i.qty || 0) <= 0 : true);
    $('#kTbl').innerHTML = rows.length ? `<div class="card"><div class="itbl-wrap" style="border:0"><table class="itbl ktbl"><thead><tr><th>Mã</th><th>Tên vật tư</th><th>Quy cách</th><th>ĐVT</th><th class="num">Tồn</th><th class="num">Tối thiểu</th><th class="num">Giá nhập</th><th class="num">Giá trị</th></tr></thead><tbody>
      ${rows.map(i => `<tr data-it="${esc(i.uid)}" class="${(+i.qty || 0) <= 0 ? 'zero' : lowStock(i) ? 'low' : ''}"><td class="mono">${esc(i.code || '')}</td><td><b>${esc(i.name)}</b></td><td>${esc(i.spec || '')}</td><td>${esc(i.unit || '')}</td>
        <td class="num"><b>${fmtQ(i.qty)}</b></td><td class="num">${i.min ? fmtQ(i.min) : ''}</td><td class="num">${i.price ? fmtMoney(i.price) : ''}</td><td class="num">${i.price ? fmtMoney((+i.qty || 0) * i.price) : ''}</td></tr>`).join('')}</tbody></table></div></div>`
      : `<div class="card empty">${itemList().length ? 'Không có vật tư phù hợp.' : 'Kho chưa có vật tư nào.' + (isKho() ? ' Bấm <b>+ Nhập kho</b> để nhập lần đầu (vật tư mới được thêm vào danh mục tự động).' : '')}</div>`;
    $$('[data-it]').forEach(r => r.onclick = () => itemDialog(r.dataset.it));
  };
  $('#kq').oninput = e => { S.f.kq = e.target.value; draw(); };
  $('#kf').onchange = e => { S.f.kfil = e.target.value; draw(); };
  $('#kCsv').onclick = () => {
    const head = ['Mã', 'Tên vật tư', 'Quy cách', 'Nhóm', 'ĐVT', 'Tồn', 'Tối thiểu', 'Giá nhập gần nhất', 'Giá trị tồn'];
    const lines = itemList().map(i => [i.code, i.name, i.spec, i.group, i.unit, i.qty || 0, i.min || 0, i.price || 0, (+i.qty || 0) * (+i.price || 0)]);
    const csv = '﻿' + [head, ...lines].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const aEl = document.createElement('a'); aEl.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    aEl.download = `ton-kho-ARCOTEK-${ymd()}.csv`; document.body.appendChild(aEl); aEl.click(); setTimeout(() => { URL.revokeObjectURL(aEl.href); aEl.remove(); }, 1000);
  };
  draw();
}
function drawPhieu() {
  const box = $('#kBody'); if (!box) return;
  box.innerHTML = `<div class="toolbar"><input class="in" id="pq" type="search" placeholder="Tìm số phiếu, công trình, nhà cung cấp, vật tư…" value="${esc(S.f.pq || '')}">
    <select class="in" id="pt"><option value="">Tất cả phiếu</option>${Object.entries(MV).map(([k, v]) => `<option value="${k}" ${S.f.pt === k ? 'selected' : ''}>${v.l}</option>`).join('')}</select></div><div class="items" id="pList"></div>`;
  const draw = () => {
    const q = (S.f.pq || '').trim().toLowerCase();
    const rows = S.moves.filter(m => !S.f.pt || m.type === S.f.pt)
      .filter(m => !q || [m.code, m.congtrinh, m.ncc, m.nguoinhan, m.note, ...(m.items || []).map(x => x.name)].join(' ').toLowerCase().includes(q));
    $('#pList').innerHTML = rows.length ? rows.map(m => `<a class="card task" href="#pk-${esc(m.id)}">
      <div class="row1"><span class="code">${esc(m.code)}</span><span class="badge ${MV[m.type].c}">${MV[m.type].l}</span>${m.refCode ? `<span class="badge st-pend">Từ đơn ${esc(m.refCode)}</span>` : ''}</div>
      <div class="ttl">${esc(m.congtrinh || m.ncc || m.note || MV[m.type].l)}</div>
      <div class="meta"><span>Ngày: <b>${fmtD(m.date)}</b></span><span>${(m.items || []).length} dòng: ${esc((m.items || []).slice(0, 3).map(x => x.name).join(', '))}${(m.items || []).length > 3 ? '…' : ''}</span>${m.total ? `<span>Tổng: <b>${fmtMoney(m.total)}</b></span>` : ''}<span>Lập: ${esc(m.by || '')}</span></div></a>`).join('')
      : '<div class="card empty">Chưa có phiếu nào.</div>';
  };
  $('#pq').oninput = e => { S.f.pq = e.target.value; draw(); };
  $('#pt').onchange = e => { S.f.pt = e.target.value; draw(); };
  draw();
}

/* ---------- STOCK DIALOG (nhập / xuất) ---------- */
function stockDialog(type, pre = {}, onDone) {
  const IN = type === 'in';
  const lines = (pre.lines && pre.lines.length ? pre.lines : [{}]).map(l => ({ ...l }));
  openModal(`<h3>${IN ? '📥 Phiếu nhập kho' : '📤 Phiếu xuất kho'}${pre.refCode ? ` <span class="hint">– từ đơn ${esc(pre.refCode)}</span>` : ''}</h3>
    <div class="grid" style="margin-top:12px">
      <div class="grid g3">
        <div><label class="f">Ngày ${IN ? 'nhập' : 'xuất'}</label><input class="in" type="date" id="sDate" value="${ymd()}"></div>
        <div><label class="f">${IN ? 'Nhà cung cấp' : 'Công trình nhận'}${IN ? '' : ' <span class="req">*</span>'}</label><input class="in" id="sA" value="${esc(IN ? pre.ncc || '' : pre.congtrinh || '')}"></div>
        <div><label class="f">${IN ? 'Cho công trình (nếu có)' : 'Người nhận'}</label><input class="in" id="sB" value="${esc(IN ? pre.congtrinh || '' : pre.nguoinhan || '')}"></div>
      </div>
      <div><label class="f">Danh sách vật tư <span class="hint" style="font-weight:400">– gõ tên để chọn từ danh mục${IN ? '; tên mới sẽ được thêm vào danh mục' : ''}</span></label><div id="sLines"></div></div>
      <div><label class="f">Ghi chú</label><input class="in" id="sNote" value="${esc(pre.note || '')}"></div>
    </div>${itemsDatalist()}
    <div class="mact"><button class="btn ghost" data-x>Hủy</button><button class="btn ${IN ? 'green' : ''}" data-ok>${IN ? 'Lưu phiếu nhập' : 'Lưu phiếu xuất'}</button></div>`, b => {
    b.classList.add('wide');
    const box = b.querySelector('#sLines');
    const sync = (l, name) => { const it = findItem(name); l.itemId = it ? it.uid : null; if (it) { l.unit = it.unit; l.spec = l.spec || it.spec; if (IN && !l.price && it.price) l.price = it.price; } };
    lines.forEach(l => { if (!l.itemId || !S.items[l.itemId]) sync(l, l.name); });
    const draw = () => {
      box.innerHTML = `<div class="itbl-wrap"><table class="itbl edit it-kho"><thead><tr><th style="width:4%">#</th><th style="width:34%">Vật tư</th><th style="width:10%">ĐVT</th><th style="width:12%" class="num">Tồn hiện tại</th><th style="width:12%" class="num">SL ${IN ? 'nhập' : 'xuất'}</th>${IN ? '<th style="width:14%" class="num">Đơn giá</th><th style="width:14%" class="num">Thành tiền</th>' : ''}<th style="width:4%"></th></tr></thead><tbody>
        ${lines.map((l, i) => { const it = l.itemId && S.items[l.itemId]; return `<tr>
          <td class="no">${i + 1}</td>
          <td data-l="Vật tư" class="c-ten"><input class="in" data-i="${i}" data-f="name" list="dlItems" value="${esc(l.name || '')}" placeholder="Tên vật tư">${!it && l.name ? `<span class="newtag">${IN ? 'mới' : 'chưa có'}</span>` : ''}</td>
          <td data-l="ĐVT"><input class="in" data-i="${i}" data-f="unit" value="${esc(l.unit || '')}" ${it ? 'readonly' : ''}></td>
          <td data-l="Tồn" class="num tcalc">${it ? fmtQ(it.qty) : '—'}</td>
          <td data-l="SL"><input class="in num" data-i="${i}" data-f="qty" inputmode="decimal" value="${l.qty ?? ''}"></td>
          ${IN ? `<td data-l="Đơn giá"><input class="in num" data-i="${i}" data-f="price" inputmode="numeric" value="${l.price ? (+l.price).toLocaleString('vi-VN') : ''}"></td><td data-l="Thành tiền" class="num tcalc" data-tt="${i}">${fmtMoney((+l.qty || 0) * (+l.price || 0))}</td>` : ''}
          <td class="tdel"><button type="button" class="ib del" data-del="${i}">${ICON.x}</button></td></tr>`; }).join('')}</tbody>
        ${IN ? `<tfoot><tr><td colspan="6" class="num"><b>Tổng cộng</b></td><td colspan="2" class="num"><b id="sTot">${fmtMoney(lines.reduce((s, l) => s + (+l.qty || 0) * (+l.price || 0), 0))}</b></td></tr></tfoot>` : ''}</table></div>
        <button type="button" class="btn ghost sm" data-add style="margin-top:8px">+ Thêm dòng</button>`;
      $$('input', box).forEach(inp => {
        const l = lines[+inp.dataset.i], f = inp.dataset.f;
        inp.oninput = () => {
          if (f === 'price') { const n = parseMoney(inp.value); l.price = n; inp.value = n ? n.toLocaleString('vi-VN') : ''; }
          else if (f === 'qty') l.qty = inp.value;
          else l[f] = inp.value;
          if (IN) { const tt = box.querySelector(`[data-tt="${inp.dataset.i}"]`); if (tt) tt.textContent = fmtMoney((+parseQ(l.qty)) * (+l.price || 0)); const st = box.querySelector('#sTot'); if (st) st.textContent = fmtMoney(lines.reduce((s, x) => s + parseQ(x.qty) * (+x.price || 0), 0)); }
        };
        if (f === 'name') inp.onchange = () => { sync(l, inp.value); draw(); };
      });
      $$('[data-del]', box).forEach(x => x.onclick = () => { lines.splice(+x.dataset.del, 1); if (!lines.length) lines.push({}); draw(); });
      box.querySelector('[data-add]').onclick = () => { lines.push({}); draw(); $$('tbody tr', box).pop().querySelector('input').focus(); };
    };
    draw();
    b.querySelector('[data-x]').onclick = closeModal;
    b.querySelector('[data-ok]').onclick = async e => {
      const ls = lines.map(l => ({ ...l, name: (l.name || '').trim(), unit: (l.unit || '').trim(), qty: parseQ(l.qty) })).filter(l => l.name);
      if (!ls.length) { toast('Nhập ít nhất 1 vật tư.'); return; }
      const bad = ls.find(l => !(l.qty > 0)); if (bad) { toast(`Số lượng của "${bad.name}" phải lớn hơn 0.`); return; }
      const A = b.querySelector('#sA').value.trim(), B = b.querySelector('#sB').value.trim();
      if (!IN && !A) { toast('Nhập công trình nhận.'); return; }
      const m = { type, date: b.querySelector('#sDate').value || ymd(), note: b.querySelector('#sNote').value.trim(), ...(IN ? { ncc: A, congtrinh: B } : { congtrinh: A, nguoinhan: B }), ...(pre.refTask ? { refTask: pre.refTask, refCode: pre.refCode } : {}) };
      const btn = e.target; btn.disabled = true; btn.textContent = 'Đang lưu…';
      try { const r = await saveMove(m, ls); closeModal(); toast(`Đã lưu ${MV[type].l.toLowerCase()} ${r.code}.`); onDone && onDone(r); }
      catch (err) { btn.disabled = false; btn.textContent = IN ? 'Lưu phiếu nhập' : 'Lưu phiếu xuất'; toast(err.code ? errMsg(err) : err.message); }
    };
  });
}

/* ---------- ITEM DIALOG ---------- */
function itemDialog(id) {
  const it = id ? S.items[id] : null, w = isKho();
  const hist = it ? S.moves.filter(m => (m.itemIds || []).includes(id)).slice(0, 30) : [];
  openModal(`<h3>${it ? esc(it.name) : 'Vật tư mới'}</h3>${it ? `<p class="hint">Tồn hiện tại: <b style="font-size:16px;color:var(--tx)">${fmtQ(it.qty)} ${esc(it.unit || '')}</b>${lowStock(it) ? ' · <span style="color:var(--late)">dưới mức tối thiểu</span>' : ''}</p>` : ''}
    <div class="grid" style="margin-top:12px">
      <div class="grid g3"><div><label class="f">Mã vật tư</label><input class="in" id="iCode" value="${esc(it ? it.code || '' : 'VT' + rid(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'))}" ${w ? '' : 'disabled'}></div>
        <div style="grid-column:span 2"><label class="f">Tên vật tư <span class="req">*</span></label><input class="in" id="iName" value="${esc(it ? it.name : '')}" ${w ? '' : 'disabled'}></div></div>
      <div class="grid g3"><div><label class="f">Quy cách / model</label><input class="in" id="iSpec" value="${esc(it ? it.spec || '' : '')}" ${w ? '' : 'disabled'}></div>
        <div><label class="f">Đơn vị tính <span class="req">*</span></label><input class="in" id="iUnit" value="${esc(it ? it.unit || '' : '')}" placeholder="cái, bình, m, bộ…" ${w ? '' : 'disabled'}></div>
        <div><label class="f">Tồn tối thiểu (cảnh báo)</label><input class="in num" id="iMin" inputmode="decimal" value="${it && it.min ? it.min : ''}" ${w ? '' : 'disabled'}></div></div>
      <div><label class="f">Nhóm</label><input class="in" id="iGroup" list="dlGroups" value="${esc(it ? it.group || '' : '')}" placeholder="VD: Bình chữa cháy, Sprinkler, Báo cháy, Ống & phụ kiện" ${w ? '' : 'disabled'}>
        <datalist id="dlGroups">${[...new Set(itemList().map(i => i.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist></div>
      ${it && w ? `<div class="kk"><b>Kiểm kê</b> – nhập số tồn thực tế để điều chỉnh:<div class="kkrow"><input class="in num" id="iReal" inputmode="decimal" placeholder="${fmtQ(it.qty)}"><input class="in" id="iWhy" placeholder="Lý do (hư hỏng, thất thoát, đếm lại…)"><button class="btn warn sm" id="iAdj" type="button">Điều chỉnh</button></div></div>` : ''}
      ${it ? `<div><label class="f">Lịch sử nhập/xuất gần đây</label>${hist.length ? `<ul class="log">${hist.map(m => { const q = (m.items || []).filter(x => x.itemId === id).reduce((s, x) => s + x.qty, 0); return `<li><div class="lh"><span class="badge ${MV[m.type].c}">${MV[m.type].l}</span><a href="#pk-${esc(m.id)}">${esc(m.code)}</a><span>${fmtD(m.date)}</span><b>${m.type === 'out' ? '−' : q < 0 ? '' : '+'}${fmtQ(q)} ${esc(it.unit || '')}</b><span>${esc(m.congtrinh || m.ncc || m.note || '')}</span></div></li>`; }).join('')}</ul>` : '<p class="hint" style="margin:0">Chưa có phiếu nào.</p>'}</div>` : ''}
    </div>
    <div class="mact">${it && isAdmin() ? '<button class="btn dghost" id="iDel" style="margin-right:auto">Xóa vật tư</button>' : ''}<button class="btn ghost" data-x>Đóng</button>${w ? '<button class="btn" data-ok>Lưu</button>' : ''}</div>`, b => {
    b.classList.add('wide');
    b.querySelector('[data-x]').onclick = closeModal;
    const ok = b.querySelector('[data-ok]');
    ok && (ok.onclick = async () => {
      const v = { code: b.querySelector('#iCode').value.trim(), name: b.querySelector('#iName').value.trim(), spec: b.querySelector('#iSpec').value.trim(), unit: b.querySelector('#iUnit').value.trim(), min: parseQ(b.querySelector('#iMin').value), group: b.querySelector('#iGroup').value.trim(), updatedAt: Date.now() };
      if (!v.name || !v.unit) { toast('Nhập tên và đơn vị tính.'); return; }
      const dup = findItem(v.name); if (dup && dup.uid !== id) { toast('Đã có vật tư cùng tên trong danh mục.'); return; }
      try { if (it) await updateDoc(doc(db, 'items', id), v); else await setDoc(doc(db, 'items', rid(12)), { ...v, qty: 0, price: 0, createdAt: Date.now() }); closeModal(); toast('Đã lưu vật tư.'); }
      catch (err) { toast(errMsg(err)); }
    });
    const adj = b.querySelector('#iAdj');
    adj && (adj.onclick = async () => {
      const raw = b.querySelector('#iReal').value; if (raw === '') { toast('Nhập số tồn thực tế.'); return; }
      const real = parseQ(raw), why = b.querySelector('#iWhy').value.trim(), d = Math.round((real - (+it.qty || 0)) * 1000) / 1000;
      if (!d) { toast('Tồn thực tế bằng tồn trên hệ thống, không cần điều chỉnh.'); return; }
      if (!why) { toast('Nhập lý do điều chỉnh.'); return; }
      adj.disabled = true;
      try { const r = await saveMove({ type: 'adjust', date: ymd(), note: `Kiểm kê ${it.name}: ${fmtQ(it.qty)} → ${fmtQ(real)}. ${why}` }, [{ itemId: id, name: it.name, spec: it.spec, unit: it.unit, qty: d, price: 0 }]); closeModal(); toast(`Đã điều chỉnh tồn (${r.code}).`); }
      catch (err) { adj.disabled = false; toast(err.code ? errMsg(err) : err.message); }
    });
    const del = b.querySelector('#iDel');
    del && (del.onclick = async () => {
      if ((+it.qty || 0) !== 0) { toast('Chỉ xóa được vật tư có tồn = 0. Hãy kiểm kê về 0 trước.'); return; }
      if (!await confirmBox('Xóa vật tư?', `Xóa "${it.name}" khỏi danh mục? Các phiếu cũ vẫn giữ nguyên.`, 'Xóa', true)) return;
      try { await deleteDoc(doc(db, 'items', id)); toast('Đã xóa vật tư.'); } catch (err) { toast(errMsg(err)); }
    });
  });
}

/* ---------- PRINT PHIẾU KHO ---------- */
function vMovePrint(a) {
  const m = S.moves.find(x => x.id === S.param);
  if (!m) { a.innerHTML = `<div class="crumb"><a href="#kho">← Kho</a></div><div class="card empty">${S.loaded ? 'Không tìm thấy phiếu.' : 'Đang tải…'}</div>`; return; }
  const T = MV[m.type], d = parseD(m.date || ymd()), IN = m.type === 'in', price = IN && m.items.some(x => x.price);
  const signs = IN ? ['Người lập phiếu', 'Người giao hàng', 'Thủ kho', 'Kế toán'] : m.type === 'out' ? ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Kế toán'] : ['Người lập', 'Thủ kho', 'Kế toán'];
  a.innerHTML = `
    <div class="noprint ptool"><a class="btn ghost" href="#kho">← Kho</a>${m.refTask ? `<a class="btn ghost" href="#hs-${esc(m.refTask)}">Xem đơn ${esc(m.refCode || '')}</a>` : ''}<button class="btn" id="pGo">🖨 In / Lưu PDF</button></div>
    <div class="sheet">
      <div class="shead"><div><b>${COMPANY.name}</b><br><span>${COMPANY.addr}</span></div><div class="c" style="text-align:right">Số: <b>${esc(m.code)}</b><br>${m.refCode ? 'Theo đơn: ' + esc(m.refCode) : ''}</div></div>
      <h1 class="stitle">${T.t}</h1>
      <p class="sto"><i>Ngày ${pad(d.getDate())} tháng ${pad(d.getMonth() + 1)} năm ${d.getFullYear()}</i></p>
      <table class="ftbl print">
        ${IN ? `<tr><td class="fk">Nhà cung cấp</td><td class="fv">${esc(m.ncc || '—')}</td></tr>` : ''}
        ${m.congtrinh ? `<tr><td class="fk">${IN ? 'Cho công trình' : 'Công trình nhận'}</td><td class="fv">${esc(m.congtrinh)}</td></tr>` : ''}
        ${m.nguoinhan ? `<tr><td class="fk">Người nhận</td><td class="fv">${esc(m.nguoinhan)}</td></tr>` : ''}
        ${m.note ? `<tr><td class="fk">Ghi chú</td><td class="fv">${esc(m.note)}</td></tr>` : ''}
      </table>
      <div class="itbl-wrap" style="margin-top:10px"><table class="itbl view"><thead><tr><th>#</th><th>Tên vật tư</th><th>Quy cách</th><th>ĐVT</th><th class="num">Số lượng</th>${price ? '<th class="num">Đơn giá</th><th class="num">Thành tiền</th>' : ''}</tr></thead><tbody>
        ${m.items.map((x, i) => `<tr><td class="no">${i + 1}</td><td>${esc(x.name)}</td><td>${esc(x.spec || '')}</td><td>${esc(x.unit || '')}</td><td class="num">${fmtQ(x.qty)}</td>${price ? `<td class="num">${fmtMoney(x.price)}</td><td class="num">${fmtMoney(x.qty * x.price)}</td>` : ''}</tr>`).join('')}</tbody>
        ${price ? `<tfoot><tr><td colspan="6" class="num"><b>Tổng cộng</b></td><td class="num"><b>${fmtMoney(m.total)}</b></td></tr><tr><td colspan="7" class="num"><i>Bằng chữ: ${docSo(m.total)}</i></td></tr></tfoot>` : ''}</table></div>
      <div class="signs" style="grid-template-columns:repeat(${signs.length},1fr);margin-top:22px">${signs.map((s, i) => `<div><b>${s.toUpperCase()}</b><div class="sig">${i === 0 ? `<small>(đã lập trên hệ thống)<br>${fmtT(m.createdAt)}</small>` : '<small>(Ký, ghi rõ họ tên)</small>'}</div><span>${i === 0 ? esc(m.by || '') : ''}</span></div>`).join('')}</div>
      <p class="sfoot">Phiếu lập trên Hệ thống giao việc ARCOTEK – arcotek.vn/giaoviec · ${esc(m.code)}</p>
    </div>`;
  $('#pGo').onclick = () => window.print();
}

/* ---------- NỐI VỚI ĐƠN TỪ ---------- */
function exportFromForm(t) {
  const d = (t.form && t.form.data) || {};
  const lines = (d.items || []).map(r => { const it = (r.itemId && S.items[r.itemId]) || findItem(r.ten); return { itemId: it ? it.uid : null, name: it ? it.name : (r.ten || ''), spec: r.qc || (it && it.spec) || '', unit: it ? it.unit : (r.dvt || ''), qty: parseQ(r.sl) }; });
  stockDialog('out', { lines, congtrinh: d.congtrinh, nguoinhan: d.nguoinhan, note: `Theo đề nghị xuất vật tư ${t.code} của ${t.assigneeName}`, refTask: t.id, refCode: t.code }, async r => {
    try {
      let finished = false;
      await mutateTask(t.id, x => {
        const k = x.steps.findIndex(s => s.status !== 'done'), s = x.steps[k], now = Date.now(); if (!s) return;
        s.status = 'done'; s.pct = 100; s.doneAt = now; s.doneBy = S.me.name;
        x.log = [logEntry('approve', `Đã xuất kho – phiếu ${r.code}.`, { step: s.name }), ...(x.log || [])];
        if (x.steps.every(y => y.status === 'done')) { x.completedAt = now; finished = true; }
      }, FORM_KEYS);
      notify(t.id, finished ? 'done' : 'next');
    } catch (err) { toast('Đã xuất kho nhưng chưa cập nhật được đơn: ' + errMsg(err)); }
  });
}
function importFromForm(t) {
  const d = (t.form && t.form.data) || {};
  const lines = (d.items || []).map(r => { const it = findItem(r.ten); return { itemId: it ? it.uid : null, name: it ? it.name : (r.ten || ''), unit: it ? it.unit : (r.dvt || ''), qty: parseQ(r.sl), price: +r.gia || 0 }; });
  stockDialog('in', { lines, ncc: d.ncc, congtrinh: d.congtrinh, note: `Nhập theo đề nghị mua hàng ${t.code}`, refTask: t.id, refCode: t.code });
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
