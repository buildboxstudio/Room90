const WaveSurfer = window.WaveSurfer;

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
const btnLike = document.getElementById("btn-like");
const iconPlay = document.getElementById("icon-play");
const iconPause = document.getElementById("icon-pause");
const iconLoading = document.getElementById("icon-loading");
const heroStats = document.getElementById("hero-stats");

let mixes = [];
let ws = null;
let current = null;

const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const likeKey = (id) => `room90_like_${id}`;
const likeCount = (m) => (m.likes || 0) + (localStorage.getItem(likeKey(m.id)) ? 1 : 0);
const isLiked = (m) => !!localStorage.getItem(likeKey(m.id));

function setPlayState(state) {
  // state: 'loading' | 'playing' | 'paused'
  if (iconLoading) iconLoading.hidden = state !== "loading";
  if (iconPlay) iconPlay.hidden = state !== "paused";
  if (iconPause) iconPause.hidden = state !== "playing";
}

function refreshLikeUI() {
  if (!current) return;
  btnLike.setAttribute("aria-pressed", String(isLiked(current)));
  renderLikes(current.id);
}

function renderLikes(id) {
  const el = document.querySelector(`[data-likes="${id}"]`);
  if (!el) return;
  const m = mixes.find((x) => x.id === id);
  if (!m) return;
  const likes = likeCount(m);
  el.textContent = likes > 0 ? `♥ ${likes}` : "";
}

function highlightActiveCard(id) {
  document.querySelectorAll(".tape-card").forEach((card) => {
    const isCurrent = card.dataset.mixId === id;
    card.classList.toggle("tape-card--active", isCurrent);
    if (isCurrent) {
      card.setAttribute("aria-current", "true");
    } else {
      card.removeAttribute("aria-current");
    }
  });
}

function updateMediaSession(m) {
  if (!("mediaSession" in navigator)) return;
  const meta = {
    title: m.title,
    artist: m.artist || "Moxxsa",
    album: "MoxxTape Archive (ROOM90)",
  };
  if (m.imageUrl) {
    meta.artwork = [
      { src: new URL(m.imageUrl, document.baseURI).href, sizes: "512x512", type: "image/jpeg" },
    ];
  }
  navigator.mediaSession.metadata = new MediaMetadata(meta);
}

async function boot() {
  if (window.location.protocol === "file:") {
    return;
  }
  try {
    const r = await fetch("mixes.json");
    if (!r.ok) throw new Error("mixes.json tidak ketemu");
    mixes = await r.json();
  } catch (e) {
    status.innerHTML = `Gagal load daftar tape (${e.message}). <button id="btn-reload" class="ghost" type="button" style="margin-left:0.5rem;padding:0.2rem 0.5rem">Muat Ulang</button>`;
    document.getElementById("btn-reload")?.addEventListener("click", () => location.reload());
    return;
  }
  if (!mixes.length) {
    status.textContent = "Belum ada tape. Tambah entry di mixes.json.";
    return;
  }

  mixes.sort((a, b) => b.date.localeCompare(a.date));
  const newestDate = mixes[0]?.date;
  status.hidden = true;

  if (heroStats) {
    const totalSec = mixes.reduce((acc, m) => acc + (m.durationSec || 0), 0);
    heroStats.textContent = `${mixes.length} TAPES // TOTAL ${fmt(totalSec)}`;
  }

  for (const m of mixes) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tape-card";
    b.dataset.mixId = m.id;
    const isNew = m.date === newestDate;
    if (isNew) b.classList.add("tape-card--new");
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
    meta.textContent = `${m.genre} · ${fmt(m.durationSec)} · ${m.date}`;

    const likes = document.createElement("span");
    likes.className = "tape-likes";
    likes.dataset.likes = m.id;

    body.append(t, meta, likes);
    if (isNew) {
      const badge = document.createElement("span");
      badge.className = "tape-badge";
      badge.textContent = "NEW";
      body.append(badge);
    }
    b.append(thumb, body);
    b.addEventListener("click", () => loadMix(m));
    li.append(b);
    list.append(li);
  }

  for (const m of mixes) renderLikes(m.id);

  const last = localStorage.getItem("room90_last");
  const saved = mixes.find((m) => m.id === last) || mixes[0];
  await loadMix(saved, { autoplay: false });
}

