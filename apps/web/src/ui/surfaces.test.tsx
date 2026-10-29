import './test-polyfills'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Card, CardHeader } from './card'
import { DropdownMenu } from './dropdown-menu'
import { ListRow } from './list-row'
import { SummaryStrip } from './summary-strip'
import { Tab, TabList, TabPanel, Tabs } from './tabs'

describe('Kart', () => {
  it('W4: başlık solda, ikincil eylem sağda metin düğmesi; kartta gölge yok', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Card>
        <CardHeader title="Bugünün randevuları" action={{ label: 'Tümünü gör', onClick }} />
        içerik
      </Card>,
    )
    expect(screen.getByRole('heading', { name: 'Bugünün randevuları' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tümünü gör' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    const card = container.firstElementChild as HTMLElement
    expect(card.className).not.toMatch(/\bshadow/)
    expect(card.className).toContain('border')
  })
})

describe('Liste satırı', () => {
  it('W4: kimlik, gri ikinci satır ve sağda tek değer görünür', () => {
    render(<ListRow title="Ayşe Yılmaz" subtitle="Saç boyama · 14:30" trailing="₺450" />)
    expect(screen.getByText('Ayşe Yılmaz')).toBeTruthy()
    expect(screen.getByText('Saç boyama · 14:30').className).toContain('text-text-muted')
    expect(screen.getByText('₺450')).toBeTruthy()
  })

  it('W4: onPress verilirse tek bir düğme olur ve tıklanır; verilmezse düğme yoktur', () => {
    const onPress = vi.fn()
    const { unmount } = render(<ListRow title="Ayşe Yılmaz" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: /Ayşe Yılmaz/ }))
    expect(onPress).toHaveBeenCalledTimes(1)
    unmount()
    render(<ListRow title="Ayşe Yılmaz" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('Özet şeridi', () => {
  it('W4: değer, etiket ve adıyla söylenen karşılaştırma gelir; ikon yoktur', () => {
    const { container } = render(
      <SummaryStrip
        items={[
          { label: 'Randevu', value: '12', comparison: 'geçen çarşamba 15' },
          { label: 'Ciro', value: '₺4.200' },
        ]}
      />,
    )
    expect(screen.getByText('Randevu')).toBeTruthy()
    expect(screen.getByText('12')).toBeTruthy()
    expect(screen.getByText('geçen çarşamba 15')).toBeTruthy()
    expect(container.querySelector('svg')).toBeNull()
  })

  it('W4: telefonda iki sütun (grid-cols-2)', () => {
    const { container } = render(<SummaryStrip items={[{ label: 'A', value: '1' }, { label: 'B', value: '2' }]} />)
    expect((container.firstElementChild as HTMLElement).className).toContain('grid-cols-2')
  })
})

describe('Sekmeler', () => {
  function Demo({ onChange }: { onChange?: (v: string) => void }) {
    const [value, setValue] = useState('bilgi')
    return (
      <Tabs
        value={value}
        onValueChange={(v) => {
          setValue(v)
          onChange?.(v)
        }}
      >
        <TabList aria-label="Müşteri bölümleri">
          <Tab value="bilgi">Bilgiler</Tab>
          <Tab value="randevu">Randevular</Tab>
          <Tab value="not">Notlar</Tab>
        </TabList>
        <TabPanel value="bilgi">bilgi içerik</TabPanel>
        <TabPanel value="randevu">randevu içerik</TabPanel>
        <TabPanel value="not">not içerik</TabPanel>
      </Tabs>
    )
  }

  it('W4: tablist/tab rolleri, seçili sekme ve yalnız aktif panel görünür', () => {
    render(<Demo />)
    expect(screen.getByRole('tablist', { name: 'Müşteri bölümleri' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Bilgiler' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('bilgi içerik')).toBeTruthy()
    expect(screen.queryByText('randevu içerik')).toBeNull()
  })

  it('W4: ok tuşuyla gezilir ve seçim değişir', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Demo onChange={onChange} />)
    screen.getByRole('tab', { name: 'Bilgiler' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('randevu')
    expect(screen.getByText('randevu içerik')).toBeTruthy()
  })

  it('W4: sekme satırı sayfayı değil kendini kaydırır', () => {
    render(<Demo />)
    expect(screen.getByRole('tablist').className).toContain('overflow-x-auto')
  })
})

describe('Açılır menü', () => {
  function setup(onDelete = vi.fn(), onEdit = vi.fn()) {
    render(
      <DropdownMenu
        items={[
          { label: 'Müşteriyi sil', onSelect: onDelete, danger: true },
          { label: 'Bilgileri düzenle', onSelect: onEdit },
        ]}
      />,
    )
    return { onDelete, onEdit }
  }

  it('W4: tetikleyici "Diğer işlemler" adını taşır; açılınca öğeler gelir, en yıkıcı en altta', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: 'Diğer işlemler' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    await user.click(trigger)
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent)
    expect(items).toEqual(['Bilgileri düzenle', 'Müşteriyi sil'])
    expect(screen.getByRole('menuitem', { name: 'Müşteriyi sil' }).className).toContain('text-danger')
  })

  it('W4: öğe seçilince eylem çalışır', async () => {
    const user = userEvent.setup()
    const { onEdit } = setup()
    await user.click(screen.getByRole('button', { name: 'Diğer işlemler' }))
    await user.click(screen.getByRole('menuitem', { name: 'Bilgileri düzenle' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('W4: Esc menüyü kapatır ve odak tetikleyiciye döner', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: 'Diğer işlemler' })
    await user.click(trigger)
    expect(screen.getByRole('menu')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})
