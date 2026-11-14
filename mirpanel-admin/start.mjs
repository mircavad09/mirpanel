// A retired region imports no business code, credentials client or job worker.
if(['relay','relay-old'].includes(process.env.MIRPANEL_RUNTIME_ROLE)){
 const {createDeploymentRelay}=await import('./deployment-relay.mjs');
 const target=process.env.MIRPANEL_RUNTIME_ROLE==='relay-old'?'https://mirpanel.onrender.com':'https://mirpanel-frankfurt.onrender.com';
 const server=createDeploymentRelay({target});
 server.listen(Number(process.env.PORT||8787),()=>console.log('DEPLOYMENT_RELAY_READY'));
 process.on('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(0),25000).unref();});
}else await import('./server.mjs');
