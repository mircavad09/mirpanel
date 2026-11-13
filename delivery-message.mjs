const credentials=/^\s*(?:e[- ]?poçt|e[- ]?mail|mail|şifrə|parol|password|pin|otaq kodu|2fa\s*(?:açarı|key|secret)|secret|gizli açar|təhlükəsizlik açarı)\s*[:：]/iu;

function destination(candidate){
 let value=candidate;
 while(value){
  if(/[.,!?;:，。،؛؟]$/u.test(value)){value=value.slice(0,-1);continue;}
  const closing=value.at(-1),opening={')':'(',']':'[','}':'{'}[closing];
  if(opening&&value.split(closing).length>value.split(opening).length){value=value.slice(0,-1);continue;}
  break;
 }
 try{
  const url=new URL(value);
  if(['http:','https:'].includes(url.protocol)&&url.hostname)return value;
 }catch{}
 return '';
}

// Add anchors only to message text. Account fields and existing guide anchors
// stay untouched, and the original string remains the clipboard source.
export function linkDeliveryMessage(container){
 const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('a,button'))nodes.push(walker.currentNode);
 for(const node of nodes){
  const fragment=document.createDocumentFragment();
  for(const line of node.data.split(/(?<=\n)/)){
   if(credentials.test(line)){fragment.append(line);continue;}
   let cursor=0;
   for(const match of line.matchAll(/https?:\/\/[^\s<>"'\u0060]+/giu)){
    const href=destination(match[0]);
    if(!href)continue;
    fragment.append(line.slice(cursor,match.index));
    const link=document.createElement('a');
    link.href=href;link.textContent=href;link.className='delivery-message-link';
    link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';
    link.dataset.nativeNavigation='';
    link.style.cssText='color:#2583FF;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere';
    fragment.append(link);cursor=match.index+href.length;
   }
   fragment.append(line.slice(cursor));
  }
  node.replaceWith(fragment);
 }
}
