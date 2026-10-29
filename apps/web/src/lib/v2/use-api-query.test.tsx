import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from './api-client'
import type { ApiClient } from './api-client'
import { ApiClientProvider } from './api-context'
import { useApiQuery } from './use-api-query'

const client = { request: vi.fn() } as unknown as ApiClient
const wrapper = ({ children }: { children: ReactNode }) => <ApiClientProvider client={client}>{children}</ApiClientProvider>

afterEach(cleanup)

describe('W10: useApiQuery', () => {
  it('veriyi getirir; yüklenirken loading true, sonra false', async () => {
    const { result } = renderHook(() => useApiQuery('a', async () => 42), { wrapper })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(result.current.error).toBeUndefined()
    expect(result.current.loadedAt).toBeInstanceOf(Date)
  })

  it('anahtar null ise istek atılmaz ve loading false kalır', () => {
    const fetcher = vi.fn()
    const { result } = renderHook(() => useApiQuery(null, fetcher), { wrapper })
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })

  it('hata ApiError olarak döner; ApiError olmayan hata NETWORK sayılır', async () => {
    const { result } = renderHook(() => useApiQuery('b', async () => { throw new TypeError('x') }), { wrapper })
    await waitFor(() => expect(result.current.error).toBeDefined())
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error?.code).toBe('NETWORK')
  })

  it('yeniden dene: hata sonrası refetch yeni istek atar ve başarılı olursa hata temizlenir', async () => {
    let calls = 0
    const { result } = renderHook(
      () => useApiQuery('c', async () => {
        calls += 1
        if (calls === 1) throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
        return 'tamam'
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.error?.code).toBe('INTERNAL_ERROR'))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.data).toBe('tamam'))
    expect(result.current.error).toBeUndefined()
    expect(calls).toBe(2)
  })

  it('hata sonrası önceki başarılı veri ve yükleme saati korunur', async () => {
    let calls = 0
    const { result } = renderHook(
      () => useApiQuery('d', async () => {
        calls += 1
        if (calls === 2) throw new ApiError({ status: 0, code: 'NETWORK' })
        return calls
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.data).toBe(1))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error?.code).toBe('NETWORK'))
    expect(result.current.data).toBe(1)
    expect(result.current.loadedAt).toBeInstanceOf(Date)
  })

  it('anahtar değişince yeni istek atılır; eski isteğin geç gelen sonucu yok sayılır', async () => {
    let resolveFirst: (v: string) => void = () => {}
    const first = new Promise<string>((resolve) => { resolveFirst = resolve })
    const { result, rerender } = renderHook(
      ({ k }: { k: string }) => useApiQuery(k, (_c, signal) => (k === 'x' ? first.then((v) => (signal.aborted ? 'eski' : v)) : Promise.resolve('yeni'))),
      { wrapper, initialProps: { k: 'x' } },
    )
    rerender({ k: 'y' })
    await waitFor(() => expect(result.current.data).toBe('yeni'))
    await act(async () => { resolveFirst('gec') })
    expect(result.current.data).toBe('yeni')
  })

  it('W10-1 K1: anahtar değişince eski anahtarın verisi dönmez (yüklenirken data undefined)', async () => {
    let resolveB: (v: string) => void = () => {}
    const b = new Promise<string>((resolve) => { resolveB = resolve })
    const { result, rerender } = renderHook(
      ({ k }: { k: string }) => useApiQuery(k, () => (k === 'a' ? Promise.resolve('VERI-A') : b)),
      { wrapper, initialProps: { k: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('VERI-A'))
    rerender({ k: 'b' })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()
    expect(result.current.loadedAt).toBeUndefined()
    await act(async () => { resolveB('VERI-B') })
    expect(result.current.data).toBe('VERI-B')
  })

  it('W10-1 K1: yeni anahtar hata verirse data undefined ve error dolu (başka anahtarın verisi korunmaz)', async () => {
    const { result, rerender } = renderHook(
      ({ k }: { k: string }) => useApiQuery(k, async () => {
        if (k === 'b') throw new ApiError({ status: 500, code: 'INTERNAL_ERROR' })
        return 'VERI-A'
      }),
      { wrapper, initialProps: { k: 'a' } },
    )
    await waitFor(() => expect(result.current.data).toBe('VERI-A'))
    rerender({ k: 'b' })
    await waitFor(() => expect(result.current.error?.code).toBe('INTERNAL_ERROR'))
    expect(result.current.data).toBeUndefined()
    expect(result.current.loadedAt).toBeUndefined()
  })

  it('W10-1 K1: anahtara dönülünce hata yenilemesinde aynı anahtarın verisi korunur', async () => {
    let calls = 0
    const { result } = renderHook(() => useApiQuery('s', async () => {
      calls += 1
      if (calls === 2) throw new ApiError({ status: 0, code: 'NETWORK' })
      return 'ilk'
    }), { wrapper })
    await waitFor(() => expect(result.current.data).toBe('ilk'))
    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error).toBeDefined())
    expect(result.current.data).toBe('ilk')
  })
})
