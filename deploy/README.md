# BeautyOS dağıtım notları

İmajlar **sunucuda** derlenir (ADR-0018). Sunucu GitHub'dan **çekmez** (ADR-0019): deploy key yoktur ve taşıma dalları
GitHub'a gönderilmez. Kaynak, müdürün onayladığı commit'in Windows'ta paketlenip sunucuya aktarılmasıyla gelir.

## Kaynak paketini hazırlama ve aktarma (müdür, Windows)

Depo klasöründe, `<tam-sha>` onaylı commit'in 40 haneli kimliği, `<sha12>` ilk 12 hanesidir:

```
git -c core.autocrlf=false archive --format=tar -o beautyos-<sha12>.tar <tam-sha>
```

`-c core.autocrlf=false` şarttır: aksi halde Windows'ta dosyalar CRLF'ye çevrilir, kabuk betikleri ve Dockerfile'lar bozulur,
Prisma migration checksum'ları değişir. (Depodaki `.gitattributes` kritik dosyaları zaten LF'ye zorlar; bu bayrak ek güvencedir.)
Kök `.gitattributes` artık TÜM metin dosyaları için `* text=auto eol=lf` uygular (ikili türler `binary` istisnası): Windows'ta `core.autocrlf` ne olursa olsun depoda ve çalışma ağacında LF kalır, CRLF'li commit ve sahte satır farkı oluşmaz. Eski bir dalda CRLF'li dosya varsa dalı şöyle birleştirilir: `git merge -X renormalize <dal>` (çakışmasız geçer) ve ardından `git add --renormalize .` çalıştırılır (yalnız dal tarafında değişen dosyalar CRLF kalabilir, bu adım zorunludur); yalnız satır sonu değişen dosyalar ayrı bir commit'e konur.

