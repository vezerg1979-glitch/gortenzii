import assert from 'node:assert/strict';
import fs from 'node:fs';
import {isExpectedForumMessage,bindCommand,unbindCommand,selectedTopicPhoto,forumPostUrl,forumTopicUrl} from '../supabase/functions/gortenzium-webhook/topic-rules.mjs';
let n=0; function test(name,fn){fn(); n++; console.log('✓ '+name);}
const chat=-1001234567890;
const p={chat:{id:chat,type:'supergroup',is_forum:true},is_topic_message:true,message_thread_id:75,message_id:92,from:{id:123},caption:'Моя гортензия #в_альбом',photo:[{file_id:'tiny',file_size:300},{file_id:'large',file_size:1500}]};
test('Только нужная форумная группа и реальный ID темы',()=>{
 assert.equal(isExpectedForumMessage(p,String(chat)),true);
 for (const x of [{...p,chat:{...p.chat,id:-1001234567891}}, {...p,chat:{...p.chat,type:'channel'}},
   {...p,chat:{...p.chat,is_forum:false}}, {...p,is_topic_message:false},{...p,message_thread_id:undefined}])
  assert.equal(isExpectedForumMessage(x,String(chat)),false);
});
test('Сорт назначается только явным /bind известного ключа внутри темы',()=>{
 assert.deepEqual(bindCommand({...p,text:'/bind limelight'}),{key:'limelight',name:'Limelight'});
 assert.deepEqual(bindCommand({...p,text:'/bind самарская_лидия'}),{key:'самарская_лидия',name:'Самарская Лидия'});
 assert.equal(bindCommand({...p,text:'Limelight'}),null);
 assert.equal(bindCommand({...p,text:'/bind random_unlisted'}),null);
 assert.equal(unbindCommand({...p,text:'/unbind'}),true);
});
test('Отдельный фото-импорт только при отметке #в_альбом',()=>{
 assert.equal(selectedTopicPhoto(p).file_id,'large');
 assert.equal(selectedTopicPhoto({...p,caption:'Без согласия'}),null);
 assert.equal(selectedTopicPhoto({...p,photo:[]}),null);
});
test('Ссылки строятся по фактическому ID группы и сообщения, не по имени канала',()=>{
 assert.equal(forumPostUrl(chat,92),'https://t.me/c/1234567890/92');
 assert.equal(forumTopicUrl(chat,75),'https://t.me/c/1234567890/75');
 assert.equal(forumPostUrl('any',92),'');
});
test('SQL гарантирует уникальное соответствие темы сорту',()=>{
 const sql=fs.readFileSync('supabase/topic_migration.sql','utf8');
 assert.match(sql,/primary key \(chat_id, message_thread_id\)/);
 assert.match(sql,/unique \(chat_id, variety_key\)/);
 assert.match(sql,/foreign key \(chat_id, message_thread_id\)/);
 assert.match(sql,/enable row level security/);
});
test('Сервер сверяет администратора группы и берёт сорт из связанной темы, не из текста',()=>{
 const src=fs.readFileSync('supabase/functions/gortenzium-webhook/index.ts','utf8');
 assert.match(src,/TELEGRAM_FORUM_CHAT_ID/);assert.match(src,/getChatMember/);
 assert.match(src,/get\('telegram_topic_gallery'\)|from\('telegram_topic_gallery'\)/);
 assert.match(src,/from\('gortenzium_topics'\)/);
 assert.match(src,/variety_key:mapping.variety_key/);
 assert.doesNotMatch(src,/const post=update\.channel_post/);
 assert.match(src,/TELEGRAM_WEBHOOK_SECRET/);
});
test('Android открывает именно связанную тему и запрос не включает неразобранный старый канал',()=>{
 const kt=fs.readFileSync('app/src/main/java/ru/gortenziya/moisad/CloudAlbum.kt','utf8');
 const main=fs.readFileSync('app/src/main/java/ru/gortenziya/moisad/MainActivity.kt','utf8');
 const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
 assert.match(kt,/rest\/v1\/gortenzium_topics/);assert.match(kt,/rest\/v1\/telegram_topic_gallery/);
 assert.doesNotMatch(kt,/rest\/v1\/telegram_gallery/);
 assert.match(main,/openTelegramForumTopic/);assert.match(main,/openTelegramForumPost/);
 assert.match(app,/open-telegram-topic/);assert.match(app,/open-forum-post/);
});
console.log(`ИТОГО: ${n} тестов по темам пройдено`);
