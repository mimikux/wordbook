/* Wordbook Cloud v3.0 - single verified email, Supabase RLS, offline-safe cache.
   No personal vocabulary, admin keys or password is included in this script. */
(() => {
  'use strict';
  const cfg = window.WORDBOOK_CONFIG || {};
  const bridge = window.WordbookBridge;
  const gate = document.getElementById('auth-gate');
  const app = document.getElementById('app');
  const status = document.getElementById('auth-message');
  const form = document.getElementById('auth-form');
  const submit = document.getElementById('auth-submit');
  const safeClone = x => JSON.parse(JSON.stringify(x));
  const initial = () => ({version:2, words:[], tags:[], deletedKeys:[], settings:{sort:'az',pos:'',tag:'',search:''}, translatorUrl:'', appliedDatasets:[]});
  const normalized = x => String(x||'').trim().toLocaleLowerCase('en-US').replace(/\s+/g,' ');
  let sb=null, uid='', email='', syncing=false, dirty=false, authorized=false, pending=null, baseline=initial();
  let debounce=0, loginEpoch=0, lastUser='', refreshing=false, currentStatus='登入中…';
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
    signOut
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
  async function cacheWrite(record){
    const db=await dbOpen();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(CACHE_STORE,'readwrite');
      tx.objectStore(CACHE_STORE).put(record);
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  async function cacheClear(){
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
    return normalizedState({words,tags:payload.tags||[],deletedKeys:payload.deletedKeys||[],
      settings:payload.settings||initial().settings,translatorUrl:payload.translatorUrl||''});
  }
  function wordChanges(base,newer){
    const old=new Map((base.words||[]).map(w=>[String(w.id),w]));
    const now=new Map((newer.words||[]).map(w=>[String(w.id),w]));
    const upserts=[],deletes=[];
    for(const w of now.values())if(JSON.stringify(w)!==JSON.stringify(old.get(String(w.id))))upserts.push(w);
    for(const w of old.values())if(!now.has(String(w.id)))deletes.push(w.id);
    return {upserts,deletes};
  }
  function mergeLocalDelta(remote,oldBase,local){
    const changes=wordChanges(oldBase,local);
    const byId=new Map(remote.words.map(w=>[String(w.id),w]));
    for(const id of changes.deletes)byId.delete(String(id));
    for(const w of changes.upserts)byId.set(String(w.id),w);
    return normalizedState({...remote,words:[...byId.values()],
      tags:local.tags,settings:local.settings,
      deletedKeys:[...new Set([...(remote.deletedKeys||[]),...(local.deletedKeys||[])])],
      translatorUrl:local.translatorUrl});
  }
  async function loadForUser(session,epoch){
    const id=session?.user?.id;
    if(!id)return;
    if(id===lastUser && authorized)return;
    uid=id;email=session.user.email||'';
    gateView(true);authMessage('正在驗證單人登入權限…');
    let cached=null;
    try{cached=await cacheRead(uid);}catch(e){console.warn('Cache read unavailable',e);}
    try{
      const {data:allow,error}=await sb.rpc('wordbook_has_access');
      if(epoch!==loginEpoch)return;
      if(error)throw error;
      if(allow!==true){
        authMessage('此帳號未獲得 Wordbook 使用權限。請使用你指定的唯一帳號。');
        await sb.auth.signOut();
        await cacheClear().catch(()=>{});
        return;
      }
      const server=await fetchRemote();
      if(epoch!==loginEpoch)return;
      baseline=safeClone(server);
      let current=server;
      if(cached?.dirty && cached?.state && cached?.baseline){
        current=mergeLocalDelta(server,cached.baseline,cached.state);
      }
      authorized=true;cloud.isReady=true;cloud.currentEmail=email;
      lastUser=uid;dirty=!!cached?.dirty;
      bridge.setState(current);
      gateView(false);setStatus(dirty?'待同步':'雲端已同步');
      if(dirty){pending=safeClone(current);queueSync(500);}
      await cacheWrite({uid,state:current,baseline,dirty,verifiedAt:Date.now()}).catch(console.warn);
      if(!current.words.length)bridge.notify('單字庫尚未匯入；請由舊版匯出完整 JSON，再到「更多」匯入',7500);
    }catch(err){
      if(epoch!==loginEpoch)return;
      if(cached?.verifiedAt && cached?.state && cached.verifiedAt>Date.now()-30*86400*1000){
        baseline=normalizedState(cached.baseline||initial());
        const recovered=normalizedState(cached.state);
        authorized=true;cloud.isReady=true;cloud.currentEmail=email;lastUser=uid;
        dirty=!!cached.dirty;pending=dirty?safeClone(recovered):null;
        bridge.setState(recovered);gateView(false);
        setStatus('離線快取 · '+(dirty?'待同步':'可離線編輯'));
        return;
      }
      authMessage('無法驗證登入權限或連線資料庫。請檢查網路及 Supabase 設定。\n'+String(err?.message||err));
    }
  }
  async function loginSession(session){
    const epoch=++loginEpoch;
    if(!session){
      if(authorized){authorized=false;uid='';email='';lastUser='';cloud.currentEmail='';cloud.isReady=false;pending=null;
        bridge.hide();await cacheClear().catch(()=>{});}
      gateView(true);return;
    }
    await loadForUser(session,epoch);
  }
  // Local changes are persisted BEFORE cloud upload. If uploading fails,
  // the cache remains dirty, and sync resumes on the next online event.
  function localChange(next){
    if(!authorized||!uid)return;
    pending=normalizedState(next);dirty=true;setStatus(online()?'儲存中…':'離線保存 · 待同步');
    cacheWrite({uid,state:pending,baseline,dirty:true,verifiedAt:Date.now()}).catch(e=>{
      console.warn('Unable to save offline cache',e);
      bridge.notify('本機離線儲存失敗；請立即下載完整 JSON 備份');
    });
    queueSync(1000);
  }
  function queueSync(ms){clearTimeout(debounce);debounce=setTimeout(()=>syncNow(),ms);}
  async function syncNow(){
    if(!authorized||!uid||syncing)return;
    if(!online()){setStatus('離線保存 · 待同步');return;}
    syncing=true;
    const current=normalizedState(pending||bridge.getState());
    const old=baseline;
    const {upserts,deletes}=wordChanges(old,current);
    setStatus('同步中…');
    try{
      for(let i=0;i<upserts.length;i+=80){
        const batch=upserts.slice(i,i+80).map(toRow);
        const {error}=await sb.from('wordbook_entries').upsert(batch,{onConflict:'owner_id,id'});
        if(error)throw error;
        if(upserts.length>100)setStatus(`同步 ${Math.min(i+80,upserts.length)}/${upserts.length}`);
      }
      for(let i=0;i<deletes.length;i+=80){
        const {error}=await sb.from('wordbook_entries').delete().eq('owner_id',uid).in('id',deletes.slice(i,i+80));
        if(error)throw error;
      }
      const payload={tags:current.tags,deletedKeys:current.deletedKeys,
        settings:{...current.settings,search:''},translatorUrl:current.translatorUrl};
      const {error}=await sb.from('wordbook_settings').upsert({owner_id:uid,payload,updated_at:new Date().toISOString()},{onConflict:'owner_id'});
      if(error)throw error;
      baseline=safeClone(current);
      const unchanged=JSON.stringify(normalizedState(bridge.getState()))===JSON.stringify(current);
      dirty=!unchanged;pending=unchanged?null:normalizedState(bridge.getState());
      await cacheWrite({uid,state:unchanged?current:pending,baseline,dirty,verifiedAt:Date.now()}).catch(console.warn);
      setStatus(unchanged?'雲端已同步':'有新變更 · 待同步');
      if(!unchanged)queueSync(500);
    }catch(err){
      dirty=true;pending=normalizedState(bridge.getState());
      setStatus('同步失敗 · 已在本機排隊');
      console.warn('Wordbook cloud sync failed',err);
      bridge.notify('雲端同步失敗，已保留本機資料；請檢查網路後重試',7000);
      await cacheWrite({uid,state:pending,baseline,dirty:true,verifiedAt:Date.now()}).catch(console.warn);
    }finally{syncing=false;}
  }
  async function refreshRemote(){
    // Do not replace the dictionary while an edit, a filter, or a jump
    // dialog is open. In particular, prevent loss of unsaved notes.
    if(!authorized||refreshing||dirty||syncing||!online()||bridge.isSheetOpen?.())return;
    refreshing=true;
    try{
      const remote=await fetchRemote();
      if(!dirty&&!syncing&&!bridge.isSheetOpen?.()){
        const current=normalizedState(bridge.getState());
        const changed=JSON.stringify(remote)!==JSON.stringify(current);
        baseline=safeClone(remote);
        if(changed)bridge.setState(remote);
        setStatus('雲端已同步');
        await cacheWrite({uid,state:remote,baseline,dirty:false,verifiedAt:Date.now()}).catch(console.warn);
      }
    }catch(e){console.warn('Wordbook refresh failed',e);}
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
    const {data,error}=await sb.from('wordbook_backup_runs').select('started_at,status,word_count,settings_count,storage_path,storage_bytes,drive_status').eq('owner_id',uid).order('started_at',{ascending:false}).limit(14);
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
    clearTimeout(debounce);pending=null;dirty=false;authorized=false;cloud.isReady=false;
    uid='';email='';lastUser='';cloud.currentEmail='';
    await cacheClear().catch(console.warn);
    try{await sb?.auth.signOut();}catch(e){console.warn(e);}
    bridge.hide();gateView(true);document.getElementById('auth-code').value='';authMessage('已登出並清除本機離線資料。請以另一台已登入裝置產生新登入碼。');
  }
  async function start(){
    gateView(true);
    if(!/^https:\/\//.test(cfg.supabaseUrl||'')||!/^sb_publishable_|^eyJ/.test(cfg.publishableKey||'')){
      authMessage('測試版已準備好；尚未設定獨立 Supabase 專案。\n請先完成新專案及網站部署，之後即可登入。');
      submit.disabled=true;return;
    }
    if(!window.supabase?.createClient){
      authMessage('Supabase 登入程式尚未載入。請確認網路可以連線 jsDelivr，然後重新整理。');
      submit.disabled=true;return;
    }
    sb=window.supabase.createClient(cfg.supabaseUrl,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
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
        codeInput.value='';
        authMessage('登入成功，正在安全載入你的私人單字本…');
      }catch(err){authMessage('無法登入：'+(err?.message||String(err)));}
      finally{submit.disabled=false;}
    });
    sb.auth.onAuthStateChange((_event,session)=>{
      // Avoid async Supabase calls inside the auth callback.
      setTimeout(()=>loginSession(session),0);
    });
    const {data,error}=await sb.auth.getSession();
    if(error)authMessage('登入狀態檢查失敗：'+error.message);
    else if(data?.session)await loginSession(data.session);
    if(navigator.serviceWorker?.register&&location.protocol==='https:'){
      navigator.serviceWorker.register('./sw.js').catch(console.warn);
    }
  }
  window.addEventListener('online',()=>{if(authorized){if(dirty)queueSync(200);else refreshRemote();}});
  window.addEventListener('focus',()=>{if(authorized&&online()){if(dirty)queueSync(500);else refreshRemote();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&authorized&&online()){if(dirty)queueSync(500);else refreshRemote();}});
  start().catch(e=>{console.warn(e);authMessage('初始化 Wordbook 失敗：'+(e?.message||e));});
})();
