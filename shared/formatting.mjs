export function formatDuration(lang,count,dictionary){
  const plural=new Intl.PluralRules(lang).select(count);
  const key=plural==='one'?'daysOne':plural==='few'?'daysFew':'days';
  return `${new Intl.NumberFormat(lang).format(count)} ${dictionary[key][lang]}`;
}
