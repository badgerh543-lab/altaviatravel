// Normalize Uzbek apostrophe variants, diacritics and punctuation for name/place lookup.
export function normalizeSearch(value:string):string {
  return value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
    .replace(/[’‘ʻʼ`´']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
