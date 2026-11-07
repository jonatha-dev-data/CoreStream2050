const $ = (id) => document.getElementById(id);
const audio = $('audio');
const ICON = (name, cls = 'i') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let library = [];      // todas as músicas (servidor + minhas)
let queue = [];        // fila que está tocando (biblioteca ou playlist)
let current = -1;
let byId = new Map();
let playlists = [];
let openList = null;   // playlist aberta na aba Playlists
let menuTrack = null;
let shuffle = false, repeat = 'off', seeking = false; // repeat: off | all | one

/* ---------- Armazenamento no navegador ---------- */
// Músicas adicionadas pelo usuário (arquivo + capa) ficam no IndexedDB; playlists no localStorage.
const db = new Promise((res, rej) => {
    const r = indexedDB.open('corestream2050', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
    const d = await db;
    return new Promise((res, rej) => {
        const t = d.transaction('songs', mode);
        const req = fn(t.objectStore('songs'));
        t.oncomplete = () => res(req.result);
        t.onerror = t.onabort = () => rej(t.error);
    });
};
const PL_KEY = 'corestream2050.playlists';
try { playlists = JSON.parse(localStorage.getItem(PL_KEY)) || []; } catch { playlists = []; }
const savePL = () => { try { localStorage.setItem(PL_KEY, JSON.stringify(playlists)); } catch {} };

/* ---------- Faixas ---------- */
const hueOf = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

function parseName(name) {
    const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    const p = base.split(' - ');
    return p.length > 1 ? { artist: p[0], title: p.slice(1).join(' - ') } : { artist: '', title: base };
}

const srv = (p) => 'musicas/' + p.split('/').map(encodeURIComponent).join('/');

function serverTrack(item) {
    const parts = item.f.split('/');
    const n = parseName(parts.pop());
    const artist = n.artist || parts.pop() || 'Artista desconhecido';
    return { id: 's:' + item.f, title: n.title, artist, url: srv(item.f), cover: item.c ? srv(item.c) : '', hue: hueOf(n.title + artist) };
}

const userTrack = (r) => ({
    id: 'u:' + r.id, dbId: r.id, mine: true, title: r.title, artist: r.artist,
    url: URL.createObjectURL(r.audio),
    cover: r.cover ? URL.createObjectURL(r.cover) : '',
    hue: hueOf(r.title + r.artist)
});

async function fetchServer() {
    try {
        const r = await fetch('musicas.json', { cache: 'no-store' });
        if (!r.ok) throw 0;
        let list = await r.json();
        if (!Array.isArray(list)) list = [list];
        list = list.map(x => typeof x === 'string' ? { f: x } : x);
        list.sort((a, b) => a.f.localeCompare(b.f, 'pt-BR', { numeric: true }));
        return list.map(serverTrack);
    } catch { return []; }
}

/* ---------- Listas na tela ---------- */
const coverInner = (t) => (t.cover ? `<img src="${t.cover}" alt="" loading="lazy" onerror="this.remove()">` : '') + ICON('note');
const coverHTML = (t) => `<div class="cover small" style="--h:${t.hue}">${coverInner(t)}</div>`;
const isActive = (t) => queue[current] && queue[current].id === t.id;
const plural = (n) => `${n} ${n === 1 ? 'música' : 'músicas'}`;
const openPl = () => playlists.find(p => p.id === openList);
const plTracks = (p) => p.ids.map(id => byId.get(id)).filter(Boolean);

function rowHTML(t, i, inList) {
    return `<li data-i="${i}" data-id="${esc(t.id)}" tabindex="0" class="${isActive(t) ? 'active' : ''}">
        ${coverHTML(t)}
        <div class="meta"><div class="t">${esc(t.title)}</div><div class="a muted">${esc(t.artist)}</div></div>
        <button class="icon-btn plain" data-act="${inList ? 'rm' : 'menu'}" aria-label="${inList ? 'Remover da playlist' : 'Mais opções'}">${ICON(inList ? 'close' : 'more')}</button>
    </li>`;
}

function renderSongs() {
    byId = new Map(library.map(t => [t.id, t]));
    $('playlist').innerHTML = library.map((t, i) => rowHTML(t, i, false)).join('');
    $('empty').hidden = library.length > 0;
    $('search').hidden = !library.length;
    $('count').textContent = library.length ? plural(library.length) : '';
    if (!library.length) {
        $('empty-title').textContent = 'Nenhuma música ainda.';
        $('empty-msg').textContent = 'Toque em + para adicionar uma música, ou coloque arquivos na pasta musicas do servidor e execute gerar-lista.ps1.';
    }
    filter();
    renderLists();
}

function filter() {
    const q = $('search').value.trim().toLowerCase();
    Array.from($('playlist').children).forEach((li) => {
        const t = library[li.dataset.i];
        li.hidden = !!q && !(t.title + ' ' + t.artist).toLowerCase().includes(q);
    });
}
$('search').addEventListener('input', filter);

function renderLists() {
    const p = openPl();
    if (openList && !p) openList = null;
    $('pl-index').hidden = !!p;
    $('pl-detail').hidden = !p;
    if (!p) {
        $('lists').innerHTML = playlists.map(x => {
            const ts = plTracks(x);
            const cv = ts[0] ? coverHTML(ts[0]) : `<div class="cover small">${ICON('note')}</div>`;
            return `<li data-pl="${x.id}" tabindex="0">${cv}<div class="meta"><div class="t">${esc(x.name)}</div><div class="a muted">${plural(ts.length)}</div></div></li>`;
        }).join('');
        $('lists-empty').hidden = playlists.length > 0;
        return;
    }
    const ts = plTracks(p);
    $('pl-name').textContent = p.name;
    $('plist').innerHTML = ts.map((t, i) => rowHTML(t, i, true)).join('');
    $('pl-empty').hidden = ts.length > 0;
    $('pl-play').hidden = !ts.length;
}

function bindRows(ul, getList) {
    const act = (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const list = getList();
        const t = list[+li.dataset.i];
        const btn = e.target.closest('button');
        if (btn) { btn.dataset.act === 'rm' ? removeFromPlaylist(t) : openMenu(t); return; }
        queue = list.slice();
        play(+li.dataset.i);
    };
    ul.addEventListener('click', act);
    ul.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('li')) act(e); });
}
bindRows($('playlist'), () => library);
bindRows($('plist'), () => plTracks(openPl()));

