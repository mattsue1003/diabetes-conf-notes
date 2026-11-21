(function () {
  'use strict';
  var V = window.VIDEOS || [];
  var $ = function (s) { return document.querySelector(s); };
  var cur = null, player = null, ready = false, pendingSeek = null, lastNow = -1;

  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ytUrl(id, t) { return 'https://www.youtube.com/watch?v=' + id + (t ? '&t=' + Math.floor(t) + 's' : ''); }
  function tsBtn(id, t) {
    return '<button class="ts" data-v="' + id + '" data-t="' + t + '" title="跳到 ' + fmt(t) + ' 播放">' + fmt(t) + '</button>';
  }
  function ytA(id, t) { return '<a class="yt" href="' + ytUrl(id, t) + '" target="_blank" rel="noopener" title="在 YouTube 從這裡開啟">YouTube ↗</a>'; }

  // ---------- picker ----------
  $('#picker').innerHTML = V.map(function (v) {
    return '<button class="vcard" data-pick="' + v.id + '">' +
      '<img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg">' +
      '<span class="g">' + esc(v.group) + '</span>' +
      '<span class="t">' + esc(v.title_zh || v.title) + '</span>' +
      '<span class="m">' + esc(v.channel) + '・' + v.duration + '</span></button>';
  }).join('');

  // ---------- render one video ----------
  function show(id, t, autoplay) {
    var v = V.find(function (x) { return x.id === id; }) || V[0];
    if (!v) return;
    var changed = !cur || cur.id !== v.id;
    cur = v; lastNow = -1;
    document.querySelectorAll('.vcard').forEach(function (b) { b.setAttribute('aria-current', b.dataset.pick === v.id); });
    $('#vtitle').textContent = v.title_zh || v.title;
    $('#vsub').innerHTML = esc(v.title) + '<br>' + esc(v.channel) + (v.speakers ? '・' + esc(v.speakers) : '') + '・' + v.duration;
    $('#summary').textContent = v.summary || '';
    $('#take').innerHTML = (v.takeaways || []).slice().sort(function (a, b) { return a.t - b.t; }).map(function (k) {
      return '<li>' + tsBtn(v.id, k.t) + '<span>' + esc(k.text) + '</span></li>';
    }).join('');
    $('#secs').innerHTML = v.sections.map(function (s, i) {
      return '<article class="sec" id="s' + i + '" data-t="' + s.t + '"><h3>' + tsBtn(v.id, s.t) + '<span>' + esc(s.title) + '</span>' + ytA(v.id, s.t) + '</h3><ul>' +
        s.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></article>';
    }).join('');
    $('#gloss').innerHTML = '<dl class="gl">' + (v.glossary || []).map(function (g) {
      return '<dt>' + esc(g.term) + '<small>' + esc(g.zh) + '</small></dt><dd>' + esc(g.explain) + '</dd>';
    }).join('') + '</dl>';
    $('#caveat').innerHTML = v.caveats ? '<strong>閱讀提醒：</strong>' + esc(v.caveats) : '';
    $('#caveat').classList.toggle('hide', !v.caveats);
    $('#ytLink').href = ytUrl(v.id);
    $('#nowSec').textContent = '目前段落：—';
    document.title = (v.title_zh || v.title) + '｜糖尿病年會影片筆記';
    if (changed) loadVideo(v.id, t || 0, autoplay);
    else if (t != null) seek(t);
  }

  // ---------- YouTube player ----------
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('yt', {
      videoId: cur ? cur.id : V[0].id,
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1, start: pendingSeek ? Math.floor(pendingSeek.t) : 0, cc_lang_pref: 'zh-Hant' },
      events: {
        onReady: function () { ready = true; if (pendingSeek && pendingSeek.play) player.playVideo(); pendingSeek = null; }
      }
    });
  };
  function loadVideo(id, t, autoplay) {
    if (ready) {
      if (autoplay) player.loadVideoById({ videoId: id, startSeconds: t });
      else player.cueVideoById({ videoId: id, startSeconds: t });
    } else pendingSeek = { t: t, play: autoplay };
  }
  function seek(t) {
    if (ready) { player.seekTo(t, true); player.playVideo(); }
    else pendingSeek = { t: t, play: true };
  }

  // highlight the section being played
  setInterval(function () {
    if (!ready || !cur || !player.getCurrentTime) return;
    var now = player.getCurrentTime(), idx = -1;
    cur.sections.forEach(function (s, i) { if (s.t <= now + 0.5) idx = i; });
    if (idx === lastNow) return;
    lastNow = idx;
    document.querySelectorAll('.sec.now').forEach(function (e) { e.classList.remove('now'); });
    if (idx >= 0) {
      document.getElementById('s' + idx).classList.add('now');
      $('#nowSec').textContent = '目前段落：' + cur.sections[idx].title;
    }
  }, 1000);

  // ---------- routing (#v=ID&t=SEC) ----------
  function setHash(id, t) {
    var h = '#v=' + id + (t ? '&t=' + Math.floor(t) : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function fromHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    return { id: p.get('v'), t: p.get('t') ? +p.get('t') : null };
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var ts = e.target.closest('.ts[data-t]');
    if (ts) {
      var id = ts.dataset.v, t = +ts.dataset.t;
      if (!$('#searchView').classList.contains('hide')) clearSearch();
      if (!cur || cur.id !== id) show(id, t, true); else seek(t);
      setHash(id, t);
      if (window.matchMedia('(min-width:901px)').matches) {
        var left = document.querySelector('.player');
        if (left.getBoundingClientRect().top < 0 || left.getBoundingClientRect().bottom > innerHeight) left.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }
    var pick = e.target.closest('[data-pick]');
    if (pick) { clearSearch(); show(pick.dataset.pick, 0, false); setHash(pick.dataset.pick); scrollTo({ top: $('#videoView').offsetTop - 10, behavior: 'smooth' }); return; }
    var tab = e.target.closest('[data-tab]');
    if (tab) {
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b === tab); });
      $('#secs').classList.toggle('hide', tab.dataset.tab !== 'secs');
      $('#gloss').classList.toggle('hide', tab.dataset.tab !== 'gloss');
    }
  });

  // ---------- search ----------
  function hl(text, q) {
    var s = esc(text), i = s.toLowerCase().indexOf(esc(q).toLowerCase());
    if (i < 0) return s;
    return s.slice(0, i) + '<mark>' + s.slice(i, i + esc(q).length) + '</mark>' + s.slice(i + esc(q).length);
  }
  function clearSearch() { $('#q').value = ''; runSearch(); }
  function runSearch() {
    var q = $('#q').value.trim();
    $('#searchView').classList.toggle('hide', !q);
    $('#videoView').classList.toggle('hide', !!q);
    if (!q) return;
    var ql = q.toLowerCase(), hits = [];
    V.forEach(function (v) {
      (v.takeaways || []).forEach(function (k) { if (k.text.toLowerCase().includes(ql)) hits.push({ v: v, t: k.t, head: '必記重點', text: k.text }); });
      v.sections.forEach(function (s) {
        var lines = s.notes.filter(function (n) { return n.toLowerCase().includes(ql); });
        if (lines.length || s.title.toLowerCase().includes(ql)) hits.push({ v: v, t: s.t, head: s.title, text: (lines.length ? lines : s.notes.slice(0, 1)).join('／') });
      });
      (v.glossary || []).forEach(function (g) {
        var all = g.term + ' ' + g.zh + ' ' + g.explain;
        if (all.toLowerCase().includes(ql)) hits.push({ v: v, t: null, head: '名詞：' + g.term + '（' + g.zh + '）', text: g.explain });
      });
    });
    $('#searchTitle').textContent = '「' + q + '」共 ' + hits.length + ' 筆';
    $('#results').innerHTML = hits.length ? hits.map(function (h) {
      return '<li><div class="src">' + esc(h.v.title_zh || h.v.title) + '</div><strong>' + hl(h.head, q) + '</strong>' +
        '<div style="display:flex;gap:10px;align-items:flex-start;margin-top:4px">' + (h.t != null ? tsBtn(h.v.id, h.t) : '<button class="ts" data-v="' + h.v.id + '" data-t="0">看影片</button>') +
        '<span>' + hl(h.text, q) + '</span></div></li>';
    }).join('') : '<li class="empty">找不到相關內容，換個關鍵字試試（中英文都可以）。</li>';
  }
  var timer;
  $('#q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 150); });

  // ---------- start ----------
  var h = fromHash();
  if (V.length) { show(h.id || V[0].id, h.t, false); if (h.t) pendingSeek = { t: h.t, play: false }; }
  else $('#videoView').innerHTML = '<p class="empty">尚無資料，請先執行 python3 build.py。</p>';
})();
