(() => {
'use strict';
const C = window.GardenCore;
const D = window.GardenContent;
const STORE = 'gortenziya_moy_sad_v1';
const main = document.getElementById('main');
const overlay = document.getElementById('overlay');
const tabs = document.getElementById('tabs');
let current = 'today';
let article = '';
let plantId = '';
let month = new Date().getMonth();
let guideMode = 'care';
let varietyFilter = 'Все';
let noticeTimer = null;
let reminderEnabled = false;
let data = readState();

function readState() {
  try { const raw = localStorage.getItem(STORE); return raw ? C.sanitizeBackup(JSON.parse(raw)) : {version:1,plants:[],completed:[]}; }
  catch(err) { return {version:1,plants:[],completed:[]}; }
}
function save() { localStorage.setItem(STORE, JSON.stringify(data)); }
function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(s) { return esc(s); }
const symbol = {
  droplet:'♧',leaf:'✿',sprout:'❧',calendar:'▦',flower:'❀',scissors:'✂',shield:'◇',sparkles:'✧',
  sun:'☀',snow:'❄',search:'⌕',bug:'♧',heart:'♡',check:'✓',clock:'◷',settings:'⚙',note:'☰',plant:'❀'
};
function glyph(icon='leaf', theme='') { return `<span class="glyph ${theme}" aria-hidden="true">${symbol[icon]||symbol.leaf}</span>`; }
function dayLabel(day) {
  const d = C.parseDay(day); return d ? `${d.getDate()} ${C.MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'Не указано';
}
function nowTitle(){const d=new Date();return `${d.getDate()} ${C.MONTHS[d.getMonth()]} · ${['вс','пн','вт','ср','чт','пт','сб'][d.getDay()]}`;}
function today(){return C.dateKey(new Date());}
function toast(text){
  const target=document.getElementById('toast');target.textContent=text;target.classList.add('show');
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>target.classList.remove('show'),2600);
}
function go(tab, options={}) {
  current=tab;article=options.article||'';plantId=options.plant||'';
  if(typeof options.month === 'number') month=options.month;
  render();window.scrollTo(0,0);
}
window.gardenBack=()=>{
  if(!overlay.classList.contains('hidden')){closeSheet();return;}
  if(plantId){go('plants');return;}
  if(article){go('guide');return;}
  if (current !== 'today') {go('today');return 'home';}
  return 'exit';
};
function header() {
  return `<div class="topbar"><div><div class="eyebrow">ВАШ ЦВЕТУЩИЙ САД</div><div class="app-name">Гортензия <span style="color:#cb93a9">✿</span></div></div><button class="circle-button avatar" data-action="open-settings" aria-label="Настройки">❀</button></div>`;
}
function flowerIllustration() {
  return `<svg viewBox="0 0 170 200" role="img" aria-label="Рисунок метельчатой гортензии" xmlns="http://www.w3.org/2000/svg">
  <path d="M86 188Q91 131 91 80" stroke="#8cab81" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M85 158Q31 134 14 146Q49 183 85 158Z" fill="#80a47f"/><path d="M89 151Q133 121 158 133Q134 169 89 151Z" fill="#a3be8d"/>
  <path d="M84 119Q46 101 28 106Q52 127 83 119Z" fill="#85ac82"/><path d="M91 121Q122 92 144 103Q131 120 91 121Z" fill="#c1d2a2"/>
  <path d="M88 11 C58 29 39 63 46 91 C52 117 71 133 88 135 C114 130 133 104 129 76 C125 51 109 28 88 11Z" fill="#e7b6cb" opacity=".85"/>
  <g fill="#fff2f5" stroke="#ebcad8" stroke-width=".8">${[[85,30],[72,46],[95,46],[58,65],[77,68],[101,68],[118,69],[52,85],[70,87],[90,89],[109,91],[126,86],[65,107],[86,110],[106,110],[89,126]].map(([x,y],i)=>`<g transform="translate(${x} ${y})"><ellipse rx="7" ry="4.7" cy="-5"/><ellipse rx="7" ry="4.7" cy="5"/><ellipse rx="4.7" ry="7" cx="-5"/><ellipse rx="4.7" ry="7" cx="5"/><circle r="2.2" fill="${i%3===0?'#d39bad':'#e7c8a6'}" stroke="none"/></g>`).join('')}</g>
  <g fill="#e8d6e2" opacity=".78"><circle cx="91" cy="52" r="2"/><circle cx="63" cy="78" r="2"/><circle cx="115" cy="103" r="2"/></g></svg>`;
}
function plantArt(){return `<div class="plant-illustration">${flowerIllustration()}</div>`;}
function hero() {
  const d = new Date(); const m=d.getMonth();
  const phase = m<=1||m===11?'Зимний покой':m<=4?'Пробуждение сада':m<=7?'Сезон роста и цветения':'Готовимся к холодам';
  const title = m<=1||m===11?'Пусть ваш сад отдыхает':m<=4?'Время новых побегов':m<=7?'Время пышных соцветий':'Осень в вашем саду';
  const desc = m<=1||m===11?'Проверьте укрытие и берегите ветви от тяжёлого снега.':m<=4?'Наблюдайте за кустами, почвой и погодой — весенний уход начинается с осмотра.':m<=7?'Проверяйте влажность грунта, любуйтесь цветением и отмечайте заботу о кустах.':'Наблюдайте за листьями и соцветиями, постепенно готовьте растения к зиме.';
  return `<div class="date-line">${esc(nowTitle())}</div><section class="hero"><div class="hero-art">${flowerIllustration()}</div><div class="hero-kicker">✧ ${phase}</div><h1>${title}</h1><p>${desc}</p><span class="hero-tag">🌿 Советы по сезону</span></section>`;
}
function careCard(task, idx, calendarMonth=new Date().getMonth(), now=new Date()) {
  const key=C.checklistKey(task.id,calendarMonth,now.getFullYear());
  const done=data.completed.includes(key);
  return `<article class="card care-card ${done?'done':''}">${glyph(task.icon,idx%3===1?'rose':idx%3===2?'cream':'')}<div class="care-text"><h3>${esc(task.title)}</h3><p>${esc(task.note)}</p></div><button class="check ${done?'checked':''}" data-action="toggle-task" data-key="${attr(key)}" aria-label="${done?'Отменить выполнение':'Отметить выполненным'}: ${attr(task.title)}">${done?'✓':''}</button></article>`;
}
function plantCard(p) {
  const status=C.moistureStatus(p), sub=p.variety||'Сорт не указан';
  return `<button class="card plant-card" style="width:100%;text-align:left;color:inherit" data-action="open-plant" data-id="${attr(p.id)}">${plantArt()}<div class="care-text"><h3 class="clipped">${esc(p.name)}</h3><p class="clipped">${esc(sub)}${p.place?' · '+esc(p.place):''}</p><span class="small-status ${status.due?'attention':''}">${status.due?'◷ Проверьте почву':'✓ Влажность проверена'}</span></div><span class="chevron">›</span></button>`;
}
function todayPage() {
  const d=new Date(),m=d.getMonth(), tasks=D.tasks[m], outstanding=tasks.filter(t=>!data.completed.includes(C.checklistKey(t.id,m,d.getFullYear())));
  const due=data.plants.filter(p=>C.moistureStatus(p,d).due);
  return `${header()}${hero()}
  <div class="section-head"><h2>Сегодня в саду</h2><span class="pill">${outstanding.length+due.length} дел</span></div>
  ${due.slice(0,4).map(p=>`<article class="card care-card">${glyph('droplet')}<div class="care-text"><h3>Проверить влажность: ${esc(p.name)}</h3><p>Коснитесь карточки, чтобы записать результат осмотра.</p></div><button class="check" aria-label="Перейти к растению" data-action="open-plant" data-id="${attr(p.id)}">›</button></article>`).join('')}
  ${outstanding.slice(0,3).map((t,i)=>careCard(t,i,m,d)).join('')}
  ${outstanding.length+due.length===0?`<div class="empty"><span class="large-emoji">🌸</span><h3>Все дела отмечены</h3><p>Загляните в календарь, если хотите посмотреть задачи на другие месяцы.</p></div>`:''}
  <div class="section-head"><h2>Мои гортензии</h2><button class="aux" data-action="go-plants">${data.plants.length?'Смотреть все →':'Добавить +'} </button></div>
  ${data.plants.length?data.plants.slice(0,2).map(plantCard).join(''):`<div class="empty"><span class="large-emoji">🌿</span><h3>Посадим первую?</h3><p>Добавьте свою гортензию, чтобы сохранять историю ухода и получать подсказки для каждого куста.</p><button class="btn btn-primary" data-action="add-plant">+ Добавить гортензию</button></div>`}
  <div class="section-head"><h2>Полезно знать</h2></div><div class="action-card">${glyph('sprout')}<div style="flex:1"><h3>Не поливайте по расписанию</h3><p>Сначала проверьте почву — после дождя полив может быть лишним.</p></div><button data-action="guide-article" data-id="watering">Читать</button></div>`;
}
function plantsPage() {
  const due=data.plants.filter(p=>C.moistureStatus(p).due).length;
  return `${header()}<h1 class="page-title">Мой сад</h1><p class="sub-title">У каждого куста — своя история, особенности и уход.</p>
  <div class="stats"><div class="stat"><strong>${data.plants.length}</strong><span>гортензий в саду</span></div><div class="stat"><strong>${due}</strong><span>проверок влажности</span></div></div>
  ${data.plants.map(plantCard).join('')}
  ${!data.plants.length?`<div class="empty"><span class="large-emoji">🌸</span><h3>Здесь будет ваша коллекция</h3><p>Добавьте сорт, дату посадки и место в саду — всё сохранится на телефоне.</p></div>`:''}
  <button class="btn btn-primary btn-block" data-action="add-plant" style="margin-top:7px">+ Добавить гортензию</button>`;
}
function plantDetail() {
  const p=data.plants.find(x=>x.id===plantId);if(!p)return plantsPage();
  const moisture=C.moistureStatus(p),history=(p.history||[]).slice().reverse();
  return `<div class="header-row"><button class="back" data-action="go-plants" aria-label="Вернуться">←</button><div class="eyebrow">МОЙ САД · КАРТОЧКА КУСТА</div></div>
    <div class="detail-banner"><div><h2>${esc(p.name)}</h2><p>${esc(p.variety||'Метельчатая гортензия')}</p><span class="pill">${esc(p.place||'Место не указано')}</span></div>${plantArt()}</div>
    <div class="card"><div class="mini-label">СОСТОЯНИЕ ПОЧВЫ</div><h3 style="font-size:17px;margin:8px 0">${esc(moisture.text)}</h3><p class="intro">${esc(moisture.secondary)}. Последняя проверка: ${p.lastCheck?dayLabel(p.lastCheck):'ещё не было'}.</p><div class="btn-row"><button class="btn btn-primary" data-action="moisture" data-id="${attr(p.id)}">Проверить почву</button><button class="btn btn-outline" data-action="water" data-id="${attr(p.id)}">+ Полив</button></div></div>
    <div class="section-head"><h2>Записи об уходе</h2></div>
    <div class="plant-actions"><button class="plant-action" data-action="log" data-kind="feed" data-id="${attr(p.id)}"><span>✧</span>Подкормка</button><button class="plant-action" data-action="log" data-kind="prune" data-id="${attr(p.id)}"><span>✂</span>Обрезка</button><button class="plant-action" data-action="log" data-kind="mulch" data-id="${attr(p.id)}"><span>❧</span>Мульча</button></div>
    ${history.length?history.slice(0,12).map(h=>`<div class="history-item"><strong>${esc(historyLabel(h.kind))}</strong><small>${dayLabel(h.day)}${h.note?' · '+esc(h.note):''}</small></div>`).join(''):`<div class="card muted tiny">Пока нет записей. Отмечайте проверки почвы и выполненные работы — здесь появится история.</div>`}
    <hr class="divider"/><div class="btn-row"><button class="btn btn-outline" data-action="edit-plant" data-id="${attr(p.id)}">Изменить куст</button><button class="btn btn-danger" data-action="delete-plant" data-id="${attr(p.id)}">Удалить</button></div>
    ${p.planted?`<p class="source-note">Дата посадки: ${dayLabel(p.planted)}${p.notes?'<br/>Заметки: '+esc(p.notes):''}</p>`:p.notes?`<p class="source-note">${esc(p.notes)}</p>`:''}`;
}
function historyLabel(kind){return ({water:'Полив',moisture:'Проверка влажности',feed:'Подкормка',prune:'Обрезка',mulch:'Мульчирование',note:'Наблюдение'})[kind]||'Уход';}
function calendarPage(){
  const year=new Date().getFullYear(), tasks=D.tasks[month];
  const done=tasks.filter(t=>data.completed.includes(C.checklistKey(t.id,month,year))).length;
  return `${header()}<h1 class="page-title">Календарь ухода</h1><p class="sub-title">Не жёсткое расписание, а сезонные ориентиры. Учитывайте погоду и состояние кустов.</p>
  <div class="month-hero"><div class="mini-label">СЕЗОННЫЕ ЗАДАЧИ · ${year}</div><h2>${C.MONTH_LABELS[month]}</h2><p>${done} из ${tasks.length} задач отмечено</p></div>
  <div class="filter-row">${C.MONTH_LABELS.map((s,i)=>`<button class="filter ${i===month?'selected':''}" data-action="month" data-month="${i}">${s}</button>`).join('')}</div>
  ${tasks.map((t,i)=>careCard(t,i,month,new Date(year,month,1))).join('')}
  <div class="tip">☀ Сроки приблизительны и ориентированы на климат средней полосы. В тёплых и холодных регионах ориентируйтесь прежде всего на погоду, состояние грунта и фазу роста растения.</div>`;
}
function guidePage() {
  if(article) return articlePage();
  const choices=[['care','Уход'],['sort','Сорта'],['problem','Что с кустом?']];
  return `${header()}<h1 class="page-title">Справочник</h1><p class="sub-title">Короткие практические советы по метельчатой гортензии.</p>
  <div class="segment">${choices.map(([id,label])=>`<button class="${guideMode===id?'active':''}" data-action="guide-mode" data-id="${id}">${label}</button>`).join('')}</div>
  <div style="height:18px"></div>
  ${guideMode==='care'?D.guides.map(g=>`<button class="list-card" data-action="guide-article" data-id="${g.id}">${glyph(g.icon)}<span style="flex:1"><strong>${esc(g.title)}</strong><small>${esc(g.sub)}</small></span><span class="chevron">›</span></button>`).join(''):
    guideMode==='sort'?varietiesView():problemsView()}
  <div class="source-note">Справочник адаптирован из приложенного пособия «Пособие по выращиванию метельчатой гортензии (Hydrangea paniculata)». Уход может отличаться в зависимости от сорта, возраста куста и климата.</div>`;
}
function varietiesView(){
  const opts=['Все','Компактный','Ранний','Поздний','Высокий'];
  return `<div class="filter-row" style="margin-top:0">${opts.map(x=>`<button class="filter ${varietyFilter===x?'selected':''}" data-action="variety-filter" data-filter="${attr(x)}">${x}</button>`).join('')}</div>
    ${D.varieties.filter(v=>varietyFilter==='Все'||v.tag===varietyFilter||v.bloom===varietyFilter).map(v=>`<div class="variety"><div class="top"><h3>${esc(v.name)}</h3><span class="pill">${esc(v.tag)}</span></div><div class="meta">Высота: ${esc(v.height)}<br/>Соцветия: ${esc(v.color)}<br/>Начало цветения: ${esc(v.bloom.toLowerCase())}</div></div>`).join('')}`;
}
function problemsView(){return `<p class="intro">Выберите наиболее заметный признак. Подсказки не заменяют осмотр растения и не являются диагнозом.</p>
    ${D.problems.map(p=>`<button class="help-option" data-action="problem" data-id="${p.id}">${glyph(p.icon)}<span style="flex:1">${esc(p.label)}</span><span class="chevron">›</span></button>`).join('')}`;}
function articlePage(){
  const item=D.guides.find(x=>x.id===article),problem=D.problems.find(x=>x.id===article);
  if(problem)return `<div class="header-row"><button class="back" data-action="go-guide" aria-label="Вернуться">←</button><span class="eyebrow">ПОМОЩЬ РАСТЕНИЮ</span></div><div class="article-head">${glyph(problem.icon)}<div><h2>${esc(problem.label)}</h2><p>Возможные причины и первые шаги</p></div></div><div class="card article"><p>${esc(problem.title)}</p><div class="help-answer">${esc(problem.help)}</div><p class="muted tiny">Если проблема быстро распространяется или растение сильно ослабло, обратитесь за местной консультацией в питомник или к специалисту по растениям.</p></div><button class="btn btn-outline" data-action="go-guide">← Назад к справочнику</button>`;
  if(!item)return guidePage();
  return `<div class="header-row"><button class="back" data-action="go-guide" aria-label="Вернуться">←</button><span class="eyebrow">АЗБУКА УХОДА</span></div><div class="article-head">${glyph(item.icon,'rose')}<div><h2>${esc(item.title)}</h2><p>${esc(item.sub)}</p></div></div>
     <div class="card article">${item.text.map(t=>`<p>${esc(t)}</p>`).join('')}</div>
     <div class="source-note">Информация — краткое изложение приложенного пособия, без индивидуальной диагностики и назначения препаратов.</div><button class="btn btn-outline" data-action="go-guide" style="margin-top:13px">← К разделам ухода</button>`;
}
function morePage(){
  return `${header()}<h1 class="page-title">Ещё</h1><p class="sub-title">Настройки, напоминания и сохранность данных.</p>
    <div class="card"><div class="setting"><div><strong>Ежедневное напоминание</strong><small>Уведомление примерно в 9:00: проверить задачи и влажность грунта.</small></div><button class="toggle ${reminderEnabled?'on':''}" role="switch" aria-checked="${reminderEnabled}" aria-label="Ежедневное напоминание" data-action="reminder"></button></div>
    <div class="setting"><div><strong>Резервная копия сада</strong><small>Сохраните растения, историю и выполненные задачи в JSON-файл.</small></div><button class="btn btn-secondary" data-action="export">Сохранить</button></div>
    <div class="setting" style="border:0"><div><strong>Восстановить данные</strong><small>Загрузка резервной копии заменит текущие записи.</small></div><button class="btn btn-outline" data-action="import">Загрузить</button></div></div>
    <div class="card"><div class="mini-label">О ПРИЛОЖЕНИИ</div><h3 style="margin:10px 0 7px">Гортензия · Мой сад</h3><p class="intro">Версия 1.0 · Для метельчатой гортензии (Hydrangea paniculata). Работает без интернета и регистрации. Записи сохраняются на этом устройстве. При удалении приложения записи могут пропасть — сохраняйте резервную копию.</p></div>
    <div class="source-note">Советы основаны на предоставленном пользователем пособии. Календарь служит напоминанием об осмотре, а не автоматической инструкцией к поливу или применению средств защиты.</div>`;
}
function render(){
  main.innerHTML=current==='today'?todayPage():current==='plants'?(plantId?plantDetail():plantsPage()):current==='calendar'?calendarPage():current==='guide'?guidePage():morePage();
  tabs.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===current;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  if(current==='calendar') {const active=main.querySelector('.filter.selected');if(active)active.scrollIntoView({block:'nearest',inline:'center'});}
}
function openSheet(markup){overlay.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-handle"></div>${markup}</div>`;overlay.classList.remove('hidden');}
function closeSheet(){overlay.classList.add('hidden');overlay.innerHTML='';}
function plantForm(id='') {
  const p=data.plants.find(p=>p.id===id)||{name:'',variety:'',planted:'',place:'',notes:''};
  openSheet(`<h2 class="sheet-title">${id?'Редактировать куст':'Новая гортензия 🌸'}</h2><p class="sheet-description">Заполните только то, что знаете. Остальное можно добавить позже.</p>
  <form id="plant-form" data-id="${attr(id)}">
    <label class="form-field"><span>Как назвать куст? *</span><input class="input" name="name" required maxlength="70" placeholder="Например, Гортензия у крыльца" value="${attr(p.name)}" /></label>
    <label class="form-field"><span>Сорт</span><input class="input" name="variety" maxlength="80" list="known-varieties" placeholder="Например, Limelight" value="${attr(p.variety)}"/><datalist id="known-varieties">${D.varieties.map(v=>`<option value="${attr(v.name)}"></option>`).join('')}</datalist></label>
    <label class="form-field"><span>Дата посадки</span><input class="input" name="planted" type="date" value="${attr(p.planted)}" /></label>
    <label class="form-field"><span>Место в саду</span><input class="input" name="place" maxlength="90" placeholder="У террасы, вдоль дорожки..." value="${attr(p.place)}" /></label>
    <label class="form-field"><span>Заметки</span><textarea class="input" name="notes" maxlength="400" rows="3" placeholder="Освещение, особенности, тип почвы...">${esc(p.notes)}</textarea></label>
    <div class="btn-row"><button class="btn btn-primary" type="submit">${id?'Сохранить изменения':'Добавить в сад'}</button><button class="btn btn-outline" type="button" data-action="close">Отмена</button></div>
  </form>`);
}
function moistureSheet(id){const p=data.plants.find(x=>x.id===id);if(!p)return;
  openSheet(`<h2 class="sheet-title">Проверка почвы</h2><p class="sheet-description">${esc(p.name)} · проверьте грунт на глубине нескольких сантиметров.</p>
    <button class="help-option" data-action="moisture-dry" data-id="${attr(id)}">${glyph('droplet','cream')}<span>Почва сухая<br/><small class="muted">Рассмотреть полив, если вода не застаивается</small></span><span class="chevron">›</span></button>
    <button class="help-option" data-action="moisture-moist" data-id="${attr(id)}">${glyph('leaf')}<span>Почва ещё влажная<br/><small class="muted">Отложить полив и отметить проверку</small></span><span class="chevron">›</span></button>
    <button class="btn btn-outline btn-block" data-action="close">Отмена</button>`);
}
function waterSheet(id) {const p=data.plants.find(x=>x.id===id);if(!p)return;
  openSheet(`<h2 class="sheet-title">Записать полив</h2><p class="sheet-description">${esc(p.name)} · отмечайте полив после проверки грунта. В сырую почву лишнюю воду не добавляйте.</p>
  <form id="water-form" data-id="${attr(id)}"><label class="form-field"><span>Дата</span><input class="input" name="day" type="date" required max="${today()}" value="${today()}" /></label><label class="form-field"><span>Заметка (по желанию)</span><input class="input" maxlength="160" name="note" placeholder="Например, грунт подсох после жары" /></label><div class="btn-row"><button class="btn btn-primary" type="submit">Сохранить полив</button><button type="button" class="btn btn-outline" data-action="close">Отмена</button></div></form>`);
}
function logSheet(id,kind){const p=data.plants.find(x=>x.id===id);if(!p)return;
  openSheet(`<h2 class="sheet-title">${historyLabel(kind)}</h2><p class="sheet-description">${esc(p.name)} · записать проведённую работу.</p><form id="log-form" data-id="${attr(id)}" data-kind="${attr(kind)}"><label class="form-field"><span>Дата</span><input class="input" type="date" name="day" required max="${today()}" value="${today()}" /></label><label class="form-field"><span>Что сделали?</span><input class="input" name="note" maxlength="160" placeholder="Краткая заметка" /></label><div class="btn-row"><button class="btn btn-primary" type="submit">Сохранить</button><button class="btn btn-outline" type="button" data-action="close">Отмена</button></div></form>`);
}
function record(id,kind,day,note=''){
  const p=data.plants.find(x=>x.id===id);if(!p || !C.parseDay(day))return;
  if(!Array.isArray(p.history))p.history=[];
  p.history.push({kind,day,note:C.safeString(note,160)});
  if(p.history.length>300)p.history=p.history.slice(-300);
  if(kind==='water') {p.lastWatered=day;p.lastCheck=day;}
  if(kind==='moisture')p.lastCheck=day;
  save();closeSheet();render();toast('Запись сохранена');
}
function confirmation(id){const p=data.plants.find(x=>x.id===id);if(!p)return;
  openSheet(`<h2 class="sheet-title">Удалить «${esc(p.name)}»?</h2><p class="sheet-description">История ухода за этим кустом будет удалена из приложения. Это действие нельзя отменить.</p><div class="btn-row"><button class="btn btn-danger" data-action="delete-confirm" data-id="${attr(id)}">Удалить куст</button><button class="btn btn-outline" data-action="close">Отмена</button></div>`);
}
function startExport(){const json=JSON.stringify(data,null,2);
  if(window.GardenAndroid){window.GardenAndroid.exportBackup(json);} else {
    const blob=new Blob([json],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='gortenziya-moy-sad.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
}
function startImport(){if(window.GardenAndroid)window.GardenAndroid.importBackup();else document.getElementById('backup-file').click();}
window.receiveImportBackup = function(text){
  try {const clean=C.sanitizeBackup(JSON.parse(text));
    openSheet(`<h2 class="sheet-title">Восстановить сад?</h2><p class="sheet-description">В файле ${clean.plants.length} растений. Текущие ${data.plants.length} растений и история ухода будут заменены данными из файла.</p><div class="btn-row"><button class="btn btn-primary" id="confirm-import">Заменить данные</button><button class="btn btn-outline" data-action="close">Отмена</button></div>`);
    const b=overlay.querySelector('#confirm-import');b.addEventListener('click',()=>{data=clean;save();closeSheet();go('plants');toast('Сад восстановлен');},{once:true});
  } catch(err){toast('Файл не подходит: '+(err.message||'ошибка формата'));}
};
window.nativeReminderStatus=function(enabled){reminderEnabled=!!enabled;if(current==='more')render();if(enabled)toast('Напоминания включены');};
if(window.GardenAndroid){try {reminderEnabled=window.GardenAndroid.getReminderState();}catch(e){reminderEnabled=false;}}
else {reminderEnabled=localStorage.getItem('garden_demo_reminder')==='yes';}

main.addEventListener('click',event=>handle(event));
tabs.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)go(b.dataset.tab);});
overlay.addEventListener('click',e=>{if(e.target===overlay)closeSheet();else handle(e);});
document.getElementById('backup-file').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  if(f.size>1_000_000){toast('Файл слишком большой');return;}
  window.receiveImportBackup(await f.text());e.target.value='';
});
function handle(e){
  const button=e.target.closest('[data-action]');if(!button)return;
  const act=button.dataset.action,id=button.dataset.id;
  switch(act){
    case 'open-settings':go('more');break;
    case 'go-plants':go('plants');break;
    case 'go-guide':go('guide');break;
    case 'open-plant':go('plants',{plant:id});break;
    case 'add-plant':plantForm();break;
    case 'edit-plant':plantForm(id);break;
    case 'close':closeSheet();break;
    case 'delete-plant':confirmation(id);break;
    case 'delete-confirm':data.plants=data.plants.filter(p=>p.id!==id);save();closeSheet();go('plants');toast('Куст удалён');break;
    case 'moisture':moistureSheet(id);break;
    case 'moisture-dry':record(id,'moisture',today(),'Почва сухая');toast('Проверьте, нужен ли полив');break;
    case 'moisture-moist':record(id,'moisture',today(),'Почва влажная, полив не нужен');break;
    case 'water':waterSheet(id);break;
    case 'log':logSheet(id,button.dataset.kind);break;
    case 'toggle-task':{
      const key=button.dataset.key;data.completed=data.completed.includes(key)?data.completed.filter(x=>x!==key):[...data.completed,key];
      save();render();break;
    }
    case 'month':month=Number(button.dataset.month);render();break;
    case 'guide-mode':guideMode=id;article='';render();break;
    case 'guide-article':go('guide',{article:id});break;
    case 'problem':go('guide',{article:id});break;
    case 'variety-filter':varietyFilter=button.dataset.filter;render();break;
    case 'reminder':
      if(window.GardenAndroid)window.GardenAndroid.setReminderEnabled(!reminderEnabled);
      else {reminderEnabled=!reminderEnabled;localStorage.setItem('garden_demo_reminder',reminderEnabled?'yes':'no');toast('В браузерной версии системные уведомления недоступны');render();}
      break;
    case 'export':startExport();break;
    case 'import':startImport();break;
  }
}
overlay.addEventListener('submit',e=>{
  e.preventDefault();const form=e.target,inputs=new FormData(form);
  if(form.id==='plant-form'){
    const name=C.safeString(inputs.get('name'),70);if(!name){toast('Введите название куста');return;}
    const id=form.dataset.id;let p=data.plants.find(x=>x.id===id);
    if(!p){p={id:`g-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,lastCheck:'',lastWatered:'',history:[]};data.plants.push(p);}
    p.name=name;p.variety=C.safeString(inputs.get('variety'),80);p.planted=C.parseDay(inputs.get('planted'))?inputs.get('planted'):'';
    p.place=C.safeString(inputs.get('place'),90);p.notes=C.safeString(inputs.get('notes'),400);
    save();closeSheet();go('plants',{plant:p.id});toast('Куст сохранён');
  }
  if(form.id==='water-form'||form.id==='log-form'){
    const day=inputs.get('day');if(!C.parseDay(day)||day>today()){toast('Укажите корректную дату');return;}
    record(form.dataset.id,form.id==='water-form'?'water':form.dataset.kind,day,inputs.get('note'));
  }
});
render();
})();
