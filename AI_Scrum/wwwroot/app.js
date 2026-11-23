/* ================= DATA ================= */
    const TODAY = new Date(2026,10,10);
    let seq = 100;
const nid = () => ++seq;

    // Тестовые данные оставлены для интерфейса (потом заменим на запросы к БД)
    let users = [];
    let availableLogins = [];
    let teams = [];
    let members = [];
    let tasks = [];
    let sprints = [];
    let daily = {answers:{ }, summary:'' };
    let reports = [];
    let curTeamId = null, curTab = 'tasks', loginFree = true;
    let dailyReminderShown = false;

/* ================= HELPERS ================= */
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const user = id => users.find(u => u.id === id);
const team = () => teams.find(t => t.id === curTeamId);
const isOwner = () => state.user && team() && team().owner === state.user.login;
let state = { user: null, prevScreen: null };

function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); }
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); $(id).classList.add('active'); }
function fmtDate(d) { const x = new Date(d); return isNaN(x) ? 'дата не указана' : x.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); }
function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 864e5); }
function initials(u) { return (u.name || 'U').split(' ').map(w => w[0]).slice(0, 2).join(''); }

function openModal(html) { $('modal').innerHTML = html; $('overlay').classList.add('show'); }
function closeModal() { $('overlay').classList.remove('show'); }

/* ================= AUTH ================= */
async function doLogin() {
    const lg = document.getElementById('lg-login').value.trim();
    const pass = document.getElementById('lg-pass').value;

    if (!lg || !pass) { toast('Заполните логин и пароль'); return; }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: lg, password: pass })
        });

        const data = await response.json();

        if (!response.ok) {
            toast(data.message || 'Ошибка входа');
            return;
        }

        state.user = data;

        // Загружаем актуальный профиль с навыками
        try {
            const profileRes = await fetch(`/api/users/${state.user.login}`);
            if (profileRes.ok) {
                const profileData = await profileRes.json();
                state.user.name = profileData.name || state.user.name;
                state.user.skills = profileData.skills || [];
            } else {
                state.user.skills = [];
            }
        } catch (e) {
            state.user.skills = [];
        }

        toast('Вы вошли в систему');
        afterAuth();

        if (!state.user.skills) state.user.skills = []; // Инициализация навыков
        toast('Вы вошли в систему');
        afterAuth();
    } catch (err) {
        toast('Ошибка сервера. Проверьте подключение к БД');
    }
}

async function doRegister() {
    const lg = document.getElementById('rg-login').value.trim();
    const pass = document.getElementById('rg-pass').value;
    const pass2 = document.getElementById('rg-pass2').value;

    if (pass !== pass2) { toast('Пароли не совпадают'); return; }
    if (pass.length < 4) { toast('Пароль минимум 4 символа'); return; }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: lg, password: pass })
        });

        const data = await response.json();

        if (!response.ok) {
            toast(data.message || 'Ошибка регистрации');
            return;
        }

        state.user = data;
        state.user.skills = [];
        toast('Аккаунт создан!');
        afterAuth(true);
    } catch (err) {
        toast('Ошибка сервера');
    }
}

function checkLogin() {
    const lg = $('rg-login').value.trim().toLowerCase();
    const h = $('rg-hint');
    if (lg.length < 3) {
        h.className = 'hint err';
        h.textContent = 'Минимум 3 символа';
    } else {
        h.className = 'hint ok';
        h.textContent = 'Логин свободен ✓';
    }
}

function doLogout() {
    state.user = null;
    state.prevScreen = null;
    curTeamId = null;
    dailyReminderShown = false;
    $('lg-login').value = '';
    $('lg-pass').value = '';
    showScreen('scr-login');
    toast('Вы вышли из профиля');
}

async function afterAuth(isNew) {
    updateAvatars();
    await loadTeams();
    goTeams();
    if (isNew) goProfile();
}

function updateAvatars() { document.querySelectorAll('.topbar .avatar').forEach(a => a.textContent = initials(state.user)); }

/* ================= TEAMS ================= */
async function loadTeams() {
    try {
        const response = await fetch(`/api/teams/by-login/${state.user.login}`);
        if (response.ok) {
            teams = await response.json();
        } else {
            console.error("Ошибка загрузки команд:", await response.text());
        }
    } catch (err) {
        console.error("Не удалось загрузить команды", err);
    }
}

function goTeams() { renderTeams(); showScreen('scr-teams'); }

function renderTeams() {
    const list = $('teams-list'); list.innerHTML = '';
    if (!teams.length) { list.innerHTML = '<div class="card empty">Пока нет команд. Создайте первую!</div>'; return; }

    teams.forEach(t => {
        const st = trafficLight(t.id);
        const isOwn = t.owner === state.user.login;
        list.insertAdjacentHTML('beforeend',
            `<div class="team-card" onclick="openTeam(${t.id})">
        <div class="team-ico">${t.emoji || 'T'}</div>
        <div style="flex:1"><div style="font-weight:700; font-size:15px">${esc(t.name)} ${isOwn ? '<span class="ai-badge">ВЛАДЕЛЕЦ</span>' : ''}</div>
        <div class="small muted" style="margin-top:4px">${esc(t.desc.slice(0, 120))}…</div></div>
        <div style="text-align:right"><span class="p-badge ${st.cls}">${st.label.toUpperCase()}</span>
        <div class="small muted mono" style="margin-top:6px">${fmtDate(t.deadline)}</div></div>
      </div>`);
    });
}

function openCreateTeam() {
    openModal(`<h3>Новая команда</h3><div class="sub">Вы станете её владельцем</div>
    <div class="field"><label>Название</label><input id="nt-name" placeholder="Например: Курсовой проект"></div>
    <div class="field"><label>Описание проекта или ТЗ</label><textarea id="nt-desc" rows="4" placeholder="Что вы делаете, зачем, ключевые функции…"></textarea></div>
    <div class="field"><label>Дата сдачи проекта</label><input id="nt-deadline" type="date" value="2026-12-25"></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="createTeam()">Создать</button></div>`);
}