const openFromIndex = (e) => {
    const li = e.target.closest('li');
    if (li) { openList = li.dataset.pl; renderLists(); }
};
$('lists').addEventListener('click', openFromIndex);
$('lists').addEventListener('keydown', (e) => { if (e.key === 'Enter') openFromIndex(e); });

/* ---------- Abas ---------- */
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
    $('v-songs').hidden = b.dataset.tab !== 'songs';
    $('v-lists').hidden = b.dataset.tab !== 'lists';
    if (b.dataset.tab === 'lists') renderLists();
}));

/* ---------- Playlists ---------- */
function newPlaylist() {
    const name = (prompt('Nome da playlist:') || '').trim();
    if (!name) return null;
    const p = { id: Date.now().toString(36), name, ids: [] };
    playlists.push(p);
    savePL();
    return p;
}
function removeFromPlaylist(t) {
    const p = openPl();
    p.ids = p.ids.filter(id => id !== t.id);
    savePL();
    renderLists();
}
$('new-pl').onclick = () => { if (newPlaylist()) renderLists(); };
$('pl-back').onclick = () => { openList = null; renderLists(); };
$('pl-play').onclick = () => { queue = plTracks(openPl()); play(0); };
$('pl-ren').onclick = () => {
    const p = openPl();
    const n = (prompt('Novo nome:', p.name) || '').trim();
    if (n) { p.name = n; savePL(); renderLists(); }
};
$('pl-del').onclick = () => {
    const p = openPl();
    if (!confirm(`Excluir a playlist "${p.name}"?`)) return;
    playlists = playlists.filter(x => x !== p);
    openList = null;
    savePL();
    renderLists();
};

