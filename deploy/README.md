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
Web değerleri paketteki `deploy/derleme.conf` dosyasından gelir. Derleme sırasında tepe bellek, swap ve canlı api sağlığı raporlanır.
Aynı sürümü yeniden derlemek için o paketin `agac/` dizininin önce temizlenmesi gerekir (betik dolu `agac/` üzerine yazmaz).

## Yayın (sunucuda)

```
bash /srv/beautyos/betikler/yayinla.sh --kuru staging <sha12>      # plan + şimdiki imaj satırları, hiçbir şey değişmez
bash /srv/beautyos/betikler/yayinla.sh staging <sha12>             # staging: önce api-staging, sonra web-staging
bash /srv/beautyos/betikler/yayinla.sh --onayli canli <sha12>      # canlı: yalnız staging'de çalışan sürüm; --onayli zorunlu
```

Sürüm değişkenleri (`BEAUTYOS_VERSION`, `BEAUTYOS_STAGING_VERSION`, `BEAUTYOS_PREVIOUS_VERSION`) gizli değildir ve ortam
dosyasında değil `/srv/beautyos/surum.conf` dosyasındadır (üç satır, 644). Betik compose'u
`--env-file <ortam dosyası> --env-file surum.conf` ile çalıştırır; aynı değişken iki dosyada varsa sonuncusu (surum.conf) kazanır,
yani ortam dosyasındaki eski sürüm satırları etkisizdir ve sonra silinebilir.

- Sıra her zaman api, sonra web; her adımdan sonra konteyner `healthy` ve dış adres (`/health` 200, staging web 401, canlı web 200) beklenir.
- Hata olursa `surum.conf` eski haline döner ve api + web BİRLİKTE yeniden oluşturulur (çıkış 1). Geri alma da başarısızsa çıkış 3: elle müdahale.
- Canlı yayında eski `BEAUTYOS_VERSION`, `BEAUTYOS_PREVIOUS_VERSION` olur (`imaj-temizle.sh` onu ve kaynak paketini korur).
- Migration yapmaz; migration ayrı ve `[ONAY]`'lıdır. İmajlar önceden `derle.sh` ile derlenmiş olmalıdır.
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