async function createTeam() {
    const name = $('nt-name').value.trim(), desc = $('nt-desc').value.trim(), deadline = $('nt-deadline').value;
    if (!name || !desc) { toast('Заполните название и описание'); return; }

    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, desc: desc, deadline: deadline, ownerLogin: state.user.login })
        });

        const data = await response.json();

        if (!response.ok) {
            toast(data.message || 'Ошибка создания команды');
            return;
        }

        teams.push(data);
        closeModal();
        toast('Команда создана');
        openTeam(data.id);

    } catch (err) {
        toast('Ошибка сервера при создании команды');
    }
}

function openDeleteTeam() {
    const t = team();
    if (!t) return;
    openModal(`<h3>Удалить команду?</h3>
    <div class="sub">Вы точно хотите удалить команду «${esc(t.name)}»? Вернуть её уже будет нельзя.</div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-danger" onclick="deleteTeam()">Удалить команду</button></div>`);
}

function deleteTeam() {
    const id = curTeamId;
    teams = teams.filter(t => t.id !== id);
    members = members.filter(m => m.teamId !== id);
    tasks = tasks.filter(t => t.teamId !== id);
    sprints = sprints.filter(s => s.teamId !== id);
    reports = reports.filter(r => r.teamId !== id);
    curTeamId = null;
    closeModal();
    toast('Команда удалена');
    goTeams();
}

/* ================= TEAM PAGE ================= */
const TABS = [['tasks', 'Задачи'], ['sprints', 'Спринты'], ['daily', 'Daily'], ['members', 'Участники'], ['reports', 'Отчёты']];

async function openTeam(id) {
    curTeamId = id; curTab = 'tasks'; showScreen('scr-team'); $('top-team-name').textContent = team().name;
    await loadTasks();
    await loadSprints();
    await loadDailyAnswers();
    await loadMembers();
    renderSide(); updateGlobalDailyAlert(); renderTab();

    if (!daily.answers[state.user.id] && !dailyReminderShown) {
        dailyReminderShown = true;
        openModal(`<h3>Напоминание о Daily</h3><div class="sub">Вы ещё не прошли daily-опрос сегодня.</div>
      <div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">i</span><span>Три коротких вопроса — две минуты. Если не ответить, команда увидит пометку «не ответил».</span></div>
      <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Позже</button>
      <button class="btn btn-primary" onclick="closeModal();setTab('daily')">Пройти сейчас</button></div>`);
    }
}

async function loadTasks() {
    try {
        const response = await fetch(`/api/tasks/team/${curTeamId}`);
        if (response.ok) {
            const data = await response.json();
            tasks = tasks.filter(t => t.teamId !== curTeamId);
            tasks = [...tasks, ...data];
        }
    } catch (err) {
        toast("Ошибка загрузки задач");
    }
}
async function loadMembers() {
    try {
        const response = await fetch(`/api/teams/${curTeamId}/members`);
        if (response.ok) {
            members = await response.json();
        }
    } catch (err) {
        console.error("Ошибка загрузки участников", err);
    }
}
async function loadSprints() {
    try {
        const response = await fetch(`/api/sprints/team/${curTeamId}`);
        if (response.ok) {
            const data = await response.json();
            sprints = sprints.filter(s => s.teamId !== curTeamId);
            sprints = [...sprints, ...data];
        }
    } catch (err) { console.error("Ошибка загрузки спринтов", err); }
}
function renderSide() {
    $('side-nav').innerHTML = TABS.map(([k, l]) => `<div class="nav-item ${curTab === k ? 'active' : ''}" onclick="setTab('${k}')">${l}</div>`).join('')
        + (isOwner() ? `<div class="side-danger"><button class="btn btn-danger btn-sm" style="width:100%" onclick="openDeleteTeam()">Удалить команду</button></div>` : '');
}
function setTab(t) { curTab = t; renderSide(); updateGlobalDailyAlert(); renderTab(); }
function renderTab() {
    ['tasks', 'sprints', 'daily', 'members', 'reports'].forEach(k => {
        const el = $('tab-' + k); if (el) el.style.display = (k === curTab) ? 'block' : 'none';
    });
    ({ tasks: renderTasks, sprints: renderSprints, daily: renderDaily, members: renderMembers, reports: renderReports })[curTab]();
}

function updateGlobalDailyAlert() {
    const box = $('daily-global-alert');
    if (!box) return;
    if (!daily.answers[state.user.id] && curTab !== 'daily') {
        box.innerHTML = `<div class="daily-alert"><span style="font-weight:800; font-family:var(--mono); color:var(--review)">!</span>
        <span><b>Напоминание:</b> вы ещё не прошли опрос Daily.</span>
        <button class="btn btn-primary btn-sm" onclick="setTab('daily')">Ответить</button></div>`;
    } else {
        box.innerHTML = '';
    }
}

function trafficLight(tid) {
    const t = teams.find(x => x.id === tid); if (!t) return { cls: 'green', label: 'В графике' };
    const ts = tasks.filter(x => x.teamId === tid && x.status !== 'done');
    const remH = ts.reduce((s, x) => s + (x.est || 0), 0);
    const days = t.deadline ? Math.max(1, daysBetween(TODAY, t.deadline)) : 365;
    const teamSize = members.filter(m => m.teamId === tid).length || 1;
    const cap = teamSize * 4, ratio = cap / (remH / days || 1);
    const near = days <= 7;
    if (ratio >= 1.15 && !near) return { cls: 'green', label: 'В графике' };
    if (ratio >= 0.75 && !(near && ratio < 1)) return { cls: 'orange', label: 'Есть риск' };
    return { cls: 'red', label: 'Не успеваем' };
}

function lightBlock() {
    const st = trafficLight(curTeamId);
    const txt = { green: 'Идём по графику — оставшийся объём делится на дни спокойно', orange: 'Объём задач превышает возможности команды', red: 'Жёстко не успеваем — нужно резать скоуп' }[st.cls];
    return `<div class="light ${st.cls === 'orange' ? 'yellow' : st.cls}"><div class="light-dot"></div>
    <div><b>${st.label}</b><div class="small muted">${txt} · дедлайн ${fmtDate(team()?.deadline)}</div></div></div>`;
}