/* ---------- Menu da música (adicionar à playlist / excluir) ---------- */
function openMenu(t) {
    menuTrack = t;
    $('menu-title').textContent = t.title;
    $('menu-lists').innerHTML = playlists.map(p =>
        `<button type="button" class="row-btn" data-pl="${p.id}"><span>${esc(p.name)}</span>${p.ids.includes(t.id) ? '<b>✓</b>' : ''}</button>`).join('');
    $('menu-del').hidden = !t.mine;
    $('dlg-menu').showModal();
}
$('menu-lists').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const p = playlists.find(x => x.id === b.dataset.pl);
    p.ids = p.ids.includes(menuTrack.id) ? p.ids.filter(id => id !== menuTrack.id) : [...p.ids, menuTrack.id];
    savePL();
    renderLists();
    $('dlg-menu').close();
});
$('menu-new').onclick = () => {
    const p = newPlaylist();
    if (!p) return;
    p.ids.push(menuTrack.id);
    savePL();
    renderLists();
    $('dlg-menu').close();
};
$('menu-del').onclick = () => { $('dlg-menu').close(); deleteSong(menuTrack); };
$('menu-close').onclick = () => $('dlg-menu').close();

async function deleteSong(t) {
    if (!confirm(`Excluir "${t.title}" do seu CoreStream?`)) return;
    try { await tx('readwrite', s => s.delete(t.dbId)); } catch { alert('Não foi possível excluir.'); return; }
    const playing = isActive(t);
    library = library.filter(x => x !== t);
    playlists.forEach(p => { p.ids = p.ids.filter(id => id !== t.id); });
    savePL();
    if (playing) {
        audio.pause();
        audio.removeAttribute('src');
        queue = []; current = -1;
        $('mini').hidden = true;
        closeFull();
    } else {
        const cur = queue[current];
        queue = queue.filter(x => x !== t);
        current = queue.indexOf(cur);
    }
    renderSongs();
    URL.revokeObjectURL(t.url);
    if (t.cover) URL.revokeObjectURL(t.cover);
}

/* ---------- Adicionar música ---------- */
const dlgAdd = $('dlg-add');

async function shrink(file) { // capas ficam com no máximo 600px
    try {
        const bmp = await createImageBitmap(file);
        const k = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * k);
        c.height = Math.round(bmp.height * k);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)) || file;
    } catch { return file; }
}

$('add-btn').onclick = () => {
    $('add-form').reset();
    $('a-fname').textContent = 'Nenhum arquivo';
    $('a-prev').innerHTML = ICON('note');
    dlgAdd.showModal();
};
$('a-cancel').onclick = () => dlgAdd.close();
$('a-file').addEventListener('change', () => {
    const f = $('a-file').files[0];
    if (!f) return;
    $('a-fname').textContent = f.name;
    const n = parseName(f.name);
    if (!$('a-title').value) $('a-title').value = n.title;
    if (!$('a-artist').value) $('a-artist').value = n.artist;
});
$('a-cover').addEventListener('change', () => {
    const f = $('a-cover').files[0];
    $('a-prev').innerHTML = f ? `<img src="${URL.createObjectURL(f)}" alt="">` : ICON('note');
});
$('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = $('a-file').files[0];
    if (!file) { alert('Escolha um arquivo de áudio.'); return; }
    const cf = $('a-cover').files[0];
    const rec = {
        title: $('a-title').value.trim(),
        artist: $('a-artist').value.trim() || 'Artista desconhecido',
        audio: file,
        cover: cf ? await shrink(cf) : null,
        added: Date.now()
    };
    try { rec.id = await tx('readwrite', s => s.add(rec)); }
    catch { alert('Não foi possível salvar neste navegador.'); return; }
    library.push(userTrack(rec));
    renderSongs();
    dlgAdd.close();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    if (current < 0) { queue = library.slice(); play(queue.length - 1, false); }
});

// Só o menu ⋮ fecha ao tocar fora. A janela de adicionar música não, para não perder o que foi digitado.
$('dlg-menu').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Reprodução ---------- */
function play(i, autoplay = true) {
    if (i < 0 || i >= queue.length) return;
    current = i;
    const t = queue[i];
    audio.src = t.url;
    if (autoplay) audio.play().catch(() => {});

    document.documentElement.style.setProperty('--hue', t.hue);
    $('mini').hidden = false;
    $('mini-title').textContent = $('full-title').textContent = t.title;
    $('mini-artist').textContent = $('full-artist').textContent = t.artist;
    $('mini-cover').outerHTML = `<div class="cover small" id="mini-cover" style="--h:${t.hue}">${coverInner(t)}</div>`;
    $('full-cover').outerHTML = `<div class="cover huge" id="full-cover" style="--h:${t.hue}">${coverInner(t)}</div>`;
    document.title = `${t.title} · CoreStream 2050`;

    document.querySelectorAll('li[data-id]').forEach(li => li.classList.toggle('active', li.dataset.id === t.id));
    const a = document.querySelector('.view:not([hidden]) li.active');
    if (a) a.scrollIntoView({ block: 'nearest' });

    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: t.title,
            artist: t.artist,
            artwork: t.cover ? [{ src: new URL(t.cover, location.href).href }] : []
        });
    }
}

