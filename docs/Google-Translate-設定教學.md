# Wordbook × Google 翻譯（Apps Script）設定

**目標：** 在 Wordbook 新增英文時，自動帶出繁體中文。Google Apps Script 僅翻譯你當下輸入的英文，不存取私人單字本、標籤或 AI 說明。

## 第一次設定（約 5–10 分鐘）

1. 用你的 Google 帳號開啟 [Google Apps Script 新專案](https://script.google.com/home/projects/create)。
2. 將預設的 `Code.gs` 程式碼**全部替換**成 GitHub 專案根目錄 [google-translate.gs](../google-translate.gs) 內容，儲存。建議專案名稱 `Wordbook Translate`。
3. 可先在編輯器上方選擇 `testTranslate`，按「執行」並完成 Google 授權；執行紀錄能看到一筆繁體中文翻譯。
4. 點右上角 **部署 → 新增部署作業 → 類型選「網頁應用程式」**。
5. **執行身分：我（Me）**；**存取權：所有人（Anyone）**；按「部署」，完成必要的授權。
6. 複製部署產生的 **網頁應用程式網址**，形式為 `https://script.google.com/macros/s/.../exec`，不是 `/dev`。
7. 開啟 [Wordbook](https://mimikux.github.io/wordbook/)，登入後選右上角 **⋯ → Google 翻譯連線**，貼上剛才的 `/exec` 網址並儲存。
8. 點「＋」新增單字，輸入 `overhear`，等待約 1 秒；或按 **取得 Google 中文 ↓**。確認中文出現後即可編輯中文並儲存單字。

**注意：** Apps Script 的部署存取權設「所有人」，是為了讓 Wordbook 的 JSONP 查詢能在瀏覽器運作。這個腳本不會讀取私人資料，只會翻譯傳入的單字。如果擔心匿名呼叫消耗 Apps Script 配額，可停用部署或改採帶登入驗證的 Supabase Edge Function 代理架構。**不要把任何私密單字、Google 密碼或 Supabase 管理金鑰寫入此腳本。**

## 運作細節

- 翻譯核心：`LanguageApp.translate(en, 'en', 'zh-TW')`。
- 瀏覽器端使用 **JSONP**，因為一般跨網域 `fetch` 會碰到 CORS 限制；只返回公開翻譯結果，不返回私人資訊。
- 若單字已填中文，不會在背景自動覆蓋，手動重新取得翻譯時會提示是否取代。
- 相同查詢可使用 Google Apps Script 快取，避免重複消耗配額。
- 使用 Google Apps Script 內建語言服務，不會消耗 OpenAI/Gemini token。但有 Apps Script 每日翻譯配額與呼叫限制，且不同於付費 Cloud Translation API。
- **此功能不會同步 Google 翻譯的星號收藏**。星號收藏須先匯出 CSV，再由 Wordbook 匯入。

## 常見錯誤排除

| 顯示 | 檢查 |
| --- | --- |
| 必須設定翻譯連線 | Wordbook「更多 → Google 翻譯連線」貼入以 `/exec` 結尾的網址 |
| 連線失敗 | Apps Script 部署存取權需為「所有人」、執行身分需為「我」 |
| 逾時 | 檢查網路與 Google Apps Script 執行紀錄 |
| 中文仍是簡體 | 目標是 `zh-TW`，Wordbook 另有繁體用字轉換；語境用詞仍可能需要手動微調 |
| 程式碼更新後仍是舊結果 | Google Apps Script **部署 → 管理部署作業 → 編輯**，選取「新版本」後部署 |

[官方文件：LanguageApp](https://developers.google.com/apps-script/reference/language/language-app) ｜ [Apps Script 網頁應用程式](https://developers.google.com/apps-script/guides/web) ｜ [JSONP 安全注意事項](https://developers.google.com/apps-script/guides/content)
