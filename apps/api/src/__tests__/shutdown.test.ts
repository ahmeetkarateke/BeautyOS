import { describe, it, expect, vi } from 'vitest'
import { createShutdown } from '../lib/shutdown'

const log = () => ({ info: vi.fn(), error: vi.fn() })

describe('G5-K3: SIGTERM kapanisi', () => {
  it('K3: kaynaklar verilen sirada kapanir ve cikis kodu 0 olur', async () => {
    const order: string[] = []
    const exit = vi.fn()
    const run = createShutdown({
      closers: [
        { name: 'http', close: async () => { order.push('http') } },
        { name: 'worker', close: async () => { order.push('worker') } },
        { name: 'redis', close: async () => { order.push('redis') } },
        { name: 'prisma', close: async () => { order.push('prisma') } },
      ],
      timeoutMs: 10_000, exit, log: log(),
    })
    await run()
    expect(order).toEqual(['http', 'worker', 'redis', 'prisma'])
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(0)
  })

  it('K3: bir kaynak kapanmasa da digerleri kapanir, cikis kodu 1', async () => {
    const closed: string[] = []
    const exit = vi.fn()
    const l = log()
    await createShutdown({
      closers: [
        { name: 'worker', close: async () => { throw new Error('boom') } },
        { name: 'prisma', close: async () => { closed.push('prisma') } },
      ],
      timeoutMs: 10_000, exit, log: l,
    })()
    expect(closed).toEqual(['prisma'])
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(1)
    expect(l.error).toHaveBeenCalled()
  })

  it('K3: takilan kapanis sure dolunca zorla cikis (1) verir', async () => {
    vi.useFakeTimers()
    const exit = vi.fn()
    void createShutdown({
      closers: [{ name: 'worker', close: () => new Promise(() => {}) }],
      timeoutMs: 10_000, exit, log: log(),
    })()
    await vi.advanceTimersByTimeAsync(9_999)
    expect(exit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    expect(exit).toHaveBeenCalledTimes(1)
    expect(exit).toHaveBeenCalledWith(1)
    vi.useRealTimers()
  })

  it('K3: ikinci SIGTERM kapanisi yeniden baslatmaz', async () => {
    const close = vi.fn()
    const run = createShutdown({ closers: [{ name: 'a', close }], timeoutMs: 10_000, exit: vi.fn(), log: log() })
    await Promise.all([run(), run()])
    expect(close).toHaveBeenCalledTimes(1)
  })
})
