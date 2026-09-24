import { knownVarieties } from './variety-catalog.mjs';
import { albumMarker, safeCaption } from './rules.mjs';
export { albumMarker, safeCaption };
const known = new Map(knownVarieties.map(x => [x.key,x.name]));
const groupIdPattern = /^-100[0-9]{6,}$/;
export function isExpectedForumMessage(post, configuredId) {
  return !!post && groupIdPattern.test(String(configuredId||'')) &&
    String(post.chat?.id) === String(configuredId) && post.chat?.type === 'supergroup' &&
    post.chat?.is_forum === true && post.is_topic_message === true &&
    Number.isSafeInteger(post.message_thread_id) && post.message_thread_id > 1 &&
    Number.isSafeInteger(post.message_id) && post.message_id > 0;
}
export function bindCommand(post) {
  const match = String(post?.text||'').trim().match(/^\/bind(?:@[a-z_0-9]+)?\s+([\p{L}\p{N}_-]{1,100})\s*$/iu);
  if (!match) return null;
  const key = match[1].normalize('NFC').toLocaleLowerCase('ru');
  return known.has(key)?{key,name:known.get(key)}:null;
}
export function unbindCommand(post) {
  return /^\/unbind(?:@[a-z_0-9]+)?\s*$/iu.test(String(post?.text||'').trim());
}
export function selectedTopicPhoto(post){
  if (!albumMarker.test(String(post?.caption||'')) || !Array.isArray(post?.photo)) return null;
  return post.photo.filter(p => typeof p?.file_id==='string' && p.file_id.length < 256 &&
    Number.isSafeInteger(p?.file_size) && p.file_size > 0 && p.file_size <= 5_000_000)
    .sort((a,b)=>b.file_size-a.file_size)[0] || null;
}
export function forumPostUrl(chatId,messageId){
  const chat = String(chatId||'');
  return groupIdPattern.test(chat) && Number.isSafeInteger(Number(messageId)) && Number(messageId)>0
    ? `https://t.me/c/${chat.slice(4)}/${messageId}` : '';
}
export function forumTopicUrl(chatId,threadId){return forumPostUrl(chatId,threadId);}
