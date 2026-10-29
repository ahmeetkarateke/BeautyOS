import './test-polyfills'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'
import { Sheet } from './sheet'

function SheetDemo({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Randevu oluştur
      </button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          onOpenChange?.(next)
        }}
        title="Yeni randevu"
        description="Müşteri ve saat seçin."
        footer={<button type="button">Randevuyu kaydet</button>}
      >
        <input aria-label="Müşteri adı" />
      </Sheet>
    </>
  )
}

describe('Katman: alt sayfa / diyalog (tasarim.md §4)', () => {
  it('W4: dialog rolü başlık ve açıklamayla adlanır; eylemler (footer) görünür', async () => {
    const user = userEvent.setup()
    render(<SheetDemo />)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    const dialog = screen.getByRole('dialog', { name: 'Yeni randevu' })
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Müşteri ve saat seçin.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Randevuyu kaydet' })).toBeTruthy()
  })

  it('W4: Esc kapatır ve odak açan düğmeye döner', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SheetDemo onOpenChange={onOpenChange} />)
    const opener = screen.getByRole('button', { name: 'Randevu oluştur' })
    await user.click(opener)
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('W4: Kapat düğmesi kapatır; arka plana dokunmak da kapatır', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<SheetDemo onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    await user.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    const overlay = document.querySelector('[data-sheet-overlay]') as HTMLElement
    expect(overlay).toBeTruthy()
    fireEvent.pointerDown(overlay)
    fireEvent.pointerUp(overlay)
    fireEvent.click(overlay)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('W4: telefonda alt sayfa (tutamaç, en çok 92dvh, üst köşe 16), 768 px üstünde ortalanmış diyalog', async () => {
    const user = userEvent.setup()
    render(<SheetDemo />)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    const cls = screen.getByRole('dialog').className
    expect(cls).toContain('max-h-[92dvh]')
    expect(cls).toContain('rounded-t-sheet')
    expect(cls).toContain('md:max-w-140')
    expect(document.querySelector('[data-sheet-handle]')).toBeTruthy()
  })

  it('W4: gövde kendi içinde kayar ve kaydırma zincirini kesmez (overscroll-contain)', async () => {
    const user = userEvent.setup()
    render(<SheetDemo />)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    const body = document.querySelector('[data-sheet-body]') as HTMLElement
    expect(body.className).toContain('overscroll-contain')
    expect(body.className).toContain('overflow-y-auto')
  })

  it('W4: odak diyalog içinde kalır (Tab dışarı çıkmaz)', async () => {
    const user = userEvent.setup()
    render(<SheetDemo />)
    await user.click(screen.getByRole('button', { name: 'Randevu oluştur' }))
    const dialog = screen.getByRole('dialog')
    for (let i = 0; i < 6; i++) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })
})

describe('Onay penceresi', () => {
  const base = {
    open: true,
    onOpenChange: () => {},
    title: 'Müşteriyi silmek istiyor musunuz?',
    description: 'Ayşe Yılmaz ve geçmiş randevuları kalıcı olarak silinir. Bu işlem geri alınamaz.',
    actionLabel: 'Müşteriyi sil',
    onConfirm: () => {},
  }

  it('W4: alertdialog, başlık eylemi sorar; eylem düğmesi eylemin adını taşır, ikincil "Vazgeç"', () => {
    render(<ConfirmDialog {...base} />)
    expect(screen.getByRole('alertdialog', { name: base.title })).toBeTruthy()
    expect(screen.getByText(base.description)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Müşteriyi sil' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^(Tamam|Evet)$/ })).toBeNull()
  })

  it('W4: yıkıcı eylem dolu kırmızıdır (danger-solid), Vazgeç ikincildir', () => {
    render(<ConfirmDialog {...base} />)
    expect(screen.getByRole('button', { name: 'Müşteriyi sil' }).className).toContain('bg-danger')
    expect(screen.getByRole('button', { name: 'Vazgeç' }).className).not.toContain('bg-danger')
  })

  it('W4: onay eylemi çağırır; Vazgeç kapatır ve eylem çağrılmaz', () => {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Müşteriyi sil' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('W4: işlem sürerken eylem meşgul olur ve tekrar basılamaz', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...base} onConfirm={onConfirm} loading loadingText="Siliniyor…" />)
    const button = screen.getByRole('button', { name: /Siliniyor…/ })
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('W4: ilk odak güvenli eylemde (Vazgeç), yıkıcı eylemde değil', () => {
    render(<ConfirmDialog {...base} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Vazgeç' }))
  })
})

describe('Onay penceresi: işlem sürerken (denetim W4-1 Öneri)', () => {
  it('W4: loading sırasında Esc ve Vazgeç pencereyi kapatmaz', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Müşteriyi silmek istiyor musunuz?"
        description="Bu işlem geri alınamaz."
        actionLabel="Müşteriyi sil"
        onConfirm={() => {}}
        loading
        loadingText="Siliniyor…"
      />,
    )
    await user.keyboard('{Escape}')
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})