function next(auto) {
    if (!queue.length) return;
    if (shuffle && queue.length > 1) {
        let n;
        do { n = Math.floor(Math.random() * queue.length); } while (n === current);
        return play(n);
    }
    if (current + 1 < queue.length) return play(current + 1);
    if (repeat === 'all' || !auto) return play(0);
}

function prev() {
    if (audio.currentTime > 3 || current <= 0) { audio.currentTime = 0; return; }
    play(current - 1);
}

function toggle() {
    if (current < 0) return;
    audio.paused ? audio.play().catch(() => {}) : audio.pause();
}

audio.addEventListener('ended', () => {
    if (repeat === 'one') { audio.currentTime = 0; audio.play(); }
    else next(true);
});
audio.addEventListener('error', () => { if (current >= 0 && current < queue.length - 1) next(true); });

function syncPlayIcons() {
    const name = audio.paused ? 'play' : 'pause';
    $('mini-play').innerHTML = ICON(name);
    $('play').innerHTML = ICON(name, 'i lg');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
}
audio.addEventListener('play', syncPlayIcons);
audio.addEventListener('pause', syncPlayIcons);

/* ---------- Progresso ---------- */
const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    s = Math.floor(s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const seekEl = $('seek');

function paintSeek() {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    $('mini-fill').style.width = pct + '%';
    seekEl.style.setProperty('--p', (seekEl.value / 10) + '%');
}
audio.addEventListener('timeupdate', () => {
    if (!seeking) {
        seekEl.value = audio.duration ? (audio.currentTime / audio.duration) * 1000 : 0;
        $('cur').textContent = fmt(audio.currentTime);
    }
    paintSeek();
});
audio.addEventListener('loadedmetadata', () => { $('dur').textContent = fmt(audio.duration); });
seekEl.addEventListener('input', () => {
    seeking = true;
    $('cur').textContent = fmt((seekEl.value / 1000) * audio.duration);
    paintSeek();
});
seekEl.addEventListener('change', () => {
    if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration;
    seeking = false;
});

/* ---------- Botões do player ---------- */
$('play').onclick = $('mini-play').onclick = toggle;
$('next').onclick = $('mini-next').onclick = () => next(false);
$('prev').onclick = prev;
$('shuffle').onclick = (e) => {
    shuffle = !shuffle;
    e.currentTarget.setAttribute('aria-pressed', shuffle);
};
$('repeat').onclick = (e) => {
    repeat = repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off';
    e.currentTarget.setAttribute('aria-pressed', repeat !== 'off');
    e.currentTarget.classList.toggle('one', repeat === 'one');
};

const full = $('full');
const openFull = () => { full.classList.add('open'); full.setAttribute('aria-hidden', 'false'); };
const closeFull = () => { full.classList.remove('open'); full.setAttribute('aria-hidden', 'true'); };
$('mini-open').onclick = openFull;
$('mini-open').addEventListener('keydown', (e) => { if (e.key === 'Enter') openFull(); });
$('close').onclick = closeFull;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFull();
    if (e.code === 'Space' && !/INPUT|BUTTON|TEXTAREA/.test(e.target.tagName) && !e.target.closest('li') && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        toggle();
    }
});

/* ---------- Controles do celular (tela bloqueada / notificação) ---------- */
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
}

/* ---------- Início ---------- */
syncPlayIcons();
(async function init() {
    const [server, mine] = await Promise.all([fetchServer(), tx('readonly', s => s.getAll()).catch(() => [])]);
    library = [...server, ...mine.map(userTrack)];
    renderSongs();
    if (library.length) { queue = library.slice(); play(0, false); }
})();