/* ================= TASKS ================= */
function renderTasks() {
    const ts = tasks.filter(t => t.teamId === curTeamId), own = isOwner();
    const pLabel = { red: 'КРИТИЧНО', orange: 'ВАЖНО', green: 'ОБЫЧНАЯ' };
    let html = lightBlock();
    html += `<div class="page-head"><h2>Задачи <span class="muted small mono">${ts.length}</span></h2>
    <div style="margin-left:auto; display:flex; gap:8px">${own ?`
    <button class="btn btn-ghost" onclick="openDistribute()">Распределить (AI)</button>
    <button class="btn btn-primary" onclick="openGenerate()">Сгенерировать</button>`: ''}</div></div>`;
    if (!ts.length) { html += '<div class="card empty">Задач пока нет.</div>'; }
    const groups = [
        { key: 'red', title: 'Критично', cls: 'red' },
        { key: 'orange', title: 'Важно', cls: 'orange' },
        { key: 'green', title: 'Обычные', cls: 'green' }
    ];
    groups.forEach(g => {
        const gt = ts.filter(t => t.priority === g.key).sort((a, b) => {
            const da = a.due ? new Date(a.due) : new Date(9999, 0, 1);
            const db = b.due ? new Date(b.due) : new Date(9999, 0, 1);
            return da - db;
        });
        if (!gt.length) return;
        html += `<div class="group-head ${g.cls}"><span class="bar"></span>${g.title} <span class="cnt">${gt.length}</span></div>`;
        gt.forEach(t => {
            const a = t.assignee ? members.find(m => m.id === t.assignee) : null;
            const overdue = t.status !== 'done' && t.due && new Date(t.due) < TODAY;
            html += `<div class="task" id="task-${t.id}">
        <div class="task-row" onclick="toggleTask(${t.id})">
          <span class="p-badge ${t.priority}">${pLabel[t.priority]}</span>
          <span class="task-title ${t.status === 'done' ? 'done' : ''}">${esc(t.title)}</span>
          <span class="st-badge ${t.status}">${{ todo: 'К работе', in_progress: 'В работе', done: 'Готово' }[t.status] || t.status}</span>
          <span class="small muted">${a ? esc(a.name) : '— без исполнителя —'}</span>
          <span class="small muted mono">${overdue ? '<span class="overdue">! ' + fmtDate(t.due) + '</span>' : (t.due ? fmtDate(t.due) : '')}</span>
        </div>
        <div class="task-body">
          <div class="desc">${esc(t.desc)}</div>
          <div class="task-meta"><span class="mono">⏱ ${t.est || '?'} ч</span><span>${t.due ? 'срок: ' + fmtDate(t.due) : 'без срока'}${overdue ? ' <span class="overdue">(просрочена)</span>' : ''}</span><span>${a ? esc(a.name) : 'не назначен'}</span><span>${t.sprintId ? 'в спринте' : 'бэклог'}</span></div>
          <div class="task-actions">${own ?`
            <button class="btn btn-ghost btn-sm" onclick="openEditTask(${t.id})">Изменить</button>
            <select onchange="reassign(${t.id},this.value)"><option value="">Назначить…</option>${members.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select>
            <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">Удалить</button>` : ''}
            ${((own || t.assignee === state.user.id) && t.status !== 'done') ? `<select onchange="setStatus(${t.id},this.value)"><option value="">Статус…</option><option value="in_progress">В работе</option><option value="done">Выполнена</option></select>` : ''}
          </div>
        </div></div>`;
        });
    });
    $('tab-tasks').innerHTML = html;
}
function toggleTask(id) { $('task-' + id).classList.toggle('open'); }

async function reassign(id, val) {
    if (!val) return;
    try {
        const response = await fetch(`/api/tasks/${id}/assignee`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Number(val)) // Отправляем число
        });

        if (response.ok) {
            await loadTasks(); // Перезагружаем задачи из базы
            toast('Исполнитель назначен');
            renderTab();
        } else {
            const err = await response.json();
            toast('Ошибка: ' + (err.message || 'Сервер отклонил запрос'));
        }
    } catch (err) {
        toast('Ошибка соединения с сервером');
    }
}

async function setStatus(id, val) {
    if (!val) return;
    try {
        const response = await fetch(`/api/tasks/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: val }) // <--- Отправляем объект с полем status
        });

        if (response.ok) {
            await loadTasks();
            toast('Статус обновлён');
            renderTab();
        } else {
            const err = await response.json();
            toast('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}

function deleteTask(id) {
    const t = tasks.find(x => x.id === id);
    openModal(`<h3>Удалить задачу?</h3><div class="sub">«${esc(t.title)}» будет удалена безвозвратно.</div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-danger" onclick="confirmDeleteTask(${id})">Удалить</button></div>`);
}

async function confirmDeleteTask(id) {
    try {
        const response = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeModal();
            toast('Задача удалена');
            await loadTasks(); // Перезагружаем задачи из базы
            renderTab();
        } else {
            toast('Ошибка при удалении задачи');
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}

function openEditTask(id) {
    const t = tasks.find(x => x.id === id);
    // Находим текущего исполнителя в массиве members по его id
    const assigneeName = members.find(m => m.id === t.assignee)?.name || 'не назначен';

    openModal(`<h3>Редактировать задачу</h3>
    <div class="field"><label>Название</label><input id="et-title" value="${esc(t.title)}"></div>
    <div class="field"><label>Описание</label><textarea id="et-desc" rows="4">${esc(t.desc)}</textarea></div>
    <div class="row2">
      <div class="field"><label>Приоритет</label><select id="et-pr"><option value="red" ${t.priority === 'red' ? 'selected' : ''}>Критично</option><option value="orange" ${t.priority === 'orange' ? 'selected' : ''}>Важно</option><option value="green" ${t.priority === 'green' ? 'selected' : ''}>Обычная</option></select></div>
      <div class="field"><label>Оценка, ч</label><input id="et-est" type="number" value="${t.est || 0}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Срок</label><input id="et-due" type="date" value="${t.due || ''}"></div>
      <div class="field"><label>Исполнитель</label>
        <select id="et-as">
            <option value="">— не назначен —</option>
            ${members.map(m => `<option value="${m.id}" ${t.assignee === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="saveTask(${id})">Сохранить</button></div>`);
}

async function saveTask(id) {
    if (!$('et-title').value.trim()) { toast('Название не может быть пустым'); return; }

    const updatedData = {
        title: $('et-title').value.trim(),
        desc: $('et-desc').value.trim(),
        priority: $('et-pr').value,
        est: +$('et-est').value || null,
        due: $('et-due').value || null,
        assigneeId: $('et-as').value ? +$('et-as').value : null,
        teamId: curTeamId
    };

    try {
        const response = await fetch(`/api/tasks/${id}/edit`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            await loadTasks(); // <--- ВАЖНО: перезагружаем задачи из базы, чтобы увидеть изменения
            closeModal();
            toast('Задача обновлена');
            renderTab();
        } else {
            const err = await response.json();
            toast('Ошибка сервера: ' + (err.message || 'Неизвестная ошибка'));
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}

function openGenerate() {
    openModal(`<h3>Генерация задач</h3><div class="sub">Система прочитает описание и предложит список задач</div>
    <div class="field"><label>Описание проекта / ТЗ</label><textarea id="gen-desc" rows="6">${esc(team()?.desc || '')}</textarea></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="runGenerate()">Сгенерировать</button></div>`);
}

async function runGenerate() {
    // 1. Сохраняем текст из поля ВВОДА до того, как удалим его
    const descText = $('gen-desc').value.trim();

    if (!descText) {
        toast('Введите описание проекта');
        return;
    }

    // 2. Теперь можно менять окно на спиннер
    $('modal').innerHTML = `<h3>Генерация задач</h3><div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">i</span><span><b>GigaChat анализирует ваше ТЗ…</b> Подождите 5-10 секунд.</span></div><div class="spinner"></div>`;

    try {
        const response = await fetch('/api/tasks/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teamId: curTeamId,
                description: descText // <--- Используем сохраненную переменную
            })
        });

        const data = await response.json();

        if (!response.ok) {
            openModal(`<h3>Ошибка ИИ</h3><div class="sub" style="color:var(--blocked)">${data.message}</div>
            <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Закрыть</button></div>`);
            return;
        }

        await loadTasks(); // Загружаем задачи, созданные ИИ

        openModal(`<h3>Готово!</h3><div class="sub">Нейросеть справилась с задачей.</div>
        <div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">OK</span><span>${data.message}</span></div>
        <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Закрыть</button>
        <button class="btn btn-primary" onclick="closeModal();setTab('tasks')">Показать</button></div>`);
    } catch (err) {
        openModal(`<h3>Ошибка соединения</h3>
            <div class="sub" style="color:var(--blocked)">${err.message}</div>
            <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Закрыть</button></div>`);
    }
}

function taskSkillOf(t) { if (/фронт|верст|CSS|JS/i.test(t.title)) return 'фронтенд'; if (/API|БД|база|Groq|бэкенд|модуль/i.test(t.title)) return 'бэкенд'; if (/дизайн|макет/i.test(t.title)) return 'дизайн'; if (/тест/i.test(t.title)) return 'тестирование'; return 'бэкенд'; }
function suggestAssignee(t) {
    const mem = members.filter(m => m.teamId === curTeamId);
    if (!mem.length) return null;
    const map = { 'фронтенд': ['фронтенд', 'JavaScript', 'CSS'], 'бэкенд': ['бэкенд', 'C#', 'PostgreSQL'], 'дизайн': ['дизайн', 'UI/UX'], 'тестирование': ['тестирование'] };
    const need = map[t.skills] || [];
    const best = mem.find(m => user(m.userId)?.skills?.some(s => need.includes(s)) && m.role !== 'Владелец / бэкенд');
    return best ? best.userId : (mem.find(m => m.role !== 'Владелец / бэкенд') || mem[0]).userId;
}
async function openDistribute() {
    openModal(`<h3>Распределение задач</h3><div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">i</span><span><b>GigaChat подбирает исполнителей…</b> Учитываем навыки и роли.</span></div><div class="spinner"></div>`);

    try {
        const response = await fetch('/api/tasks/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(curTeamId) // Отправляем ID команды
        });

        const data = await response.json();

        if (!response.ok) {
            openModal(`<h3>Ошибка ИИ</h3><div class="sub" style="color:var(--blocked)">${data.message}</div>
            <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Закрыть</button></div>`);
            return;
        }

        await loadTasks(); // Загружаем задачи, чтобы увидеть новые назначения

        openModal(`<h3>Готово!</h3><div class="sub">ИИ распределил задачи.</div>
        <div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">OK</span><span>${data.message}</span></div>
        <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Закрыть</button>
        <button class="btn btn-primary" onclick="closeModal();renderTab()">Показать</button></div>`);

    } catch (err) {
        toast('Ошибка соединения с ИИ');
        closeModal();
    }
}
async function applyDistribute() {
    try {
        const un = tasks.filter(t => t.teamId === curTeamId && t.status !== 'done');

        for (let t of un) {
            const sel = $(`dist-${t.id}`);
            if (sel && sel.value) {
                await fetch(`/api/tasks/${t.id}/assignee`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Number(sel.value))
                });
            }
        }

        await loadTasks();
        closeModal();
        toast('Задачи распределены');
        renderTab();
    } catch (err) {
        toast('Ошибка при распределении');
    }
}

/* ================= SPRINTS ================= */
function renderSprints() {
    const own = isOwner();
    const sps = sprints.filter(s => s.teamId === curTeamId);
    let html = lightBlock() +`<div class="page-head"><h2>Спринты</h2>
    ${own ? '<div style="margin-left:auto"><button class="btn btn-primary" onclick="openCreateSprint()">+ Создать</button></div>' : ''}</div>`;
    if (!sps.length) { html += '<div class="card empty">Спринтов пока нет.</div>'; }
    sps.forEach(s => {
        const ts = tasks.filter(t => t.sprintId === s.id);
        const done = ts.filter(t => t.status === 'done').length;
        const pct = ts.length ? Math.round(done / ts.length * 100) : 0;
        const dLeft = daysBetween(TODAY, s.end), dTot = Math.max(1, daysBetween(s.start, s.end));
        const hot = dLeft / dTot < 0.5 && pct < 60;
        html +=`<div class="sprint">
      <div class="sprint-head"><b>${esc(s.name)}</b>
        <span class="muted small mono">${fmtDate(s.start)} — ${fmtDate(s.end)}</span>
        <span class="burn ${hot ? 'hot' : 'ok'}">${hot ? 'ГОРИТ' : 'НОРМ'}</span>
        ${own ?`<div style="margin-left:auto; display:flex; gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openAddToSprint(${s.id})">+ Задачи</button>
          <button class="btn btn-ghost btn-sm" onclick="genReport(${s.id})">Отчёт</button></div>` : ''}
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      <div class="small muted">Выполнено ${done} из ${ts.length} (${pct}%)${dLeft > 0 ? ' · осталось ' + dLeft + ' дн.' : ' · срок истёк'}</div>
      <div class="chips">${ts.length ? ts.map(t => `<span class="chip">${esc(t.title)}</span>`).join('') : '<span class="small muted">Задачи ещё не добавлены</span>'}</div>
    </div>`;
    });
    $('tab-sprints').innerHTML = html;
}
function openCreateSprint() {
    openModal(`<h3>Новый спринт</h3>
    <div class="field"><label>Название</label><input id="ns-name" value="Спринт ${sprints.filter(s => s.teamId === curTeamId).length + 1}"></div>
    <div class="row2">
        <div class="field"><label>Начало</label><input id="ns-start" type="date" value="2026-12-01"></div>
        <div class="field"><label>Конец</label><input id="ns-end" type="date" value="2026-12-14"></div>
    </div>
    <div class="modal-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
        <button class="btn btn-primary" onclick="createSprint()">Создать</button>
    </div>`);
}
async function createSprint() {
    const st = $('ns-start').value, en = $('ns-end').value;
    if (!st || !en || new Date(en) <= new Date(st)) { toast('Проверьте даты'); return; }

    try {
        const response = await fetch('/api/sprints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teamId: curTeamId,
                name: $('ns-name').value.trim() || 'Спринт',
                start: st,
                end: en
            })
        });

        if (response.ok) {
            await loadSprints(); // Перезагружаем спринты из БД
            closeModal();
            toast('Спринт создан');
            renderTab();
        } else {
            toast('Ошибка при создании спринта на сервере');
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}
function openAddToSprint(sid) {
    const back = tasks.filter(t => t.teamId === curTeamId && !t.sprintId);
    if (!back.length) { toast('Свободных задач нет'); return; }
    openModal(`<h3>Добавить задачи</h3>
    ${back.map(t =>`<label style="display:flex; gap:10px; align-items:center; padding:9px 4px; border-bottom:1px solid var(--line); margin-bottom:0;">
      <input type="checkbox" id="sp-${t.id}" style="width:auto; margin-bottom:0;"> <span style="font-size:13px">${esc(t.title)}</span></label>`).join('')}
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="addToSprint(${sid})">Добавить</button></div>`);
}
async function addToSprint(sid) {
    const tasksToAdd = tasks.filter(t => t.teamId === curTeamId && !t.sprintId && $('sp-' + t.id)?.checked);

    if (!tasksToAdd.length) { closeModal(); toast('Ничего не выбрано'); return; }

    try {
        for (let t of tasksToAdd) {
            // Убедитесь, что sid - это число!
            await fetch(`/api/tasks/${t.id}/sprint`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Number(sid)) // <--- Явно приводим к числу
            });
        }
        await loadTasks(); // Обновляем задачи
        closeModal();
        toast(`Добавлено в спринт: ${tasksToAdd.length}`);
        renderTab();
    } catch (err) {
        toast('Ошибка добавления');
    }
}

