import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {BlockList, isIP} from 'node:net';

const blocked = new BlockList();
for (const [address, bits] of [
  ['0.0.0.0',8], ['10.0.0.0',8], ['100.64.0.0',10], ['127.0.0.0',8],
  ['169.254.0.0',16], ['172.16.0.0',12], ['192.0.0.0',24], ['192.0.2.0',24],
  ['192.88.99.0',24], ['192.168.0.0',16], ['198.18.0.0',15], ['198.51.100.0',24],
  ['203.0.113.0',24], ['224.0.0.0',3]
]) blocked.addSubnet(address,bits);

export function approvedUrl(base, path, allowlist) {
  const url = new URL(base);
  if (url.protocol !== 'https:' || url.port || url.username || url.password ||
      !url.hostname.includes('.') || isIP(url.hostname) || url.pathname !== '/' ||
      url.search || url.hash || !allowlist.has(url.origin)) throw Error('ORIGIN_BLOCKED');
  if (typeof path !== 'string' || !/^\/(?!\/)[a-zA-Z0-9_./~-]{1,300}$/.test(path) ||
      path.split('/').some(part => part === '.' || part === '..')) throw Error('PATH_BLOCKED');
  return new URL(path,url);
}

export async function supplierRequest({base, path, key, allowlist, body, reference}) {
  const url = approvedUrl(base,path,allowlist);
  const signal = AbortSignal.timeout(8000);
  const records = await lookup(url.hostname,{family:4,all:true});
  signal.throwIfAborted();
  if (!records.length || records.some(({address}) => blocked.check(address))) throw Error('ADDRESS_BLOCKED');
  const [{address}] = records;
  if (reference && !body) url.searchParams.set('reference',reference);
  const payload = body ? JSON.stringify(body) : null;
  return new Promise((resolve,reject) => {
    const req = request(url,{
      method: payload ? 'POST' : 'GET', signal, agent:false, family:4,
      lookup: (_hostname,options,callback) => options.all
        ? callback(null,[{address,family:4}]) : callback(null,address,4),
      headers:{
        Authorization:'Bearer '+key, Accept:'application/json',
        ...(payload ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload),
          'Idempotency-Key':reference} : {})
      }
    }, res => {
      const chunks = [];
      let length = 0;
      res.on('error',reject);
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.destroy();
        reject(Error('SUPPLIER_HTTP'));
        return;
      }
      res.on('data',chunk => {
        length += chunk.length;
        if (length > 65536) res.destroy(Error('SUPPLIER_RESPONSE_LIMIT'));
        else chunks.push(chunk);
      });
      res.on('end',() => {
        if (!reference && !payload) return resolve(null);
        try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
        catch { reject(Error('SUPPLIER_JSON')); }
      });
    });
    req.on('error',reject);
    req.end(payload);
  });
}
