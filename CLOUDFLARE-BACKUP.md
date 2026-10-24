# Cloudflare production backup (2026-10-24)

This public repository is a **backup**, not a live deployment source. The official Wordbook website runs on Cloudflare Pages project `tvocab`; personal vocabulary data and authentication belong in Supabase, not GitHub.

- Verified production Cloudflare deployment: `fbf8ffa3-eeca-4dc5-b422-ae0a8b0cece4` (2026-10-21).
- All 15 deployed assets have been accounted for. Effective HTML/CSS/JavaScript files were synchronized to GitHub `main`; previously existing binary icons and MP3 were hash-matched to deployed assets and retained unchanged.
- Newly deployed `sync-policy.js` is included.
- Pre-synchronization GitHub state was preserved in `backup/pre-cloudflare-sync-20261024`.
- Other historical source, documents and Supabase source folders in GitHub were left intact.

## Future maintenance
1. Update and verify the Cloudflare production website first via ChatGPT Cloudflare MCP.
2. Read the resulting production deployment and deployed assets; confirm every file and hash.
3. Synchronize the GitHub backup, recording the corresponding Cloudflare deployment ID. Never publish GitHub's older assets over the newer Cloudflare site.
4. Exclude secrets, database dumps and private user data from this public repository.

This is a source snapshot. Full disaster recovery also depends on Supabase backend/configuration and verified database backups.