/* ================= DAILY ================= */
const DAILY_OPTS = {
    done: ['Закончил(а) задачу', 'Продвинулся(ась)', 'Провёл(а) ревью', 'Помог(ла) коллеге'],
    planned: ['Начну новую задачу', 'Продолжу текущую', 'Протестирую', 'Документация'],
    blockers: ['Всё ок', 'Нужна помощь', 'Жду доступ', 'Мало информации']
};

async function loadDailyAnswers() {
    try {
        const response = await fetch(`/api/daily/team/${curTeamId}/today`);
        if (response.ok) {
            const data = await response.json();
            daily.answers = {};
            data.forEach(item => {
                daily.answers[item.userId] = {
                    done: item.done,
                    planned: item.planned,
                    blockers: item.blockers
                };
            });
        }
    } catch (err) { console.error("Ошибка загрузки daily", err); }
}
async function renderDaily() {
    await loadDailyAnswers();
    const mem = members.filter(m => m.teamId === curTeamId);
    const answered = daily.answers, meNot = !answered[state.user.id];
    const my = answered[state.user.id] || { done: '', planned: '', blockers: '' };
    let html = `<div class="page-head"><h2>Daily</h2><span class="muted small">каждый день в 20:00 · три вопроса · 2 минуты</span></div>`;
    if (meNot) html += `<div class="banner"><span style="font-weight:800; font-family:var(--mono); color:var(--review)">!</span><span><b>Вы ещё не ответили сегодня.</b> Пройдите опрос до конца дня.</span></div>`;
    html +=`<div class="card">
    <div class="q"><label>1. Что было сделано?</label>
      <div class="daily-opts">${DAILY_OPTS.done.map(o => `<div class="daily-opt ${my.done === o ? 'selected' : ''}" onclick="pickDaily(event,'done','${o}')">${o}</div>`).join('')}</div>
      <textarea id="q-done" rows="2" placeholder="Или впишите свой вариант…">${esc(my.done && !DAILY_OPTS.done.includes(my.done) ? my.done : '')}</textarea>
    </div>
    <div class="q"><label>2. Что планируется?</label>
      <div class="daily-opts">${DAILY_OPTS.planned.map(o => `<div class="daily-opt ${my.planned === o ? 'selected' : ''}" onclick="pickDaily(event,'planned','${o}')">${o}</div>`).join('')}</div>
      <textarea id="q-plan" rows="2" placeholder="Или впишите свой вариант…">${esc(my.planned && !DAILY_OPTS.planned.includes(my.planned) ? my.planned : '')}</textarea>
    </div>
    <div class="q"><label>3. Что мешает?</label>
      <div class="daily-opts">${DAILY_OPTS.blockers.map(o => `<div class="daily-opt ${my.blockers === o ? 'selected' : ''}" onclick="pickDaily(event,'blockers','${o}')">${o}</div>`).join('')}</div>
      <textarea id="q-block" rows="2" placeholder="Или впишите свой вариант…">${esc(my.blockers && !DAILY_OPTS.blockers.includes(my.blockers) ? my.blockers : '')}</textarea>
    </div>
    <button class="btn btn-primary" onclick="submitDaily()">Отправить</button>
  </div>`;
    html +=`<div class="card"><b style="font-size:14px; display:block; margin-bottom:12px;">Кто прошёл опрос</b>
    <div class="daily-status">${mem.map(m => {
        const u = user(m.userId), has = !!answered[m.userId];
        return `<div class="person ${has ? '' : 'missed'}"><div class="nm"><span class="dot ${has ? 'ok' : 'no'}"></span>${esc(u?.name || 'Пользователь')}</div>
        <div class="small ${has ? '' : 'overdue'}" style="margin-top:4px">${has ? 'ответил(а)' : 'не ответил(а)'}</div></div>`;
    }).join('')}</div></div>`;
    html +=`<div class="card"><div class="page-head" style="margin-bottom:14px"><b style="font-size:14px">Сводка</b>
    <div style="margin-left:auto"><button class="btn btn-ghost btn-sm" onclick="genSummary()">Сформировать</button></div></div>
    <div id="summary-box">${daily.summary ? `<div class="summary">${esc(daily.summary)}</div>` : '<div class="small muted">Сводка появится после формирования.</div>'}</div></div>`;
    $('tab-daily').innerHTML = html;
}
function pickDaily(ev, q, val) {
    const map = { done: 'q-done', planned: 'q-plan', blockers: 'q-block' };
    const wrap = ev.target.parentElement;
    wrap.querySelectorAll('.daily-opt').forEach(el => el.classList.remove('selected'));
    ev.target.classList.add('selected');
    const ta = $(map[q]);
    if (ta) ta.value = val;
    if (!daily.answers[state.user.id]) daily.answers[state.user.id] = { done: '', planned: '', blockers: '' };
    daily.answers[state.user.id][q] = val;
}
async function submitDaily() {
    const d = $('q-done').value.trim(), p = $('q-plan').value.trim(), b = $('q-block').value.trim() || 'нет';
    if (!d || !p) { toast('Заполните первые два вопроса'); return; }

    try {
        const response = await fetch('/api/daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teamId: curTeamId,
                userId: state.user.id,
                done: d,
                planned: p,
                blockers: b
            })
        });

        if (response.ok) {
            toast('Ответы сохранены в БД');
            await loadDailyAnswers(); // Обновляем статусы
            updateGlobalDailyAlert();
            renderTab();
        }
    } catch (err) {
        toast('Ошибка сохранения ответов');
    }
}
async function genSummary() {
    const box = $('summary-box');
    box.innerHTML = '<div class="ai-tip"><span style="font-weight:800; font-family:var(--mono);">i</span><span><b>Нейросеть анализирует ответы…</b> Подождите.</span></div><div class="spinner"></div>';

    try {
        const response = await fetch('/api/daily/summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(curTeamId)
        });
        const data = await response.json();

        if (!response.ok) {
            box.innerHTML = `<div class="summary" style="color:var(--blocked)">${data.message || 'Ошибка генерации'}</div>`;
            return;
        }

        // --- НОВОЕ: Парсим ответ от ИИ ---
        let cleanSummary = data.summary;
        try {
            // Пытаемся распарсить строку, если внутри неё зашит JSON
            const parsed = JSON.parse(cleanSummary);
            // Ищем поле "сводка" (или "summary", если ИИ решил ответить на английском)
            cleanSummary = parsed["сводка"] || parsed["summary"] || cleanSummary;
        } catch (e) {
            // Если это не JSON, значит ИИ вернул чистый текст, и мы ничего не меняем
        }

        daily.summary = cleanSummary;
        box.innerHTML = `<div class="summary">${esc(daily.summary)}</div>`;
        toast('Сводка сгенерирована ИИ');

    } catch (err) {
        box.innerHTML = '<div class="summary" style="color:var(--blocked)">Ошибка соединения с ИИ. Проверьте консоль.</div>';
        console.error(err);
    }
}

