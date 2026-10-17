/**
 * Wordbook | Google Apps Script translation endpoint
 * English -> Traditional Chinese (zh-TW).
 * Deploy as Web app: Execute as Me; Who has access: Anyone.
 * This public read-only JSONP endpoint handles only one word/phrase.
 * It NEVER accesses Supabase, saved vocabulary, email, or personal notes.
 */
function doGet(e) {
  var p = e && e.parameter ? e.parameter : {};
  var callback = String(p.callback || '');
  // Wordbook generates callback names in this exact format. Do not loosen
  // this validation: callback values are emitted in executable JavaScript.
  if (!/^wbReply_[0-9]{11,16}_[a-z0-9]{5,16}$/.test(callback)) {
    return ContentService.createTextOutput('/* Invalid callback */')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  var en = String(p.q || '').trim().replace(/\s+/g, ' ');
  if (!en || en.length > 140 || /[\u0000-\u001f<>]/.test(en)) {
    return wordbookJsonp_(callback, {ok:false, error:'請輸入有效的英文單字或片語'});
  }

  try {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, en, Utilities.Charset.UTF_8);
    var key = 'en-zhTW-' + Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
    var cache = CacheService.getScriptCache();
    var zh = cache.get(key);
    if (!zh) {
      // Official built-in Google Apps Script Language service.
      zh = LanguageApp.translate(en, 'en', 'zh-TW');
      if (!zh) throw new Error('No translation result');
      cache.put(key, zh, 21600); // 6 h; reduce quota use for repeat lookups
    }
    return wordbookJsonp_(callback, {ok:true, zh:zh});
  } catch (error) {
    console.error('Wordbook translation failed', error);
    return wordbookJsonp_(callback, {ok:false, error:'翻譯服務暫時無法使用，請稍後再試'});
  }
}
function wordbookJsonp_(callback, data) {
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
// In Apps Script editor you can run this to grant Language service permission.
function testTranslate() {
  console.log(LanguageApp.translate('a tight spot', 'en', 'zh-TW'));
}
