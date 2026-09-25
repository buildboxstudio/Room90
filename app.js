import WaveSurfer from "wavesurfer.js";

const list = document.getElementById("tape-list");
const status = document.getElementById("status");
const player = document.getElementById("player");
const npTitle = document.getElementById("np-title");
const npGenre = document.getElementById("np-genre");
const npTime = document.getElementById("np-time");
const btnPlay = document.getElementById("btn-play");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const btnRetry = document.getElementById("btn-retry");
const vol = document.getElementById("vol");
const waveBox = document.getElementById("waveform");
const npImage = document.getElementById("np-image");
const btnAbout = document.getElementById("btn-about");
const aboutModal = document.getElementById("about-modal");
const btnAboutClose = document.getElementById("btn-about-close");

let mixes = [];
let ws = null;
let current = null;

const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

async function boot() {
  try {
    const r = await fetch("mixes.json");
    if (!r.ok) throw new Error("mixes.json tidak ketemu");
    mixes = await r.json();
  } catch (e) {
    status.textContent = `Gagal load daftar tape (${e.message}). Cek file mixes.json, lalu muat ulang.`;
    return;
  }
  if (!mixes.length) {
    status.textContent = "Belum ada tape. Tambah entry di mixes.json.";
    return;
  }
  status.hidden = true;
  for (const m of mixes) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tape-card";
    const no = m.id.replace("room90-", "#");
    const thumb = document.createElement("img");
    thumb.className = "tape-thumb";
    thumb.alt = m.title;
    thumb.loading = "lazy";
    thumb.src = m.imageUrl || "";
    thumb.addEventListener("error", () => {
      thumb.replaceWith(Object.assign(document.createElement("span"), {
        className: "tape-thumb tape-thumb-fallback",
        style: `background:${m.coverColor || "#d4ff32"}`,
      }));
    });
    const body = document.createElement("span");
    body.className = "tape-body";
    const t = document.createElement("span");
    t.className = "tape-title";
    t.textContent = `ROOM90 ${no} / ${m.title}`;
    const meta = document.createElement("span");
    meta.className = "tape-meta";
    meta.textContent = `${m.genre} · ${m.durationText} · ${m.date}`;
    body.append(t, meta);
    b.append(thumb, body);
    b.addEventListener("click", () => loadMix(m));
    li.append(b);
    list.append(li);
  }
  const last = localStorage.getItem("room90_last");
  const saved = mixes.find((m) => m.id === last) || mixes[0];
  await loadMix(saved, { autoplay: false });
}

async function loadMix(m, { autoplay = true } = {}) {
  current = m;
  player.hidden = false;
  npTitle.textContent = `ROOM90 ${m.id.replace("room90-", "#")} / ${m.title}`;
  npGenre.textContent = m.genre;
  npTime.textContent = `00:00 / ${m.durationText}`;
  if (m.imageUrl) {
    npImage.src = m.imageUrl;
    npImage.alt = m.title;
    npImage.hidden = false;
  } else {
    npImage.removeAttribute("src");
    npImage.hidden = true;
  }
  btnRetry.hidden = true;
  btnPlay.textContent = "···";
  if (ws) { ws.destroy(); ws = null; }
  ws = WaveSurfer.create({
    container: waveBox,
    waveColor: "#3a3a32",
    progressColor: "#d4ff32",
    cursorColor: "#f5f5f0",
    height: 64,
    interact: true,
  });
  ws.setVolume(parseFloat(vol.value || "0.8"));
  ws.on("timeupdate", (t) => {
    npTime.textContent = `${fmt(t)} / ${m.durationText}`;
  });
  ws.on("finish", () => { step(1); });
  ws.on("error", (e) => {
    npTime.textContent = `Gagal load audio (${e?.message || "error"}).`;
    btnPlay.textContent = "▶";
    btnRetry.hidden = false;
  });
  try {
    const rp = await fetch(m.peaksUrl);
    if (!rp.ok) throw new Error("peaks tidak ketemu");
    const peaks = await rp.json();
    await ws.load(m.audioUrl, peaks, m.durationSec);
  } catch {
    await ws.load(m.audioUrl);
  }
  btnPlay.textContent = "▶";
  localStorage.setItem("room90_last", m.id);
  if (autoplay) { ws.play(); btnPlay.textContent = "⏸"; }
}

btnPlay.addEventListener("click", async () => {
  if (!ws) return;
  const playing = await ws.playPause();
  btnPlay.textContent = playing ? "⏸" : "▶";
});

btnRetry.addEventListener("click", () => {
  if (current) loadMix(current);
});

function step(dir) {
  if (!mixes.length) return;
  const i = mixes.findIndex((m) => current && m.id === current.id);
  const n = mixes[(i + dir + mixes.length) % mixes.length];
  loadMix(n);
}

btnPrev.addEventListener("click", () => step(-1));
btnNext.addEventListener("click", () => step(1));

vol.addEventListener("input", () => {
  const v = parseFloat(vol.value);
  if (ws) ws.setVolume(v);
  localStorage.setItem("room90_vol", String(v));
});

const savedVol = localStorage.getItem("room90_vol");
if (savedVol !== null) vol.value = savedVol;

npImage.addEventListener("error", () => { npImage.hidden = true; });

function openAbout() {
  aboutModal.hidden = false;
  btnAboutClose.focus();
}
function closeAbout() {
  aboutModal.hidden = true;
  btnAbout.focus();
}
btnAbout.addEventListener("click", openAbout);
btnAboutClose.addEventListener("click", closeAbout);
aboutModal.addEventListener("click", (e) => { if (e.target === aboutModal) closeAbout(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !aboutModal.hidden) closeAbout(); });

boot();
