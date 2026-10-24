/* Wordbook offline sync safety policy v3.11.
 * Pure client-side merge helpers: no network calls, no private-data export.
 */
(function(root, factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WordbookSyncPolicy=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const canonical=x=>{
    if(Array.isArray(x))return x.map(canonical);
    if(x && typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));
    return x;
  };
  const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
  function comparableWord(w){
    if(!w)return null;
    return {
      id:String(w.id), en:String(w.en||''), zh:String(w.zh||''),
      note:String(w.note||''),pos:String(w.pos||''),posDetails:String(w.posDetails||''),
      posSource:String(w.posSource||''),tags:Array.isArray(w.tags)?w.tags:[],
      source:String(w.source||''), originals:Array.isArray(w.originals)?w.originals:[],
      createdAt:String(w.createdAt||''),updatedAt:String(w.updatedAt||'')
    };
  }
  const sameWord=(a,b)=>same(comparableWord(a),comparableWord(b));
  const mapWords=s=>new Map((s?.words||[]).map(w=>[String(w.id),w]));
  function wordChanges(base,newer){
    const old=mapWords(base),now=mapWords(newer),upserts=[],deletes=[];
    for(const [id,w] of now)if(!sameWord(w,old.get(id)))upserts.push(w);
    for(const [id] of old)if(!now.has(id))deletes.push(id);
    return {upserts,deletes};
  }
  const KEYS=['tags','tagOrders','translatorUrl'];
  function settingsChanges(base,local){
    const a=base?.settings||{},b=local?.settings||{};
    const keys=new Set([...Object.keys(a),...Object.keys(b)]);
    return [...keys].filter(k=>k!=='search'&&!same(a[k],b[k]));
  }
  function detectConflicts(base,remote,local){
    const previous=mapWords(base),server=mapWords(remote);
    const delta=wordChanges(base,local),conflicts=[];
    for(const w of delta.upserts){
      const old=previous.get(String(w.id)),latest=server.get(String(w.id));
      if(!sameWord(old,latest)&&!sameWord(latest,w))conflicts.push({type:'word',id:String(w.id),label:String(w.en||w.id)});
    }
    for(const id of delta.deletes){
      const old=previous.get(String(id)),latest=server.get(String(id));
      if(latest&&!sameWord(old,latest))conflicts.push({type:'delete',id:String(id),label:String(old?.en||id)});
    }
    for(const key of KEYS){
      if(!same(base?.[key],local?.[key])&&!same(base?.[key],remote?.[key])&&!same(remote?.[key],local?.[key]))
        conflicts.push({type:'setting',id:key,label:key});
    }
    for(const key of settingsChanges(base,local)){
      const old=base?.settings?.[key],current=local?.settings?.[key],latest=remote?.settings?.[key];
      if(!same(old,latest)&&!same(current,latest))conflicts.push({type:'setting',id:'settings.'+key,label:key});
    }
    return conflicts;
  }
  function mergeLocalDelta(remote,base,local){
    const out={...remote,settings:{...(remote?.settings||{})}};
    const changed=wordChanges(base,local),words=mapWords(remote);
    for(const id of changed.deletes)words.delete(String(id));
    for(const w of changed.upserts)words.set(String(w.id),w);
    out.words=[...words.values()];
    for(const key of KEYS)if(!same(base?.[key],local?.[key]))out[key]=local[key];
    for(const key of settingsChanges(base,local))out.settings[key]=local.settings?.[key];
    out.settings.search='';
    out.deletedKeys=[...new Set([...(remote?.deletedKeys||[]),...(local?.deletedKeys||[])])];
    return out;
  }
  // Always avoid writing a large delete set on automatic reconnect. This is
  // especially important after restore/import or when the server looks empty.
  function unsafeDeleteCount(count,baselineCount){
    return count>25 || (baselineCount>=30 && count>Math.ceil(baselineCount*0.1));
  }
  function unsafeUpsertCount(count,baselineCount){
    // A large manual import must be reviewed before it can upload hundreds of
    // rows; do not confuse client-side normalization with real user edits.
    return count>150 && count>Math.max(30,Math.ceil(baselineCount*0.2));
  }
  return Object.freeze({wordChanges,detectConflicts,mergeLocalDelta,unsafeDeleteCount,unsafeUpsertCount,same,sameWord});
});
