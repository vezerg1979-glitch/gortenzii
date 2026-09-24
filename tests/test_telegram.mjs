import assert from 'node:assert/strict';
import fs from 'node:fs';
import { selectedVariety,makeVarietyKey,albumMarker,safeCaption } from '../supabase/functions/gortenzium-webhook/rules.mjs';
import { isExpectedForumMessage,bindCommand,selectedTopicPhoto } from '../supabase/functions/gortenzium-webhook/topic-rules.mjs';
let count=0;
const test=(n,fn)=>{fn();count++;console.log('✓ '+n)};
const root='app/src/main/assets/';
test('Справочник содержит нормализованные ключи сортов для старых резервных копий',()=>{
 assert.equal(makeVarietyKey('Little Lime'),'little_lime');
 assert.deepEqual(selectedVariety({caption:'#сорт_Самарская_Лидия'}),{key:'самарская_лидия',name:'Самарская Лидия'});
});
test('Сохранённая подпись не показывает служебные метки',()=>{
 assert.equal(safeCaption({caption:'Красивый куст #в_альбом #сорт_Limelight'}),'Красивый куст');
});
test('Форумные фото маршрутизируются по теме, без хештега сорта',()=>{
 const p={chat:{id:-1001234567890,type:'supergroup',is_forum:true},message_id:101,message_thread_id:22,is_topic_message:true,caption:'Мой куст #в_альбом',photo:[{file_id:'a',file_size:1500}]};
 assert.equal(isExpectedForumMessage(p,'-1001234567890'),true);
 assert.equal(selectedTopicPhoto(p).file_id,'a');
 assert.equal(selectedVariety(p),null);
});
test('Явная привязка возможна для известного сорта',()=>{
 assert.equal(bindCommand({text:'/bind limelight'}).key,'limelight');
 assert.equal(bindCommand({text:'/bind unknown'}),null);
});
test('В группе не импортируется фотография без отметки разрешения',()=>{
 assert.equal(albumMarker.test(' #в_альбом '),true);
 assert.equal(selectedTopicPhoto({caption:'Личный снимок',photo:[{file_id:'a',file_size:1234}]}),null);
});
test('Разделы в приложении фильтруются по точному ключу сорта',()=>{
 const a=fs.readFileSync(root+'app.js','utf8');
 const k=fs.readFileSync('app/src/main/java/ru/gortenziya/moisad/CloudAlbum.kt','utf8');
 assert.match(a,/galleryVarietyKey/);assert.match(a,/view-variety-gallery/);
 assert.match(k,/variety_key=eq/);assert.match(k,/"variety_key", varietyKey/);
});
test('Секреты находятся только в серверном коде',()=>{
 const server=fs.readFileSync('supabase/functions/gortenzium-webhook/index.ts','utf8');
 const gradle=fs.readFileSync('app/build.gradle.kts','utf8');
 assert.match(server,/TELEGRAM_WEBHOOK_SECRET/);assert.match(server,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(gradle,/TELEGRAM_BOT_TOKEN|SUPABASE_SERVICE_ROLE_KEY/);
});
test('Общий каталог согласован с сервером и SQL seed',()=>{
 const sql=fs.readFileSync('supabase/varieties_seed.sql','utf8');
 const code=fs.readFileSync('supabase/functions/gortenzium-webhook/variety-catalog.mjs','utf8');
 assert.equal((sql.match(/^\('/gm)||[]).length,(code.match(/"key"/g)||[]).length);
});
test('Обновлённые файлы настроены на форумное соответствие',()=>{
 const sql=fs.readFileSync('supabase/topic_migration.sql','utf8');
 const server=fs.readFileSync('supabase/functions/gortenzium-webhook/index.ts','utf8');
 assert.match(sql,/unique \(chat_id, variety_key\)/);assert.match(server,/TELEGRAM_FORUM_CHAT_ID/);
});
console.log(`ИТОГО: ${count} тестов интеграции Telegram пройдено`);
