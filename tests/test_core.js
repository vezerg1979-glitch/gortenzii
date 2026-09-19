const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../app/src/main/assets/core.js');
const root = path.join(__dirname,'../app/src/main/assets');
let total=0;
function test(name,run){run();total++;console.log('✓ '+name);}
const date = (y,m,d)=>new Date(y,m-1,d);
test('Локальная дата без смещения часового пояса',()=>{
  assert.equal(C.dateKey(date(2026,9,19)), '2026-09-19');
  assert.equal(C.daysSince('2026-09-17', date(2026,9,19)),2);
  assert.equal(C.daysSince('2026-12-31', date(2027,1,1)),1);
});
test('Некорректные даты отклоняются',()=>{
  assert.equal(C.parseDay('2026-02-30'),null);
  assert.equal(C.parseDay('0000-00-00'),null);
  assert.equal(C.parseDay('2026-9-19'),null);
  assert.equal(C.daysSince('not-a-date'),null);
});
test('Влажность: никогда не предписывает полив автоматически',()=>{
  assert.equal(C.moistureStatus({lastCheck:''},date(2026,7,15)).due,true);
  assert.equal(C.moistureStatus({lastCheck:'2026-07-14'},date(2026,7,15)).due,false);
  assert.equal(C.moistureStatus({lastCheck:'2026-07-13'},date(2026,7,15)).due,true);
  assert.match(C.moistureStatus({lastCheck:''},date(2026,7,15)).secondary,/только если/i);
});
test('Отметка календарной задачи привязана к году и месяцу',()=>{
  assert.equal(C.checklistKey('prune',3,2026),'2026-04:prune');
  assert.notEqual(C.checklistKey('prune',3,2026),C.checklistKey('prune',3,2027));
});
test('Корректная копия сохраняет растения и историю',()=>{
  const b=C.sanitizeBackup({version:1,plants:[{id:'p1',name:'Лаймлайт',variety:'Limelight',lastCheck:'2026-09-19',history:[{kind:'water',day:'2026-09-19',note:'полив'}]}],completed:['2026-04:prune']});
  assert.equal(b.plants[0].name,'Лаймлайт');
  assert.equal(b.plants[0].history[0].kind,'water');
  assert.equal(b.completed.length,1);
});
test('Копия с повторными ID и неверной версией не импортируется',()=>{
  assert.throws(()=>C.sanitizeBackup({version:2,plants:[],completed:[]}));
  assert.throws(()=>C.sanitizeBackup({version:1,plants:[{id:'x',name:'Куст'},{id:'x',name:'Куст 2'}],completed:[]}));
});
test('Длинные примечания и дополнительные поля отбрасываются при импорте',()=>{
  const p=C.sanitizeBackup({version:1,plants:[{id:'x',name:'A'.repeat(500),notes:'n'.repeat(900),evil:'<script>'}],completed:['bad value','2026-04:prune']}).plants[0];
  assert.equal(p.name.length,70); assert.equal(p.notes.length,400);
  assert.equal(Object.hasOwn(p,'evil'),false);
});
test('Сезонные задачи, справочник и сорта доступны для 12 месяцев',()=>{
  const ctx={window:{},console};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'content.js'),'utf8'),ctx);
  assert.equal(ctx.window.GardenContent.tasks.length,12);
  assert.ok(ctx.window.GardenContent.tasks.every(x=>x.length>=2));
  assert.ok(ctx.window.GardenContent.guides.length>=8);
  assert.ok(ctx.window.GardenContent.varieties.some(x=>x.name==='Limelight'));
});
test('Стартовая страница приложения рендерится в офлайн-режиме',()=>{
  const stored={};
  const ctx={window:{GardenCore:C},console,Date,Math,JSON,URL,Blob,setTimeout:()=>1,clearTimeout:()=>{},
    localStorage:{getItem:k=>stored[k]||null,setItem:(k,v)=>{stored[k]=v;}},
    FormData:class {constructor(form){this.values=form.values;} get(key){return this.values[key]||'';}},
  };
  class El{
    constructor(){this.innerHTML='';this.classList={toggle:()=>{},add:()=>{},remove:()=>{},contains:()=>true};this.dataset={};this.handlers={};}
    addEventListener(name, fn){this.handlers[name]=fn;}
    querySelectorAll(){return [new El(),new El(),new El(),new El(),new El()];}
    querySelector(){return null;}
    setAttribute(){}
  }
  const elems={main:new El(),overlay:new El(),tabs:new El(),toast:new El(),'backup-file':new El()};
  ctx.document={getElementById:id=>elems[id]};
  ctx.window.scrollTo=()=>{};
  ctx.window.GardenContent=null;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'content.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),ctx);
  assert.match(elems.main.innerHTML,/Сегодня в саду/);
  assert.match(elems.main.innerHTML,/Добавить гортензию/);
  assert.match(elems.main.innerHTML,/Гортензия/);
  // Переход в календарь и справочник через настоящие обработчики приложения.
  elems.tabs.handlers.click({target:{closest:()=>({dataset:{tab:'calendar'}})}});
  assert.match(elems.main.innerHTML,/Календарь ухода/);
  elems.tabs.handlers.click({target:{closest:()=>({dataset:{tab:'guide'}})}});
  assert.match(elems.main.innerHTML,/Справочник/);
  elems.tabs.handlers.click({target:{closest:()=>({dataset:{tab:'plants'}})}});
  elems.main.handlers.click({target:{closest:()=>({dataset:{action:'add-plant'}})}});
  assert.match(elems.overlay.innerHTML,/Новая гортензия/);
  let prevented=false;
  elems.overlay.handlers.submit({preventDefault:()=>{prevented=true;},target:{id:'plant-form',dataset:{id:''},values:{name:'Куст у дома',variety:'Limelight',place:'Терраса'}}});
  assert.equal(prevented,true);
  assert.match(elems.main.innerHTML,/Куст у дома/);
  assert.equal(JSON.parse(stored['gortenziya_moy_sad_v1']).plants.length,1);
});
console.log(`ИТОГО: ${total} тестов пройдено`);
