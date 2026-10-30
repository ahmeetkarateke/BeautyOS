/* BeautyOS salon paneli prototipi — kabuk, yönlendirme, Bugün, Günüm, Takvim, randevu akışları.
   Diğer ekranlar panel-ek.js'te. Ekran kimlikleri ve durum metinleri docs/tasarim.md §8 ile aynıdır. */
(function () {
  const V = window.VERI, ik = P.ikon, para = P.para;
  const E = {};          // ekran kayıtları: E[ad] = (arg) => ({ baslik, html, sonra })
  const EYLEM = {};      // data-eylem işleyicileri
  const D = P.durum;
  const per = (id) => V.PERSONEL.find((p) => p.id === id);
  const hiz = (id) => V.HIZMETLER.find((h) => h.id === id);
  const rnd = (id) => V.RANDEVULAR.find((r) => r.id === id);
  const benim = () => P.kisi();
  const ad = (s) => s; // yer tutucu: üretimde metin kaynağı

  // ---------------- Menü (rol filtreli; docs/tasarim.md §5) ----------------
  const MENU = [
    { grup: null, ogeler: [
      { id: 'bugun', ad: 'Bugün', ikon: 'bugun', y: 'bugun' },
      { id: 'gunum', ad: 'Günüm', ikon: 'bugun', y: 'gunum' },
      { id: 'takvim', ad: () => (P.rol === 'personel' ? 'Takvimim' : 'Takvim'), ikon: 'takvim', y: 'takvim' },
      { id: 'musteriler', ad: () => (P.rol === 'personel' ? P.T('kisilerim') : P.T('kisiler')), ikon: 'musteri', y: 'musteriler' },
      { id: 'bekleme', ad: 'Bekleme listesi', ikon: 'saat', y: 'bekleme', sayac: () => V.BEKLEME.filter((b) => b.durum === 'bekliyor').length },
      { id: 'kasa', ad: 'Kasa', ikon: 'kasa', y: 'kasa' },
    ] },
    { grup: 'Hizmet ve personel', ogeler: [
      { id: 'hizmetler', ad: P.T('hizmetler'), ikon: 'hizmet', y: 'hizmetler' },
      { id: 'personel', ad: 'Personel', ikon: 'personel', y: 'personel' },
      { id: 'primim', ad: 'Primim', ikon: 'prim', y: 'primim' },
      { id: 'asistan', ad: 'Mesaj asistanı', ikon: 'sohbet', y: 'ayar-asistan' },
    ] },
    { grup: 'Yönetim', acilir: true, ogeler: [
      { id: 'raporlar', ad: 'Raporlar', ikon: 'rapor', y: 'raporlar' },
      { id: 'hesaplar', ad: 'Hesaplar', ikon: 'hesap', y: 'yonetim' },
      { id: 'cari', ad: 'Cari hesap', ikon: 'cari', y: 'yonetim' },
      { id: 'faturalar', ad: 'Alış faturaları', ikon: 'fatura', y: 'yonetim' },
      { id: 'tedarikciler', ad: 'Tedarikçiler', ikon: 'kamyon', y: 'yonetim' },
      { id: 'stok', ad: 'Stok', ikon: 'kutu', y: 'yonetim', sayac: () => V.STOK.filter((s) => s.miktar <= s.kritik).length },
      { id: 'paketler', ad: 'Paketler', ikon: 'paket', y: 'yonetim' },
      { id: 'odemeler', ad: 'Personel ödemeleri', ikon: 'prim', y: 'yonetim' },
      { id: 'bahsis', ad: 'Bahşiş', ikon: 'bahsis', y: 'yonetim' },
    ] },
  ];
  const ADI = (o) => (typeof o.ad === 'function' ? o.ad() : o.ad);
  const anaEkran = () => (P.rol === 'personel' || P.rol === 'saglik' ? 'gunum' : 'bugun');

  function yanMenu(aktif) {
    const k = benim();
    const acik = localStorage.getItem('bos-yonetim-acik') !== '0';
    let h = P.marka('#' + anaEkran());
    h += `<button class="salon-secici" aria-label="Salon: ${V.SALON.ad}. Rolünüz: ${P.ROLLER[P.rol]}">
      <span class="avatar avatar--kucuk" style="background:var(--renk-birincil);color:#fff" aria-hidden="true">${V.SALON.ad.split(' ').slice(0, 2).map((x) => x[0]).join('')}</span>
      <span style="flex:1;min-width:0"><span class="salon-secici__ad" style="display:block">${V.SALON.ad}</span><span class="metin-kucuk metin-soluk">${P.ROLLER[P.rol]}</span></span></button>`;
    MENU.forEach((g) => {
      const ogeler = g.ogeler.filter((o) => P.yetki(o.y));
      if (!ogeler.length) return;
      if (g.grup) h += g.acilir
        ? `<button class="yan-menu__grup" aria-expanded="${acik}" data-eylem="grup-ac"><span>${g.grup}</span>${ik(acik ? 'asagi' : 'ileri', 'ikon--16')}</button>`
        : `<div class="yan-menu__grup" role="presentation">${g.grup}</div>`;
      const gizli = g.acilir && !acik;
      ogeler.forEach((o) => {
        const s = o.sayac ? o.sayac() : 0;
        h += `<a href="#${o.id}" ${o.id === aktif ? 'aria-current="page"' : ''} ${gizli ? 'hidden' : ''} data-grup="${g.grup || ''}">${ik(o.ikon)}<span>${ADI(o)}</span>${s ? `<span class="sayac" aria-label="${s} bekleyen">${s}</span>` : ''}</a>`;
      });
    });
    h += `<div class="yan-menu__alt">`;
    if (P.rol === 'sahip') h += `<a href="#ayarlar/abonelik" class="metin-14" style="background:var(--renk-yuzey);border:1px solid var(--renk-cizgi);min-height:auto;padding:10px;display:grid;gap:2px;margin-bottom:8px"><span class="metin-kucuk metin-soluk">Deneme süresi</span><span class="orta" style="color:var(--renk-metin)">${V.SALON.denemeKalanGun} gün kaldı · Planı gör</span></a>`;
    if (P.yetki('ayarlar')) h += `<a href="#ayarlar" ${aktif === 'ayarlar' ? 'aria-current="page"' : ''}>${ik('ayar')}<span>Ayarlar</span></a>`;
    else h += `<a href="#hesabim" ${aktif === 'hesabim' ? 'aria-current="page"' : ''}>${ik('personel')}<span>Hesabım</span></a>`;
    h += `<div class="kullanici">${P.avatar(k, 'avatar--kucuk')}<span style="flex:1;min-width:0"><span class="kullanici__ad" style="display:block">${k.ad}</span><span class="metin-kucuk metin-soluk">${k.unvan}</span></span><a href="giris.html#giris" class="dugme dugme--ikon" style="min-height:36px;width:36px;padding:0" aria-label="Çıkış yap">${ik('cikis')}</a></div></div>`;
    document.getElementById('yan-menu').innerHTML = h;
  }

  function ustBar(baslik, geri) {
    const k = benim();
    document.getElementById('ust-bar').innerHTML = geri
      ? `<a class="dugme dugme--ikon" href="${geri}" aria-label="Geri" style="margin-left:-12px">${ik('geri')}</a><span class="ust-bar__baslik">${baslik}</span><a class="dugme dugme--ikon" href="#hesabim" aria-label="Hesabım">${P.avatar(k, 'avatar--kucuk')}</a>`
      : `${P.isaret(26)}<span class="ust-bar__baslik" style="margin-left:8px">${V.SALON.ad}</span><a class="dugme dugme--ikon" href="#musteriler" aria-label="Müşteri ara">${ik('ara')}</a><a class="dugme dugme--ikon" href="#hesabim" aria-label="Hesabım">${P.avatar(k, 'avatar--kucuk')}</a>`;
  }

  function altMenu(aktif) {
    const p = P.rol === 'personel';
    const ogeler = [
      { id: anaEkran(), ad: p ? 'Günüm' : 'Bugün', ikon: 'bugun' },
      { id: 'takvim', ad: p ? 'Takvimim' : 'Takvim', ikon: 'takvim' },
      { arti: true },
      { id: 'musteriler', ad: p ? P.T('kisilerim') : P.T('kisiler'), ikon: 'musteri' },
      { id: 'menu', ad: 'Menü', ikon: 'menu' },
    ];
    document.getElementById('alt-menu').innerHTML = ogeler.map((o) => o.arti
      ? `<button class="alt-menu__arti" data-eylem="randevu-yeni" aria-label="Randevu oluştur" data-testid="alt-menu-randevu">${ik('arti', 'ikon--24')}</button>`
      : `<a href="#${o.id}" ${o.id === aktif || (o.id === 'menu' && !['bugun', 'gunum', 'takvim', 'musteriler'].includes(aktif)) ? 'aria-current="page"' : ''}>${ik(o.ikon, 'ikon--24')}<span>${o.ad}</span></a>`).join('');
  }

  // ---------------- Ortak durum blokları ----------------
  const H = {};
  H.hata = (ne, ek = '') => `<div class="kart hata-blok" role="alert" data-durum="hata">${ik('hata')}<div class="yigin yigin--8" style="gap:4px"><p class="kalin">${ne} yüklenemedi.</p><p class="metin-ikincil metin-14">Bağlantınızı kontrol edip tekrar deneyin.${ek}</p><div><button class="dugme dugme--ikincil dugme--kucuk" data-eylem="yeniden-dene">${ik('yenile', 'ikon--16')}Yeniden dene</button></div></div></div>`;
  H.bos = ({ ikon = 'liste', baslik, metin = '', eylem = '', eylemAd = '', orta = false }) => `<div class="bos ${orta ? 'bos--orta' : ''}" data-durum="bos"><span class="bos__ikon">${ik(ikon)}</span><p class="bos__baslik">${baslik}</p>${metin ? `<p class="bos__metin">${metin}</p>` : ''}${eylem ? `<button class="dugme dugme--birincil" data-eylem="${eylem}">${ik('arti')}${eylemAd}</button>` : ''}</div>`;
  H.iskeletSatir = (n = 4) => `<ul class="liste kart" aria-hidden="true" data-durum="yukleniyor">${Array.from({ length: n }, () => `<li><div class="satir"><span class="iskelet iskelet--yuvarlak" style="width:36px;height:36px"></span><span class="satir__ana" style="gap:6px">${P.iskelet('46%', 14)}${P.iskelet('30%', 12)}</span>${P.iskelet('56px', 14)}</div></li>`).join('')}</ul><p class="gizli-metin" role="status">Yükleniyor…</p>`;
  H.yetkisiz = () => `<div class="bos bos--orta kart" data-durum="yetkisiz" data-testid="yetkisiz"><span class="bos__ikon">${ik('kilit')}</span><h1 class="bos__baslik" style="font-size:var(--yazi-20)">Bu sayfayı görme yetkiniz yok.</h1><p class="bos__metin">${P.T('sahiptenIste')}</p><a class="dugme dugme--birincil" href="#${anaEkran()}">${P.rol === 'personel' ? 'Günüm’e dön' : 'Bugün’e dön'}</a></div>`;
  H.sayfaUst = (h1, alt = '', eylem = '') => `<div class="sayfa-ust"><div class="sayfa-ust__metin"><h1 class="baslik-sayfa" id="sayfa-basligi">${h1}</h1>${alt ? `<p class="metin-ikincil metin-14">${alt}</p>` : ''}</div>${eylem ? `<div class="sayfa-ust__eylem">${eylem}</div>` : ''}</div>`;
  H.kartBaslik = (b, sag = '') => `<div class="kart__baslik"><h2 class="baslik-bolum">${b}</h2>${sag}</div>`;
  H.dk = P.dk;

  // Randevu satırı (liste/çizelge)
  H.randevuKart = (r, { personelGoster = true } = {}) => {
    const p = per(r.p);
    return `<button class="randevu-kart kisi-${p.ton} ${r.durum === 'iptal' ? 'randevu-kart--iptal' : ''} ${r.durum === 'suruyor' ? 'randevu-kart--suruyor' : ''}" data-eylem="randevu-ac" data-id="${r.id}" data-testid="randevu-${r.id}">
      <span class="randevu-kart__serit" aria-hidden="true"></span>
      <span class="randevu-kart__ana"><span class="randevu-kart__saat">${r.bas} – ${r.bit}</span><span class="randevu-kart__musteri orta">${r.musteri}</span><span class="metin-14 metin-soluk">${r.hizmet}${personelGoster ? ` · ${p.kisa}` : ''}${r.kanal === 'online' ? ' · Online' : ''}</span></span>
      <span class="randevu-kart__sag">${P.durumEtiketi(r.durum)}${r.saglikNotu && P.yetki('saglik') && (P.rol !== 'personel' || r.p === benim().id) ? `<span class="metin-kucuk metin-soluk" title="Sağlık notu var">${ik('kalp', 'ikon--16')}</span>` : ''}</span>
    </button>`;
  };

  // ---------------- Doluluk şeridi (imza öğesi) ----------------
  const GUN_BAS = 540, GUN_SON = 1200, GUN_UZ = GUN_SON - GUN_BAS; // 09:00–20:00
  const yuzde = (dk) => ((dk - GUN_BAS) / GUN_UZ) * 100;
  function bosAraliklar(pid) {
    const s = P.dk(V.BUGUN.simdi);
    const rr = V.RANDEVULAR.filter((r) => r.p === pid && r.durum !== 'iptal' && r.durum !== 'gelmedi').sort((a, b) => P.dk(a.bas) - P.dk(b.bas));
    const mesgul = rr.find((r) => P.dk(r.bas) <= s && P.dk(r.bit) > s);
    if (mesgul) return { simdi: 'meşgul', bitis: mesgul.bit };
    const sonraki = rr.find((r) => P.dk(r.bas) > s);
    return { simdi: 'boş', kadar: sonraki ? sonraki.bas : '20:00' };
  }
  H.doluluk = (personeller) => {
    const s = yuzde(P.dk(V.BUGUN.simdi));
    const satirlar = personeller.map((p) => {
      const rr = V.RANDEVULAR.filter((r) => r.p === p.id && r.durum !== 'iptal');
      const b = bosAraliklar(p.id);
      return `<div class="doluluk__satir kisi-${p.ton}">
        <span class="doluluk__ad">${P.avatar(p, 'avatar--kucuk')}<span>${p.kisa}</span></span>
        <div class="doluluk__iz" data-eylem="serit-bos" data-p="${p.id}" role="group" aria-label="${p.ad}: ${b.simdi === 'boş' ? 'şu an boş, ' + P.kadar(b.kadar) : 'şu an meşgul, ' + P.kadar(b.bitis)}">
          ${rr.map((r) => `<button class="doluluk__blok ${r.durum === 'suruyor' ? 'doluluk__blok--suruyor' : ''} ${r.durum === 'bekliyor' ? 'doluluk__blok--bekliyor' : ''} ${['bitti', 'gelmedi'].includes(r.durum) ? 'doluluk__blok--bitti' : ''}" style="left:${yuzde(P.dk(r.bas))}%;width:${(r.sure / GUN_UZ) * 100}%" data-eylem="randevu-ac" data-id="${r.id}" aria-label="${r.bas} – ${r.bit}, ${r.musteri}, ${r.hizmet}, ${P.DURUM_ADI[r.durum]}" tabindex="-1"></button>`).join('')}
          <span class="doluluk__simdi" style="left:${s}%" aria-hidden="true"></span>
        </div></div>`;
    }).join('');
    return `<div class="doluluk" data-testid="doluluk-seridi">${satirlar}<div class="doluluk__eksen" aria-hidden="true"><span></span><div><span>09</span><span>12</span><span>15</span><span>18</span><span>20</span></div></div></div>`;
  };

  // ======================= EKRAN: Bugün =======================
  E.bugun = () => {
    const ust = H.sayfaUst('Bugün', `${V.BUGUN.okunur} · Saat ${V.BUGUN.simdi}`,
      `<button class="dugme dugme--ikincil masaustu" data-eylem="hizli-islem">Randevusuz işlem</button><button class="dugme dugme--birincil masaustu" data-eylem="randevu-yeni">${ik('arti')}Randevu oluştur</button>`);
    if (D === 'yukleniyor') return { html: ust + `<div class="yigin">${H.iskeletSatir(3)}${H.iskeletSatir(4)}</div>` };
    if (D === 'hata') return { html: ust + `<div class="yigin">${H.hata('Bugünün randevuları', ' Son başarılı yükleme: 14:12.')}<div class="kart">${H.kartBaslik('Kasa özeti')}<div class="kart__govde metin-ikincil metin-14">Randevular yüklenmeden kasa özeti gösterilmez. Sıfır gibi görünen tutarlar yanıltıcı olur.</div></div></div>` };
    if (D === 'bos') return { html: ust + ilkKurulum() };

    const O = V.OZET, K = V.KASA;
    const suruyor = V.RANDEVULAR.filter((r) => r.durum === 'suruyor');
    const s = P.dk(V.BUGUN.simdi);
    const siradaki = V.RANDEVULAR.filter((r) => ['onayli', 'bekliyor'].includes(r.durum) && P.dk(r.bas) >= s).sort((a, b) => P.dk(a.bas) - P.dk(b.bas)).slice(0, 3);
    const bekleyen = V.RANDEVULAR.filter((r) => r.durum === 'bekliyor');
    const hizmetVerenler = V.PERSONEL.filter((p) => !p.hizmetVermez);
    const bosNow = hizmetVerenler.map((p) => ({ p, b: bosAraliklar(p.id) })).filter((x) => x.b.simdi === 'boş');
    const doluluk = Math.round((V.RANDEVULAR.filter((r) => r.durum !== 'iptal').reduce((a, r) => a + r.sure, 0) / (hizmetVerenler.length * GUN_UZ)) * 100);

    const elleOnay = P.klinik ? P.param('onay') !== 'otomatik' : P.param('onay') === 'elle';
    const bulgu = bekleyen.length && !P.param('vitrin') && elleOnay ? `<div class="serit serit--uyari" data-testid="bugun-bulgu">${ik('saat')}<div class="serit__metin"><span><strong>${bekleyen.length} online randevu onay bekliyor.</strong> ${bekleyen.map((r) => `${r.musteri} ${r.bas}`).join(', ')}.</span></div><button class="dugme dugme--ikincil dugme--kucuk" data-eylem="randevu-ac" data-id="${bekleyen[0].id}">Gözden geçir</button></div>` : '';

    const sirada = `<section class="kart" aria-labelledby="b-sirada">${H.kartBaslik('<span id="b-sirada">Şimdi ve sırada</span>', `<a href="#takvim" class="metin-14">Takvim</a>`)}
      <ul class="liste sirada">${[...suruyor, ...siradaki].map((r) => {
        const p = per(r.p);
        const eylem = r.durum === 'suruyor' ? `<button class="dugme dugme--birincil dugme--kucuk" data-eylem="tamamla" data-id="${r.id}">Tamamla</button>` : r.durum === 'bekliyor' ? `<button class="dugme dugme--ikincil dugme--kucuk" data-eylem="onayla" data-id="${r.id}">Onayla</button>` : `<button class="dugme dugme--ikincil dugme--kucuk" data-eylem="baslat" data-id="${r.id}">Başlat</button>`;
        return `<li><div class="satir" style="cursor:default">${P.avatar(p)}<button class="satir__ana" style="background:none;border:0;padding:0;text-align:left;cursor:pointer" data-eylem="randevu-ac" data-id="${r.id}"><span class="satir__ust"><span class="sayi">${r.bas}</span> · ${r.musteri}</span><span class="satir__alt">${r.hizmet} · ${p.kisa}${r.durum === 'suruyor' ? ` · ${P.kadar(r.bit)}` : ''}</span></button><span class="satir__sag">${P.durumEtiketi(r.durum)}</span>${eylem}</div></li>`;
      }).join('')}</ul></section>`;

    const serit = `<section class="kart" aria-labelledby="b-serit">${H.kartBaslik('<span id="b-serit">Personelin günü</span>', `<span class="metin-kucuk metin-soluk">Boş saate dokunun.</span>`)}
      <div class="kart__govde yigin" style="gap:12px">
        <p class="metin-14" data-testid="simdi-bos"><strong>Şu an boş:</strong> ${bosNow.length ? bosNow.map((x) => `${x.p.kisa} (${P.kadar(x.b.kadar)})`).join(', ') : 'kimse yok'}.</p>
        ${H.doluluk(hizmetVerenler)}
      </div></section>`;

    const ozet = P.yetki('bugun-ciro')
      ? `<section class="kart" aria-labelledby="b-ozet">${H.kartBaslik('<span id="b-ozet">Günün özeti</span>', `<div class="parcali" data-tekli role="group" aria-label="Dönem"><button aria-pressed="true">Bugün</button><button aria-pressed="false">Bu hafta</button><button aria-pressed="false">Bu ay</button></div>`)}
        <div class="kart__govde"><div class="ozet ozet--yigilir" style="--sutun:4;border:0">
          <div class="ozet__oge"><span class="ozet__etiket">Randevu</span><span class="ozet__deger">${O.toplam}</span><span class="ozet__alt">${O.tamamlanan} tamamlandı · geçen çarşamba 15 randevu</span></div>
          <div class="ozet__oge"><span class="ozet__etiket">Tahsilat</span><span class="ozet__deger">${para(K.ciro)}</span><span class="ozet__alt">Nakit ${para(K.nakit)} · Kart ${para(K.kart)}</span></div>
          <div class="ozet__oge"><span class="ozet__etiket">Beklenen</span><span class="ozet__deger">${para(O.beklenenCiro)}</span><span class="ozet__alt">${O.gelecek + O.bekliyor + O.suruyor} açık randevudan</span></div>
          <div class="ozet__oge"><span class="ozet__etiket">Doluluk</span><span class="ozet__deger">%${doluluk}</span><span class="ozet__alt">${O.gelmedi} gelmedi · ${O.iptal} iptal</span></div>
        </div></div></section>`
      : `<section class="kart" aria-labelledby="b-ozet">${H.kartBaslik('<span id="b-ozet">Bugünkü kasa</span>', `<a href="#kasa" class="metin-14">Kasa</a>`)}<div class="kart__govde"><div class="ozet" style="--sutun:3;border:0"><div class="ozet__oge"><span class="ozet__etiket">Tahsilat</span><span class="ozet__deger">${para(K.ciro)}</span></div><div class="ozet__oge"><span class="ozet__etiket">Nakit</span><span class="ozet__deger">${para(K.nakit)}</span></div><div class="ozet__oge"><span class="ozet__etiket">Kart</span><span class="ozet__deger">${para(K.kart)}</span></div></div></div></section>`;

    const tum = V.RANDEVULAR.slice().sort((a, b) => P.dk(a.bas) - P.dk(b.bas));
    const liste = `<section class="kart" aria-labelledby="b-liste">${H.kartBaslik(`<span id="b-liste">Günün randevuları</span> <span class="metin-soluk orta sayi">${O.toplam}</span>`)}
      <div class="kart__govde yigin" style="gap:12px"><div class="cipler" data-tekli role="group" aria-label="Personele göre süz">
        <button class="cip" aria-pressed="true" data-deger="">Tümü <span class="sayac">${O.toplam}</span></button>${hizmetVerenler.map((p) => `<button class="cip" aria-pressed="false" data-deger="${p.id}">${p.kisa} <span class="sayac">${V.RANDEVULAR.filter((r) => r.p === p.id && r.durum !== 'iptal').length}</span></button>`).join('')}
      </div><div class="yigin yigin--8" id="gun-listesi">${tum.map((r) => H.randevuKart(r)).join('')}</div></div></section>`;

    return {
      html: ust + `<div class="yigin">${bulgu}<div class="iki-sutun"><div class="yigin">${sirada}${serit}${liste}</div><div class="yigin">${ozet}${P.rol !== 'resepsiyon' ? '' : ''}<section class="kart">${H.kartBaslik('Bekleme listesi', `<a href="#bekleme" class="metin-14">Tümü</a>`)}<ul class="liste">${V.BEKLEME.slice(0, 3).map((b) => `<li><a class="satir" href="#bekleme"><span class="satir__ana"><span class="satir__ust">${b.musteri}</span><span class="satir__alt">${b.hizmet} · ${b.tercih}</span></span>${b.durum === 'haber' ? '<span class="durum durum--onayli">Haber verildi</span>' : '<span class="durum durum--bekliyor">Bekliyor</span>'}</a></li>`).join('')}</ul></section></div></div></div>`,
      sonra(kok) {
        kok.querySelector('.cipler').addEventListener('secim', (e) => {
          kok.querySelectorAll('#gun-listesi .randevu-kart').forEach((el) => { const r = rnd(el.dataset.id); el.hidden = e.detail && r.p !== e.detail; });
        });
      },
    };
  };

  function ilkKurulum() {
    const adimlar = [
      ['Salon bilgileri', true, 'ayarlar/salon'], ['Çalışma saatleri', true, 'ayarlar/saatler'],
      ['Hizmetleri ekleyin', false, 'hizmetler'], ['Personel ekleyin', false, 'personel'],
      ['İlk randevuyu oluşturun', false, 'randevu-yeni'], ['Online randevu bağlantısını paylaşın', false, 'ayarlar/online'],
    ];
    const biten = adimlar.filter((a) => a[1]).length;
    return `<div class="yigin" data-durum="bos" data-testid="ilk-kurulum">
      <section class="kart"><div class="kart__baslik"><h2 class="baslik-bolum">Kurulumu tamamlayın</h2><span class="metin-14 metin-soluk sayi">${biten}/${adimlar.length}</span></div>
      <div class="kart__govde yigin" style="gap:12px"><div class="ilerleme" role="progressbar" aria-valuemin="0" aria-valuemax="${adimlar.length}" aria-valuenow="${biten}" aria-label="Kurulum ilerlemesi"><span style="width:${(biten / adimlar.length) * 100}%"></span></div>
      <ol class="liste" style="margin:0 -16px">${adimlar.map(([a, b, h]) => `<li>${h === 'randevu-yeni' ? `<button class="satir" data-eylem="randevu-yeni">` : `<a class="satir" href="#${h}">`}<span style="color:${b ? 'var(--renk-basari)' : 'var(--renk-metin-soluk)'}">${ik(b ? 'tamamDaire' : 'saat')}</span><span class="satir__ana"><span class="satir__ust" ${b ? 'style="color:var(--renk-metin-soluk);text-decoration:line-through"' : ''}>${a}</span></span>${b ? '<span class="metin-kucuk metin-soluk">Tamamlandı</span>' : ik('ileri', 'satir__ok')}${h === 'randevu-yeni' ? '</button>' : '</a>'}</li>`).join('')}</ol></div></section>
      <section class="kart">${H.kartBaslik('Günün randevuları')}${H.bos({ ikon: 'takvim', baslik: 'Bugün randevu yok.', metin: 'Telefonla gelen ilk randevuyu buradan girin; takvimde hemen görünür.', eylem: 'randevu-yeni', eylemAd: 'Randevu oluştur' })}</section></div>`;
  }

  // ======================= EKRAN: Günüm (personel) =======================
  E.gunum = () => {
    const k = benim();
    const benimR = V.RANDEVULAR.filter((r) => r.p === k.id).sort((a, b) => P.dk(a.bas) - P.dk(b.bas));
    const ust = H.sayfaUst('Günüm', `${V.BUGUN.okunur} · ${benimR.filter((r) => r.durum !== 'iptal').length} randevu`, `<button class="dugme dugme--birincil masaustu" data-eylem="randevu-yeni">${ik('arti')}Randevu oluştur</button>`);
    if (D === 'yukleniyor') return { html: ust + H.iskeletSatir(5) };
    if (D === 'hata') return { html: ust + H.hata('Randevularınız') };
    if (D === 'bos') return { html: ust + `<div class="kart">${H.bos({ ikon: 'takvim', baslik: 'Bugün randevunuz yok.', metin: 'Yeni randevu gelince burada sırayla görünür.', eylem: 'randevu-yeni', eylemAd: 'Randevu oluştur', orta: true })}</div>` };
    const s = P.dk(V.BUGUN.simdi);
    const sonraki = benimR.find((r) => ['onayli', 'bekliyor', 'suruyor'].includes(r.durum) && P.dk(r.bit) > s);
    const kalan = sonraki ? P.dk(sonraki.bas) - s : 0;
    const buyuk = sonraki ? `<section class="kart" aria-labelledby="g-siradaki" style="border-color:var(--renk-vurgu-isaret)" data-testid="gunum-siradaki">
      <div class="kart__baslik"><h2 class="baslik-bolum" id="g-siradaki">${sonraki.durum === 'suruyor' ? 'Şimdi' : 'Sıradaki'}</h2><span class="metin-14 orta" style="color:var(--renk-vurgu-metin)">${sonraki.durum === 'suruyor' ? 'Devam ediyor' : kalan > 0 ? `${kalan} dk sonra` : 'Başlama saati geldi'}</span></div>
      <div class="kart__govde yigin" style="gap:12px">
        <div><p class="sayi kalin" style="font-size:var(--yazi-24);line-height:var(--satir-24)">${sonraki.bas} – ${sonraki.bit}</p><p style="font-size:var(--yazi-20);line-height:var(--satir-20)" class="orta">${sonraki.musteri}</p><p class="metin-ikincil">${sonraki.hizmet} · ${P.sure(sonraki.sure)}</p></div>
        ${sonraki.saglikNotu ? `<p class="metin-14" style="display:flex;gap:6px;align-items:center;color:var(--renk-metin-ikincil)">${ik('kalp', 'ikon--16')}Sağlık notu var · <a href="#musteri/m3">Müşteri kartında görün</a></p>` : ''}
        <div class="dugme-sirasi"><button class="dugme dugme--birincil" style="flex:1" data-eylem="${sonraki.durum === 'suruyor' ? 'tamamla' : 'baslat'}" data-id="${sonraki.id}">${sonraki.durum === 'suruyor' ? 'Tamamla' : 'Başlat'}</button><a class="dugme dugme--ikincil" href="tel:${sonraki.tel.replace(/\s/g, '')}" aria-label="${sonraki.musteri}’i ara">${ik('telefon')}Ara</a><button class="dugme dugme--ikon" data-eylem="randevu-ac" data-id="${sonraki.id}" aria-label="Randevu ayrıntıları">${ik('nokta')}</button></div>
      </div></section>` : '';
    const tam = benimR.filter((r) => r.durum === 'bitti');
    return {
      html: ust + `<div class="iki-sutun"><div class="yigin">${buyuk}
        <section class="kart" aria-labelledby="g-gun">${H.kartBaslik('<span id="g-gun">Günün sırası</span>')}<div class="kart__govde yigin yigin--8">${benimR.map((r) => H.randevuKart(r, { personelGoster: false })).join('')}</div></section></div>
        <div class="yigin"><section class="kart">${H.kartBaslik('Bugün')}<div class="kart__govde"><div class="ozet" style="--sutun:2;border:0"><div class="ozet__oge"><span class="ozet__etiket">Tamamlanan</span><span class="ozet__deger">${tam.length}</span></div><div class="ozet__oge"><span class="ozet__etiket">Kalan</span><span class="ozet__deger">${benimR.filter((r) => ['onayli', 'bekliyor', 'suruyor'].includes(r.durum)).length}</span></div></div></div><div class="kart__alt"><a href="#primim" class="dugme dugme--metin dugme--kucuk">Benim primim${ik('ileri', 'ikon--16')}</a></div></section>
        <section class="kart">${H.kartBaslik('Bu hafta izinlerim')}<p class="kart__govde metin-14 metin-ikincil">Cumartesi, 31 Ekim · Yıllık izin. Değişiklik için salon sahibine yazın.</p></section></div></div>`,
    };
  };

  // ======================= EKRAN: Takvim =======================
  const GUNLER = [['Pzt', 26], ['Sal', 27], ['Çar', 28], ['Per', 29], ['Cum', 30], ['Cmt', 31], ['Paz', 1]];
  function gunRandevulari(no) {
    if (no === 28) return V.RANDEVULAR;
    if (no === 1) return [];
    const kayd = (no * 3) % 7;
    const adlar = V.MUSTERILER.map((m) => m.ad);
    return V.RANDEVULAR.filter((r, i) => (i + no) % 4 !== 0).map((r, i) => Object.assign({}, r, { id: r.id + '-' + no, musteri: adlar[(i + kayd) % adlar.length], durum: no < 28 ? (r.durum === 'iptal' ? 'iptal' : 'bitti') : 'onayli', kanal: 'elle', saglikNotu: false }));
  }
  E.takvim = (arg) => {
    const gorunum = P.param('gorunum', 'gun');
    const gun = Number(arg) || 28;
    const pp = P.rol === 'personel' ? [benim()] : V.PERSONEL.filter((p) => !p.hizmetVermez);
    const gunAdi = GUNLER.find((g) => g[1] === gun);
    const baslik = gun === 28 ? `Bugün, ${V.BUGUN.okunur}` : `${gun} ${gun === 1 ? 'Kasım' : 'Ekim'}, ${{ Pzt: 'Pazartesi', Sal: 'Salı', Çar: 'Çarşamba', Per: 'Perşembe', Cum: 'Cuma', Cmt: 'Cumartesi', Paz: 'Pazar' }[gunAdi[0]]}`;
    const ust = H.sayfaUst(P.rol === 'personel' ? 'Takvimim' : 'Takvim', baslik,
      `<div class="parcali yalniz-masaustu" role="group" aria-label="Görünüm"><a class="dugme" style="min-height:38px;border:0;${gorunum === 'gun' ? 'background:var(--renk-yuzey);box-shadow:0 1px 2px rgba(17,36,42,.12)' : 'background:transparent'}" href="?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), gorunum: 'gun' })}#takvim/${gun}">Gün</a><a class="dugme" style="min-height:38px;border:0;${gorunum === 'hafta' ? 'background:var(--renk-yuzey);box-shadow:0 1px 2px rgba(17,36,42,.12)' : 'background:transparent'}" href="?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), gorunum: 'hafta' })}#takvim/${gun}">Hafta</a><a class="dugme" style="min-height:38px;border:0;${gorunum === 'ay' ? 'background:var(--renk-yuzey);box-shadow:0 1px 2px rgba(17,36,42,.12)' : 'background:transparent'}" href="?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), gorunum: 'ay' })}#takvim/${gun}">Ay</a></div><div class="alan" style="min-width:150px"><select aria-label="Duruma göre süz" id="tk-durum"><option value="">Tüm durumlar</option>${Object.entries(P.DURUM_ADI).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div><button class="dugme dugme--birincil masaustu" data-eylem="randevu-yeni">${ik('arti')}Randevu oluştur</button>`);
    const serit = `<div class="satir-arasi" style="margin-bottom:12px;gap:8px"><a class="dugme dugme--ikon" href="#takvim/${Math.max(26, gun - 1)}" aria-label="Önceki gün">${ik('geri')}</a><div class="gun-seridi" style="flex:1" role="group" aria-label="Gün seçin">${GUNLER.map(([a, n]) => `<a class="gun" href="#takvim/${n}" ${n === gun ? 'aria-current="date"' : ''} style="flex:1;min-width:44px"><span class="gun__ad">${a}</span><span class="gun__no">${n}</span></a>`).join('')}</div><a class="dugme dugme--ikon" href="#takvim/${Math.min(31, gun + 1)}" aria-label="Sonraki gün">${ik('ileri')}</a></div>`;
    if (D === 'yukleniyor') return { html: ust + serit + H.iskeletSatir(6) };
    if (D === 'hata') return { html: ust + serit + H.hata('Takvim') };
    const rr = (D === 'bos' ? [] : gunRandevulari(gun)).filter((r) => pp.some((p) => p.id === r.p));
    const kapali = gun === 1;

    // Telefon: personele göre süz + saat çizelgesi
    const filtre = P.rol === 'personel' ? '' : `<div class="cipler" data-tekli role="group" aria-label="Personel" style="margin-bottom:12px"><button class="cip" aria-pressed="true" data-deger="">Tümü</button>${pp.map((p) => `<button class="cip" aria-pressed="false" data-deger="${p.id}"><span class="avatar avatar--kucuk kisi-${p.ton}" style="width:20px;height:20px;font-size:10px" aria-hidden="true">${p.bas}</span>${p.kisa}</button>`).join('')}</div>`;
    const saatler = Array.from({ length: 11 }, (_, i) => 9 + i);
    const telefon = kapali ? `<div class="kart">${H.bos({ ikon: 'takvim', baslik: 'Pazar günleri salon kapalı.', metin: 'Çalışma saatlerini Ayarlar’dan değiştirebilirsiniz.', orta: true })}</div>`
      : !rr.length ? `<div class="kart">${H.bos({ ikon: 'takvim', baslik: 'Bu gün için randevu yok.', eylem: 'randevu-yeni', eylemAd: 'Randevu oluştur', orta: true })}</div>`
      : `<div class="cizelge yalniz-telefon" id="cizelge">${saatler.map((s) => {
        const bu = rr.filter((r) => Math.floor(P.dk(r.bas) / 60) === s).sort((a, b) => P.dk(a.bas) - P.dk(b.bas));
        const simdiSaat = gun === 28 && s === 14;
        return `<div class="cizelge__saat"><span>${String(s).padStart(2, '0')}:00</span><div class="yigin yigin--8" style="padding:8px 0;position:relative">${simdiSaat ? `<div style="position:absolute;left:-8px;right:0;top:${(20 / 60) * 64}px;height:2px;background:var(--renk-vurgu-isaret)" aria-hidden="true"></div><span class="gizli-metin">Şu an ${V.BUGUN.simdi}</span>` : ''}${bu.map((r) => H.randevuKart(r, { personelGoster: P.rol !== 'personel' })).join('') || `<button class="metin-14 metin-soluk" style="text-align:left;background:none;border:0;min-height:44px;cursor:pointer" data-eylem="randevu-yeni" data-saat="${String(s).padStart(2, '0')}:00">Boş · randevu oluştur</button>`}</div></div>`;
      }).join('')}</div>`;

    // Masaüstü: personel sütunları
    const SY = 72;
    const masa = gorunum === 'ay' ? ayGorunumu() : kapali || !rr.length ? '' : gorunum === 'hafta' ? haftaGorunumu(pp) : `<div class="takvim yalniz-masaustu" style="--sutun:${pp.length};--saat-y:${SY}px" role="grid" aria-label="Günlük takvim">
      <div class="takvim__kose"></div>${pp.map((p) => `<div class="takvim__kisi kisi-${p.ton}" role="columnheader">${P.avatar(p, 'avatar--kucuk')}<span style="min-width:0"><span style="display:block">${p.kisa}</span><small>${rr.filter((r) => r.p === p.id && r.durum !== 'iptal').length} randevu</small></span></div>`).join('')}
      <div class="takvim__eksen" aria-hidden="true">${saatler.map((s) => `<div>${String(s).padStart(2, '0')}:00</div>`).join('')}</div>
      ${pp.map((p) => `<div class="takvim__sutun kisi-${p.ton}" style="height:${11 * SY}px">
        ${Array.from({ length: 44 }, (_, i) => { const dk = 540 + i * 15; const t = `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}`; return `<button class="takvim__bos-dilim" style="top:${(i * SY) / 4}px" tabindex="-1" aria-hidden="true" data-eylem="randevu-yeni" data-p="${p.id}" data-saat="${t}"></button>`; }).join('')}
        ${rr.filter((r) => r.p === p.id).map((r) => `<button class="takvim__olay takvim__olay--${r.durum}" style="top:${((P.dk(r.bas) - 540) / 60) * SY + 1}px;height:${(r.sure / 60) * SY - 3}px" data-eylem="randevu-ac" data-id="${r.id}" aria-label="${r.bas} – ${r.bit}, ${r.musteri}, ${r.hizmet}, ${P.DURUM_ADI[r.durum]}">${r.sure > 30 ? `<strong>${r.musteri}</strong><span>${r.bas} – ${r.bit} · ${r.hizmet}</span>` : `<strong class="takvim__olay-kisa">${r.bas} ${r.musteri}</strong>`}${r.sure >= 75 ? `<span>${P.DURUM_ADI[r.durum]}${r.kanal === 'online' ? ' · Online' : ''}</span>` : ''}</button>`).join('')}
        ${gun === 28 ? `<div class="takvim__simdi" style="top:${((P.dk(V.BUGUN.simdi) - 540) / 60) * SY}px" aria-hidden="true"></div>` : ''}
      </div>`).join('')}</div>
      <p class="metin-kucuk metin-soluk" style="margin-top:8px">Randevuyu sürükleyerek taşıyabilirsiniz (yalnız ileri tarihli ve kapanmamış randevular). Boş bir saate tıklayınca randevu oluşturulur.</p>`;
    return {
      html: ust + serit + `<div class="yalniz-telefon">${filtre}</div>` + telefon + masa,
      sonra(kok) {
        kok.querySelector('.cipler')?.addEventListener('secim', (e) => kok.querySelectorAll('#cizelge .randevu-kart').forEach((el) => { el.hidden = e.detail && !el.classList.contains('kisi-' + per(e.detail).ton); }));
        kok.querySelector('#tk-durum')?.addEventListener('change', (e) => { const d = e.target.value; kok.querySelectorAll('.randevu-kart, .takvim__olay').forEach((el) => { const r = rnd(el.dataset.id) || rnd((el.dataset.id || '').split('-')[0]); if (r) el.hidden = d && !el.className.includes(d) && r.durum !== d; }); });
        kok.querySelector('.gun[aria-current="date"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
      },
    };
  };
  function ayGorunumu() {
    // Ekim 2026: 1 Ekim Perşembe. Hücre: gün no + randevu sayısı; Pazar kapalı.
    const bos = 3, gunler = 31;
    const hucre = (n) => { const hg = (bos + n - 1) % 7; const kapali = hg === 6; const c = kapali ? 0 : 12 + ((n * 7) % 9); return `<a href="?gorunum=gun#takvim/${Math.min(Math.max(n, 26), 31)}" style="display:grid;align-content:space-between;min-height:76px;padding:8px;border-top:1px solid var(--renk-cizgi-hafif);border-left:1px solid var(--renk-cizgi-hafif);text-decoration:none;color:inherit;${n === 28 ? 'background:var(--renk-birincil-hafif)' : ''}" aria-label="${n} Ekim${kapali ? ', kapalı' : `, ${c} randevu`}"><span class="sayi ${n === 28 ? 'kalin' : ''}">${n}</span><span class="metin-kucuk ${kapali ? 'metin-soluk' : ''}">${kapali ? 'Kapalı' : `${c} randevu`}</span></a>`; };
    return `<div class="kart yalniz-masaustu" style="display:grid;grid-template-columns:repeat(7,1fr);overflow:hidden">${['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((g) => `<div class="metin-kucuk metin-soluk" style="padding:8px">${g}</div>`).join('')}${Array.from({ length: bos }, () => '<div style="border-top:1px solid var(--renk-cizgi-hafif);border-left:1px solid var(--renk-cizgi-hafif)"></div>').join('')}${Array.from({ length: gunler }, (_, i) => hucre(i + 1)).join('')}</div>`;
  }
  function haftaGorunumu(pp) {
    return `<div class="kart yalniz-masaustu tablo-kutu"><table class="tablo"><caption class="gizli-metin">Haftalık özet: personel ve gün başına randevu sayısı</caption><thead><tr><th scope="col">Personel</th>${GUNLER.map(([a, n]) => `<th scope="col" class="sayi">${a} ${n}</th>`).join('')}</tr></thead><tbody>${pp.map((p) => `<tr><th scope="row" style="font-weight:500;color:var(--renk-metin);font-size:var(--yazi-14)"><span style="display:flex;align-items:center;gap:8px">${P.avatar(p, 'avatar--kucuk')}${p.kisa}</span></th>${GUNLER.map(([, n]) => { const c = n === 1 ? null : gunRandevulari(n).filter((r) => r.p === p.id && r.durum !== 'iptal').length; return `<td class="sayi">${c === null ? '<span class="metin-soluk">Kapalı</span>' : `<a href="#takvim/${n}" style="font-weight:${n === 28 ? 600 : 400}">${c}</a>`}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // ======================= Randevu oluştur (alt sayfa / diyalog) =======================
  EYLEM['randevu-yeni'] = (el) => randevuYeni({ p: el?.dataset.p, saat: el?.dataset.saat });
  EYLEM['serit-bos'] = (el, e) => {
    if (e.target.closest('.doluluk__blok')) return;
    const r = el.getBoundingClientRect();
    const dk = Math.round((GUN_BAS + ((e.clientX - r.left) / r.width) * GUN_UZ) / 15) * 15;
    randevuYeni({ p: el.dataset.p, saat: `${String(Math.floor(dk / 60)).padStart(2, '0')}:${String(dk % 60).padStart(2, '0')}` });
  };
  function bosSaatler(pid, hizmetSure) {
    const dolu = V.RANDEVULAR.filter((r) => r.p === pid && !['iptal', 'gelmedi'].includes(r.durum));
    const sonuc = []; const simdi = P.dk(V.BUGUN.simdi);
    for (let t = 540; t + hizmetSure <= 1200; t += 15) {
      if (t < simdi) continue;
      if (dolu.every((r) => t + hizmetSure <= P.dk(r.bas) || t >= P.dk(r.bit))) sonuc.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
    }
    return sonuc;
  }
  function randevuYeni(on = {}) {
    if (!P.yetki('randevu-olustur')) return;
    const kisi = P.rol === 'personel' ? benim().id : on.p || '';
    const s = { musteri: null, h: kisi === 'p3' ? 'h7' : 'h1', p: kisi || 'p2', gun: 28, saat: on.saat || '' };
    const kategoriler = [...new Set(V.HIZMETLER.map((h) => h.kat))];
    const govde = `
      <section class="yigin" style="gap:8px" aria-labelledby="ry-m"><h3 class="alan__etiket" id="ry-m">Müşteri</h3>
        <div id="ry-musteri-secili" hidden></div>
        <div id="ry-musteri-ara"><div class="alan__kutu">${ik('ara')}<input class="alan__girdi" id="ry-ara" aria-labelledby="ry-m" type="search" inputmode="search" autocomplete="off" placeholder="Ad veya telefon yazın…" aria-describedby="ry-ara-ipucu" data-ilk-odak data-testid="randevu-musteri-ara"></div>
        <p class="alan__ipucu" id="ry-ara-ipucu">En az 2 karakter. Kayıtlı değilse yeni müşteri olarak ekleyin.</p>
        <ul class="liste kart" id="ry-sonuc" style="margin-top:8px" hidden></ul></div>
      </section>
      <section class="yigin" style="gap:8px;margin-top:20px" aria-labelledby="ry-h"><h3 class="alan__etiket" id="ry-h">Hizmet</h3>
        <div class="cipler" data-tekli role="group" aria-label="Kategori" id="ry-kat">${kategoriler.map((k, i) => `<button class="cip" aria-pressed="${i === 0 ? 'true' : 'false'}" data-deger="${k}">${k}</button>`).join('')}</div>
        <div class="yigin yigin--8" id="ry-hizmetler" role="radiogroup" aria-labelledby="ry-h"></div>
      </section>
      <section class="yigin" style="gap:8px;margin-top:20px" aria-labelledby="ry-p"><h3 class="alan__etiket" id="ry-p">Personel</h3><div class="cipler" id="ry-personel" role="radiogroup" aria-labelledby="ry-p"></div>${P.rol === 'personel' ? '<p class="alan__ipucu">Yalnız kendi adınıza randevu oluşturabilirsiniz.</p>' : ''}</section>
      <section class="yigin" style="gap:8px;margin-top:20px" aria-labelledby="ry-t"><h3 class="alan__etiket" id="ry-t">Tarih</h3><div class="gun-seridi" data-tekli role="group" aria-labelledby="ry-t">${['Bugün|28', 'Per|29', 'Cum|30', 'Cmt|31', 'Paz|1', 'Pzt|2', 'Sal|3', 'Çar|4', 'Per|5', 'Cum|6', 'Cmt|7', 'Paz|8', 'Pzt|9', 'Sal|10'].map((x, i) => { const [a, n] = x.split('|'); return `<button class="gun" aria-pressed="${i === 0}" data-deger="${n}" ${a === 'Paz' ? 'disabled aria-label="' + n + ' Pazar, kapalı"' : ''}><span class="gun__ad">${a}</span><span class="gun__no">${n}</span></button>`; }).join('')}</div></section>
      <section class="yigin" style="gap:8px;margin-top:20px" aria-labelledby="ry-s"><h3 class="alan__etiket" id="ry-s">Saat</h3><div id="ry-saatler"></div></section>
      <div class="alan" style="margin-top:20px"><label class="alan__etiket" for="ry-not">Not <span class="istege-bagli">(isteğe bağlı)</span></label><textarea id="ry-not" maxlength="500" placeholder="Ör. kısa kesim, fotoğraf getirecek…" aria-describedby="ry-not-ipucu"></textarea><p class="alan__ipucu" id="ry-not-ipucu">Sağlık bilgisi yazmayın; bunun için müşteri kartındaki Sağlık bilgileri bölümünü kullanın.</p></div>`;
    const k = P.katmanAc({ baslik: 'Randevu oluştur', govde, tam: true, kimlik: 'randevu-olustur',
      alt: `<div style="flex:1;min-width:0;display:grid" aria-live="polite"><span class="metin-14 orta" id="ry-ozet1" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Müşteri seçin</span><span class="metin-kucuk metin-soluk" id="ry-ozet2"></span></div><button class="dugme dugme--birincil" id="ry-kaydet" style="flex:none" data-testid="randevu-olustur-kaydet">Randevu oluştur</button>` });
    const kok = k.kok;
    const $ = (sel) => kok.querySelector(sel);
    const hizmetCiz = (kat) => {
      $('#ry-hizmetler').innerHTML = V.HIZMETLER.filter((h) => h.kat === kat && (P.rol !== 'personel' || h.personel.includes(benim().id))).map((h) => `<button class="secim-kart" role="radio" aria-checked="${h.id === s.h}" data-h="${h.id}"><span class="secim-kart__ana"><span class="orta">${h.ad}</span><span class="metin-14 metin-soluk">${P.sure(h.sure)}</span></span><span class="secim-kart__sag sayi orta">${para(h.fiyat)}</span></button>`).join('') || '<p class="metin-14 metin-soluk">Bu kategoride verdiğiniz hizmet yok.</p>';
    };
    const personelCiz = () => {
      const h = hiz(s.h);
      const uygun = V.PERSONEL.filter((p) => h.personel.includes(p.id) && (P.rol !== 'personel' || p.id === benim().id));
      if (!uygun.some((p) => p.id === s.p)) s.p = uygun[0]?.id;
      $('#ry-personel').innerHTML = uygun.map((p) => `<button class="cip" role="radio" aria-checked="${p.id === s.p}" aria-pressed="${p.id === s.p}" data-p="${p.id}" style="min-height:44px">${P.avatar(p, 'avatar--kucuk')}${p.kisa}</button>`).join('');
    };
    const saatCiz = (yukleniyor) => {
      if (yukleniyor) { $('#ry-saatler').innerHTML = `<p class="metin-14 metin-soluk" role="status">Boş saatler getiriliyor…</p>`; return; }
      const ss = s.gun === 28 ? bosSaatler(s.p, hiz(s.h).sure) : ['09:00', '09:15', '10:30', '11:00', '13:00', '13:45', '15:30', '16:00', '17:15'];
      if (s.saat && !ss.includes(s.saat)) s.saat = '';
      $('#ry-saatler').innerHTML = ss.length ? `<div class="saatler" data-tekli role="group" aria-labelledby="ry-s">${ss.map((t) => `<button class="saat" aria-pressed="${t === s.saat}" data-deger="${t}">${t}</button>`).join('')}</div>` : `<div class="cerceve-bos">${per(s.p).kisa} için bu gün boş saat yok. Başka bir gün ya da personel seçin.</div>`;
    };
    const ozet = () => {
      const h = hiz(s.h), p = per(s.p);
      $('#ry-ozet1').textContent = s.musteri ? `${s.musteri.ad} · ${h.ad}` : 'Müşteri seçin';
      $('#ry-ozet2').textContent = `${p?.kisa || ''} · ${s.gun === 28 ? 'Bugün' : s.gun + (s.gun < 15 && s.gun > 1 ? ' Kasım' : s.gun === 1 ? ' Kasım' : ' Ekim')}${s.saat ? ' ' + s.saat : ''} · ${P.sure(h.sure)} · ${para(h.fiyat)}`;
    };
    hizmetCiz(hiz(s.h).kat); kok.querySelectorAll('#ry-kat .cip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.deger === hiz(s.h).kat)));
    personelCiz(); saatCiz(); ozet();
    $('#ry-kat').addEventListener('secim', (e) => hizmetCiz(e.detail));
    $('#ry-hizmetler').addEventListener('click', (e) => { const b = e.target.closest('[data-h]'); if (!b) return; s.h = b.dataset.h; kok.querySelectorAll('#ry-hizmetler [role=radio]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); personelCiz(); saatCiz(true); setTimeout(() => saatCiz(), 350); ozet(); });
    $('#ry-personel').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; s.p = b.dataset.p; personelCiz(); saatCiz(true); setTimeout(() => saatCiz(), 350); ozet(); });
    kok.querySelector('.gun-seridi').addEventListener('secim', (e) => { s.gun = Number(e.detail); saatCiz(true); setTimeout(() => saatCiz(), 350); ozet(); });
    $('#ry-saatler').addEventListener('secim', (e) => { s.saat = e.detail; ozet(); $('#ry-saat-hata')?.remove(); });
    // Müşteri arama
    const ara = $('#ry-ara'), sonuc = $('#ry-sonuc');
    const musteriSec = (m) => {
      s.musteri = m;
      $('#ry-musteri-ara').hidden = true;
      $('#ry-musteri-secili').hidden = false;
      $('#ry-musteri-secili').innerHTML = `<div class="secim-kart" aria-checked="true" style="cursor:default"><span class="avatar" aria-hidden="true">${m.ad.split(' ').map((x) => x[0]).join('')}</span><span class="secim-kart__ana"><span class="orta">${m.ad}</span><span class="metin-14 metin-soluk">${m.tel}${m.son && m.son !== '—' ? ' · Son ziyaret ' + m.son : ' · Yeni müşteri'}</span></span><button class="dugme dugme--metin dugme--kucuk" id="ry-degistir">Değiştir</button></div>${m.not ? `<p class="alan__ipucu" style="margin-top:6px">Not: ${m.not}</p>` : ''}`;
      $('#ry-degistir').onclick = () => { s.musteri = null; $('#ry-musteri-ara').hidden = false; $('#ry-musteri-secili').hidden = true; ara.focus(); ozet(); };
      ozet();
    };
    ara.addEventListener('input', () => {
      const q = ara.value.trim().toLocaleLowerCase('tr-TR');
      const uz = P.rol === 'personel';
      if (q.length < (uz ? 3 : 2)) { sonuc.hidden = true; return; }
      const kendi = (m) => V.RANDEVULAR.some((r) => r.p === benim().id && r.musteri === m.ad);
      const bul = V.MUSTERILER.filter((m) => m.ad.toLocaleLowerCase('tr-TR').includes(q) || m.tel.replace(/\s/g, '').includes(q.replace(/\s/g, ''))).slice(0, uz ? 10 : 5);
      const tel = (m) => (uz && !kendi(m) ? `<span style="user-select:none">${m.tel.slice(0, 4)} *** ** ${m.tel.slice(-2)}</span>` : m.tel);
      sonuc.hidden = false;
      sonuc.innerHTML = bul.map((m) => `<li><button class="satir" data-m="${m.id}"><span class="satir__ana"><span class="satir__ust">${m.ad}</span><span class="satir__alt">${tel(m)} · ${m.ziyaret} ziyaret</span></span></button></li>`).join('') + (uz ? '<li class="alan__ipucu" style="padding:8px 16px">En çok 10 sonuç. Randevunuz olmayan kişilerin numarası gizlidir.</li>' : '') + `<li><button class="satir" data-yeni style="color:var(--renk-birincil)">${ik('arti')}<span class="satir__ana"><span class="satir__ust">“${P.kac(ara.value)}” adıyla yeni müşteri ekle</span></span></button></li>`;
    });
    sonuc.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (b) return musteriSec(V.MUSTERILER.find((m) => m.id === b.dataset.m));
      if (e.target.closest('[data-yeni]')) {
        sonuc.innerHTML = `<li style="padding:12px 16px"><div class="alan"><label class="alan__etiket" for="ry-yad">Ad soyad</label><input class="alan__girdi" id="ry-yad" autocomplete="off" value="${P.kac(/\d/.test(ara.value) ? '' : ara.value)}"></div><div class="alan"><label class="alan__etiket" for="ry-ytel">Telefon</label><div class="alan__on-ek"><span>+90</span><input class="alan__girdi" id="ry-ytel" type="tel" inputmode="tel" autocomplete="off" placeholder="5xx xxx xx xx" value="${/\d/.test(ara.value) ? P.kac(ara.value) : ''}"></div></div><div class="dugme-sirasi" style="margin-top:12px"><button class="dugme dugme--birincil dugme--kucuk" data-ekle>Müşteri ekle</button></div></li>`;
        kok.querySelector('#ry-yad').focus();
        sonuc.querySelector('[data-ekle]').onclick = () => { const a = kok.querySelector('#ry-yad').value.trim(); const t = kok.querySelector('#ry-ytel').value.trim(); if (!a || t.replace(/\D/g, '').length < 10) { P.bildir('Ad soyad ve 10 haneli telefon yazın.', { tur: 'hata' }); return; } musteriSec({ ad: a, tel: '0' + t, son: '—' }); P.bildir(P.T('kisiEklendi')); };
      }
    });
    if (on.musteri) musteriSec(on.musteri);
    $('#ry-kaydet').addEventListener('click', (e) => {
      if (!s.musteri) { P.bildir(P.T('kisiSec'), { tur: 'hata' }); ara.focus(); return; }
      if (!s.saat) { const st = $('#ry-saatler'); if (!$('#ry-saat-hata')) st.insertAdjacentHTML('beforebegin', `<p class="alan__hata" id="ry-saat-hata" role="alert">${ik('hata', 'ikon--16')}Saat seçin.</p>`); st.scrollIntoView({ block: 'center' }); return; }
      if (P.param('cakisma') === '1') { P.isle(e.currentTarget, 'Oluşturuluyor…', () => { const st = $('#ry-saatler'); st.insertAdjacentHTML('beforebegin', `<div class="serit serit--hata" role="alert" id="ry-saat-hata">${ik('hata')}<span class="serit__metin">Bu saatte ${per(s.p).kisa} için başka bir randevu var. Başka bir saat seçin.</span></div>`); s.saat = ''; saatCiz(); }); return; }
      P.isle(e.currentTarget, 'Oluşturuluyor…', () => { k.kapat(); P.bildir('Randevu oluşturuldu.'); });
    });
  }

  // ======================= Randevu ayrıntısı =======================
  EYLEM['randevu-ac'] = (el) => randevuAc(el.dataset.id);
  function randevuAc(id) {
    const r = rnd(id) || rnd(id.split('-')[0]);
    if (!r) return;
    const p = per(r.p), m = V.MUSTERILER.find((x) => x.ad === r.musteri);
    const kendi = P.rol !== 'personel' || r.p === benim().id;
    const kilitli = ['bitti', 'iptal', 'gelmedi'].includes(r.durum);
    const satir = (et, de) => `<div class="kuyu__satir"><span class="metin-soluk metin-14">${et}</span><span class="orta" style="text-align:right">${de}</span></div>`;
    let eylem = '';
    if (!kendi) eylem = '';
    else if (r.durum === 'bekliyor') eylem = `<button class="dugme dugme--ikincil" data-eylem="iptal-et" data-id="${r.id}">Reddet</button><button class="dugme dugme--birincil" data-eylem="onayla" data-id="${r.id}">Onayla</button>`;
    else if (r.durum === 'onayli') eylem = `<button class="dugme dugme--ikincil" data-eylem="saat-degistir" data-id="${r.id}">Saati değiştir</button><button class="dugme dugme--birincil" data-eylem="baslat" data-id="${r.id}">Başlat</button>`;
    else if (r.durum === 'suruyor') eylem = `<button class="dugme dugme--birincil" data-eylem="tamamla" data-id="${r.id}">Tamamla ve ödeme al</button>`;
    const kilitNot = kilitli ? `<div class="serit serit--bilgi" style="margin-top:12px">${ik('kilit')}<span class="serit__metin">${r.durum === 'bitti' ? `<span><strong>Ödeme alındı:</strong> ${para(r.tutar)} · ${r.odeme}.</span>` : ''}<span>${{ bitti: 'Tamamlanan', iptal: 'İptal edilen', gelmedi: '“Gelmedi” işaretli' }[r.durum]} randevu değiştirilemez.${P.rol === 'resepsiyon' || P.rol === 'personel' ? ' Hatalı kayıt için salon sahibine ya da yöneticiye haber verin.' : ''}</span></span></div>` : '';
    const menu = !kilitli && kendi ? `<div style="margin-top:16px;border-top:1px solid var(--renk-cizgi-hafif);padding-top:8px" class="yigin yigin--8">
      ${r.durum === 'onayli' ? `<button class="dugme dugme--metin" style="justify-content:flex-start" data-eylem="gelmedi" data-id="${r.id}">${ik('kapat')}Gelmedi olarak işaretle</button>` : ''}
      <button class="dugme dugme--metin" style="justify-content:flex-start;color:var(--renk-hata)" data-eylem="iptal-et" data-id="${r.id}">${ik('kapat')}Randevuyu iptal et</button>
      ${P.yetki('randevu-sil') ? `<button class="dugme dugme--metin" style="justify-content:flex-start;color:var(--renk-hata)" data-eylem="randevu-sil" data-id="${r.id}">${ik('sil')}Randevuyu sil</button>` : ''}
    </div>` : '';
    const goz = P.rol !== 'personel' || r.p === benim().id;
    P.katmanAc({
      baslik: r.musteri, kimlik: 'randevu-detay',
      govde: `<div class="satir-arasi" style="margin-bottom:12px">${P.durumEtiketi(r.durum)}<span class="metin-kucuk metin-soluk">${r.kanal === 'online' ? 'Online randevu' : 'Salonda oluşturuldu'}</span></div>
        <div class="kuyu">${satir('Saat', `${r.id.includes('-') ? '' : 'Bugün '}${r.bas} – ${r.bit} <span class="metin-soluk">(${P.sure(r.sure)})</span>`)}${satir('Hizmet', r.hizmet)}${satir('Personel', `<span style="display:inline-flex;gap:6px;align-items:center">${P.avatar(p, 'avatar--kucuk')}${p.ad}</span>`)}${satir('Ücret', `<span class="sayi">${para(r.tutar)}</span>`)}</div>
        ${goz ? `<div class="dugme-sirasi" style="margin-top:12px"><a class="dugme dugme--ikincil" style="flex:1" href="tel:${r.tel.replace(/\s/g, '')}">${ik('telefon')}${r.tel}</a><a class="dugme dugme--ikincil" href="https://wa.me/90${r.tel.replace(/\D/g, '').slice(1)}" target="_blank" rel="noopener" aria-label="WhatsApp’tan yaz">${ik('mesaj')}</a>${m ? `<a class="dugme dugme--ikincil" href="#musteri/${m.id}" data-katman-kapat aria-label="Müşteri kartını aç">${ik('personel')}</a>` : ''}</div>` : ''}
        ${r.saglikNotu && P.yetki('saglik') && goz ? `<p class="metin-14" style="margin-top:12px;display:flex;gap:6px;align-items:center;color:var(--renk-metin-ikincil)">${ik('kalp', 'ikon--16')}Sağlık notu var. İçeriği müşteri kartında görünür.</p>` : ''}
        <div class="alan" style="margin-top:16px"><label class="alan__etiket" for="rd-not">Not</label><textarea id="rd-not" maxlength="500" ${kilitli || !kendi ? 'readonly' : ''} placeholder="Randevu notu…">${r.not || ''}</textarea><p class="alan__ipucu">Sağlık bilgisi yazmayın. En çok 500 karakter.</p></div>
        ${kilitNot}${menu}`,
      alt: eylem,
    });
  }
  const durumDegis = (id, yeni, mesaj) => { const r = rnd(id); if (r) r.durum = yeni; P.tumKatmanlariKapat(); P.bildir(mesaj); setTimeout(PANEL.ciz, 200); };
  EYLEM.onayla = (el) => durumDegis(el.dataset.id, 'onayli', 'Randevu onaylandı.');
  EYLEM.baslat = (el) => durumDegis(el.dataset.id, 'suruyor', 'Randevu başladı.');
  EYLEM.gelmedi = (el) => { const r = rnd(el.dataset.id); P.onay({ baslik: '“Gelmedi” olarak işaretlensin mi?', metin: `${r.musteri}, ${r.bas} randevusu “Gelmedi” olur. Bu işlem sonra değiştirilemez.`, eylem: 'Gelmedi olarak işaretle', sonra: () => durumDegis(r.id, 'gelmedi', 'Randevu “Gelmedi” olarak işaretlendi.') }); };
  EYLEM['iptal-et'] = (el) => { const r = rnd(el.dataset.id); P.onay({ baslik: 'Randevuyu iptal etmek istiyor musunuz?', metin: `${r.musteri}, bugün ${r.bas} randevusu iptal edilir.`, vazgec: 'Randevuyu koru', eylem: 'Randevuyu iptal et', ek: `<div class="alan" style="margin-top:12px"><label class="alan__etiket" for="ip-neden">Neden <span class="istege-bagli">(isteğe bağlı)</span></label><select id="ip-neden"><option>Müşteri iptal etti</option><option>Personel izinli</option><option>Salon kapalı</option><option>Diğer</option></select></div>`, sonra: () => durumDegis(r.id, 'iptal', 'Randevu iptal edildi.') }); };
  EYLEM['randevu-sil'] = (el) => { const r = rnd(el.dataset.id); P.onay({ baslik: 'Randevu silinsin mi?', metin: `${r.musteri}, ${r.bas} randevusu kalıcı olarak silinir. İptal etmek yeterliyse “Randevuyu iptal et”i kullanın; iptal edilen randevu kayıtta kalır.`, eylem: 'Randevuyu sil', sonra: () => { P.tumKatmanlariKapat(); P.bildir('Randevu silindi.'); } }); };
  EYLEM['saat-degistir'] = (el) => {
    const r = rnd(el.dataset.id);
    const ss = bosSaatler(r.p, r.sure).filter((t) => t !== r.bas);
    const k = P.katmanAc({ baslik: 'Saati değiştir', kimlik: 'saat-degistir', geri: true,
      govde: `<p class="metin-ikincil" style="margin-bottom:12px">${r.musteri} · ${r.hizmet} · ${per(r.p).kisa}. Şu an: bugün ${r.bas}.</p><div class="gun-seridi" data-tekli style="margin-bottom:16px">${['Bugün|28', 'Per|29', 'Cum|30', 'Cmt|31'].map((x, i) => { const [a, n] = x.split('|'); return `<button class="gun" aria-pressed="${i === 0}"><span class="gun__ad">${a}</span><span class="gun__no">${n}</span></button>`; }).join('')}</div><div class="saatler" data-tekli role="group" aria-label="Boş saatler">${ss.map((t) => `<button class="saat" aria-pressed="false">${t}</button>`).join('')}</div>${P.rol === 'personel' ? '<p class="alan__ipucu" style="margin-top:12px">Yalnız kendi randevunuzu taşıyabilirsiniz (kurucu teyidi bekliyor).</p>' : ''}`,
      alt: `<button class="dugme dugme--ikincil" data-katman-kapat>Vazgeç</button><button class="dugme dugme--birincil" data-kaydet>Kaydet</button>` });
    k.kok.querySelector('[data-kaydet]').onclick = (e) => P.isle(e.currentTarget, 'Kaydediliyor…', () => { P.tumKatmanlariKapat(); P.bildir('Randevu saati değiştirildi.'); });
  };

  // ======================= Tamamla ve ödeme al =======================
  EYLEM.tamamla = (el) => {
    const r = rnd(el.dataset.id);
    const m = V.MUSTERILER.find((x) => x.ad === r.musteri);
    const tutarDuz = P.yetki('tutar-degistir');
    const paket = m?.paket && r.hizmet === 'Cilt bakımı (derin temizlik)' ? m.paket : null;
    const k = P.katmanAc({ baslik: 'Tamamla ve ödeme al', kimlik: 'tamamla-odeme',
      govde: `<p class="metin-ikincil" style="margin-bottom:16px">${r.musteri} · ${r.hizmet} · ${per(r.p).kisa}</p>
        ${paket ? `<div class="yigin yigin--8" data-tekli role="radiogroup" aria-label="Ödeme şekli" style="margin-bottom:16px"><button class="secim-kart" aria-pressed="false" data-deger="paket"><span class="secim-kart__ana"><span class="orta">Paketten düş</span><span class="metin-14 metin-soluk">${paket.ad} · ${paket.kalan} seans kaldı</span></span></button><button class="secim-kart" aria-pressed="true" data-deger="ode"><span class="secim-kart__ana"><span class="orta">Ödeme al</span></span></button></div>` : ''}
        <div class="alan"><label class="alan__etiket" for="tm-tutar">Tutar</label><div class="alan__on-ek"><span>₺</span><input class="alan__girdi sayi" id="tm-tutar" inputmode="decimal" autocomplete="off" value="${P.sayi(r.tutar)}" ${tutarDuz ? '' : 'readonly aria-describedby="tm-tutar-ipucu"'}></div>${tutarDuz ? '<p class="alan__ipucu">Hizmet fiyatı yazıldı. İndirim yaptıysanız değiştirin.</p>' : '<p class="alan__ipucu" id="tm-tutar-ipucu">Tutar hizmet fiyatıdır. Değişmesi gerekiyorsa resepsiyona haber verin.</p>'}</div>
        <fieldset class="alan" style="border:0;padding:0;margin:16px 0 0"><legend class="alan__etiket" style="margin-bottom:6px">Ödeme yöntemi</legend><div class="parcali parcali--tam" data-tekli><button aria-pressed="true" data-deger="Nakit">${ik('nakit', 'ikon--16')} Nakit</button><button aria-pressed="false" data-deger="Kart">${ik('kart', 'ikon--16')} Kart</button></div></fieldset>
        ${P.yetki('bahsis-gir') ? `<details style="margin-top:16px"><summary class="orta" style="cursor:pointer;min-height:44px;display:flex;align-items:center">Bahşiş ekle <span class="metin-soluk" style="font-weight:400">&nbsp;(isteğe bağlı)</span></summary><div class="alan-satir" style="margin-top:8px"><div class="alan"><label class="alan__etiket" for="tm-bahsis">Tutar</label><div class="alan__on-ek"><span>₺</span><input class="alan__girdi" id="tm-bahsis" inputmode="decimal" autocomplete="off" placeholder="0"></div></div><div class="alan"><label class="alan__etiket" for="tm-kime">Kime</label><select id="tm-kime"><option>${per(r.p).kisa}</option><option>Salon havuzu</option></select></div></div></details>` : ''}`,
      alt: `<button class="dugme dugme--birincil" style="flex:1" data-ode>Ödeme al · ${para(r.tutar)}</button>` });
    k.kok.querySelector('[data-ode]').onclick = (e) => P.isle(e.currentTarget, 'Ödeme kaydediliyor…', () => { r.durum = 'bitti'; P.tumKatmanlariKapat(); P.bildir('Ödeme alındı.'); setTimeout(PANEL.ciz, 200); });
    k.kok.querySelector('[role=radiogroup]')?.addEventListener('secim', (e) => { const b = k.kok.querySelector('[data-ode]'); const f = k.kok.querySelector('#tm-tutar').closest('.alan'); const ft = k.kok.querySelector('fieldset'); const pk = e.detail === 'paket'; f.hidden = pk; ft.hidden = pk; b.textContent = pk ? 'Seans düş ve tamamla' : `Ödeme al · ${para(r.tutar)}`; });
  };

  // ======================= Randevusuz işlem =======================
  EYLEM['hizli-islem'] = () => {
    const k = P.katmanAc({ baslik: 'Randevusuz işlem', kimlik: 'hizli-islem',
      govde: `<p class="metin-ikincil" style="margin-bottom:16px">Randevusu olmadan gelen müşterinin hizmetini ve ödemesini tek seferde kaydedin.</p>
        <div class="alan"><label class="alan__etiket" for="hi-m">Müşteri</label><div class="alan__kutu">${ik('ara')}<input class="alan__girdi" id="hi-m" type="search" autocomplete="off" placeholder="Ad veya telefon…" data-ilk-odak></div></div>
        <div class="alan"><label class="alan__etiket" for="hi-h">Hizmet</label><select id="hi-h">${V.HIZMETLER.map((h) => `<option>${h.ad} · ${para(h.fiyat)}</option>`).join('')}</select></div>
        <div class="alan"><label class="alan__etiket" for="hi-p">Personel</label><select id="hi-p">${V.PERSONEL.filter((p) => !p.hizmetVermez && (P.rol !== 'personel' || p.id === benim().id)).map((p) => `<option>${p.ad}</option>`).join('')}</select></div>
        <div class="alan-satir"><div class="alan"><label class="alan__etiket" for="hi-t">Tutar</label><div class="alan__on-ek"><span>₺</span><input class="alan__girdi" id="hi-t" inputmode="decimal" value="850" autocomplete="off"></div></div><div class="alan"><label class="alan__etiket" for="hi-s">Saat <span class="istege-bagli">(isteğe bağlı)</span></label><input class="alan__girdi" id="hi-s" type="time" value="14:20"></div></div>
        <fieldset class="alan" style="border:0;padding:0;margin:16px 0 0"><legend class="alan__etiket" style="margin-bottom:6px">Ödeme yöntemi</legend><div class="parcali parcali--tam" data-tekli><button aria-pressed="true">Nakit</button><button aria-pressed="false">Kart</button></div></fieldset>`,
      alt: `<button class="dugme dugme--ikincil" data-katman-kapat>Vazgeç</button><button class="dugme dugme--birincil" data-ode>Ödeme al</button>` });
    k.kok.querySelector('[data-ode]').onclick = (e) => P.isle(e.currentTarget, 'Ödeme kaydediliyor…', () => { k.kapat(); P.bildir('Ödeme alındı.'); });
  };

  // ---------------- Yönlendirme ve çizim ----------------
  const YETKI_EKRAN = { bugun: 'bugun', gunum: 'gunum', takvim: 'takvim', musteriler: 'musteriler', musteri: 'musteriler', bekleme: 'bekleme', kasa: 'kasa', hizmetler: 'hizmetler', personel: 'personel', 'personel-detay': 'personel', primim: 'primim', raporlar: 'raporlar', hesaplar: 'yonetim', cari: 'yonetim', faturalar: 'yonetim', 'fatura-yeni': 'yonetim', tedarikciler: 'yonetim', stok: 'yonetim', paketler: 'yonetim', odemeler: 'yonetim', bahsis: 'yonetim', ayarlar: 'ayarlar', hesabim: 'hesabim', asistan: 'ayar-asistan', menu: 'hesabim', 'abonelik-bitti': 'hesabim', 'yeniden-kabul': 'hesabim', 'musteri-yeni': 'musteri-duzenle' };
  const GERI = { musteri: '#musteriler', 'personel-detay': '#personel', 'fatura-yeni': '#faturalar', 'musteri-yeni': '#musteriler' };
  function ciz() {
    const [ekranHam, arg] = (location.hash.slice(1) || anaEkran()).split('/');
    let ekran = ekranHam;
    if (ekran === 'bugun' && anaEkran() === 'gunum') ekran = 'gunum';
    if (ekran === 'gunum' && anaEkran() !== 'gunum') ekran = 'bugun';
    const kok = document.getElementById('ana');
    const tanim = E[ekran];
    const aktif = ekran === 'musteri' || ekran === 'musteri-yeni' ? 'musteriler' : ekran === 'personel-detay' ? 'personel' : ekran === 'fatura-yeni' ? 'faturalar' : ekran;
    yanMenu(aktif); altMenu(aktif);
    let sonuc;
    if (!tanim) sonuc = { html: `<div class="bos bos--orta kart"><span class="bos__ikon">${ik('bilgi')}</span><h1 class="bos__baslik">Sayfa bulunamadı.</h1><p class="bos__metin">Adres yanlış yazılmış ya da sayfa kaldırılmış olabilir.</p><a class="dugme dugme--birincil" href="#${anaEkran()}">${anaEkran() === 'gunum' ? 'Günüm’e dön' : 'Bugün’e dön'}</a></div>` };
    else if (D === 'yetkisiz' || (YETKI_EKRAN[ekran] && !P.yetki(YETKI_EKRAN[ekran]))) sonuc = { html: H.yetkisiz(), baslik: 'Yetkiniz yok' };
    else sonuc = tanim(arg);
    kok.innerHTML = (P.klinik && P.param('2fa') === 'yok' ? `<div class="serit serit--uyari" style="margin-bottom:16px" data-testid="2fa-serit">${ik('kilit')}<span class="serit__metin"><strong>İki adımlı doğrulama kurulmadı.</strong><span>Kurulana kadar sağlık bilgileri, onamlar ve klinik notları kapalıdır.</span></span><a class="dugme dugme--ikincil dugme--kucuk" href="giris.html?tur=${P.tur}#2fa-kur">Şimdi kur</a></div>` : '') + sonuc.html;
    kok.dataset.ekran = ekran; kok.dataset.durum = D;
    kok.querySelectorAll('table.tablo').forEach((t) => { const h = [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()); t.querySelectorAll('tbody tr, tfoot tr').forEach((tr) => [...tr.children].forEach((c, i) => { if (!c.hasAttribute('colspan')) c.dataset.etiket = h[i] || ''; })); });
    document.body.toggleAttribute('data-sade', ['abonelik-bitti', 'yeniden-kabul'].includes(ekran));
    const h1 = kok.querySelector('h1');
    const baslik = sonuc.baslik || h1?.textContent || 'BeautyOS';
    document.title = `${baslik} · ${V.SALON.ad} · BeautyOS`;
    ustBar(GERI[ekran] ? baslik : '', GERI[ekran]);
    sonuc.sonra && sonuc.sonra(kok, arg);
  }

  // Olay devri: data-eylem
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-eylem]');
    if (!el) return;
    const f = EYLEM[el.dataset.eylem];
    if (f) { e.preventDefault(); f(el, e); }
  });
  EYLEM['grup-ac'] = (el) => { const acik = el.getAttribute('aria-expanded') !== 'true'; localStorage.setItem('bos-yonetim-acik', acik ? '1' : '0'); ciz(); };
  EYLEM['yeniden-dene'] = (el) => { P.isle(el, 'Yükleniyor…', () => { const u = new URL(location.href); u.searchParams.set('durum', 'normal'); location.href = u.toString(); }, 600); };

  window.PANEL = {
    E, EYLEM, H, ciz, per, hiz, rnd, randevuYeni,
    baslat() {
      window.addEventListener('hashchange', () => { ciz(); document.getElementById('ana').focus({ preventScroll: true }); window.scrollTo(0, 0); });
      ciz(); P.cubuk();
      if (P.param('ac') === 'randevu-yeni') setTimeout(() => randevuYeni(), 50);
      if (P.param('ac') === 'randevu-detay') setTimeout(() => randevuAc(P.param('id', 'r7')), 50);
      if (P.param('ac') === 'tamamla') setTimeout(() => EYLEM.tamamla({ dataset: { id: P.param('id', 'r3') } }), 50);
      if (P.param('ac') === 'hizli-islem') setTimeout(() => EYLEM['hizli-islem'](), 50);
      if (P.param('ac') && EYLEM[P.param('ac')] && !['randevu-yeni', 'randevu-detay', 'tamamla', 'hizli-islem'].includes(P.param('ac'))) setTimeout(() => EYLEM[P.param('ac')]({ dataset: { id: P.param('id', '') } }), 50);
    },
  };
})();
