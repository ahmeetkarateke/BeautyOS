// Düzgün kapanış (G5-K3): SIGTERM'de kaynaklar sırayla kapatılır, süre dolarsa zorla çıkılır.

export interface Closer {
  name: string
  close: () => Promise<unknown> | unknown
}

export interface ShutdownDeps {
  closers: Closer[]
  timeoutMs: number
  exit: (code: number) => void
  log: { info: (obj: object, msg: string) => void; error: (obj: object, msg: string) => void }
}

/** Dönen fonksiyon bir kez çalışır; tekrar çağrılırsa yok sayılır. Bir kaynağın kapanış hatası diğerlerini engellemez. */
export function createShutdown(deps: ShutdownDeps): () => Promise<void> {
  let started = false
  return async () => {
    if (started) return
    started = true
    let failed = false
    const timer = setTimeout(() => {
      deps.log.error({ timeoutMs: deps.timeoutMs }, 'Kapanış süresi doldu, zorla çıkılıyor')
      deps.exit(1)
    }, deps.timeoutMs)
    timer.unref?.()
    for (const closer of deps.closers) {
      try {
        await closer.close()
        deps.log.info({ resource: closer.name }, 'Kapatıldı')
      } catch (err) {
        failed = true
        deps.log.error({ resource: closer.name, err }, 'Kapatılamadı')
      }
    }
    clearTimeout(timer)
    deps.exit(failed ? 1 : 0)
  }
}
