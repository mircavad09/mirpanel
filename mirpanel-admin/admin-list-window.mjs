// Read-only anchored pagination: additions before the visible row never move it.
export function adminListWindow(rows,{page=1,pageSize=20,anchorId='',anchorIndex=0}={}){
 const ordinary=(page-1)*pageSize,index=rows.findIndex(r=>r.id===anchorId);
 const offset=Math.max(0,Math.min(pageSize-1,Number.parseInt(anchorIndex,10)||0));
 const start=anchorId&&index>=0?Math.max(0,index-offset):ordinary;
 return{rows:rows.slice(start,start+pageSize),start,newBeforeAnchor:anchorId&&index>=0?Math.max(0,start-ordinary):0,anchorMissing:Boolean(anchorId&&index<0)};
}
