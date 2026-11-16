import assert from 'node:assert/strict';
import {shopFixture} from './shop-test-fixture.mjs';
import {influencerPreview} from '../mirpanel-admin/community/influencer-preview.mjs';
const fixture=await shopFixture(),{pool,id}=fixture;
try{
 await pool.query("update community_member_numbers set member_number=1554 where user_id='b'");
 await assert.rejects(influencerPreview(pool,'owner'),{status:409});
 await pool.query('update "user" set email=$1 where id=$2',['aysdrrek@gmail.com','b']);
 assert.deepEqual((await influencerPreview(pool,'owner')).items,[]);
 const input={action:'send',clientId:id(),body:'Salam!\nİkinci sətir 💛'};
 const [a,b]=await Promise.all([influencerPreview(pool,'owner',input),influencerPreview(pool,'owner',input)]);
 assert.equal(a.items[0].id,b.items[0].id);
 assert.equal(a.items.length,1);
 assert.equal(a.items[0].test,true);
 assert.equal(a.items[0].body,input.body);
 await assert.rejects(influencerPreview(pool,'owner',{...input,body:'Fərqli mətn'}),{status:409});
 assert.deepEqual((await influencerPreview(pool,'a')).items,[]);
 await influencerPreview(pool,'a',{action:'delete',id:a.items[0].id});
 assert.equal((await influencerPreview(pool,'owner')).items.length,1);
 assert.equal((await pool.query('select count(*)::int n from community_messages')).rows[0].n,0);
 assert.equal((await pool.query('select count(*)::int n from community_profiles where user_id=$1',['b'])).rows[0].n,0);
 await influencerPreview(pool,'owner',{action:'delete',id:a.items[0].id});
 assert.deepEqual((await influencerPreview(pool,'owner')).items,[]);
 await assert.rejects(influencerPreview(pool,'owner',{action:'send',clientId:id(),body:'x'.repeat(2001)}),{status:400});
 const permissions=(await pool.query("select has_table_privilege('anon','mirpanel_community.influencer_preview_messages','SELECT') exposed,relrowsecurity secured from pg_class where oid='mirpanel_community.influencer_preview_messages'::regclass")).rows[0];
 assert.equal(permissions.exposed,false);assert.equal(permissions.secured,true);
 console.log('PASS isolated preview: verified target, parallel retry one message, ownership, delete, multiline, public chat/profile untouched, private table permissions.');
}finally{await fixture.close();}
