import { knownVarieties } from './variety-catalog.mjs';
export const albumMarker = /(?:^|\s)#в_альбом(?=\s|$)/iu;
export const publicChannel = 'Gortenzium';
export const varietyTag = /(?:^|\s)#сорт_([\p{L}\p{N}_-]+)(?=\s|$)/giu;
const byKey = new Map(knownVarieties.map(({key,name})=>[key,name]));
export function makeVarietyKey(name) {
  return String(name||'').normalize('NFC').trim().toLocaleLowerCase('ru')
    .replace(/[^\p{L}\p{N}]+/gu,'_').replace(/^_|_$/g,'');
}
// A missing, unknown, or ambiguous tag is deliberately not sent to a catch-all album.
export function selectedVariety(post) {
  const caption=String(post?.caption || '');
  const tags=[...caption.matchAll(varietyTag)];
  if(tags.length!==1)return null;
  const key=makeVarietyKey(tags[0][1]);
  const name=byKey.get(key);
  return name?{key,name}:null;
}
export function isExpectedChannel(post, configuredChannelId) {
  return !!post && /^-100[0-9]{6,}$/.test(configuredChannelId) &&
    String(post.chat?.id) === configuredChannelId &&
    String(post.chat?.username || '').toLowerCase() === publicChannel.toLowerCase() &&
    Number.isSafeInteger(post.message_id) && post.message_id > 0;
}
export function selectedPhoto(post) {
  if (!albumMarker.test(String(post?.caption || '')) || !selectedVariety(post) || !Array.isArray(post?.photo)) return null;
  const choices = post.photo.filter(p => typeof p?.file_id === 'string' && p.file_id.length < 256 &&
    Number.isSafeInteger(p.file_size) && p.file_size > 0 && p.file_size <= 5_000_000);
  return choices.sort((a, b) => b.file_size - a.file_size)[0] || null;
}
export function safeCaption(post) {
  return String(post.caption || '').replace(albumMarker,'').replace(varietyTag,'').trim().slice(0,180);
}
