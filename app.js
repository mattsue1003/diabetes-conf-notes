(function () {
  'use strict';
  var V = window.VIDEOS || [];
  var TR = window.TRANSCRIPTS || null;          // full transcripts: only present in the local copy
  var $ = function (s) { return document.querySelector(s); };
  var cur = null, player = null, ready = false, pendingSeek = null, lastSec = -1, lastPara = -1;
  var tab = TR ? 'tr' : 'secs';

  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ytUrl(id, t) { return 'https://www.youtube.com/watch?v=' + id + (t ? '&t=' + Math.floor(t) + 's' : ''); }
  function tsBtn(id, t) { return '<button class="ts" data-v="' + id + '" data-t="' + t + '" title="跳到 ' + fmt(t) + ' 播放">' + fmt(t) + '</button>'; }
  function ytA(id, t) { return '<a class="yt" href="' + ytUrl(id, t) + '" target="_blank" rel="noopener" title="在 YouTube 從這裡開啟">YouTube ↗</a>'; }
  function vName(v) { return v.title_zh || v.title; }

  // Chinese keywords also search the English transcript
  var SYN = {
    '血酮': ['ketone'], '酮': ['ketone'], '酮酸中毒': ['dka', 'ketoacidosis'], '低血糖': ['hypoglycemia', 'hypo', 'low'], '高血糖': ['hyperglycemia'],
    '胰島素': ['insulin'], '幫浦': ['pump'], '胰島素幫浦': ['pump'], '感測器': ['sensor'], '連續血糖': ['cgm', 'continuous glucose'],
    '閉環': ['closed loop', 'closed-loop'], '全閉環': ['fully closed'], '人工胰臟': ['artificial pancreas'], '演算法': ['algorithm'],
    '輸注套組': ['infusion set'], '輸注': ['infusion'], '貼片': ['patch'], '皮膚': ['skin'], '針': ['needle'],
    '篩檢': ['screening', 'screen'], '診斷': ['diagnos'], '分類': ['classification'], '糖化血色素': ['a1c', 'hba1c'], '空腹': ['fasting'],
    '妊娠': ['pregnan', 'gestational'], '懷孕': ['pregnan'], '兒童': ['child', 'pediatric', 'kids'], '青少年': ['adolescen', 'youth'],
    '減重': ['weight', 'obesity'], '肥胖': ['obesity'], '體重': ['weight'], '運動': ['exercise', 'physical activity'], '飲食': ['diet', 'nutrition', 'meal'], '餐': ['meal'],
    '腎': ['kidney', 'renal', 'ckd'], '心臟': ['heart', 'cardi'], '心衰竭': ['heart failure'], '肝': ['liver', 'masld'], '眼': ['retinopathy', 'eye'], '神經': ['neuropathy'],
    '足部': ['foot'], '骨': ['bone', 'osteopor'], '血壓': ['blood pressure', 'hypertension'], '血脂': ['lipid', 'cholesterol', 'statin'],
    '週': ['weekly'], '每週': ['weekly'], '人工智慧': ['ai', 'artificial intelligence'], '數位分身': ['digital twin'], '臨床試驗': ['trial'], '試驗': ['trial', 'study'],
    '第1型': ['type 1'], '第一型': ['type 1'], '第2型': ['type 2'], '第二型': ['type 2'], '糖尿病前期': ['prediabetes', 'pre-diabetes'],
    '抗體': ['antibod', 'autoantibod'], '老人': ['older', 'elderly'], '長者': ['older', 'elderly'], '睡眠': ['sleep'], '憂鬱': ['depression'], '費用': ['cost', 'price', 'insurance'], '保險': ['insurance']
  };
  // query terms: split on spaces; every term must match (AND); a term matches itself or any synonym
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // each term → regex source; synonyms match only at the start of an English word
  function terms(q) {
    return q.toLowerCase().split(/\s+/).filter(Boolean).map(function (t) {
      return [escRe(t)].concat((SYN[t] || []).map(function (a) { return '\\b' + escRe(a); })).join('|');
    });
  }
  function matches(text, ts) { return ts.every(function (src) { return new RegExp(src, 'i').test(text); }); }
  function re(ts) { return new RegExp('(' + ts.map(function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }).join('|') + ')', 'gi'); }
  function hl(text, ts) { var s = esc(text); return ts.length ? s.replace(re(ts), '<mark>$1</mark>') : s; }
  function trHtml(text, ts) { return hl(text, ts).replace(/ ?¶ ?/g, '<span class="sp"></span>'); }

  if (!TR) { document.querySelectorAll('[data-tr]').forEach(function (e) { e.remove(); }); $('#fScope').remove(); }
  // transcript language: zh (default when translated), en, or both
  var lang = 'zh';
  try { lang = localStorage.getItem('dcn.lang') || 'zh'; } catch (e) {}
  function hasZh(p) { return p.length > 2; }
  function paraHtml(p, ts) {
    if (!hasZh(p) || lang === 'en') return '<span class="tx">' + trHtml(p[1], ts) + '</span>';
    if (lang === 'zh') return '<span class="tx">' + trHtml(p[2], ts) + '</span>';
    return '<span class="tx">' + trHtml(p[2], ts) + '<span class="en">' + trHtml(p[1], ts) + '</span></span>';
  }
  function paraText(p) { return p[1] + ' ' + (p[2] || ''); }

  // ---------- picker + video filter ----------
  $('#picker').innerHTML = V.map(function (v) {
    return '<button class="vcard" data-pick="' + v.id + '">' +
      '<img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg">' +
      '<span class="g">' + esc(v.group) + '</span><span class="t">' + esc(vName(v)) + '</span>' +
      '<span class="m">' + esc(v.channel) + '・' + v.duration + '</span></button>';
  }).join('');
  $('#fVideo').innerHTML += ['ATTD 2026', 'ADA 2026'].map(function (g) {
    return '<optgroup label="' + g + '"><option value="g:' + g + '">' + g + ' 全部</option>' +
      V.filter(function (v) { return v.group === g; }).map(function (v) { return '<option value="' + v.id + '">' + esc(v.channel + '｜' + vName(v)) + '</option>'; }).join('') + '</optgroup>';
  }).join('');

  // ---------- tabs ----------
  function setTab(name) {
    tab = name;
    document.querySelectorAll('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === name); });
    ['tr', 'secs', 'gloss'].forEach(function (k) { var el = document.getElementById(k); if (el) el.classList.toggle('hide', k !== name); });
  }

  // ---------- render one video ----------
  function show(id, t, autoplay) {
    var v = V.find(function (x) { return x.id === id; }) || V[0];
    if (!v) return;
    var changed = !cur || cur.id !== v.id;
    cur = v; lastSec = lastPara = -1;
    document.querySelectorAll('.vcard').forEach(function (b) { b.setAttribute('aria-current', b.dataset.pick === v.id); });
    $('#vtitle').textContent = vName(v);
    $('#vsub').innerHTML = esc(v.title) + '<br>' + esc(v.channel) + (v.speakers ? '・' + esc(v.speakers) : '') + '・' + v.duration;
    $('#summary').textContent = v.summary || '';
    $('#take').innerHTML = (v.takeaways || []).slice().sort(function (a, b) { return a.t - b.t; }).map(function (k) {
      return '<li>' + tsBtn(v.id, k.t) + '<span>' + esc(k.text) + '</span></li>';
    }).join('');
    $('#secs').innerHTML = v.sections.map(function (s, i) {
      return '<article class="sec" id="s' + i + '"><h3>' + tsBtn(v.id, s.t) + '<span>' + esc(s.title) + '</span>' + ytA(v.id, s.t) + '</h3><ul>' +
        s.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></article>';
    }).join('');
    $('#gloss').innerHTML = '<dl class="gl">' + (v.glossary || []).map(function (g) {
      return '<dt>' + esc(g.term) + '<small>' + esc(g.zh) + '</small></dt><dd>' + esc(g.explain) + '</dd>';
    }).join('') + '</dl>';
    $('#caveat').innerHTML = v.caveats ? '<strong>閱讀提醒：</strong>' + esc(v.caveats) : '';
    $('#caveat').classList.toggle('hide', !v.caveats);
    if (TR) { $('#trq').value = ''; renderTr(); }
    $('#ytLink').href = ytUrl(v.id);
    $('#nowSec').textContent = '目前段落：—';
    document.title = vName(v) + '｜糖尿病年會影片筆記';
    if (changed) loadVideo(v.id, t || 0, autoplay);
    else if (t != null) seek(t);
  }

  // ---------- transcript tab ----------
  var hits = [], hitIdx = -1;
  function renderTr() {
    var paras = (TR && TR[cur.id]) || [], ts = terms($('#trq').value);
    $('#trBody').innerHTML = paras.length ? paras.map(function (p, i) {
      return '<p class="tp" id="p' + i + '">' + tsBtn(cur.id, p[0]) + paraHtml(p, ts) + '</p>';
    }).join('') : '<p class="empty">這部影片沒有逐字稿。</p>';
    hits = [].slice.call(document.querySelectorAll('#trBody mark'));
    hitIdx = -1;
    $('#trCount').textContent = ts.length ? (hits.length ? hits.length + ' 處' : '找不到') : '';
    lastPara = -1;
  }
  function stepHit(d) {
    if (!hits.length) return;
    if (hitIdx >= 0) hits[hitIdx].classList.remove('cur');
    hitIdx = (hitIdx + d + hits.length) % hits.length;
    hits[hitIdx].classList.add('cur');
    $('#follow').checked = false;
    hits[hitIdx].scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('#trCount').textContent = (hitIdx + 1) + ' / ' + hits.length + ' 處';
  }
  function gotoPara(i, q) {
    setTab('tr');
    if (q) { $('#trq').value = q; renderTr(); }
    var el = document.getElementById('p' + i);
    if (!el) return;
    $('#follow').checked = false;
    el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 2500);
    el.scrollIntoView({ block: 'center' });
  }

  // ---------- YouTube player ----------
  window.onYouTubeIframeAPIReady = function () {
    player = new YT.Player('yt', {
      videoId: cur ? cur.id : V[0].id,
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1, start: pendingSeek ? Math.floor(pendingSeek.t) : 0 },
      events: { onReady: function () { ready = true; if (pendingSeek && pendingSeek.play) player.playVideo(); pendingSeek = null; } }
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

  // follow playback: highlight current section and transcript paragraph
  function lastAtOrBefore(arr, now, get) { var idx = -1; for (var i = 0; i < arr.length; i++) { if (get(arr[i]) <= now + 0.5) idx = i; else break; } return idx; }
  setInterval(function () {
    if (!ready || !cur || !player.getCurrentTime) return;
    var now = player.getCurrentTime();
    var si = lastAtOrBefore(cur.sections, now, function (s) { return s.t; });
    if (si !== lastSec) {
      lastSec = si;
      document.querySelectorAll('.sec.now').forEach(function (e) { e.classList.remove('now'); });
      if (si >= 0) { document.getElementById('s' + si).classList.add('now'); $('#nowSec').textContent = '目前段落：' + cur.sections[si].title; }
    }
    if (TR && TR[cur.id]) {
      var pi = lastAtOrBefore(TR[cur.id], now, function (p) { return p[0]; });
      if (pi !== lastPara) {
        lastPara = pi;
        document.querySelectorAll('.tp.now').forEach(function (e) { e.classList.remove('now'); });
        var el = pi >= 0 && document.getElementById('p' + pi);
        if (el) {
          el.classList.add('now');
          var playing = player.getPlayerState && player.getPlayerState() === 1;
          if (playing && tab === 'tr' && $('#follow').checked && $('#searchView').classList.contains('hide')) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
  }, 700);

  // ---------- routing (#v=ID&t=SEC) ----------
  function setHash(id, t) {
    var h = '#v=' + id + (t ? '&t=' + Math.floor(t) : '');
    if (location.hash !== h) history.replaceState(null, '', h);
  }
  function fromHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    return { id: p.get('v'), t: p.get('t') ? +p.get('t') : null };
  }
  function scrollToPlayerIfHidden() {
    var pl = document.querySelector('.player'), r = pl.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) pl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- events ----------
  document.addEventListener('click', function (e) {
    var ctx = e.target.closest('[data-ctx]');
    if (ctx) {  // open the transcript at this paragraph, without playing
      var id = ctx.dataset.v, i = +ctx.dataset.ctx, qts = $('#q').value.trim();
      leaveSearch();
      if (!cur || cur.id !== id) show(id, TR[id][i][0], false);
      setHash(id, TR[id][i][0]);
      gotoPara(i, qts);
      return;
    }
    var ts = e.target.closest('.ts[data-t]');
    if (ts) {
      var vid = ts.dataset.v, t = +ts.dataset.t, inSearch = !$('#searchView').classList.contains('hide');
      if (inSearch) leaveSearch();
      if (!cur || cur.id !== vid) show(vid, t, true); else seek(t);
      setHash(vid, t);
      if (inSearch && ts.dataset.p != null) gotoPara(+ts.dataset.p, $('#q').value.trim());
      scrollToPlayerIfHidden();
      return;
    }
    var pick = e.target.closest('[data-pick]');
    if (pick) { clearSearch(); show(pick.dataset.pick, 0, false); setHash(pick.dataset.pick); scrollTo({ top: $('#videoView').offsetTop - 10, behavior: 'smooth' }); return; }
    var tb = e.target.closest('[data-tab]');
    if (tb) { setTab(tb.dataset.tab); return; }
    if (e.target.closest('#moreBtn')) { shown += PAGE; drawResults(); }
  });

  // ---------- global search ----------
  var all = [], shown = 0, PAGE = 60, lastTerms = [];
  function leaveSearch() { $('#searchView').classList.add('hide'); $('#videoView').classList.remove('hide'); $('#picker').classList.remove('hide'); }
  function clearSearch() { $('#q').value = ''; runSearch(); }
  function inFilter(v) {
    var f = $('#fVideo').value;
    return !f || (f.indexOf('g:') === 0 ? v.group === f.slice(2) : v.id === f);
  }
  function runSearch() {
    var q = $('#q').value.trim(), scope = TR ? $('#fScope').value : 'notes', ts = terms(q);
    $('#searchView').classList.toggle('hide', !q);
    $('#videoView').classList.toggle('hide', !!q);
    $('#picker').classList.toggle('hide', !!q);
    if (!q) return;
    all = []; lastTerms = ts;
    V.filter(inFilter).forEach(function (v) {
      if (scope !== 'notes' && TR && TR[v.id]) TR[v.id].forEach(function (p, i) {
        if (matches(paraText(p), ts)) all.push({ kind: 'tr', v: v, t: p[0], p: i, para: p });
      });
      if (scope === 'tr') return;
      (v.takeaways || []).forEach(function (k) { if (matches(k.text, ts)) all.push({ kind: 'n', v: v, t: k.t, head: '必記重點', text: k.text }); });
      v.sections.forEach(function (s) {
        var lines = s.notes.filter(function (n) { return matches(n, ts); });
        if (lines.length || matches(s.title, ts)) all.push({ kind: 'n', v: v, t: s.t, head: s.title, text: (lines.length ? lines : s.notes.slice(0, 1)).join('／') });
      });
      (v.glossary || []).forEach(function (g) {
        if (matches(g.term + ' ' + g.zh + ' ' + g.explain, ts)) all.push({ kind: 'n', v: v, t: null, head: '名詞：' + g.term + '（' + g.zh + '）', text: g.explain });
      });
    });
    // order: video order, then time
    var order = {}; V.forEach(function (v, i) { order[v.id] = i; });
    all.sort(function (a, b) { return order[a.v.id] - order[b.v.id] || (a.t || 0) - (b.t || 0); });
    var nTr = all.filter(function (h) { return h.kind === 'tr'; }).length;
    var nVid = new Set(all.map(function (h) { return h.v.id; })).size;
    $('#searchTitle').textContent = '「' + q + '」共 ' + all.length + ' 筆' + (TR && scope !== 'notes' ? '（逐字稿 ' + nTr + '、筆記 ' + (all.length - nTr) + '）' : '') + (all.length ? '，分布在 ' + nVid + ' 部影片' : '');
    shown = PAGE; drawResults();
  }
  function drawResults() {
    var ts = lastTerms, prev = null;
    $('#results').innerHTML = all.length ? all.slice(0, shown).map(function (h) {
      var head = h.v.id !== prev ? '<div class="src" style="margin-top:6px">' + esc(h.v.group + '｜' + vName(h.v)) + '</div>' : '';
      prev = h.v.id;
      if (h.kind === 'tr') {
        // show the chosen language; if the hit is only in the other language, show that one too
        var body = paraHtml(h.para, ts);
        if (hasZh(h.para) && lang !== 'both') {
          var other = lang === 'en' ? h.para[2] : h.para[1], shown = lang === 'en' ? h.para[1] : h.para[2];
          if (!matches(shown, ts)) body = '<span class="tx">' + trHtml(shown, ts) + '<span class="en">' + trHtml(other, ts) + '</span></span>';
        }
        return '<li>' + head + '<span class="kind tr">逐字稿</span><div class="tx">' + body + '</div>' +
          '<div class="acts"><button class="ts" data-v="' + h.v.id + '" data-t="' + h.t + '" data-p="' + h.p + '">' + fmt(h.t) + '</button>' +
          '<button class="ctx" data-v="' + h.v.id + '" data-ctx="' + h.p + '">看前後文</button>' + ytA(h.v.id, h.t) + '</div></li>';
      }
      return '<li>' + head + '<span class="kind">中文筆記</span><strong>' + hl(h.head, ts) + '</strong><div class="tx">' + hl(h.text, ts) + '</div>' +
        '<div class="acts">' + (h.t != null ? tsBtn(h.v.id, h.t) + ytA(h.v.id, h.t) : '<button class="ts" data-v="' + h.v.id + '" data-t="0">看影片</button>') + '</div></li>';
    }).join('') + (all.length > shown ? '<li class="more"><button id="moreBtn">再顯示 ' + Math.min(PAGE, all.length - shown) + ' 筆（還有 ' + (all.length - shown) + ' 筆）</button></li>' : '')
      : '<li class="empty">找不到相關內容。逐字稿是英文，中文只會對應常用詞；可以改試英文關鍵字（例如 insulin、ketone、screening）。</li>';
  }
  var timer;
  $('#q').addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 200); });
  $('#fScope').addEventListener('change', runSearch);
  $('#fVideo').addEventListener('change', runSearch);
  if (TR) {
    var tt;
    $('#trq').addEventListener('input', function () { clearTimeout(tt); tt = setTimeout(function () { renderTr(); if (hits.length) stepHit(1); }, 200); });
    $('#trq').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); stepHit(e.shiftKey ? -1 : 1); } });
    $('#trNext').addEventListener('click', function () { stepHit(1); });
    $('#lang').value = lang;
    $('#lang').addEventListener('change', function () {
      lang = this.value; try { localStorage.setItem('dcn.lang', lang); } catch (e) {}
      renderTr(); if (!$('#searchView').classList.contains('hide')) drawResults();
    });
    $('#trPrev').addEventListener('click', function () { stepHit(-1); });
  }

  // ---------- start ----------
  setTab(tab);
  var h = fromHash();
  if (V.length) { show(h.id || V[0].id, h.t, false); if (h.t) pendingSeek = { t: h.t, play: false }; }
  else $('#videoView').innerHTML = '<p class="empty">尚無資料，請先執行 python3 build.py。</p>';
})();
