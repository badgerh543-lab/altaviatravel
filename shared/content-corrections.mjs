import corrections from './content-corrections.json' with {type:'json'};
const replacements=new Map(corrections);
// Replace only known, exact legacy wording. Staff-written alternatives stay intact.
export function correctContent(value){
  if(typeof value==='string')return replacements.get(value)??value;
  if(Array.isArray(value))return value.map(correctContent);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,correctContent(item)]));
  return value;
}
