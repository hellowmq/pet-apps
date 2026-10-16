import portableSource from 'virtual:petapp-portable-source';

export function createPetBookmark({ pet = 'maodie', locale = 'zh-CN' } = {}) {
  const code = `void function(){${portableSource}\nPetAppPortable.install(${JSON.stringify({ pet, locale })})}()`;
  const bookmark = `javascript:${encodeURIComponent(code)}`;
  if (bookmark.length > 1900000) throw new Error('Portable pet bookmark exceeds the supported URL size');
  return bookmark;
}
