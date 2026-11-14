// A retired region imports no business code, credentials client or job worker.
if(process.env.MIRPANEL_RUNTIME_ROLE==='relay'){
 const {createDeploymentRelay}=await import('./deployment-relay.mjs');
 const target='https://mirpanel-frankfurt.onrender.com';
 const server=createDeploymentRelay({target});
 server.listen(Number(process.env.PORT||8787),()=>console.log('DEPLOYMENT_RELAY_READY'));
 process.on('SIGTERM',()=>{server.close();setTimeout(()=>process.exit(0),25000).unref();});
}else await import('./server.mjs');
