import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { StrictMode } from 'react'
import { takeHashToken, useHashToken } from './hash-token'

function setUrl(url: string) {
  window.history.replaceState(null, '', url)
}

beforeEach(() => setUrl('/invite'))
afterEach(cleanup)

describe('takeHashToken (ADR-0046)', () => {
  it('K1: # parçasındaki belirteci okur ve adres çubuğundan siler', () => {
    setUrl('/invite?x=1#abc123')
    expect(takeHashToken()).toBe('abc123')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname + window.location.search).toBe('/invite?x=1')
  })

  it('K2: # yoksa null döner ve adresi değiştirmez', () => {
    expect(takeHashToken()).toBeNull()
    expect(window.location.pathname).toBe('/invite')
  })

  it('K3: # var ama boşsa null döner (boş belirteç geçersizdir)', () => {
    setUrl('/invite#')
    expect(takeHashToken()).toBeNull()
  })

  it('K4: belirteç yüzde-kodlu gelirse çözülmeden olduğu gibi döner (sunucu hex/base64url bekler)', () => {
    setUrl('/invite#a%2Fb')
    expect(takeHashToken()).toBe('a%2Fb')
  })

  it('K5: belirteç depolamaya yazılmaz', () => {
    setUrl('/invite#gizli')
    takeHashToken()
    expect(JSON.stringify({ ...localStorage })).not.toContain('gizli')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('gizli')
  })
})

function Probe() {
  const state = useHashToken()
  return <p>{state.status === 'ready' ? `hazir:${state.token}` : state.status}</p>
}

describe('useHashToken', () => {
  it('K6: StrictMode çift efektinde belirteci kaybetmez', async () => {
    setUrl('/invite#tok')
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    )
    expect(await screen.findByText('hazir:tok')).toBeTruthy()
    expect(window.location.hash).toBe('')
  })

  it('K7: belirteç yoksa "missing" olur', async () => {
    render(<Probe />)
    expect(await screen.findByText('missing')).toBeTruthy()
  })
})

describe('takeHashToken biçimleri', () => {
  it('K8: sunucunun gönderdiği #token=<değer> biçiminde ön ek atılır ve adres temizlenir', () => {
    setUrl('/reset-password#token=abc123')
    expect(takeHashToken()).toBe('abc123')
    expect(window.location.hash).toBe('')
  })

  it('K9: eski ?token= sorgusu artık okunmaz ve belirteç çıkarılmaz', () => {
    setUrl('/reset-password?token=eski')
    expect(takeHashToken()).toBeNull()
  })

  it('K10: yalnız "token=" yazan parça boş sayılır', () => {
    setUrl('/reset-password#token=')
    expect(takeHashToken()).toBeNull()
  })
})