Özet dosyasını `sha256sum -c` biçiminde yaz (`certutil` çıktısı bu biçimde DEĞİLDİR; Git Bash'te `sha256sum` kullan):

```
sha256sum beautyos-<sha12>.tar | sed 's/beautyos-<sha12>.tar/kaynak.tar/' > kaynak.tar.sha256
printf '%s\n' <tam-sha> > commit.txt
```

Sunucuya aktar (hedef dizin yoksa önce oluştur):

```
ssh karateke@209.38.237.171 "mkdir -p /srv/beautyos/kaynak/<sha12>"
scp beautyos-<sha12>.tar karateke@209.38.237.171:/srv/beautyos/kaynak/<sha12>/kaynak.tar
scp kaynak.tar.sha256 commit.txt karateke@209.38.237.171:/srv/beautyos/kaynak/<sha12>/
```

## Derleme (sunucuda)

```
bash /srv/beautyos/betikler/derle.sh <tam-sha>      # 40 haneli kimlik; kısa sha, dal, etiket, HEAD kabul edilmez
```

Betik önce paketi doğrular: üç dosya var mı, `sha256sum -c`, tar içindeki commit kimliği (`git get-tar-commit-id`) = `commit.txt` = argüman;
sonra boş `agac/` altına açar ve derler. Bir doğrulama başarısız olursa `docker build` hiç çalışmaz.
Sunucuda `git` kurulu olmalıdır (yalnız commit kimliğini okumak için; ağa bağlanmaz).

Üretilen imajlar: `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod`, `beautyos-web:<sha12>-staging`.
Web değerleri paketteki `deploy/derleme.conf` dosyasından gelir. Yeni arayüz yüzey bayrağı `NEXT_PUBLIC_UI_V2_PROD` / `_STAGING` ilgili
web imajına `NEXT_PUBLIC_UI_V2` olarak geçer; boş ya da tanımsız = v2 kapalı, değer yalnız `[a-z,]` olabilir (aksi halde derleme başlamadan durur).
Staging'de şu an yalnız `panel` açıktır; yüzeyler (auth, book, site, admin) HAZIR oldukça eklenir. Yer tutucu sayfalı bir yüzeyin açılması staging'i kullanılamaz yapar (2e551d6'da görüldü).
Tasarım sistemi vitrini (`/v2/tasarim-sistemi`) için `NEXT_PUBLIC_UI_V2_SHOWCASE_STAGING=1` yalnız staging imajına `NEXT_PUBLIC_UI_V2_SHOWCASE` olarak geçer;
canlı için `..._SHOWCASE_PROD` ya da `..._SHOWCASE` anahtarı tanımlanamaz (derle.sh derlemeyi durdurur). İlk canlı yayından sonra `/v2/tasarim-sistemi` adresinin 404 döndüğü yayın kaydına yazılır.. Derleme sırasında tepe bellek, swap ve canlı api sağlığı raporlanır.
Aynı sürümü yeniden derlemek için o paketin `agac/` dizininin önce temizlenmesi gerekir (betik dolu `agac/` üzerine yazmaz).

## Yayın (sunucuda)

```
bash /srv/beautyos/betikler/yayinla.sh --kuru staging <sha12>      # plan + şimdiki imaj satırları, hiçbir şey değişmez
bash /srv/beautyos/betikler/yayinla.sh staging <sha12>             # staging: önce api-staging, sonra web-staging
bash /srv/beautyos/betikler/yayinla.sh --onayli canli <sha12>      # canlı: yalnız staging'de çalışan sürüm; --onayli zorunlu
bash /srv/beautyos/betikler/yayinla.sh --migrate [--onayli] ...    # migration'lı yayın: önce YENİ imajla migration, sonra api, sonra web
```

Sürüm değişkenleri (`BEAUTYOS_VERSION`, `BEAUTYOS_STAGING_VERSION`, `BEAUTYOS_PREVIOUS_VERSION`) gizli değildir ve ortam
dosyasında değil `/srv/beautyos/surum.conf` dosyasındadır (üç satır, 644). Betik compose'u
`--env-file <ortam dosyası> --env-file surum.conf` ile çalıştırır; aynı değişken iki dosyada varsa sonuncusu (surum.conf) kazanır.

**Geçişte ortam dosyasındaki üç sürüm satırı SİLİNİR (zorunlu).** Kalırlarsa surum.conf'suz bir `docker compose up -d --force-recreate --no-deps api`
(örn. gizli anahtar yükledikten sonra) canlı api'yi eski sürüme döndürür; web yeni kalır ve eski devCode açığı yeniden açılabilir.
Bu yüzden `yayinla.sh` bu üç anahtar ortam dosyasında varsa gerçek yayında exit 2 verir (yalnız anahtar adı aranır; `--kuru` yalnız uyarır).
Silindikten sonra surum.conf'suz sıradan compose "tanımlı olmalı" hatasıyla durur. Elle compose gerekirse her zaman
`docker compose -p beautyos --env-file .env --env-file surum.conf ...` yazılır.

- Sıra her zaman api, sonra web; her adımdan sonra konteyner `healthy` ve dış adres (`/health` 200, staging web 401, canlı web 200) beklenir.
- Hata olursa `surum.conf` eski haline döner ve api + web BİRLİKTE yeniden oluşturulur (çıkış 1). Geri alma da başarısızsa çıkış 3: elle müdahale.
- `api` ve `api-staging` için `stop_grace_period: 15s` (D6): uygulamanın kapanış süresi 10 sn olduğundan docker'ın 10 sn'lik varsayılanı payı bırakmıyordu. Ayar compose.yml sunucuya kurulduktan sonra konteyner yeniden oluşturulunca geçerli olur: staging, staging yayınıyla birlikte; CANLI api yalnızca yeni canlı yayında (kurucu onayıyla) yeniden oluştuğunda uygulanır. Bunun için tek başına canlı api yeniden oluşturulmaz.
- Canlı yayında eski `BEAUTYOS_VERSION`, `BEAUTYOS_PREVIOUS_VERSION` olur (`imaj-temizle.sh` onu ve kaynak paketini korur).
- Migration yalnız açık `--migrate` ile çalışır (canlı için `[ONAY]`, `--onayli` beyanına dahildir): `migrate`/`migrate-staging` YENİ imajla, api yeniden oluşturulmadan ÖNCE koşar.
  Başarısızsa hiçbir şey değişmez (çıkış 1); kısmi uygulanmış olabilir, veri geri yükleme elle ve `[ONAY]`'lıdır. Elle: `BEAUTYOS_VERSION=<yeni> docker compose ... --profile migrate run --rm migrate`.
  İmajlar önceden `derle.sh` ile derlenmiş olmalıdır.
- Staging web dış kontrolü beklenen 401'i Caddy basic_auth'tan alır; web-staging çökse de 401 gelir. Bu yüzden asıl kanıt konteynerin `healthy` olmasıdır, 401 ek kanıttır.
- `compose config` çıktısı gizli değer içerir; betik yalnız servis adı + `image` satırlarını gösterir. Kayıt: `/srv/beautyos/yayinla.log`.
- İlk kurulum: `surum.conf` mevcut çalışan etiketlerle elle oluşturulur (hiçbir konteyner değişmemeli; `--kuru` ile doğrulanır).
- Betik testi (sahte docker, ağ yok): `bash deploy/betikler/test-yayinla.sh`.

## Eski imajları ve kaynak paketlerini temizleme

```
bash /srv/beautyos/betikler/imaj-temizle.sh --dry-run   # önce ne silineceğini göster
bash /srv/beautyos/betikler/imaj-temizle.sh             # kurucu kuralı onayladıktan sonra
```

Her imaj ailesinde ve `kaynak/<sha12>/` dizinlerinde en yeni 3 sürüm kalır; bir konteynerin kullandığı ya da `.env`'de adı geçen
sürüm asla silinmez; hâlâ imajı bulunan paketin kaynağı da silinmez. Otomatik (zamanlanmış) çağrı yoktur.

## Şema uyum kontrolü

`bash /srv/beautyos/betikler/sema-karsilastir.sh <kaynak|hedef|karsilastir>` (ayrıntı: betiğin başındaki açıklama).
`.env.supabase` değerleri **tırnaksız** yazılır (docker `--env-file` tırnağı değerin parçası sayar).
