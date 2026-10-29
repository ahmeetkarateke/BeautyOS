import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider, toastDuration, useToast } from './toast'

function Trigger({ options }: { options: Parameters<ReturnType<typeof useToast>['show']>[0] }) {
  const { show } = useToast()
  return (
    <button type="button" onClick={() => show(options)}>
      göster
    </button>
  )
}

function setup(options: Parameters<typeof Trigger>[0]['options']) {
  render(
    <ToastProvider>
      <Trigger options={options} />
    </ToastProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'göster' }))
}

describe('Bildirim süresi (tasarim.md §4)', () => {
  it('W3: 4 sn; geri al varsa 8 sn', () => {
    expect(toastDuration({ message: 'x' })).toBe(4000)
    expect(toastDuration({ message: 'x', undo: () => {} })).toBe(8000)
  })
})

describe('Toast', () => {
  it('W3: mesaj role=status bölgesinde görünür ve kapatma düğmesi vardır', () => {
    setup({ message: 'Müşteri eklendi.' })
    expect(screen.getByText('Müşteri eklendi.')).toBeTruthy()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Bildirimi kapat' })).toBeTruthy()
  })

  it('W3: kapat düğmesi bildirimi kaldırır', async () => {
    setup({ message: 'Müşteri eklendi.' })
    fireEvent.click(screen.getByRole('button', { name: 'Bildirimi kapat' }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(screen.queryByText('Müşteri eklendi.')).toBeNull()
  })

  it('W3: Geri al düğmesi eylemi çağırır ve bildirimi kapatır', async () => {
    const undo = vi.fn()
    setup({ message: 'Müşteri silindi.', undo })
    fireEvent.click(screen.getByRole('button', { name: 'Geri al' }))
    expect(undo).toHaveBeenCalledTimes(1)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(screen.queryByText('Müşteri silindi.')).toBeNull()
  })

  it('W3: hata bildirimi ayrı (koyu kırmızı) görünüm sınıfı alır', () => {
    setup({ message: 'Kaydedilemedi.', tone: 'error' })
    const root = screen.getByText('Kaydedilemedi.').closest('li') as HTMLElement
    expect(root.getAttribute('data-tone')).toBe('error')
  })

  it('W3: ToastProvider dışında useToast anlaşılır hata verir', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger options={{ message: 'x' }} />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})
