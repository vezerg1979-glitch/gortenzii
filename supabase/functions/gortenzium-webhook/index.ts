/** v2.1. Gortenzium forum topic -> same cultivar's gallery.
 * Binding is explicitly confirmed by a REAL group admin using /bind <variety_key> INSIDE the existing topic.
 * Only explicitly marked (#в_альбом) photos of group admins are mirrored to the public gallery.
 * User photos shared through Android remain private pending moderation, never copied automatically.
 * Bot token and Supabase service key MUST stay in Supabase function secrets.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isExpectedForumMessage, bindCommand, unbindCommand, selectedTopicPhoto, albumMarker, safeCaption } from './topic-rules.mjs';

const result = (status:number,body:string)=>new Response(body,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const bucket='gortenzium-channel';
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return result(405,'Method not allowed');
 const secret=Deno.env.get('TELEGRAM_WEBHOOK_SECRET')||'';
 const token=Deno.env.get('TELEGRAM_BOT_TOKEN')||'';
 const chatId=Deno.env.get('TELEGRAM_FORUM_CHAT_ID')||'';
 const url=Deno.env.get('SUPABASE_URL')||'';
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||Deno.env.get('GARDEN_SERVER_KEY')||'';
 if(secret.length<32 || !token || !/^-100[0-9]{6,}$/.test(chatId) || !url || !service)return result(503,'Not configured');
 if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==secret)return result(403,'Forbidden');
 const raw=await request.text(); if(raw.length>256000)return result(413,'Too large');
 let update:any;try{update=JSON.parse(raw);}catch{return result(400,'Invalid JSON');}
 const post=update.message??update.edited_message;
 if(!isExpectedForumMessage(post,chatId))return result(200,'Ignored non-forum message');
 const threadId=post.message_thread_id;
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const tg=async(method:string,payload:unknown)=>{
   const res=await fetch(`https://api.telegram.org/bot${token}/${method}`,{
     method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
   });
   if(!res.ok)throw new Error('Telegram API failure');
   const parsed=await res.json();if(!parsed.ok)throw new Error('Telegram API failure');
   return parsed.result;
 };
 // getChatMember uses Telegram's actual group membership, not a nickname or a self-asserted role.
 const admin=async()=>{
   if(!Number.isSafeInteger(post.from?.id) || post.sender_chat) return false;
   try{
     const m=await tg('getChatMember',{chat_id:chatId,user_id:post.from.id});
     return m.status==='creator'||m.status==='administrator';
   }catch{return false;}
 };
 const reply=async(message:string)=>{
   try{await tg('sendMessage',{chat_id:chatId,message_thread_id:threadId,text:message});}catch{ /* no chat permission: no exposure of secrets */ }
 };
 const requested=bindCommand(post),unbinding=unbindCommand(post);
 if(requested||unbinding){
   if(!(await admin())){await reply('Привязать сорт может только администратор группы.');return result(200,'Not an admin');}
   const {data:current,error:lookupError}=await db.from('gortenzium_topics')
     .select('variety_key').eq('chat_id',chatId).eq('message_thread_id',threadId).maybeSingle();
   if(lookupError)return result(500,'Mapping lookup failed');
   if(unbinding){
     if(current){
       // Protect existing gallery provenance: do not delete or change historical photos silently.
       const {count,error:countError}=await db.from('telegram_topic_gallery').select('message_id',{count:'exact',head:true})
         .eq('chat_id',chatId).eq('message_thread_id',threadId);
       if(countError)return result(500,'Gallery lookup failed');
       if((count||0)>0){await reply('В теме уже есть синхронизированные фото. Перепривязка заблокирована: сначала обратитесь к администратору данных для переноса записей.');return result(200,'Not unbound');}
       const {error}=await db.from('gortenzium_topics').delete().eq('chat_id',chatId).eq('message_thread_id',threadId);
       if(error)return result(500,'Unbind failed');
     }
     await reply('Привязка темы снята.');return result(200,'Unbound');
   }
   if(current && current.variety_key!==requested.key){
     await reply('Эта тема уже привязана к другому сорту. Автоматическая перепривязка запрещена.');return result(200,'Conflict');
   }
   const {data:duplicate,error:dupError}=await db.from('gortenzium_topics').select('message_thread_id')
     .eq('chat_id',chatId).eq('variety_key',requested.key).maybeSingle();
   if(dupError)return result(500,'Duplicate lookup failed');
   if(duplicate && Number(duplicate.message_thread_id)!==threadId){
     await reply('Этот сорт уже привязан к другой теме. Используйте существующую тему.');return result(200,'Conflict');
   }
   const {error}=await db.from('gortenzium_topics').upsert({chat_id:chatId,message_thread_id:threadId,
     variety_key:requested.key,topic_title:String(post.reply_to_message?.forum_topic_created?.name||'').slice(0,128)},
     {onConflict:'chat_id,message_thread_id'});
   if(error)return result(500,'Binding failed');
   await reply(`Тема привязана к сорту «${requested.name}». Отмеченные администратором фотографии будут попадать только в этот сорт.`);
   return result(200,'Bound');
 }
 if(!Array.isArray(post.photo) || !await admin())return result(200,'No admin photo');
 const {data:mapping,error:mappingError}=await db.from('gortenzium_topics').select('variety_key')
   .eq('chat_id',chatId).eq('message_thread_id',threadId).maybeSingle();
 if(mappingError)return result(500,'Mapping lookup failed');
 if(!mapping)return result(200,'Topic not bound');
 const messageId=post.message_id;
 const {data:old,error:oldError}=await db.from('telegram_topic_gallery')
   .select('variety_key,variety_storage_path').eq('chat_id',chatId).eq('message_id',messageId).maybeSingle();
 if(oldError)return result(500,'Photo lookup failed');
 const caption=String(post.caption||'');
 if(!albumMarker.test(caption)){
   if(update.edited_message && old){
     const {error}=await db.from('telegram_topic_gallery').delete().eq('chat_id',chatId).eq('message_id',messageId);
     if(error)return result(500,'Delete failed');
     await db.storage.from(bucket).remove([old.variety_storage_path]);
   }
   return result(200,'No explicit opt-in');
 }
 const selected=selectedTopicPhoto(post); if(!selected)return result(200,'No valid photo');
 const path=`Gortenzium/topics/${mapping.variety_key}/${messageId}.jpg`;
 if(old && old.variety_key===mapping.variety_key){
   if(update.edited_message){
     const {error}=await db.from('telegram_topic_gallery').update({caption:safeCaption(post)})
       .eq('chat_id',chatId).eq('message_id',messageId);
     return error?result(500,'Caption update failed'):result(200,'Updated');
   }
   return result(200,'Already synced');
 }
 let filePath:string;
 try{const info=await tg('getFile',{file_id:selected.file_id});filePath=String(info?.file_path||'');}
 catch{return result(502,'Telegram getFile failed');}
 if(!/^photos\/[\w./-]+\.jpe?g$/i.test(filePath)||filePath.includes('..'))return result(502,'Unexpected file path');
 const download=await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`,{signal:AbortSignal.timeout(20000)});
 if(!download.ok)return result(502,'Download failed');
 const bytes=new Uint8Array(await download.arrayBuffer());
 if(bytes.length<100 || bytes.length>5_000_000 || bytes[0]!==0xff || bytes[1]!==0xd8 || bytes.at(-2)!==0xff || bytes.at(-1)!==0xd9)
   return result(422,'Invalid JPEG');
 const {error:uploadError}=await db.storage.from(bucket).upload(path,bytes,{contentType:'image/jpeg',cacheControl:'3600',upsert:false});
 if(uploadError&&!/already exists/i.test(uploadError.message))return result(500,'Storage failed');
 if(!Number.isSafeInteger(post.date)||post.date<=0)return result(200,'Invalid date');
 const {error:insertError}=await db.from('telegram_topic_gallery').upsert({chat_id:chatId,message_id:messageId,
   message_thread_id:threadId,variety_key:mapping.variety_key,caption:safeCaption(post),created_at:new Date(post.date*1000).toISOString()},
   {onConflict:'chat_id,message_id'});
 if(insertError)return result(500,'Database write failed');
 return result(200,'Synced to bound topic');
});