async function loadMix(m, { autoplay = true } = {}) {
  current = m;
  player.hidden = false;
  highlightActiveCard(m.id);
  npTitle.textContent = `ROOM90 ${m.id.replace("room90-", "#")} / ${m.title}`;
  npGenre.textContent = m.genre;
  npTime.textContent = `00:00 / ${fmt(m.durationSec)}`;

  if (m.imageUrl) {
    npImage.src = m.imageUrl;
    npImage.alt = m.title;
    npImage.hidden = false;
  } else {
    npImage.removeAttribute("src");
    npImage.hidden = true;
  }

  btnRetry.hidden = true;
  setPlayState("loading");

  if (ws) {
    ws.destroy();
    ws = null;
  }

  if (!WaveSurfer) {
    npTime.textContent = "WaveSurfer library tidak tersedia.";
    setPlayState("paused");
    return;
  }

  ws = WaveSurfer.create({
    container: waveBox,
    waveColor: "#3a3a32",
    progressColor: "#d4ff32",
    cursorColor: "#f5f5f0",
    height: 56,
    interact: true,
  });

  ws.setVolume(parseFloat(vol.value || "0.8"));
  refreshLikeUI();
  updateMediaSession(m);

  ws.on("play", () => setPlayState("playing"));
  ws.on("pause", () => setPlayState("paused"));
  ws.on("timeupdate", (t) => {
    npTime.textContent = `${fmt(t)} / ${fmt(m.durationSec)}`;
  });
  ws.on("finish", () => { step(1); });
  ws.on("error", (e) => {
    npTime.textContent = `Gagal load audio (${e?.message || "error"}).`;
    setPlayState("paused");
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

  setPlayState("paused");
  localStorage.setItem("room90_last", m.id);
  if (autoplay) {
    ws.play();
  }
}

btnPlay.addEventListener("click", async () => {
  if (!ws) return;
  await ws.playPause();
});

btnLike.addEventListener("click", () => {
  if (!current) return;
  const k = likeKey(current.id);
  if (localStorage.getItem(k)) localStorage.removeItem(k);
  else localStorage.setItem(k, "1");
  refreshLikeUI();
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

// MediaSession Action Handlers
if ("mediaSession" in navigator) {
  navigator.mediaSession.setActionHandler("play", () => { ws?.play(); });
  navigator.mediaSession.setActionHandler("pause", () => { ws?.pause(); });
  navigator.mediaSession.setActionHandler("previoustrack", () => { step(-1); });
  navigator.mediaSession.setActionHandler("nexttrack", () => { step(1); });
  navigator.mediaSession.setActionHandler("seekto", (details) => {
    if (details.seekTime !== undefined && ws) {
      ws.setTime(details.seekTime);
    }
  });
}

// Global Keyboard Shortcuts
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !aboutModal.hidden) {
    closeAbout();
    return;
  }

  // Jangan trigger shortcut jika user sedang mengetik di input atau modal terbuka
  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || !aboutModal.hidden) return;

  if (e.code === "Space") {
    e.preventDefault();
    if (ws) ws.playPause();
  } else if (e.shiftKey && (e.key === "N" || e.key === "n")) {
    e.preventDefault();
    step(1);
  } else if (e.shiftKey && (e.key === "P" || e.key === "p")) {
    e.preventDefault();
    step(-1);
  } else if (e.key === "ArrowLeft" && e.altKey) {
    e.preventDefault();
    if (ws) ws.setTime(Math.max(0, ws.getCurrentTime() - 15));
  } else if (e.key === "ArrowRight" && e.altKey) {
    e.preventDefault();
    if (ws) ws.setTime(Math.min(ws.getDuration(), ws.getCurrentTime() + 15));
  }
});

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

boot();