/* ================= MEMBERS ================= */
async function renderMembers() {
    const own = isOwner();
    let mem = [];
    try {
        const response = await fetch(`/api/teams/${curTeamId}/members`);
        if (response.ok) mem = await response.json();
    } catch (err) {
        console.error("Ошибка загрузки участников", err);
    }

    let html = `<div class="page-head"><h2>Участники <span class="muted small mono">${mem.length}</span></h2>
    ${own ? '<div style="margin-left:auto; display:flex; gap:8px"><button class="btn btn-ghost" onclick="openSuggestRoles()">Роли (авто)</button><button class="btn btn-primary" onclick="openAddMember()">+ Добавить</button></div>' : ''}</div>`;

    html += '<div class="card">';
    if (!mem.length) html += '<div class="empty">Участников пока нет</div>';

    mem.forEach(m => {
        html +=`<div class="member">
      <div class="avatar">${initials({ name: m.name || 'U' })}</div>
      <div style="min-width:150px"><b>${esc(m.name || m.login)}</b><div class="small muted mono">@${esc(m.login)}</div></div>
      ${own ? `<select onchange="setRole(${m.id},this.value)">
    <option value="">— роль —</option>
    ${['Владелец', 'Фронтендер', 'Бэкендер', 'Дизайнер', 'Тестировщик', 'Аналитик'].map(r =>
        `<option ${m.role === r ? 'selected' : ''}>${r}</option>`
    ).join('')}
</select>` : `<span class="st-badge">${esc(m.role)}</span>`}
      <div class="skills">${m.skills.map(s => `<span class="chip accent">${esc(s)}</span>`).join('') || '<span class="small muted">навыки не указаны</span>'}</div>
    </div>`;
    });
    html += '</div>';
    $('tab-members').innerHTML = html;
}

