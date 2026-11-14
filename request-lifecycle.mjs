// Keep deadlines and cancellation active through response-body processing.
// No AbortSignal.any/timeout dependency: older Safari supports AbortController.
export async function withRequestSignal(signals,timeout,run){
 const controller=new AbortController(),listeners=[];
 let timer,timedOut=false;
 const reason=()=>new DOMException(timedOut?'Request timed out':'Request cancelled',timedOut?'TimeoutError':'AbortError');
 const abort=()=>{if(!controller.signal.aborted)controller.abort(reason());};
 for(const signal of signals.filter(Boolean)){
  if(signal.aborted){abort();break;}
  signal.addEventListener('abort',abort,{once:true});listeners.push(signal);
 }
 try{
  if(controller.signal.aborted)throw reason();
  timer=setTimeout(()=>{timedOut=true;abort();},timeout);
  const result=await run(controller.signal);
  if(controller.signal.aborted)throw reason();
  return result;
 }catch(error){if(controller.signal.aborted)throw reason();throw error;}
 finally{clearTimeout(timer);for(const signal of listeners)signal.removeEventListener('abort',abort);}
}
export function orderRequestMessage(error){
 if(error?.name==='TimeoutError')return 'Cavab gecikir. Daxil etdiyiniz məlumatlar bu pəncərədə qalıb. Yenidən cəhd edin.';
 if(error?.name==='AbortError')return 'Sorğu ləğv edildi. Yenidən cəhd edin.';
 if(error?.name==='TypeError'||!error?.message||/AbortSignal|is not a function|undefined|Failed to fetch|Load failed|NetworkError/i.test(error.message))return 'Bağlantı alınmadı. Daxil etdiyiniz məlumatlar bu pəncərədə qalıb. Yenidən cəhd edin.';
 return error.message;
}
