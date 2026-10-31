/* Edit mode for Adrie's lesson pages
   - Only on a computer that knows the teacher code: an "Edit" button sits on the purple teacher pill.
   - Edit on: click any text on the page and type. Changed text gets a yellow outline.
     Ctrl+B = bold, Ctrl+I = italic. Enter is turned off (one point stays one point).
   - "Save to build folder" writes a small change file to lessons\<unit>\_build\edits\ (Chrome or Edge).
     The first time, pick the "lessons" folder (Swayreplacements\lessons). The page remembers it.
   - A small orange flag on the teacher pill shows when change files are waiting.
     "Ask Claude to apply" opens Claude with the request ready to send.
   - Claude runs _template\edits\apply-edits.js, which puts the changes into _content\ (the source),
     then rebuilds, locks and uploads. Applied files move to _build\edits\applied\.
   Students never see any of this: the pill only shows on a computer that has the teacher code.
   Built by Claude for A3 Homan, 31 Oct 2026. */
(function(){
  'use strict';
  var pill = document.querySelector('.tpill');
  if(!pill) return;

  /* ---------- where am I ---------- */
  var parts = decodeURIComponent(location.pathname).replace(/\\/g, '/').split('/').filter(Boolean);
  var PAGE = parts[parts.length - 1] || 'index.html';
  var UNIT = parts[parts.length - 2] || 'unit';
  var K_DRAFT = 'em_draft:' + UNIT + '/' + PAGE, K_PEND = 'em_pending:' + UNIT;

  function ls(k, v){ try{ if(arguments.length === 1) return localStorage.getItem(k); if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){ return null; } }
  function jget(k, d){ try{ var v = JSON.parse(ls(k)); return v == null ? d : v; }catch(e){ return d; } }
  function jset(k, v){ ls(k, JSON.stringify(v)); }
  function el(tag, cls, txt){ var e = document.createElement(tag); if(cls) e.className = cls; if(txt != null) e.textContent = txt; return e; }
  function teacherOn(){ return !pill.hidden; }

  /* ---------- styles ---------- */
  var css = el('style');
  css.textContent = [
    '.tpill .tp-edit.on{background:#ffd54a;color:#3a2a00}',
    'body.em-on [data-em]{outline:1px dashed rgba(120,80,200,.45);outline-offset:2px;border-radius:3px;cursor:text}',
    'body.em-on [data-em]:hover{outline:2px dashed rgba(120,80,200,.8)}',
    'body.em-on [data-em]:focus{outline:2px solid #6a3fc8;background:rgba(255,255,255,.6)}',
    'body.em-on [data-em].em-changed{outline:2px solid #e0a800;background:rgba(255,213,74,.25)}',
    '.em-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:60;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;',
    ' background:#2b1f4a;color:#fff;border-radius:30px;padding:8px 10px 8px 18px;box-shadow:0 6px 20px rgba(0,0,0,.3);font:600 15px/1.3 "Segoe UI",Arial,sans-serif;max-width:calc(100vw - 32px)}',
    '.em-bar[hidden],.em-flag[hidden],.em-panel[hidden]{display:none}',
    '.em-bar button,.em-panel button{font:inherit;font-size:14px;border:0;border-radius:20px;padding:7px 14px;cursor:pointer;background:#fff;color:#2b1f4a;min-height:34px}',
    '.em-bar button.em-save{background:#ffd54a;color:#3a2a00}',
    '.em-bar button:disabled{opacity:.45;cursor:default}',
    '.em-flag{position:fixed;top:58px;right:10px;z-index:45;background:#e8710a;color:#fff;border:0;border-radius:20px;padding:6px 14px;font:700 14px "Segoe UI",Arial,sans-serif;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.25)}',
    '.em-panel{position:fixed;top:98px;right:10px;z-index:61;width:min(380px,calc(100vw - 32px));background:#fff;color:#222;border-radius:14px;padding:16px;box-shadow:0 8px 28px rgba(0,0,0,.3);font:15px/1.45 "Segoe UI",Arial,sans-serif}',
    '.em-panel h4{margin:0 0 6px;font-size:16px}.em-panel ul{margin:6px 0 10px;padding-left:20px;font-size:13px;color:#444;max-height:160px;overflow:auto}',
    '.em-panel .em-row{display:flex;gap:8px;flex-wrap:wrap}.em-panel .em-go{background:#6a3fc8;color:#fff}.em-panel button{border:1px solid #6a3fc8}',
    '.em-panel .em-msg{font-size:13px;color:#555;margin-top:8px}',
    '.em-toast{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);z-index:62;background:#222;color:#fff;padding:8px 16px;border-radius:10px;font:14px "Segoe UI",Arial,sans-serif;max-width:calc(100vw - 32px)}'
  ].join('\n');
  document.head.appendChild(css);

  function toast(t, ms){ var x = el('div', 'em-toast', t); document.body.appendChild(x); setTimeout(function(){ x.remove(); }, ms || 3500); }

  /* ---------- page text back to the mini-markdown used in _content ---------- */
  var SKIP = '.ref,.num,button,.say,.audio-label,.star,.star-link,svg,script,style,[contenteditable="false"]';
  var TAGS = { 'tag old': '{{OLD}}', 'tag repl': '{{REPLACED}}', 'tag new': '{{NEW}}' };
  function slug(s){ return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function toMd(node){
    var out = '';
    node.childNodes.forEach(function(n){
      if(n.nodeType === 3){ out += n.nodeValue; return; }
      if(n.nodeType !== 1) return;
      if(n.matches(SKIP)) return;
      var t = n.tagName, inner = toMd(n);
      if(t === 'BR'){ out += ' '; return; }
      if(n.matches('a.term')){
        var term = n.getAttribute('data-term') || '', shown = n.textContent;
        out += (slug(shown) === term) ? '[[' + shown + ']]' : '[[@' + term + '|' + shown + ']]'; return;
      }
      if(t === 'A' && /^https?:/.test(n.getAttribute('href') || '')){ out += '[' + inner + '](' + n.getAttribute('href') + ')'; return; }
      if(t === 'SPAN' && TAGS[n.className]){ out += TAGS[n.className]; return; }
      if(t === 'STRONG' && n.classList.contains('motto')){ out += inner.trim() ? '!!' + inner + '!!' : ''; return; }
      if(t === 'B' || t === 'STRONG'){ out += inner.trim() ? '**' + inner + '**' : inner; return; }
      if(t === 'I' || t === 'EM'){ out += inner.trim() ? '*' + inner + '*' : inner; return; }
      out += inner;
    });
    return out;
  }
  function clean(s){ return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\*\*\*\*/g, '').trim(); }
  function mdOf(e){ return clean(toMd(e)); }
  function textOf(e){ var c = e.cloneNode(true); c.querySelectorAll(SKIP).forEach(function(x){ x.remove(); }); return clean(c.textContent); }

  /* ---------- which text can be edited ---------- */
  var CAND = 'h1,h2,h3,h4,p,li,figcaption,td,th,dd,dt,blockquote,.watch-out';
  var NOT = '.kicker,.tpill,.em-bar,.em-panel,.em-flag,.em-toast,.lessonbar,nav,.mascot,.act-body,.act-start,.act-foot,.act-head,.act-tools,.source,.vid,.audio-line,.infopic figcaption,.t-head,.gpop,.big,.lock-screen,.pv-panel,.present-panel,footer';
  var items = [], byKey = {};
  function where(e){ var a = e.closest('[id]'); return a ? a.id : ''; }
  function sectionOf(e){ var s = e.closest('section[id], .slide[id]'); return s ? s.id : ''; }
  function labelOf(e){ var r = e.querySelector('.ref'); if(r) return r.textContent.trim(); var s = e.closest('[data-ref]'); return s ? s.getAttribute('data-ref') : ''; }
  function scan(){
    document.querySelectorAll(CAND).forEach(function(e){
      if(e.hasAttribute('data-em') || e.closest(NOT)) return;
      if(e.querySelector(CAND)) return;                 /* only the innermost text blocks */
      if(!textOf(e)) return;
      e.setAttribute('data-em', '');
      var it = { e: e, html: e.innerHTML, md: mdOf(e), text: textOf(e) };
      it.key = (where(e) || 'top') + '|' + it.md;
      items.push(it); byKey[it.key] = it;
      e.querySelectorAll(SKIP).forEach(function(x){ x.setAttribute('contenteditable', 'false'); });
    });
  }

  /* ---------- draft (kept on this computer until saved) ---------- */
  var draft = jget(K_DRAFT, {});    /* key -> { where, section, label, beforeMd, afterMd, beforeText, afterText, afterHtml } */
  function changedCount(){ return Object.keys(draft).length; }
  function record(it){
    var now = mdOf(it.e);
    if(now === it.md){ delete draft[it.key]; it.e.classList.remove('em-changed'); }
    else {
      draft[it.key] = { where: where(it.e), section: sectionOf(it.e), label: labelOf(it.e), tag: it.e.tagName.toLowerCase(), cls: it.e.className.replace(/\s*em-changed/, ''),
        beforeMd: it.md, afterMd: now, beforeText: it.text, afterText: textOf(it.e), afterHtml: it.e.innerHTML };
      it.e.classList.add('em-changed');
    }
    jset(K_DRAFT, draft); updateBar();
  }
  function restoreDraft(){
    Object.keys(draft).forEach(function(k){
      var it = byKey[k];
      if(it){ it.e.innerHTML = draft[k].afterHtml; it.e.classList.add('em-changed'); }
    });
  }

  /* ---------- edit on / off ---------- */
  var editBtn = el('button', 'tp-edit', 'Edit'); editBtn.type = 'button'; editBtn.title = 'Change the words on this page';
  var out = pill.querySelector('.tp-out'); pill.insertBefore(editBtn, out || null);
  var bar = el('div', 'em-bar'); bar.hidden = true;
  var cnt = el('span', 'em-count', 'Click any text to change it');
  var undo = el('button', 'em-undo', 'Undo all'); undo.type = 'button';
  var save = el('button', 'em-save', 'Save to build folder'); save.type = 'button';
  var done = el('button', 'em-done', 'Done'); done.type = 'button';
  bar.append(cnt, undo, save, done); document.body.appendChild(bar);
  var on = false;
  function updateBar(){
    var n = changedCount();
    cnt.textContent = n ? n + (n === 1 ? ' change not saved yet' : ' changes not saved yet') : 'Click any text to change it';
    save.disabled = !n; undo.disabled = !n;
  }
  function setOn(v){
    on = !!v;
    if(on){ scan(); restoreDraft(); }
    document.body.classList.toggle('em-on', on);
    items.forEach(function(it){ if(on) it.e.setAttribute('contenteditable', 'true'); else it.e.removeAttribute('contenteditable'); });
    editBtn.classList.toggle('on', on); editBtn.textContent = on ? 'Editing' : 'Edit';
    bar.hidden = !on; updateBar();
  }
  editBtn.addEventListener('click', function(){ setOn(!on); });
  done.addEventListener('click', function(){
    if(changedCount()) toast('Your changes stay on this computer until you press Save to build folder.', 4500);
    setOn(false);
  });
  undo.addEventListener('click', function(){
    if(!confirm('Undo all ' + changedCount() + ' unsaved changes on this page?')) return;
    items.forEach(function(it){ if(draft[it.key]){ it.e.innerHTML = it.html; it.e.classList.remove('em-changed'); } });
    draft = {}; jset(K_DRAFT, draft); updateBar();
  });

  /* typing rules while editing */
  document.addEventListener('keydown', function(e){
    if(!on || !e.target.closest || !e.target.closest('[data-em]')) return;
    if(e.key === 'Enter'){ e.preventDefault(); e.target.closest('[data-em]').blur(); }
    if(e.key === 'Escape'){ e.stopPropagation(); e.target.closest('[data-em]').blur(); }
  }, true);
  document.addEventListener('paste', function(e){
    if(!on || !e.target.closest || !e.target.closest('[data-em]')) return;
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, t);
  }, true);
  document.addEventListener('click', function(e){
    if(!on) return;
    var a = e.target.closest && e.target.closest('[data-em] a, [data-em] .info-svg');
    if(a){ e.preventDefault(); e.stopPropagation(); }   /* links and glossary pop-ups wait while editing */
  }, true);
  document.addEventListener('focusout', function(e){
    if(!on || !e.target.hasAttribute || !e.target.hasAttribute('data-em')) return;
    var it = items.filter(function(x){ return x.e === e.target; })[0]; if(it) record(it);
  });
  document.addEventListener('input', function(e){
    if(!on || !e.target.hasAttribute || !e.target.hasAttribute('data-em')) return;
    var it = items.filter(function(x){ return x.e === e.target; })[0]; if(it) record(it);
  });

  /* ---------- the build folder (File System Access, Chrome and Edge) ---------- */
  var DB = 'a3-editmode', ST = 'handles';
  function idb(){ return new Promise(function(res, rej){ var r = indexedDB.open(DB, 1); r.onupgradeneeded = function(){ r.result.createObjectStore(ST); }; r.onsuccess = function(){ res(r.result); }; r.onerror = function(){ rej(r.error); }; }); }
  function hget(k){ return idb().then(function(db){ return new Promise(function(res){ var q = db.transaction(ST).objectStore(ST).get(k); q.onsuccess = function(){ res(q.result || null); }; q.onerror = function(){ res(null); }; }); }).catch(function(){ return null; }); }
  function hset(k, v){ return idb().then(function(db){ return new Promise(function(res){ var t = db.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = function(){ res(); }; t.onerror = function(){ res(); }; }); }).catch(function(){}); }
  var canFS = typeof window.showDirectoryPicker === 'function';

  function sub(dir, name, create){ return dir.getDirectoryHandle(name, { create: !!create }); }
  /* from whatever folder Adrie picked, find <unit>\_build */
  function buildDirFrom(root){
    if(root.name === '_build') return Promise.resolve(root);
    if(root.name === UNIT) return sub(root, '_build');
    return sub(root, UNIT).then(function(u){ return sub(u, '_build'); }, function(){
      return sub(root, 'lessons').then(function(l){ return sub(l, UNIT); }).then(function(u){ return sub(u, '_build'); });
    });
  }
  function perm(h, ask){
    var o = { mode: 'readwrite' };
    return h.queryPermission(o).then(function(p){ return p === 'granted' ? true : (ask ? h.requestPermission(o).then(function(q){ return q === 'granted'; }) : false); });
  }
  /* returns the _build\edits folder, or null. ask = may show a prompt or the folder picker (needs a click). */
  function editsDir(ask){
    if(!canFS) return Promise.resolve(null);
    return hget('unit:' + UNIT).then(function(h){ return h || hget('root'); }).then(function(h){
      if(h) return perm(h, ask).then(function(ok){ return ok ? buildDirFrom(h).catch(function(){ return null; }) : null; });
      return null;
    }).then(function(b){
      if(b || !ask) return b;
      alert('Pick your "lessons" folder (OneDrive > AI Projects > Swayreplacements > lessons).\nThe page remembers it for every unit.');
      return window.showDirectoryPicker({ id: 'a3-lessons', mode: 'readwrite' }).then(function(h){
        return buildDirFrom(h).then(function(b2){
          return hset((h.name === UNIT || h.name === '_build') ? 'unit:' + UNIT : 'root', h).then(function(){ return b2; });
        }, function(){ alert('That folder does not have the ' + UNIT + ' unit in it. Pick the "lessons" folder.'); return null; });
      }, function(){ return null; });
    }).then(function(b){ return b ? sub(b, 'edits', true) : null; });
  }
  function listPending(dir){
    var names = [];
    var it = dir.values ? dir.values() : dir.entries();
    function step(){ return it.next().then(function(r){
      if(r.done) return names.sort();
      var h = Array.isArray(r.value) ? r.value[1] : r.value;
      if(h.kind === 'file' && /\.json$/i.test(h.name)) names.push(h.name);
      return step();
    }); }
    return step();
  }

  function stamp(){ var d = new Date(), p = function(n){ return String(n).padStart(2, '0'); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
  save.addEventListener('click', function(){
    if(document.activeElement && document.activeElement.hasAttribute && document.activeElement.hasAttribute('data-em')) document.activeElement.blur();
    var keys = Object.keys(draft); if(!keys.length) return;
    var name = 'edit-' + PAGE.replace(/\.html$/, '') + '-' + stamp() + '.json';
    var data = { version: 1, unit: UNIT, page: PAGE, saved: new Date().toISOString(),
      changes: keys.map(function(k){ var c = draft[k]; return { where: c.where, section: c.section, label: c.label, tag: c.tag, cls: c.cls, beforeMd: c.beforeMd, afterMd: c.afterMd, beforeText: c.beforeText, afterText: c.afterText }; }) };
    var text = JSON.stringify(data, null, 2);
    function saved(how){
      draft = {}; jset(K_DRAFT, draft);
      items.forEach(function(it){ it.html = it.e.innerHTML; it.md = mdOf(it.e); it.text = textOf(it.e); it.e.classList.remove('em-changed'); });
      byKey = {}; items.forEach(function(it){ it.key = (where(it.e) || 'top') + '|' + it.md; byKey[it.key] = it; });
      var p = jget(K_PEND, []); if(p.indexOf(name) < 0) p.push(name); jset(K_PEND, p);
      updateBar(); refreshFlag(false);
      toast(how, 5000);
    }
    editsDir(true).then(function(dir){
      if(!dir) throw new Error('nodir');
      return dir.getFileHandle(name, { create: true }).then(function(fh){ return fh.createWritable(); })
        .then(function(w){ return w.write(text).then(function(){ return w.close(); }); })
        .then(function(){ saved('Saved to ' + UNIT + '\\_build\\edits\\' + name); });
    }).catch(function(){
      /* no folder access (Firefox, Safari, Nearpod frame, or cancelled): normal download */
      var a = el('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      saved('Downloaded ' + name + '. Move it to lessons\\' + UNIT + '\\_build\\edits\\');
    });
  });

  /* ---------- the "changes waiting" flag ---------- */
  var flag = el('button', 'em-flag'); flag.type = 'button'; flag.hidden = true; document.body.appendChild(flag);
  var panel = el('div', 'em-panel'); panel.hidden = true; document.body.appendChild(panel);
  var known = null;   /* list read from the folder, or null when the folder could not be read */
  function pendingNames(){ return known || jget(K_PEND, []); }
  function drawFlag(){
    var n = pendingNames().length;
    flag.hidden = !(n && teacherOn());
    flag.textContent = '\u270E ' + n + (n === 1 ? ' change file waiting' : ' change files waiting');
    if(!n) panel.hidden = true;
  }
  function refreshFlag(ask){
    return editsDir(ask).then(function(dir){
      if(!dir){ known = null; drawFlag(); return; }
      return listPending(dir).then(function(names){ known = names; jset(K_PEND, names); drawFlag(); });
    }).catch(function(){ known = null; drawFlag(); });
  }
  function claudePrompt(names){
    return 'Please apply my lesson page edits for ' + UNIT + '. The change files are in Swayreplacements\\lessons\\' + UNIT +
      '\\_build\\edits (' + names.join(', ') + '). Use _template\\edits\\apply-edits.js, then rebuild the pages, lock them and upload the changed pages to GitHub.';
  }
  function openPanel(){
    var names = pendingNames();
    panel.innerHTML = '';
    panel.append(el('h4', null, 'Changes waiting for ' + UNIT.toUpperCase()));
    var ul = el('ul'); names.forEach(function(n){ ul.append(el('li', null, n)); }); panel.append(ul);
    var row = el('div', 'em-row');
    var go = el('button', 'em-go', 'Ask Claude to apply'); go.type = 'button';
    var chk = el('button', null, 'Check again'); chk.type = 'button';
    var cls = el('button', null, 'Close'); cls.type = 'button';
    row.append(go, chk, cls); panel.append(row);
    var msg = el('p', 'em-msg', known ? 'Read from your build folder.' : 'Not checked in the folder yet. Press Check again.');
    panel.append(msg);
    go.addEventListener('click', function(){
      var p = claudePrompt(pendingNames());
      var copy = navigator.clipboard ? navigator.clipboard.writeText(p).catch(function(){}) : Promise.resolve();
      copy.then(function(){ window.open('https://claude.ai/new?q=' + encodeURIComponent(p), '_blank', 'noopener'); });
      msg.textContent = 'Claude opened in a new tab with the request ready. Press Enter to send it. (The request is also copied, so you can paste it.)';
    });
    chk.addEventListener('click', function(){ refreshFlag(true).then(function(){ if(pendingNames().length) openPanel(); else toast('No changes waiting. Everything has been applied.'); }); });
    cls.addEventListener('click', function(){ panel.hidden = true; });
    panel.hidden = false;
  }
  flag.addEventListener('click', function(){ if(panel.hidden) openPanel(); else panel.hidden = true; });

  /* show the flag only while the teacher pill is showing */
  new MutationObserver(function(){ drawFlag(); if(!teacherOn() && on) setOn(false); }).observe(pill, { attributes: true, attributeFilter: ['hidden'] });
  refreshFlag(false);   /* edit mode always starts off, so a page on the projector never shows the edit outlines */
})();
