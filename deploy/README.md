# BeautyOS dağıtım notları

İmajlar **sunucuda** derlenir (ADR-0018); GHCR ve `docker login` yoktur. Derleme kaynağı sunucudaki
`/srv/beautyos/kaynak` deposudur ve GitHub'a **salt okunur deploy key** ile bağlanır.

## Deploy key kurulumu (bir kez, kurucu sunucuda)

1. Sunucuda `karateke` olarak anahtar üret (parolasız; yalnız bu depoyu okur):

   ```
   ssh-keygen -t ed25519 -N '' -C 'beautyos-deploy (salt okunur)' -f ~/.ssh/beautyos_deploy
   cat ~/.ssh/beautyos_deploy.pub
   ```

2. GitHub'da `beautyos` deposu > Settings > Deploy keys > Add deploy key: başlık `sirket-sunucu-1`, açık anahtarı yapıştır.
   **"Allow write access" işaretlenmez.**
3. `~/.ssh/config` dosyasına takma ad ekle (bu anahtar dışında anahtar denenmesin diye `IdentitiesOnly yes`):

   ```
   Host github-beautyos
       HostName github.com
       User git
       IdentityFile ~/.ssh/beautyos_deploy
       IdentitiesOnly yes
   ```

4. Salt okunur erişimi doğrula. `ssh -T` depoyu tanımalı; yazma denemesi reddedilmeli:

   ```
   ssh -T git@github-beautyos        # "Hi ahmeetkarateke/beautyos! You've successfully authenticated, but GitHub does not provide shell access."
   ```

5. Depoyu klonla (anahtar yolu hiçbir betikte yazmaz; yalnız takma ad kullanılır):

   ```
   git clone git@github-beautyos:ahmeetkarateke/beautyos.git /srv/beautyos/kaynak
   ```

## Derleme

```
bash /srv/beautyos/betikler/derle.sh <commit-sha>      # en az 12 haneli onaltılık kimlik; dal/etiket/HEAD kabul edilmez
```

Üretilen imajlar: `beautyos-api:<sha12>`, `beautyos-web:<sha12>-prod`, `beautyos-web:<sha12>-staging`.
Web değerleri commit'teki `deploy/derleme.conf` dosyasından gelir. Derleme sırasında tepe bellek, swap ve canlı api sağlığı raporlanır.
Yayın için `.env` içinde `BEAUTYOS_VERSION` / `BEAUTYOS_STAGING_VERSION` güncellenir (önce staging).

## Eski imajları temizleme

```
bash /srv/beautyos/betikler/imaj-temizle.sh --dry-run   # önce ne silineceğini göster
bash /srv/beautyos/betikler/imaj-temizle.sh             # kurucu kuralı onayladıktan sonra
```

Her imaj ailesinde en yeni 3 sürüm kalır; bir konteynerin kullandığı ya da `.env`'de adı geçen sürüm asla silinmez.
Otomatik (zamanlanmış) çağrı yoktur.

## Şema uyum kontrolü

`bash /srv/beautyos/betikler/sema-karsilastir.sh <kaynak|hedef|karsilastir>` (ayrıntı: betiğin başındaki açıklama).
`.env.supabase` değerleri **tırnaksız** yazılır (docker `--env-file` tırnağı değerin parçası sayar).
