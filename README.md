# ROOM90 — Private Tape Archive

Landing publik + player streaming by Moxxsa. Deploy: GitHub Pages (static, tanpa build).

## Tambah mix baru

1. Export MP3 **192kbps CBR** (biar ≤200MB).
2. Upload ke Catbox:
   - Web: drag ke `catbox.moe`, copy link.
   - API: `curl -F "reqtype=fileupload" -F "fileToUpload=@MIX.mp3" https://catbox.moe/user/api.php`
3. Generate peaks (sekali per mix):
   ```
   ffmpeg -i "MIX.mp3" -ac 1 -ar 8000 -f s16le -acodec pcm_s16le - | python gen-peaks.py - peaks/<id>.json
   ```
   Lalu upload `peaks/<id>.json` ke Catbox, atau commit ke repo (kecil).
   Format: `[[peak,...]]`, nilai -1..1, ~10000 titik.
4. Tambah entry di `mixes.json`.
5. Push ke GitHub. Pages auto-deploy 1-2 menit.

## Skema mixes.json

`id`, `title`, `artist`, `date` (YYYY-MM-DD), `genre`, `durationSec`, `durationText` (mm:ss),
`audioUrl` (catbox), `peaksUrl`, `bpm`, `coverColor`, `tracklist[]`, `notes`.

## Catatan internal (bukan buat UI publik)

- Dulu pakai Telegram Bot API + Cloudflare Worker. Dibuang: Bot API limit download 20MB,
  mix DJ (87MB+) tidak bisa. Lihat `Room90-Plan-V2.md`.
- Token bot lama dan Worker `room90-proxy` sudah tidak dipakai. Jangan commit kredensial.
