/* Tanıtım sitesi hareket katmanı. Kütüphanesiz (IntersectionObserver + Web Animations API).
   HAREKET.kur(kök) her sayfa çiziminden sonra çağrılır. Hareket azaltılmışsa döngü ve bölme işleri çalışmaz; içerik zaten tam görünür. */
window.HAREKET = (function () {
  // Gizli başlangıç durumları yalnız bu sınıf varken uygulanır; betik yüklenmezse içerik görünür kalır
  document.documentElement.classList.add('js-hareket');
  const az = matchMedia('(prefers-reduced-motion: reduce)');
  const EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
  let dongu = null;
  let gozcu = null;

  function kur(kok) {
    document.documentElement.classList.remove('hareket-durdu');
    if (dongu) { dongu.dur(); dongu = null; }
    if (gozcu) { gozcu.disconnect(); gozcu = null; }

    kok.querySelectorAll('[data-yuk]').forEach((el, i) => (el.style.animationDelay = `${360 + i * 90}ms`));
    kok.querySelectorAll('[data-anim="satirlar"]').forEach((l) => [...l.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8))));
    kok.querySelectorAll('[data-anim="dusme"] .takvim__olay').forEach((o) => o.style.setProperty('--d', `${Math.round((parseFloat(o.style.top) || 0) * 1.3)}ms`));
    rakamlar(kok);
    murekkep(kok);
    const zamanCizelgesi = CSS.supports('animation-timeline: view()');
    if (!zamanCizelgesi && !az.matches) geriCekilYedek(kok);

    const hedefler = [...kok.querySelectorAll('[data-anim], .roll, .is-filling')].filter((e) => !e.closest('.hikaye__sahne'));
    if (!zamanCizelgesi) kok.querySelectorAll('.kapanis').forEach((k) => hedefler.push(k));
    if (!('IntersectionObserver' in window)) hedefler.forEach((e) => e.classList.add('is-in'));
    else {
      gozcu = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add(e.target.classList.contains('kapanis') ? 'is-in-yedek' : 'is-in'); gozcu.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
      hedefler.forEach((e) => gozcu.observe(e));
    }
    hikaye(kok);
    sektor(kok);
    const parca = kok.querySelector('#hero-parca');
    if (parca && !az.matches && 'animate' in Element.prototype) dongu = heroDongu(parca);
  }

  // Rakam sütunları: değer metinde kalır (ekran okuyucu), görünen kopya yuvarlanır
  function rakamlar(kok) {
    kok.querySelectorAll('[data-roll]:not(.roll)').forEach((el) => {
      const deger = el.textContent.trim();
      const soz = Object.assign(document.createElement('span'), { className: 'gizli-metin', textContent: deger });
      const gor = Object.assign(document.createElement('span'), { className: 'roll__digits' });
      gor.setAttribute('aria-hidden', 'true');
      let i = 0;
      for (const ch of deger) {
        if (!/\d/.test(ch)) { gor.append(ch); continue; }
        const col = Object.assign(document.createElement('span'), { className: 'roll__col' });
        const serit = Object.assign(document.createElement('span'), { className: 'roll__strip' });
        serit.style.setProperty('--d', ch); serit.style.setProperty('--i', i++);
        for (let n = 0; n < 10; n++) serit.append(Object.assign(document.createElement('span'), { textContent: n }));
        col.append(serit); gor.append(col);
      }
      el.classList.add('roll');
      el.replaceChildren(soz, gor);
    });
  }

  // Beyan: kelimeler okunur tonla başlar, kaydırdıkça (ya da görününce) tam mürekkebe dolar. Metin gerçek metin olarak kalır.
  function murekkep(kok) {
    if (az.matches) return;
    kok.querySelectorAll('[data-fill]:not(.is-filling)').forEach((el) => {
      const kelimeler = el.textContent.trim().split(/\s+/);
      el.textContent = '';
      kelimeler.forEach((k, i) => { const s = document.createElement('span'); s.textContent = k; s.style.setProperty('--w', i); el.append(s, i < kelimeler.length - 1 ? ' ' : ''); });
      el.classList.add('is-filling');
    });
  }

  // Scroll timeline olmayan tarayıcıda hero sahnesinin geri çekilmesi (yalnız transform, rAF ile)
  let kaydirDinleyici = null;
  function geriCekilYedek(kok) {
    if (kaydirDinleyici) removeEventListener('scroll', kaydirDinleyici);
    const hero = kok.querySelector('.hero'); const sahne = hero && hero.querySelector('.sahne');
    if (!sahne) return;
    let bekliyor = false;
    kaydirDinleyici = () => { if (bekliyor) return; bekliyor = true; requestAnimationFrame(() => { bekliyor = false; const r = hero.getBoundingClientRect(); const p = Math.min(1, Math.max(0, -r.top / r.height)); sahne.style.transform = p ? `translateY(${(p * 5).toFixed(2)}%) scale(${(1 - p * 0.03).toFixed(4)})` : ''; }); };
    addEventListener('scroll', kaydirDinleyici, { passive: true });
  }

  // Hikâye: ekranın ortasındaki adım yapışkan telefondaki ekranı seçer
  function hikaye(kok) {
    const k = kok.querySelector('.hikaye');
    if (!k || !('IntersectionObserver' in window)) return;
    const adimlar = [...k.querySelectorAll('.adim')];
    const ekranlar = [...k.querySelectorAll('.hikaye__sahne .ek')];
    const sayac = k.querySelector('[data-sayac]');
    const goster = (i) => {
      adimlar.forEach((a, j) => a.classList.toggle('is-active', j === i));
      ekranlar.forEach((e, j) => {
        const on = j === i; const onceki = e.classList.contains('is-on');
        e.classList.toggle('is-on', on);
        if (on && !onceki) e.querySelectorAll('.roll').forEach((r) => { r.classList.remove('is-in'); requestAnimationFrame(() => requestAnimationFrame(() => r.classList.add('is-in'))); });
      });
      if (sayac) sayac.textContent = `${adimlar.length} adımdan ${i + 1}`;
    };
    const g = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) goster(adimlar.indexOf(e.target)); }), { rootMargin: '-45% 0px -45% 0px' });
    adimlar.forEach((a) => g.observe(a));
    goster(0);
  }

  // Sektör sekmeleri: alt çizgi seçili sekmeye kayar (sekme mantığı prototip.js'te)
  function sektor(kok) {
    const s = kok.querySelector('.sektor');
    if (!s) return;
    const iz = s.querySelector('.sektor__iz');
    const yer = () => { const t = s.querySelector('[role="tab"][aria-selected="true"]'); if (t) iz.style.transform = `translateX(${t.offsetLeft}px) scaleX(${t.offsetWidth / 100})`; };
    s.addEventListener('click', () => requestAnimationFrame(yer));
    s.addEventListener('keydown', () => requestAnimationFrame(yer));
    addEventListener('resize', yer);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(yer);
  }

  // Hero döngüsü: şimdi çizgisi ilerler, Elif'in boş saatine dokunulur, randevu dolar, bildirim gelir; ekran dışındayken durur
  function heroDongu(parca) {
    const izler = [...parca.querySelectorAll('.doluluk__iz')];
    const iz = izler[1];
    const kutu = parca.querySelector('.parca');
    if (!iz || !kutu) return null;
    const y = (dk) => ((dk - 540) / 660) * 100;
    const simdi = izler.map((i) => i.querySelector('.doluluk__simdi')).filter(Boolean);
    const blok = document.createElement('span');
    blok.className = 'doluluk__blok';
    blok.style.cssText = `left:${y(975)}%;width:${(45 / 660) * 100}%;transform:scaleX(0);transform-origin:left;`;
    const dok = document.createElement('span');
    dok.className = 'dokunus';
    dok.style.left = `${y(997)}%`;
    iz.append(blok, dok);
    const bil = document.createElement('div');
    bil.className = 'parca-bildirim';
    bil.setAttribute('aria-hidden', 'true');
    bil.innerHTML = `${P.ikon('tamamDaire', 'ikon--16')}<span>Randevu oluşturuldu · Elif, 16:15</span>`;
    kutu.append(bil);

    let calis = true, gorunur = true, durdu = false;
    const bekleyenler = new Set(); // { t, red }
    // Bekleme durdurulunca hemen reddedilir: tur catch'e düşer, sıfırlanır ve "başlat"la yeniden döner
    const bekle = (ms) => new Promise((r, red) => { const k = { red }; k.t = setTimeout(() => { bekleyenler.delete(k); (durdu || !calis) ? red(0) : r(); }, ms); bekleyenler.add(k); });
    const kes = () => { bekleyenler.forEach((k) => { clearTimeout(k.t); k.red(0); }); bekleyenler.clear(); };
    // WCAG 2.2.2: 5 sn'den uzun otomatik hareket durdurulabilir. Durum değişen etiketle verilir (aria-pressed yok).
    const dd = document.querySelector('[data-hero-durdur]');
    // A2: aynı düğme ışık lekelerini ve yüzen parçaları da durdurur (html.hareket-durdu, tanitim-derinlik.css)
    if (dd) { dd.hidden = false; dd.onclick = () => { durdu = !durdu; document.documentElement.classList.toggle('hareket-durdu', durdu); dd.textContent = durdu ? 'Hareketi başlat' : 'Hareketi durdur'; if (durdu) { kes(); sifirla(); } }; }
    const sifirla = () => [blok, dok, bil, ...simdi].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
    const g = new IntersectionObserver((es) => { gorunur = es[0].isIntersecting; }, { threshold: 0.2 });
    g.observe(parca);
    const dinlen = (ms) => new Promise((r) => setTimeout(r, ms));
    (async function tur() {
      await dinlen(1400);
      while (calis) {
        if (!gorunur || document.hidden || durdu) { await dinlen(500); continue; }
        try {
        simdi.forEach((s) => s.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${s.parentElement.clientWidth * 0.045}px)` }], { duration: 9000, easing: 'linear', fill: 'forwards' }));
        await bekle(1500);
        dok.animate([{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 380, easing: EXPO, fill: 'forwards' });
        await bekle(420);
        dok.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: 260, composite: 'add' });
        await bekle(200);
        blok.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 750, easing: EXPO, fill: 'forwards' });
        dok.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 350, fill: 'forwards' });
        await bekle(520);
        bil.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: EXPO, fill: 'forwards' });
        await bekle(3200);
        bil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
        await bekle(1400);
        blok.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' });
        await bekle(900);
        sifirla();
        await bekle(300);
        } catch (e) { sifirla(); }
      }
    })();
    return { dur() { calis = false; kes(); g.disconnect(); sifirla(); } };
  }

  return { kur, dur() { document.documentElement.classList.add('hareket-durdu'); if (dongu) { dongu.dur(); dongu = null; } const d = document.querySelector('[data-hero-durdur]'); if (d) d.hidden = true; } };
})();
