/* Presenting view for Adrie's lesson pages
   - Teacher: a "Presenting" button on the purple teacher pill. When on, each activity
     shows how many students are done / still working, and a panel can be shown.
   - Students: their page quietly reports (no names) when they start an activity,
     when they get it all correct, and whether their first Check was all correct.
   - Data lives in Google Firebase Realtime Database (free plan). See SETUP below.
   Built by Claude for A3 Homan, 27 Oct 2026. */
(function(){
  'use strict';

  /* ===== SETUP: paste the Firebase web config here (from Firebase console > Project settings) ===== */
  /* Firebase project "A3 Lessons Live" (a3-lessons-live, Spark free plan, Singapore), owner adriehoman@gmail.com */
  var FIREBASE_CONFIG = window.PRESENT_FIREBASE_CONFIG || {
    projectId: 'a3-lessons-live',
    databaseURL: 'https://a3-lessons-live-default-rtdb.asia-southeast1.firebasedatabase.app'
  };
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  /* ================================================================================================= */

  var acts = Array.prototype.slice.call(document.querySelectorAll('.activity[id]'));
  if(!acts.length) return;

  /* ---------- small helpers ---------- */
  function ls(k, v){ try{ if(arguments.length === 1) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } }
  function rid(n){ var s = '', c = 'abcdefghijkmnpqrstuvwxyz23456789'; var a = new Uint8Array(n); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function(_, i){ a[i] = Math.random() * 256; }); for(var i = 0; i < n; i++) s += c[a[i] % c.length]; return s; }
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function titleOf(act){ var b = act.querySelector('.act-head b'); return b ? b.textContent.trim() : act.id; }

  /* winner code: the same 3 digits on the student's screen and on the teacher's panel */
  function winCode(dev, sid){ var h = 5381, t = dev + '|' + sid; for(var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return String(100 + h % 900); }

  var LESSON = (location.pathname.replace(/^\/lessons\//, '').replace(/\.html$/, '').replace(/[.#$\[\]\/]/g, '_')) || 'page';
  var DEVICE = ls('pv_dev'); if(!DEVICE){ DEVICE = rid(12); ls('pv_dev', DEVICE); }
  var ACT_IDS = acts.map(function(a){ return a.id; });

  /* ---------- backend (Firebase, or a test stand-in) ---------- */
  var backend = null, backendWaiters = [];
  function withBackend(fn){ if(backend) fn(backend); else backendWaiters.push(fn); }
  function loadScript(src){ return new Promise(function(res, rej){ var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function startBackend(){
    if(window.PRESENT_BACKEND){ ready(window.PRESENT_BACKEND); return; }
    if(!FIREBASE_CONFIG) return;
    loadScript(SDK + 'firebase-app-compat.js').then(function(){ return loadScript(SDK + 'firebase-database-compat.js'); }).then(function(){
      var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
      var db = app.database();
      ready({
        watch: function(path, cb){ var r = db.ref(path); var h = r.on('value', function(s){ cb(s.val()); }); return function(){ r.off('value', h); }; },
        set: function(path, val){ return db.ref(path).set(val); },
        update: function(path, val){ return db.ref(path).update(val); },
        now: function(){ return firebase.database.ServerValue.TIMESTAMP; }
      });
    }).catch(function(){ /* blocked network: page works as normal without counts */ });
  }
  function ready(b){ backend = b; var w = backendWaiters; backendWaiters = []; w.forEach(function(fn){ fn(b); }); }

  /* ---------- styles ---------- */
  var css = el('style');
  css.textContent = [
    '.pv-badge{display:none; margin-left:auto; font-size:.8em; font-weight:800; padding:4px 12px; border-radius:20px; background:#ede9fe; color:#4c1d95; white-space:nowrap}',
    'body.presenting .pv-badge{display:inline-block}',
    '.pv-badge.all{background:#059669; color:#fff}',
    '.tpill .tp-present{background:#fde68a; color:#4c1d95}',
    '.ppill{position:fixed; top:10px; right:10px; z-index:46; display:none; gap:8px; align-items:center; background:#b45309; color:#fff; border-radius:30px; padding:6px 8px 6px 16px; font-size:15px; font-weight:700; box-shadow:0 4px 14px rgba(0,0,0,.25)}',
    'body.presenting .ppill{display:flex}',
    'body.presenting.teacher .ppill{top:62px}',
    '.ppill button{font:inherit; font-size:14px; font-weight:700; border:0; border-radius:20px; padding:6px 12px; background:#fff; color:#b45309; cursor:pointer; min-height:34px}',
    '.ppill .pp-stop{background:transparent; color:#fff; border:1px solid #fff}',
    '.ppill .dot{width:10px; height:10px; border-radius:50%; background:#fef3c7; animation:pvblink 1.6s infinite}',
    '@keyframes pvblink{50%{opacity:.25}}',
    '.ppanel{position:fixed; right:clamp(14px,2vw,32px); bottom:clamp(80px,7vw,110px); z-index:44; width:min(440px,calc(100vw - 32px)); max-height:calc(100vh - 230px); overflow:auto; background:#fff; color:#1b2530; border:3px solid #b45309; border-radius:16px; box-shadow:0 10px 30px rgba(0,0,0,.3); font-size:clamp(15px,1.05vw,21px); display:none}',
    'body.presenting .ppanel.open{display:block}',
    '.ppanel h3{position:sticky; top:0; margin:0; padding:8px 10px 8px 14px; background:#b45309; color:#fff; font-size:1.05em; display:flex; justify-content:space-between; align-items:center; gap:10px}',
    '.ppanel h3 span{font-weight:600; font-size:.85em}',
    '.ppanel ol{list-style:none; margin:0; padding:6px 10px}',
    '.ppanel li{display:flex; gap:10px; align-items:center; padding:4px 6px; border-bottom:1px solid #f1e6d6; cursor:pointer; border-radius:8px}',
    '.ppanel li:hover{background:#fffbeb}',
    '.ppanel li .n{flex:0 0 1.6em; height:1.6em; border-radius:50%; background:#fde68a; color:#78350f; display:grid; place-items:center; font-weight:800; font-size:.85em}',
    '.ppanel li .t{flex:1; line-height:1.25}',
    '.ppanel li .c{white-space:nowrap; font-weight:800; text-align:right; line-height:1.2}',
    '.ppanel li .c small{display:block; font-weight:600; color:#6b7280; font-size:.75em}',
    '.ppanel li.all .n{background:#059669; color:#fff}',
    '.ppanel .sum{padding:6px 14px 8px; background:#fffbeb; border-top:2px solid #fde68a}',
    '.ppanel .sum div{display:flex; justify-content:space-between; gap:10px; padding:3px 0}',
    '.ppanel .sum b{font-size:1.1em}',
    '.ppanel .star b{color:#b45309}',
    '.ppanel .sum{position:sticky; bottom:0}',
    '.ppanel.compact li{padding:2px 6px; font-size:.9em}',
    '.ppanel.compact li .c small{display:inline; margin-left:6px}',
    '.ppanel.compact li .c{display:flex; align-items:baseline}',
    '.ppanel .pv-ann{font:inherit; font-size:.8em; font-weight:800; border:0; border-radius:20px; padding:5px 12px; background:#fff; color:#b45309; cursor:pointer; min-height:34px; white-space:nowrap}',
    '.ppanel h3 .ht{display:flex; flex-direction:column; gap:0; font-size:1em; font-weight:800}',
    '.ppanel h3 .here{font-size:.75em; font-weight:600}',
    '.ppanel .pv-note{font-size:.75em; color:#6b7280; margin-top:6px}',
    '.pv-win{position:fixed; left:50%; top:50%; transform:translate(-50%,-50%); z-index:60; width:min(560px,calc(100vw - 32px)); background:#fffbeb; border:4px solid #f59e0b; border-radius:20px; padding:26px 24px 22px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.35); font-size:clamp(18px,1.4vw,26px)}',
    '.pv-win .big{font-size:3em; line-height:1}',
    '.pv-win p{margin:10px 0 18px; font-weight:700; color:#78350f}',
    '.pv-win .code{display:inline-block; margin:0 0 16px; font-size:1.6em; font-weight:900; letter-spacing:.12em; color:#fff; background:#b45309; border-radius:14px; padding:6px 18px}',
    '.pv-code{position:fixed; left:clamp(14px,2vw,32px); bottom:clamp(14px,2vw,32px); z-index:41; background:#fffbeb; color:#78350f; border:3px solid #f59e0b; border-radius:30px; padding:8px 18px; font-weight:800; font-size:clamp(16px,1.2vw,22px); box-shadow:0 4px 14px rgba(0,0,0,.2)}',
    '.pv-code b{letter-spacing:.1em; color:#b45309}',
    '.ppanel .codes{font-size:.85em; color:#78350f; padding:0 0 4px}',
    '.ppanel .codes b{letter-spacing:.08em}',
    '.pv-win button{font:inherit; font-weight:700; border:0; border-radius:24px; padding:10px 24px; background:#b45309; color:#fff; cursor:pointer; min-height:44px}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- per-activity badge (teacher's screen only, while presenting) ---------- */
  acts.forEach(function(a){ var h = a.querySelector('.act-head'); if(h){ var b = el('span', 'pv-badge'); b.setAttribute('aria-live', 'polite'); h.appendChild(b); } });

  /* =====================================================================
     STUDENT SIDE: report progress while a class session is live
     ===================================================================== */
  var mine = (function(){ try{ return JSON.parse(ls('pv_' + LESSON)) || {}; }catch(e){ return {}; } })();
  /* mine = { sid: <session it belongs to or null>, a: { actId: { s:'w'|'d', f:true|false } } } */
  if(!mine.a) mine.a = {};
  function saveMine(){ ls('pv_' + LESSON, JSON.stringify(mine)); }
  var liveSid = null;
  function iAmPresenting(){ return document.body.classList.contains('presenting'); }

  function push(actId){
    if(!liveSid || iAmPresenting() || !backend) return;
    var r = mine.a[actId]; if(!r) return;
    backend.set('sessions/' + liveSid + '/' + actId + '/' + DEVICE, { s: r.s, f: r.f === undefined ? null : r.f, t: backend.now() });
  }
  function pushAll(){
    if(!liveSid || iAmPresenting() || !backend) return;
    backend.set('sessions/' + liveSid + '/_here/' + DEVICE, { s: 'h', t: backend.now() });
    Object.keys(mine.a).forEach(push);
  }
  function joinSession(sid){
    if(sid === liveSid) return;
    liveSid = sid;
    if(!sid) return;
    if(mine.sid && mine.sid !== sid){ mine.a = {}; }   /* a new class session: start fresh */
    mine.sid = sid; saveMine();
    pushAll();
    maybeCelebrate();
  }

  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('.act-go, .act-check, .act-peek');
    if(!btn) return;
    var act = btn.closest('.activity[id]'); if(!act) return;
    var id = act.id, r = mine.a[id] || (mine.a[id] = { s: 'w' });
    var undecided = r.f === undefined || r.f === null;
    if(btn.classList.contains('act-peek')){
      /* the page has already toggled the blur: notes now showing = the student peeked */
      var slide = act.closest('section.slide');
      if(undecided && slide && !slide.classList.contains('hide-notes')) r.p = true;
      saveMine(); return;
    }
    if(btn.classList.contains('act-check')){
      var good = !!act.querySelector('.act-result.good');
      if(undecided) r.f = good && !r.p;   /* first Check decides "first try"; a peek before it counts as a miss */
      if(good) r.s = 'd';
    }
    saveMine(); push(id);
    if(btn.classList.contains('act-check')) maybeCelebrate();
  }, false);

  var codeTag = null;
  function maybeCelebrate(){
    if(!liveSid || iAmPresenting()) return;
    var all = ACT_IDS.every(function(id){ return mine.a[id] && mine.a[id].f === true; });
    if(!all) return;
    var code = winCode(DEVICE, liveSid);
    /* the code stays in the corner, even after Close or a reload */
    if(!codeTag){
      codeTag = el('div', 'pv-code'); codeTag.setAttribute('role', 'status');
      codeTag.appendChild(document.createTextNode('\u2B50 Winner code ')); codeTag.appendChild(el('b', null, code));
      document.body.appendChild(codeTag);
    }
    if(mine.won === liveSid) return;   /* pop-up only once */
    mine.won = liveSid; saveMine();
    var w = el('div', 'pv-win'); w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Well done');
    w.appendChild(el('div', 'big', '\u2B50'));
    w.appendChild(el('p', null, 'You got all ' + ACT_IDS.length + ' activities right on the first try! Show your teacher this code:'));
    w.appendChild(el('div', 'code', code));
    w.appendChild(el('p', null, 'Your code stays in the bottom corner of the page.'));
    var ok = el('button', null, 'Close'); ok.type = 'button'; ok.addEventListener('click', function(){ w.remove(); });
    w.appendChild(ok); document.body.appendChild(w); ok.focus();
  }

  /* =====================================================================
     TEACHER SIDE: Presenting button, badges and panel
     ===================================================================== */
  var pill = document.querySelector('.tpill');
  var ppill = el('div', 'ppill');
  ppill.innerHTML = '<span class="dot" aria-hidden="true"></span><span>Presenting</span>';
  var bPanel = el('button', 'pp-panel', 'Show panel'); bPanel.type = 'button';
  var bStop = el('button', 'pp-stop', 'Stop'); bStop.type = 'button';
  ppill.appendChild(bPanel); ppill.appendChild(bStop);
  document.body.appendChild(ppill);

  var bPresent = null;
  if(pill){
    bPresent = el('button', 'tp-present', 'Presenting'); bPresent.type = 'button';
    bPresent.title = 'Show how many students have finished each activity';
    pill.insertBefore(bPresent, pill.querySelector('.tp-hide'));
  }

  var panel = el('div', 'ppanel'); panel.setAttribute('aria-label', 'Class progress');
  panel.innerHTML = '<h3><span class="ht">Class progress <span class="here"></span></span></h3><ol></ol><div class="sum"></div>';
  document.body.appendChild(panel);
  var list = panel.querySelector('ol');
  if(acts.length > 8) panel.classList.add('compact');
  acts.forEach(function(a, i){
    var li = el('li'); li.setAttribute('data-act', a.id);
    li.appendChild(el('span', 'n', String(i + 1)));
    li.appendChild(el('span', 't', titleOf(a)));
    li.appendChild(el('span', 'c', '0'));
    li.addEventListener('click', function(){ a.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    list.appendChild(li);
  });

  var mySid = ls('pv_teach_' + LESSON), unwatch = null, lastPerfect = 0, lastCodes = [];

  /* ---------- mascots announce the result ---------- */
  var annBtn = el('button', 'pv-ann', '\uD83D\uDCE3 Announce'); annBtn.type = 'button';
  annBtn.addEventListener('click', function(){ announce(lastPerfect, lastCodes); });
  panel.querySelector('h3').appendChild(annBtn);
  function pickVoice(want){
    var vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    return vs.filter(function(v){ return v.name.indexOf(want) > -1; })[0] ||
           vs.filter(function(v){ return /en-AU/i.test(v.lang); })[0] ||
           vs.filter(function(v){ return /^en/i.test(v.lang); })[0] || null;
  }
  function say(text, voiceName, pitch){
    return new Promise(function(done){
      if(!window.speechSynthesis){ setTimeout(done, 4000); return; }
      var finished = false, finish = function(){ if(!finished){ finished = true; done(); } };
      setTimeout(finish, 2500 + text.length * 90);   /* never wait forever, e.g. no voices on this computer */
      var u = new SpeechSynthesisUtterance(text), v = pickVoice(voiceName);
      if(v){ u.voice = v; u.lang = v.lang; } else u.lang = 'en-AU';
      u.rate = 0.95; u.pitch = pitch || 1;
      u.onend = u.onerror = finish;
      speechSynthesis.speak(u);
    });
  }
  function bubble(mascot, text){
    var b = mascot && mascot.querySelector('.gerry-bubble'); if(!b) return;
    b.textContent = text; b.hidden = false;
    mascot.classList.remove('hop'); void mascot.offsetWidth; mascot.classList.add('hop');
    clearTimeout(b._t); b._t = setTimeout(function(){ b.hidden = true; }, 12000);
  }
  function announce(n, codes){
    codes = codes || [];
    var shown = codes.length ? ' Winner code' + (codes.length > 1 ? 's: ' : ': ') + codes.join(', ') + '.' : '';
    var spoken = codes.length ? ' Winner code' + (codes.length > 1 ? 's: ' : ': ') + codes.map(function(c){ return c.split('').join(' '); }).join(', and ') + '.' : '';
    var who = n === 1 ? '1 student' : n + ' students';
    /* Each unit can give its own mascots their own lines (window.ANNOUNCE, written by the unit's build from site.js).
       Without it, the original Gerry and Dottie lines are used, so older pages work as before. */
    var A = window.ANNOUNCE, ms = document.querySelectorAll('.mascot'), first, second, fLine, sLine, fV = 'William', fP = 1.15, sV = 'Natasha', sP = 1;
    if(A && A.first){
      var fill = function(t){ return String(t || '').replace(/\{who\}/g, who).replace(/\{n\}/g, ACT_IDS.length); };
      first = document.querySelector('.mascot[data-mascot="' + A.first.mascot + '"]') || ms[0];
      second = A.second ? (document.querySelector('.mascot[data-mascot="' + A.second.mascot + '"]') || null) : null;
      fLine = fill(n === 0 ? A.first.none : A.first.some); fV = A.first.voice || fV; fP = A.first.pitch || fP;
      if(A.second){ sLine = fill(n === 0 ? A.second.none : A.second.some); sV = A.second.voice || sV; sP = A.second.pitch || sP; }
    } else {
      first = document.querySelector('.mascot[data-mascot="gerry"]'); second = document.querySelector('.mascot[data-mascot="drop"]');
      fLine = n === 0 ? 'Ha! Nobody got every activity right on the first try. Not yet!'
                      : 'Oh no! ' + who + ' got every activity right on the first try. They know all my tricks!';
      sLine = n === 0 ? 'Keep going, everyone. You can still beat Gerry!'
                      : 'Well done! ' + who + ' got all ' + ACT_IDS.length + ' right first time. Gerry is in trouble now!';
    }
    if(window.speechSynthesis) speechSynthesis.cancel();
    if(!second){ bubble(first, fLine + shown); say(fLine + spoken, fV, fP); return; }
    bubble(first, fLine);
    say(fLine, fV, fP).then(function(){
      bubble(second, sLine + shown);
      return say(sLine + spoken, sV, sP);
    });
  }
  if(window.speechSynthesis){ speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = function(){ speechSynthesis.getVoices(); }; }

  function render(data){
    data = data || {};
    var here = Object.keys(data._here || {});
    var devs = {}; here.forEach(function(d){ devs[d] = true; });
    ACT_IDS.forEach(function(id){ Object.keys(data[id] || {}).forEach(function(d){ devs[d] = true; }); });
    var nStudents = Object.keys(devs).length;
    panel.querySelector('.here').textContent = nStudents + (nStudents === 1 ? ' student' : ' students') + ' on this page';

    ACT_IDS.forEach(function(id, i){
      var rows = data[id] || {}, done = 0, working = 0;
      Object.keys(rows).forEach(function(d){ if(rows[d].s === 'd') done++; else working++; });
      var all = done > 0 && done >= nStudents;
      var act = document.getElementById(id), badge = act && act.querySelector('.pv-badge');
      var txt = done + ' of ' + nStudents + ' done · ' + working + ' working';
      if(badge){ badge.textContent = txt; badge.classList.toggle('all', all); }
      var li = list.children[i], c = li.querySelector('.c');
      c.innerHTML = ''; c.appendChild(document.createTextNode(done + ' of ' + nStudents + ' done')); c.appendChild(el('small', null, working + ' working'));
      li.classList.toggle('all', all);
    });

    /* first-try counts across ALL activities on the page */
    var perfect = 0, onTrack = 0, codes = [];
    Object.keys(devs).forEach(function(d){
      var tried = 0, firstOk = 0;
      ACT_IDS.forEach(function(id){ var r = (data[id] || {})[d]; if(r && r.f !== null && r.f !== undefined){ tried++; if(r.f === true) firstOk++; } });
      if(tried && firstOk === tried){ if(tried === ACT_IDS.length){ perfect++; codes.push(winCode(d, mySid)); } else onTrack++; }
    });
    var sum = panel.querySelector('.sum'); sum.innerHTML = '';
    var r1 = el('div', 'star'); r1.appendChild(el('span', null, '⭐ All ' + ACT_IDS.length + ' right first try')); r1.appendChild(el('b', null, String(perfect)));
    var r2 = el('div'); r2.appendChild(el('span', null, 'Still on track (no mistakes yet)')); r2.appendChild(el('b', null, String(onTrack)));
    sum.appendChild(r1);
    if(codes.length){ var cr = el('div', 'codes'); cr.appendChild(document.createTextNode('Winner codes: ')); cr.appendChild(el('b', null, codes.sort().join(' \u00B7 '))); sum.appendChild(cr); }
    sum.appendChild(r2);
    sum.appendChild(el('div', 'pv-note', 'Peeking at the notes before the first Check counts as a miss.'));
    lastPerfect = perfect; lastCodes = codes;
  }

  function startPresenting(resume){
    withBackend(function(b){
      if(!resume || !mySid){ mySid = Date.now().toString(36) + rid(6); ls('pv_teach_' + LESSON, mySid); }
      document.body.classList.add('presenting'); if(bPresent) bPresent.textContent = 'Stop presenting';
      if(!resume) b.set('live/' + LESSON, { sid: mySid, at: b.now() });
      if(unwatch) unwatch();
      render({});
      unwatch = b.watch('sessions/' + mySid, render);
      if(ls('pv_panel') === '1'){ panel.classList.add('open'); bPanel.textContent = 'Hide panel'; }
    });
    if(!backend && !window.PRESENT_BACKEND && !FIREBASE_CONFIG) alert('Presenting is not set up yet (no Firebase settings in shared/presenting.js).');
  }
  function stopPresenting(){
    document.body.classList.remove('presenting'); if(bPresent) bPresent.textContent = 'Presenting';
    if(unwatch){ unwatch(); unwatch = null; }
    withBackend(function(b){ b.set('live/' + LESSON, null); });
    mySid = null; ls('pv_teach_' + LESSON, null);
  }

  if(bPresent) bPresent.addEventListener('click', function(){ if(iAmPresenting()) stopPresenting(); else startPresenting(false); });
  bStop.addEventListener('click', stopPresenting);
  bPanel.addEventListener('click', function(){
    var open = panel.classList.toggle('open');
    bPanel.textContent = open ? 'Hide panel' : 'Show panel';
    ls('pv_panel', open ? '1' : '0');
  });

  /* ---------- start up ---------- */
  startBackend();
  if(mySid) startPresenting(true);   /* teacher reloaded the page: carry on */
  withBackend(function(b){
    b.watch('live/' + LESSON, function(v){ if(!iAmPresenting()) joinSession(v && v.sid ? v.sid : null); });
  });
})();
