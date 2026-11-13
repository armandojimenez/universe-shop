// The landing's shop: a wallet balance, a Cosmic Bag and a certificate of ownership, all
// with simulated money, the way the app does it. State stays in this browser and follows
// the visitor across the language pages. Every word shown comes from the page's own data
// (window.SHOP), which the build fills from the app's strings.
(function () {
  'use strict';
  var S = window.SHOP;
  if (!S) return;
  var KEY = 'universe-shop-landing';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ── State ──────────────────────────────────────────────────────────────────────
  // Money arrives while you sleep: on a new day the balance is whole again and the
  // allowance is waiting. The bag keeps what was put in it.
  var today = new Date().toISOString().slice(0, 10);
  var state = { day: today, balance: S.balance, bag: [], claimed: false };
  try {
    var saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved.balance === 'number' && Array.isArray(saved.bag)) {
      state.bag = saved.bag.filter(function (id) { return S.items[id]; });
      if (saved.day === today) {
        state.balance = Math.max(0, saved.balance);
        state.claimed = !!saved.claimed;
      }
    }
  } catch (e) {}
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  // ── Money, written the way the app writes it in this language ────────────────
  function money(n) {
    var digits = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, S.money.group);
    return S.money.pre + digits + S.money.post;
  }
  function fill(text, vars) { return text.replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }); }
  var shown = state.balance;
  var raf = 0;
  function paintBalance(n) { $$('[data-balance]').forEach(function (el) { el.textContent = money(n); }); }
  function setBalance(to) {
    state.balance = to;
    save();
    cancelAnimationFrame(raf);
    if (reduced) { shown = to; paintBalance(to); return; }
    var from = shown, start = performance.now(), ms = 900;
    (function tick(now) {
      var t = Math.min(1, (now - start) / ms);
      shown = from + (to - from) * (1 - Math.pow(1 - t, 3));
      paintBalance(shown);
      if (t < 1) raf = requestAnimationFrame(tick); else shown = to;
    })(start);
  }
  function total() { return state.bag.reduce(function (sum, id) { return sum + S.items[id].usd; }, 0); }

  // ── Toast ──────────────────────────────────────────────────────────────────────
  var toast = $('[data-toast]'), toastTimer = 0;
  function say(text) {
    if (!toast) return;
    toast.innerHTML = '<i></i>';
    toast.appendChild(document.createTextNode(text));
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2600);
  }

  // ── The bag ────────────────────────────────────────────────────────────────────
  var dialog = $('#bag');
  var bagButton = $('[data-bag-open]');
  var count = $('[data-bag-count]');
  var CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function paintShelf() {
    $$('[data-add]').forEach(function (btn) {
      var inBag = state.bag.indexOf(btn.getAttribute('data-add')) !== -1;
      btn.classList.toggle('is-in', inBag);
      btn.textContent = inBag ? S.t.view : S.t.add;
    });
    if (count) { count.hidden = state.bag.length === 0; count.textContent = String(state.bag.length); }
  }
  function view(name) {
    $$('.bag__view', dialog).forEach(function (el) { el.hidden = el.getAttribute('data-view') !== name; });
  }
  function paintBag() {
    var empty = state.bag.length === 0;
    $('[data-empty]', dialog).hidden = !empty;
    $('[data-full]', dialog).hidden = empty;
    if (empty) return;
    var list = $('[data-items]', dialog);
    list.textContent = '';
    state.bag.forEach(function (id) {
      var it = S.items[id];
      var li = document.createElement('li');
      var img = document.createElement('img');
      img.src = it.img; img.alt = ''; img.width = 92; img.height = 61;
      var text = document.createElement('div');
      var name = document.createElement('b'); name.textContent = it.title;
      var price = document.createElement('bdi'); price.textContent = money(it.usd);
      text.appendChild(name); text.appendChild(price);
      var remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'bag__remove';
      remove.setAttribute('aria-label', fill(S.t.remove, { title: it.title }));
      remove.innerHTML = CROSS;
      remove.addEventListener('click', function () {
        state.bag = state.bag.filter(function (x) { return x !== id; });
        save(); paintShelf(); paintBag();
        ($('.bag__remove', dialog) || $('[data-bag-start]', dialog)).focus();
      });
      li.appendChild(img); li.appendChild(text); li.appendChild(remove);
      list.appendChild(li);
    });
    var sum = total(), short = Math.max(0, sum - state.balance);
    $('[data-total]', dialog).textContent = money(sum);
    $('[data-available]', dialog).textContent = money(state.balance);
    $('[data-provision-row]', dialog).hidden = short === 0;
    $('[data-provision-help]', dialog).hidden = short === 0;
    $('[data-provision]', dialog).textContent = money(short);
    $('[data-place]', dialog).textContent = fill(S.t.place, { amount: money(sum) });
  }
  function openBag() {
    view('bag');
    paintBag();
    if (!dialog.open) dialog.showModal();
  }
  function closeBag() { if (dialog.open) dialog.close(); }

  function add(id, from) {
    if (state.bag.indexOf(id) !== -1) { openBag(); return; }
    state.bag.push(id);
    save(); paintShelf();
    say(S.t.added);
    if (bagButton && !reduced) {
      bagButton.classList.remove('is-bump');
      void bagButton.offsetWidth;
      bagButton.classList.add('is-bump');
    }
    if (from) from.focus();
  }

  function place() {
    if (state.bag.length === 0) return;
    var bought = state.bag.map(function (id) { return S.items[id]; });
    var sum = total();
    var items = $('[data-cert-items]', dialog);
    items.textContent = '';
    bought.forEach(function (it) { var line = document.createElement('span'); line.textContent = it.title; items.appendChild(line); });
    var date = $('[data-cert-date]', dialog), now = new Date();
    var tag = S.lang === 'ar' ? 'ar-u-nu-latn' : S.lang;
    try { date.textContent = new Intl.DateTimeFormat(tag, { dateStyle: 'long' }).format(now); } catch (e) { date.textContent = now.toLocaleDateString(); }
    date.setAttribute('datetime', now.toISOString().slice(0, 10));
    $('[data-cert-say]', dialog).textContent = bought[bought.length - 1].say;
    state.bag = [];
    paintShelf();
    setBalance(Math.max(0, state.balance - sum));
    view('certificate');
    dialog.scrollTop = 0;
    var cert = $('[data-cert]', dialog);
    if (cert) cert.focus({ preventScroll: true });
  }

  if (dialog) {
    if (bagButton) bagButton.addEventListener('click', openBag);
    $$('[data-add]').forEach(function (btn) { btn.addEventListener('click', function () { add(btn.getAttribute('data-add'), btn); }); });
    $$('[data-bag-close]', dialog).forEach(function (btn) { btn.addEventListener('click', closeBag); });
    $$('[data-bag-start]', dialog).forEach(function (btn) {
      btn.addEventListener('click', function () {
        closeBag();
        var shelf = document.getElementById('shop');
        if (shelf) shelf.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      });
    });
    $('[data-place]', dialog).addEventListener('click', place);
    // A click on the dimmed page behind the drawer closes it.
    dialog.addEventListener('click', function (ev) { if (ev.target === dialog) closeBag(); });
  }

  // ── The morning allowance ──────────────────────────────────────────────────────
  var claim = $('[data-claim]'), note = $('[data-claim-note] span');
  function paintClaim() {
    if (!claim || !state.claimed) return;
    claim.disabled = true;
    claim.textContent = S.t.claimed;
    if (note) note.textContent = fill(S.t.received, { amount: money(S.claim.amount) });
  }
  if (claim) {
    claim.addEventListener('click', function () {
      if (state.claimed) return;
      state.claimed = true;
      setBalance(state.balance + S.claim.amount);
      paintClaim();
    });
  }

  // ── Language menu: closes on Escape and on a click elsewhere ───────────────────
  var lang = $('.lang');
  if (lang) {
    document.addEventListener('click', function (ev) { if (lang.open && !lang.contains(ev.target)) lang.open = false; });
    lang.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && lang.open) { lang.open = false; $('summary', lang).focus(); } });
  }

  paintBalance(state.balance);
  paintShelf();
  paintClaim();
  document.documentElement.classList.add('shop');
})();