async function setRole(uid, val) {
    if (!val) return;
    try {
        const response = await fetch(`/api/teams/${curTeamId}/members/${uid}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(val)
        });

        if (response.ok) {
            toast('Роль обновлена');
            renderMembers(); // Перерисовываем список
        } else {
            toast('Ошибка при смене роли');
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}
function openAddMember() {
    openModal(`<h3>Добавить участника</h3>
    <div class="sub">Введите логин пользователя, которого хотите добавить.</div>
    <div class="field"><label>Логин</label><input id="am-login" placeholder="например, test"></div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="addMember()">Добавить</button></div>`);
}

async function addMember() {
    const lg = $('am-login').value.trim();
    if (!lg) { toast('Введите логин'); return; }

    try {
        const response = await fetch(`/api/teams/${curTeamId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lg)
        });

        const data = await response.json();

        if (!response.ok) {
            toast(data.message || 'Ошибка добавления');
            return;
        }

        closeModal();
        toast('Участник добавлен');
        renderTab();
    } catch (err) {
        toast('Ошибка сервера');
    }
}

function openRemoveMember(uid) {
    const u = user(uid);
    openModal(`<h3>Удалить участника?</h3><div class="sub">«${esc(u?.name || '')}» потеряет доступ к команде.</div>
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-danger" onclick="removeMember(${uid})">Удалить</button></div>`);
}
function removeMember(uid) {
    const u = user(uid);
    members = members.filter(m => !(m.teamId === curTeamId && m.userId === uid));
    if (u && !availableLogins.some(l => l.login === u.login)) availableLogins.push({ login: u.login, name: u.name, skills: u.skills });
    closeModal(); toast('Участник удалён'); renderTab();
}
function openSuggestRoles() {
    // Берем всех, кроме владельца
    const mem = members.filter(m => m.login !== team()?.owner);

    if (!mem.length) { toast('Нет участников для назначения ролей'); return; }

    const roles = [['Бэкендер', 'бэкенд'], ['Фронтендер', 'фронтенд'], ['Дизайнер', 'дизайн'], ['Тестировщик', 'тестирование']];

    const rows = roles.map((r, i) => {
        // Простая логика: ищем по навыкам, если нет — берем первого из списка
        const cand = mem.find(m => m.skills && m.skills.includes(r[1])) || mem[i % mem.length];

        return `<div style="display:flex; gap:10px; align-items:center; margin-bottom:10px">
      <div style="flex:1"><b style="font-size:13px">${r[0]}</b><div class="small muted">навыки: ${r[1]}</div></div>
      <select id="role-${i}" style="width:200px">
        ${mem.map(m => `<option value="${m.id}" ${cand && cand.id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select></div>`;
    }).join('');

    openModal(`<h3>Предложение ролей</h3><div class="sub">Подобрано по навыкам.</div>${rows}
    <div class="modal-foot"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button>
    <button class="btn btn-primary" onclick="applyRoles()">Применить</button></div>`);
}
function applyRoles() {
    ['Бэкендер', 'Фронтендер', 'Дизайнер', 'Тестировщик'].forEach((r, i) => {
        const v = $('role-' + i);
        if (v && v.value) {
            // Здесь мы меняем роль только в памяти, так как в БД нет поля role для участника
            // (В будущем можно добавить обновление в базу)
            toast(`Роль ${r} назначена`);
        }
    });
    closeModal();
    renderTab();
}

/* ================= REPORTS ================= */
function renderReports() {
    const sps = sprints.filter(s => s.teamId === curTeamId);
    let html = `<div class="page-head"><h2>Отчёты</h2></div>`;
    if (!sps.length) html += '<div class="card empty">Сначала создайте спринты.</div>';
    sps.forEach(s => {
        const rep = reports.find(r => r.sprintId === s.id);
        html += `<div class="card"><div class="page-head" style="margin-bottom:14px"><b>${esc(s.name)}</b>
      <span class="muted small mono">${fmtDate(s.start)} — ${fmtDate(s.end)}</span>
      <div style="margin-left:auto; display:flex; gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="genReport(${s.id})">Сформировать</button>
        ${rep ? `<button class="btn btn-primary btn-sm" onclick="downloadPDF(${s.id})">PDF</button>` : ''}</div></div>
      ${rep ? `<div class="report-text">${esc(rep.text)}</div>` : '<div class="small muted">Отчёт ещё не сформирован.</div>'}</div>`;
    });
    $('tab-reports').innerHTML = html;
}
async function genReport(sid) {
    toast('Нейросеть пишет отчет…');

    try {
        const response = await fetch(`/api/sprints/${sid}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            toast(data.message || 'Ошибка генерации отчета');
            return;
        }

        // Парсим ответ от ИИ (убираем JSON обертку, если она есть)
        let cleanReport = data.report;
        try {
            const parsed = JSON.parse(cleanReport);
            cleanReport = parsed["отчет"] || parsed["report"] || cleanReport;
        } catch (e) {
            // Если это не JSON, оставляем как есть
        }

        // Сохраняем текст от ИИ в глобальную переменную reports
        let rep = reports.find(r => r.sprintId === sid);
        if (!rep) {
            rep = { sprintId: sid, teamId: curTeamId, created: new Date(), text: '' };
            reports.push(rep);
        }

        rep.text = cleanReport;

        if (curTab === 'reports') renderTab();
        else { setTab('reports'); }

        toast('Отчет от ИИ готов');

    } catch (err) {
        toast('Ошибка соединения');
        console.error(err);
    }
}
function downloadPDF(sid) {
    const rep = reports.find(r => r.sprintId === sid), s = sprints.find(x => x.id === sid);
    const w = window.open('', '_blank');
    if (!w) { toast('Разрешите всплывающие окна'); return; }
    w.document.write(`<html><head><title>Отчёт — ${s.name}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;line-height:1.7}h1{font-size:20px;border-bottom:2px solid #00BFA5;padding-bottom:10px}.meta{color:#6C757D;font-size:13px;margin-bottom:20px}pre{white-space:pre-wrap;font-family:inherit;font-size:13px}</style></head><body>
    <h1>AI Scrum Master — отчёт</h1><div class="meta">${esc(team()?.name || '')} · ${esc(s.name)} · ${TODAY.toLocaleDateString('ru-RU')}</div>
    <pre>${esc(rep.text)}</pre></body></html>`);
    w.document.close(); w.focus(); w.print();
}

/* ================= PROFILE ================= */
function goProfile() { state.prevScreen = document.querySelector('.screen.active').id; renderProfile(); showScreen('scr-profile'); }
function backFromProfile() {
    if (state.prevScreen === 'scr-team') { showScreen('scr-team'); renderTab(); } else goTeams();
}
function renderProfile() {
    const u = state.user;
    if (!u) return;
    const allSkills = ['фронтенд', 'бэкенд', 'C#', 'PostgreSQL', 'JavaScript', 'CSS', 'дизайн', 'UI/UX', 'тестирование', 'документация', 'генерирую идеи'];
    const userSkills = u.skills || [];
    const shownSkills = [...new Set([...allSkills, ...userSkills])];
    $('profile-body').innerHTML =`
    <div class="page-head">
      <h2>Профиль</h2><span class="muted small mono">@${esc(u.login)}</span>
      <div style="margin-left:auto"><button class="btn btn-danger btn-sm" onclick="doLogout()">Выйти из профиля</button></div>
    </div>
    <div class="profile-grid">
      <div class="card">
        <span class="block-title">Данные и навыки</span>
        <div class="field">
          <label>ФИО (необязательно)</label>
          <input id="pf-name" value="${esc(u.name)}">
        </div>
        <div style="margin-bottom:12px; font-weight:600; font-size:13.5px; color:var(--ink)">Мои навыки</div>
        <div class="chips" style="margin-bottom:16px;">
          ${shownSkills.map(s => `<span class="chip ${userSkills.includes(s) ? 'accent' : 'off'}" onclick="toggleSkill('${esc(s).replace(/'/g, "\\'")}')">${esc(s)}</span>`).join('')}
        </div>
        <div class="field" style="margin-bottom:0;">
          <label>Свой навык</label>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <input id="pf-custom" placeholder="Например: Docker" style="flex:1">
            <button class="btn btn-ghost" onclick="addCustomSkill()" style="margin-bottom:0">Добавить</button>
          </div>
        </div>
      </div>
      <div class="card">
        <span class="block-title">Тест навыков</span>
        <div class="small muted" style="margin-bottom:18px;">4 вопроса — система добавит навыки в профиль.</div>
        ${[['1. Что ближе в проекте?', ['бэкенд', 'фронтенд', 'дизайн', 'тестирование']],
        ['2. Чем привыкли работать?', ['C# / базы данных', 'JavaScript / CSS', 'Figma', 'чек-листы и документация']],
        ['3. Сильная сторона?', ['генерирую идеи', 'внимательность к деталям', 'архитектура решения', 'визуальный стиль']],
        ['4. Что удобнее вести?', ['документация', 'тестирование', 'бэкенд', 'фронтенд']]]
            .map((q, i) =>`
            <div class="q" style="margin-bottom:16px;">
              <label style="display:block; font-weight:600; font-size:13px; margin-bottom:8px; color:var(--ink)">${q[0]}</label>
              <div class="chips" data-q="${i}" style="margin-top:0;">
                ${q[1].map(a => `<span class="chip off selectable" onclick="pickTest(this)">${a}</span>`).join('')}
              </div>
            </div>`).join('')}
        <div class="q" style="margin-bottom:16px;">
          <label style="display:block; font-weight:600; font-size:13px; margin-bottom:8px; color:var(--ink)">5. Свои навыки (если нет в списке)</label>
          <input id="test-custom-skills" placeholder="Например: Python, Git, SQL (через запятую)" style="margin-bottom:0;">
        </div>
        <div style="margin-top:20px; display:flex; gap:10px;">
          <button class="btn btn-primary" onclick="applyTest()" style="margin-bottom:0">Применить тест</button>
          <button class="btn btn-ghost" onclick="saveProfile()" style="margin-bottom:0">Сохранить профиль</button>
        </div>
      </div>
    </div>`;
}
function toggleSkill(s) {
    const u = state.user;
    if (!u.skills) u.skills = [];
    u.skills = u.skills.includes(s) ? u.skills.filter(x => x !== s) : [...u.skills, s];
    renderProfile();
}
function pickTest(el) { el.classList.toggle('off'); el._picked = !el._picked; }
function applyTest() {
    let n = 0;
    document.querySelectorAll('.chips[data-q]').forEach(g => {
        g.querySelectorAll('.chip').forEach(c => {
            if (c._picked && state.user && !state.user.skills.includes(c.textContent)) {
                state.user.skills.push(c.textContent); n++;
            }
            c._picked = false; c.classList.add('off');
        });
    });
    const customEl = $('test-custom-skills');
    if (customEl && customEl.value.trim() && state.user) {
        customEl.value.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
            if (!state.user.skills.includes(s)) { state.user.skills.push(s); n++; }
        });
    }
    toast(n ? `Добавлено навыков: ${n}` : 'Отметьте вариант или введите свои навыки');
    renderProfile();
}
function addCustomSkill() {
    const v = $('pf-custom').value.trim();
    if (!v || !state.user) return;
    if (!state.user.skills.includes(v)) state.user.skills.push(v);
    toast('Навык добавлен'); renderProfile();
}
async function saveProfile() {
    if (!state.user) return;

    const newName = $('pf-name').value.trim() || state.user.name;
    const skills = state.user.skills || [];

    try {
        const response = await fetch(`/api/users/${state.user.login}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, skills: skills })
        });

        if (response.ok) {
            state.user.name = newName; // Обновляем локально
            updateAvatars();
            toast('Профиль сохранён в БД');
        } else {
            toast('Ошибка сохранения профиля');
        }
    } catch (err) {
        toast('Ошибка соединения');
    }
}