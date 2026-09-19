/* Чистые функции для интерфейса, браузерных и Node.js тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GardenCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const MONTH_LABELS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  function dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }
  function parseDay(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(str)) return null;
    const [y,m,d] = str.split('-').map(Number);
    const v = new Date(y,m-1,d);
    return v.getFullYear() === y && v.getMonth() === m-1 && v.getDate() === d ? v : null;
  }
  function daysSince(day, now = new Date()) {
    const start = parseDay(day);
    if (!start) return null;
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((Date.UTC(current.getFullYear(),current.getMonth(),current.getDate()) - Date.UTC(start.getFullYear(),start.getMonth(),start.getDate())) / 86400000);
  }
  function moistureStatus(plant, now = new Date()) {
    const n = daysSince(plant.lastCheck, now);
    const month = now.getMonth();
    const gap = [5,5,3,3,2,2,2,2,2,3,4,5][month];
    if (n === null || n >= gap) return { due: true, text: 'Проверьте влажность грунта', secondary: 'Поливать только если почва подсохла' };
    return { due: false, text: 'Проверка влажности проведена', secondary: `Следующая проверка примерно через ${gap-n} дн.` };
  }
  function checklistKey(taskId, monthIndex, year) { return `${year}-${String(monthIndex+1).padStart(2,'0')}:${taskId}`; }
  function safeString(value, max=120) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
  function sanitizeBackup(input) {
    if (!input || typeof input !== 'object' || input.version !== 1 || !Array.isArray(input.plants) || !Array.isArray(input.completed)) throw Error('Неверный формат резервной копии');
    if (input.plants.length > 200 || input.completed.length > 2000) throw Error('Слишком много данных');
    const ids = new Set();
    const plants = input.plants.map((p, idx) => {
      if (!p || typeof p !== 'object') throw Error('Ошибка записи растения');
      const id = safeString(p.id, 70);
      const name = safeString(p.name, 70);
      if (!id || !name || ids.has(id)) throw Error('Некорректное название или ID растения');
      ids.add(id);
      const history = Array.isArray(p.history) ? p.history.slice(0, 300).map(h => ({
        kind: safeString(h.kind, 32), day: parseDay(h.day) ? h.day : '', note: safeString(h.note, 160)
      })).filter(h => h.day) : [];
      return {id, name, variety:safeString(p.variety, 80), planted:parseDay(p.planted)?p.planted:'',
        place:safeString(p.place, 90), notes:safeString(p.notes, 400), lastCheck:parseDay(p.lastCheck)?p.lastCheck:'',
        lastWatered:parseDay(p.lastWatered)?p.lastWatered:'', history};
    });
    return {version:1,plants,completed:input.completed.filter(x=>typeof x==='string' && /^[0-9]{4}-[0-9]{2}:[a-z0-9-]{1,50}$/.test(x)).slice(0,2000)};
  }
  return {MONTHS,MONTH_LABELS,dateKey,parseDay,daysSince,moistureStatus,checklistKey,safeString,sanitizeBackup};
});
