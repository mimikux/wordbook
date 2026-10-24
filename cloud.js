/* Wordbook Cloud v3.0 - single verified email, Supabase RLS, offline-safe cache.
   No personal vocabulary, admin keys or password is included in this script. */
(() => {
  'use strict';
  const cfg = window.WORDBOOK_CONFIG || {};
  const bridge = window.WordbookBridge;
  const policy = window.WordbookSyncPolicy;
  if(!policy)throw new Error('Wordbook sync safety module missing');
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('app');
  const status = document.getElementById('auth-message');
  const form = document.getElementById('auth-form');
  const submit = document.getElementById('auth-submit');
  const safeClone = x => JSON.parse(JSON.stringify(x));
  const initial = () => ({version:2, words:[], tags:[], tagOrders:{}, deletedKeys:[], settings:{sort:'az',pos:'',tag:'',search:''}, translatorUrl:'', appliedDatasets:[]});
  const normalized = x => String(x||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
  let sb=null, uid='', email='', syncing=false, dirty=false, authorized=false, pending=null, baseline=initial();
  let debounce=0, loginEpoch=0, lastUser='', refreshing=false, currentStatus='登入中…';
  let offlineUnlocked=false,authStarted=false,signOutRequested=false,lastVerifiedAt=0,conflictBlocked=[];
  let cacheWriteChain=Promise.resolve(),localRevision=0;
  const cloud = {
    isReady: false,
    currentEmail:'',
    statusText:'',
    localChange,
    syncNow,
    issueDeviceCode,
    lookupPartOfSpeech,
    listBackups,
    downloadBackupUrl,
    signOut,
    bootOnline:()=>start(),
    getOfflineStatus:()=>({authorized,offline:!online(),pending:dirty,blocked:conflictBlocked.length})
  };
  window.WordbookCloud = cloud;
  const setStatus = msg => {currentStatus=msg;cloud.statusText=msg;bridge.setStatus(msg);};
  const authMessage = msg => status.textContent=msg;
  function gateView(visible) { gate.hidden=!visible;app.hidden=visible; }
  const online=()=>navigator.onLine!==false;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  // IndexedDB is scoped per authenticated Supabase user, not an unprotected
  // shared localStorage key. Clearing it on logout is mandatory. This is an
  // offline convenience cache, NOT disk encryption against a compromised device.
  const CACHE_DB='wordbook-private-cache-v3';
  const CACHE_STORE='users';
  function dbOpen(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('No IndexedDB'));
      const request=indexedDB.open(CACHE_DB,1);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains(CACHE_STORE))request.result.createObjectStore(CACHE_STORE,{keyPath:'uid'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function cacheRead(id){
    const db=await dbOpen();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readonly');
      const r=tx.objectStore(CACHE_STORE).get(id);
      r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
      tx.oncomplete=()=>db.close();
    });
  }
  async function cacheReadAnyVerified(){
    const db=await dbOpen();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readonly');
      const request=tx.objectStore(CACHE_STORE).getAll();
      request.onsuccess=()=>{
        const recent=(request.result||[]).filter(row=>row?.uid&&row?.state&&row?.verifiedAt&&
          row.verifiedAt <= Date.now() && row.verifiedAt > Date.now()-30*86400*1000);
        recent.sort((a,b)=>b.verifiedAt-a.verifiedAt);
        // This app supports only one owner. Do not guess an account on shared devices.
        resolve(recent.length===1?recent[0]:null);
      };
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>db.close();
    });
  }
  async function cacheWriteRaw(record){
    const db=await dbOpen();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readwrite');
      tx.objectStore(CACHE_STORE).put(record);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  // Keep IndexedDB writes in order: a delayed clean write must never overwrite
  // a newer offline edit. A failed write does not block subsequent attempts.
  function cacheWrite(record){
    const snapshot=safeClone(record);
    cacheWriteChain=cacheWriteChain.catch(()=>{}).then(()=>cacheWriteRaw(snapshot));
    return cacheWriteChain;
  }
  async function cacheClear(){
    await cacheWriteChain.catch(()=>{});
    const db=await dbOpen();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readwrite');
      tx.objectStore(CACHE_STORE).clear();
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  const normalizedState=data=>{
    const x=data&&typeof data==='object'?data:initial();
    return {...initial(),...x,
      words:Array.isArray(x.words)?x.words:[],
      tags:Array.isArray(x.tags)?x.tags:[],
      tagOrders:x.tagOrders&&typeof x.tagOrders==='object'&&!Array.isArray(x.tagOrders)?x.tagOrders:{},
      deletedKeys:Array.isArray(x.deletedKeys)?x.deletedKeys:[],
      settings:{...initial().settings,...(x.settings||{}),search:''}};
  };
  function toRow(w){
    return {owner_id:uid,id:String(w.id),en:String(w.en||''),zh:String(w.zh||''),note:String(w.note||''),
      pos:String(w.pos||''),pos_details:String(w.posDetails||''),pos_source:String(w.posSource||''),
      tags:Array.isArray(w.tags)?w.tags:[],source:String(w.source||''),
      originals:Array.isArray(w.originals)?w.originals:[],
      created_at:w.createdAt||new Date().toISOString(),updated_at:w.updatedAt||new Date().toISOString()};
  }
  const fromRow=r=>({id:r.id,en:r.en,zh:r.zh,note:r.note,pos:r.pos,posDetails:r.pos_details,
    posSource:r.pos_source,tags:r.tags,source:r.source,originals:r.originals,createdAt:r.created_at,updatedAt:r.updated_at});
  async function fetchRemote(){
    const words=[];
    for(let page=0;page<100;page++){
      const {data,error}=await sb.from('wordbook_entries').select('*').eq('owner_id',uid)
        .order('created_at',{ascending:true}).range(page*500,(page+1)*500-1);
      if(error)throw error;
      words.push(...(data||[]).map(fromRow));
      if(!data||data.length<500)break;
    }
    const {data:settings,error}=await sb.from('wordbook_settings').select('payload').eq('owner_id',uid).maybeSingle();
    if(error)throw error;
    const payload=settings?.payload||{};
    return normalizedState({words,tags:payload.tags||[],tagOrders:payload.tagOrders||{},deletedKeys:payload.deletedKeys||[],
      settings:payload.settings||initial().settings,translatorUrl:payload.translatorUrl||''});
  }
  const wordChanges=policy.wordChanges;
  const mergeLocalDelta=policy.mergeLocalDelta;
  const detectConflicts=policy.detectConflicts;
  function recordForCache(state,base,isDirty){
    return {uid,email,state:normalizedState(state),baseline:normalizedState(base),
      dirty:!!isDirty,verifiedAt:lastVerifiedAt,conflictBlocked:conflictBlocked.length>0};
  }
  function recoverFromCache(record,message){
    if(!record?.uid||!record?.state||!record?.verifiedAt ||
       record.verifiedAt>Date.now() || record.verifiedAt<=Date.now()-30*86400*1000)return false;
    uid=record.uid;email=record.email||'';lastUser=uid;lastVerifiedAt=record.verifiedAt;
    baseline=normalizedState(record.baseline||record.state);
    const recovered=normalizedState(record.state);
    authorized=true;cloud.isReady=true;cloud.currentEmail=email;
    offlineUnlocked=true;dirty=!!record.dirty;pending=dirty?safeClone(recovered):null;
    conflictBlocked=record.conflictBlocked?[{type:'saved',label:'上次同步衝突仍待處理'}]:[];
    bridge.setState(recovered);gateView(false);
    setStatus(message||(dirty?'離線保存 · 待同步':'離線可用 · 可編輯'));
    return true;
  }
  async function restoreOffline(){
    let record=null;
    try{record=await cacheReadAnyVerified();}catch(e){console.warn('Private cache unavailable',e);}
    if(recoverFromCache(record,record?.dirty?'離線保存 · 待同步':'離線可用 · 可編輯'))return true;
    authMessage('這台裝置尚未保存有效的離線單字快取。請先連網完成一次登入及同步，再使用飛航模式。');
    return false;
  }
  function conflictMessage(items){
    const names=items.slice(0,5).map(x=>x.label).join('、');
    return '偵測到其他裝置也修改了 '+items.length+' 個項目（'+names+ (items.length>5?'…':'')+ '）。已保留本機修改並停止自動覆蓋。請先下載完整 JSON 備份，再人工核對差異。';
  }
  function holdConflicts(items,local,oldBase){
    conflictBlocked=items;
    baseline=safeClone(oldBase);
    dirty=true;pending=normalizedState(local);
    setStatus('同步衝突 · 本機資料已保留');
    bridge.notify(conflictMessage(items),12000);
    return cacheWrite(recordForCache(pending,baseline,true)).catch(console.warn);
  }
  function guardRemoteCount(remote,reference){
    const n=reference?.words?.length||0,server=remote?.words?.length||0;
    if(n>=20 && (server===0 || server < Math.floor(n*0.5)))
      throw new Error('伺服器詞條數異常下降；為保護本機資料，已暫停同步');
  }
  async function loadForUser(session,epoch){
    const id=session?.user?.id;
    if(!id)return;
    if(id===lastUser && authorized && !offlineUnlocked)return;
    uid=id;email=session.user.email||'';
    if(!offlineUnlocked){gateView(true);authMessage('正在驗證單人登入權限…');}
    else setStatus('已恢復網路 · 正在重新驗證…');
    let cached=null;
    await cacheWriteChain.catch(()=>{});
    try{cached=await cacheRead(uid);}catch(e){console.warn('Cache read unavailable',e);}
    try{
      const {data:allow,error}=await sb.rpc('wordbook_has_access');
      if(epoch!==loginEpoch)return;
      if(error)throw error;
      if(allow!==true){
        authorized=false;cloud.isReady=false;
        authMessage('此帳號未獲 Wordbook 使用權限。離線資料不會自動上傳或清除。');
        bridge.hide();gateView(true);return;
      }
      const server=await fetchRemote();
      if(epoch!==loginEpoch)return;
      guardRemoteCount(server,cached?.state||baseline);
      const hadDirty=!!cached?.dirty&&!!cached?.state&&!!cached?.baseline;
      const previous=hadDirty?normalizedState(cached.baseline):server;
      const local=hadDirty?normalizedState(cached.state):server;
      const collisions=hadDirty?detectConflicts(previous,server,local):[];
      const current=collisions.length?local:(hadDirty?mergeLocalDelta(server,previous,local):server);
      lastVerifiedAt=Date.now();authorized=true;cloud.isReady=true;cloud.currentEmail=email;
      lastUser=uid;offlineUnlocked=false;
      baseline=safeClone(collisions.length?previous:server);
      dirty=hadDirty;pending=dirty?safeClone(current):null;
      conflictBlocked=collisions;
      bridge.setState(current);gateView(false);
      setStatus(collisions.length?'同步衝突 · 本機資料已保留':dirty?'待同步':'雲端已同步');
      if(collisions.length)bridge.notify(conflictMessage(collisions),12000);
      await cacheWrite(recordForCache(current,baseline,dirty)).catch(console.warn);
      if(dirty&&!collisions.length)queueSync(700);
      if(!current.words.length)bridge.notify('單字庫尚未匯入；請由舊版匯出完整 JSON，再到「更多」匯入',7500);
    }catch(err){
      if(epoch!==loginEpoch)return;
      if(!recoverFromCache(cached,'暫時無法連線 · 本機資料已保留')){
        authMessage('無法驗證登入權限或連線資料庫。請檢查網路及 Supabase 設定。\n'+String(err?.message||err));
      }
      console.warn('Online load failed; leaving saved offline data intact',err);
    }
  }
  async function loginSession(session){
    const epoch=++loginEpoch;
    if(!session){
      if(signOutRequested)return;
      // Supabase can report a transient null session during offline refresh.
      // Never discard a locally dirty notebook on this event.
      if(!online()&&authorized){setStatus(dirty?'離線保存 · 待同步':'離線可用 · 可編輯');return;}
      if(dirty){setStatus('登入待恢復 · 本機修改已保留');return;}
      authorized=false;cloud.isReady=false;
      bridge.hide();gateView(true);
      authMessage('登入狀態已失效。單字快取仍安全保留在本機，請連網重新登入。');
      return;
    }
    await loadForUser(session,epoch);
  }
  // Offline writes are stored in private per-user IndexedDB first. Never
  // refresh verifiedAt while offline: only genuine online RLS checks do that.
  function localChange(next){
    if(!authorized||!uid)return;
    pending=normalizedState(next);dirty=true;localRevision++;
    setStatus(online()?'儲存中…':'離線保存 · 待同步');
    cacheWrite(recordForCache(pending,baseline,true)).catch(e=>{
      console.warn('Unable to save offline cache',e);
      bridge.notify('本機離線儲存失敗；請立即下載完整 JSON 備份',8000);
    });
    if(!conflictBlocked.length)queueSync(1000);
  }
  function queueSync(ms){clearTimeout(debounce);debounce=setTimeout(()=>syncNow(),ms);}
  async function syncNow(){
    if(!authorized||!uid||syncing)return;
    if(offlineUnlocked){setStatus('連線恢復中 · 正在確認登入權限');return;}
    if(conflictBlocked.length){setStatus('同步衝突 · 本機資料已保留');return;}
    if(!online()){setStatus('離線保存 · 待同步');return;}
    syncing=true;
    const revision=localRevision;
    const current=normalizedState(pending||bridge.getState());
    const old=baseline;
    setStatus('安全核對雲端資料中…');
    try{
      // Re-read server BEFORE writing. A stale device must never blind-upsert
      // its entire dictionary or silently delete remote changes.
      const remote=await fetchRemote();
      guardRemoteCount(remote,old);
      const collisions=detectConflicts(old,remote,current);
      if(collisions.length){await holdConflicts(collisions,current,old);return;}
      const merged=mergeLocalDelta(remote,old,current);
      const {upserts,deletes}=wordChanges(remote,merged);
      if(policy.unsafeUpsertCount(upserts.length,remote.words.length)){
        await holdConflicts([{type:'bulk-edit',label:'大量詞條修改需人工核對'}],current,old);
        return;
      }
      if(policy.unsafeDeleteCount(deletes.length,remote.words.length)){
        await holdConflicts([{type:'bulk-delete',label:'大量刪除需人工核對'}],current,old);
        return;
      }
      const remoteWords=new Map(remote.words.map(w=>[String(w.id),w]));
      setStatus('安全同步中…');
      for(const w of upserts){
        const was=remoteWords.get(String(w.id));
        let request;
        if(was){
          request=sb.from('wordbook_entries').update(toRow(w)).eq('owner_id',uid)
            .eq('id',String(w.id)).eq('updated_at',was.updatedAt).select('id');
        }else{
          request=sb.from('wordbook_entries').insert(toRow(w)).select('id');
        }
        const {data,error}=await request;
        if(error)throw error;
        if(!data||data.length!==1)throw new Error('資料版本已變動，停止覆蓋');
      }
      for(const id of deletes){
        const was=remoteWords.get(String(id));
        if(!was)continue;
        const {data,error}=await sb.from('wordbook_entries').delete().eq('owner_id',uid)
          .eq('id',String(id)).eq('updated_at',was.updatedAt).select('id');
        if(error)throw error;
        if(!data||data.length!==1)throw new Error('刪除目標已被其他裝置更新，停止刪除');
      }
      const payload=x=>({tags:x.tags,tagOrders:x.tagOrders||{},deletedKeys:x.deletedKeys||[],
        settings:{...x.settings,search:''},translatorUrl:x.translatorUrl});
      if(!policy.same(payload(remote),payload(merged))){
        const {error}=await sb.from('wordbook_settings').upsert({owner_id:uid,
          payload:payload(merged),updated_at:new Date().toISOString()},{onConflict:'owner_id'});
        if(error)throw error;
      }
      // Confirm read-after-write before acknowledging success.
      const verified=await fetchRemote();
      guardRemoteCount(verified,merged);
      const live=normalizedState(bridge.getState());
      const newEdits=revision!==localRevision || !policy.same(payload(live),payload(current)) ||
        wordChanges(current,live).upserts.length>0 || wordChanges(current,live).deletes.length>0;
      baseline=safeClone(verified);
      if(newEdits){
        pending=normalizedState(mergeLocalDelta(verified,current,live));
        dirty=true;
        if(!bridge.isSheetOpen?.())bridge.setState(pending);
        setStatus('新修改已保留 · 待同步');
      }else{
        dirty=false;pending=null;
        if(!bridge.isSheetOpen?.())bridge.setState(verified);
        setStatus('雲端已同步');
      }
      await cacheWrite(recordForCache(pending||verified,baseline,dirty));
      if(dirty)queueSync(600);
    }catch(err){
      dirty=true;pending=normalizedState(bridge.getState());
      setStatus(online()?'同步暫停 · 本機修改已保留':'離線保存 · 待同步');
      console.warn('Wordbook cloud sync paused safely',err);
      bridge.notify('未完成雲端同步，本機修改已保留；請稍後重新連線',7000);
      await cacheWrite(recordForCache(pending,baseline,true)).catch(console.warn);
    }finally{syncing=false;}
  }
  async function refreshRemote(){
    if(!authorized||refreshing||dirty||syncing||!online()||bridge.isSheetOpen?.())return;
    refreshing=true;
    try{
      const remote=await fetchRemote();
      guardRemoteCount(remote,baseline);
      if(!dirty&&!syncing&&!bridge.isSheetOpen?.()){
        const current=normalizedState(bridge.getState());
        const changed=!policy.same(remote.words,current.words)||
          !policy.same(remote.tags,current.tags)||!policy.same(remote.settings,current.settings)||
          !policy.same(remote.tagOrders,current.tagOrders)||!policy.same(remote.deletedKeys,current.deletedKeys);
        baseline=safeClone(remote);
        if(changed)bridge.setState(remote);
        lastVerifiedAt=Date.now();setStatus('雲端已同步');
        await cacheWrite(recordForCache(remote,baseline,false)).catch(console.warn);
      }
    }catch(e){console.warn('Wordbook refresh failed; retained offline copy',e);}
    finally{refreshing=false;}
  }
  async function callDeviceLogin(payload, token=''){
    if(!sb)throw new Error('Wordbook 尚未連線至 Supabase');
    const headers={'Content-Type':'application/json','apikey':cfg.publishableKey};
    if(token)headers.Authorization='Bearer '+token;
    let response;
    try{
      response=await fetch(cfg.supabaseUrl+'/functions/v1/wordbook-device-login',{
        method:'POST',headers,body:JSON.stringify(payload),cache:'no-store'
      });
    }catch(err){throw new Error('無法連線登入服務。請檢查網路。');}
    const result=await response.json().catch(()=>({}));
    if(!response.ok){
      const messages={invalid_or_expired_code:'登入碼錯誤、過期或已使用。請重新取得登入碼。',
        max_active_codes:'已達三組有效登入碼上限，請等待過期或使用後再試。',
        login_required:'登入狀態已過期，請重新登入。',not_authorized:'這個帳號沒有 Wordbook 使用權限。',
        issue_failed:'目前無法產生登入碼，請稍後再試。',session_generation_failed:'驗證成功，但登入建立失敗。請聯絡管理員重新發碼。'};
      throw new Error(messages[result.error]||result.message||('登入服務暫時無法使用（'+response.status+'）'));
    }
    return result;
  }
  async function listBackups(){
    if(!authorized||!uid||!sb)throw new Error('請先登入');
    const {data,error}=await sb.from('wordbook_backup_runs').select('started_at,status,word_count,settings_count,storage_path,storage_bytes,drive_status,drive_file_id,drive_file_name').eq('owner_id',uid).order('started_at',{ascending:false}).limit(14);
    if(error)throw error;
    return data||[];
  }
  async function downloadBackupUrl(path){
    if(!authorized||!uid||!sb||typeof path!=='string'||!path.startsWith(uid+'/'))throw new Error('無權下載');
    const {data,error}=await sb.storage.from('wordbook-backups').createSignedUrl(path,60,{download:path.split('/').pop()});
    if(error||!data?.signedUrl)throw error||new Error('無法產生下載連結');
    return data.signedUrl;
  }
  async function lookupPartOfSpeech(word){
    if(!authorized||!sb)throw new Error('請先登入 Wordbook');
    const {data,error}=await sb.auth.getSession();
    if(error||!data?.session?.access_token)throw new Error('登入狀態無效');
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8500);
    try{
      const r=await fetch(cfg.supabaseUrl+'/functions/v1/wordbook-pos-lookup',{
        method:'POST',signal:abort.signal,cache:'no-store',
        headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':'Bearer '+data.session.access_token},
        body:JSON.stringify({word})});
      const body=await r.json().catch(()=>({}));
      if(!r.ok||body.ok!==true)throw new Error('查詢失敗');
      return {pos:Array.isArray(body.pos)?body.pos:[],source:body.source};
    }finally{clearTimeout(timer);}
  }
  async function issueDeviceCode(){
    if(!authorized||!sb)throw new Error('請先登入 Wordbook');
    const {data,error}=await sb.auth.getSession();
    if(error||!data?.session?.access_token)throw new Error('登入狀態失效，請重新登入。');
    return callDeviceLogin({action:'issue'},data.session.access_token);
  }
  async function signOut(){
    if(dirty&&!confirm('尚有尚未同步的修改。登出會清除本機離線資料，確定繼續嗎？'))return;
    signOutRequested=true;loginEpoch++;
    clearTimeout(debounce);pending=null;dirty=false;authorized=false;cloud.isReady=false;
    offlineUnlocked=false;conflictBlocked=[];lastVerifiedAt=0;
    uid='';email='';lastUser='';cloud.currentEmail='';
    await cacheClear().catch(console.warn);
    try{await sb?.auth.signOut();}catch(e){console.warn(e);}
    bridge.hide();gateView(true);document.getElementById('auth-code').value='';
    authMessage('已登出並清除本機離線資料。請以另一台已登入裝置產生新登入碼。');
    signOutRequested=false;
  }
  async function start(){
    if(navigator.serviceWorker?.register&&location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    }
    if(!online()){
      if(!authorized)await restoreOffline();
      return;
    }
    if(!/^https:\/\//.test(cfg.supabaseUrl||'')||!/^sb_publishable_|^eyJ/.test(cfg.publishableKey||'')){
      gateView(true);
      authMessage('尚未設定獨立 Supabase 專案。');submit.disabled=true;return;
    }
    if(!window.supabase?.createClient){
      // Some Android networks report onLine=true even when there is no route.
      // Do not hide a previously verified notebook while waiting for the CDN.
      if(!authorized){
        const opened=await restoreOffline();
        if(opened)setStatus('本機資料可用 · 等待線上驗證');
        else{gateView(true);authMessage('Supabase 程式庫尚未載入。新裝置請先連網登入；舊裝置可讀取離線快取。');}
      }
      return;
    }
    if(authStarted){
      if(offlineUnlocked){
        const {data}=await sb.auth.getSession();
        if(data?.session)await loginSession(data.session);
        else setStatus('登入待恢復 · 本機修改已保留');
      }else if(authorized){if(dirty)queueSync(250);else refreshRemote();}
      return;
    }
    authStarted=true;
    if(!authorized)gateView(true);
    sb=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,
      {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const codeInput=document.getElementById('auth-code');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const address=document.getElementById('auth-email').value.trim().toLowerCase();
      const code=codeInput.value.toUpperCase().replace(/[\s-]/g,'');
      if(!address)return authMessage('請先輸入授權的 Email');
      if(!/^[A-HJ-NP-Z2-9]{10,16}$/.test(code)){
        authMessage('請輸入一次性啟用碼或由已登入裝置產生的登入碼。');return;
      }
      submit.disabled=true;authMessage('正在驗證登入碼…');
      try{
        const result=await callDeviceLogin({action:'redeem',email:address,code});
        if(!result?.tokenHash)throw new Error('登入回傳資料不完整。');
        const {error}=await sb.auth.verifyOtp({token_hash:result.tokenHash,type:'magiclink'});
        if(error)throw error;
        codeInput.value='';authMessage('登入成功，正在安全載入你的私人單字本…');
      }catch(err){authMessage('無法登入：'+(err?.message||String(err)));}
      finally{submit.disabled=false;}
    });
    sb.auth.onAuthStateChange((_event,session)=>{
      setTimeout(()=>loginSession(session),0);
    });
    try{
      const {data,error}=await sb.auth.getSession();
      if(error){if(!authorized)authMessage('登入狀態檢查失敗：'+error.message);}
      else if(data?.session)await loginSession(data.session);
    }catch(e){if(!authorized)authMessage('暫時無法登入：'+String(e));}
  }
  window.addEventListener('online',()=>{
    start().catch(console.warn);
    if(authorized&&!offlineUnlocked){if(dirty)queueSync(800);else refreshRemote();}
  });
  window.addEventListener('offline',()=>{if(authorized)setStatus(dirty?'離線保存 · 待同步':'離線可用 · 可編輯');});
  window.addEventListener('focus',()=>{if(authorized&&online()&&!offlineUnlocked){if(dirty)queueSync(700);else refreshRemote();}});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&authorized&&online()&&!offlineUnlocked){if(dirty)queueSync(700);else refreshRemote();}
  });
  start().catch(e=>{console.warn(e);authMessage('初始化 Wordbook 失敗：'+(e?.message||e));});
})();
