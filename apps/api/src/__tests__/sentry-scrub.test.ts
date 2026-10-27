import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/node'
import { scrubEvent } from '../lib/sentry-scrub'

// Her test yalnız bir alanı sınar; olayın geri kalanı geçerli ve zararsızdır.
function baseEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    type: undefined,
    message: 'boom',
    request: { method: 'POST', url: 'https://api.beautyossapp.com/api/v1/tenants/x/customers' },
    ...overrides,
  }
}

describe('scrubEvent (KVKK: Sentry olaylarından kişisel veri silme)', () => {
  it('removes the request body', () => {
    const event = baseEvent({
      request: { method: 'POST', url: 'https://a.test/x', data: { phone: '+905551112233', allergies: 'penisilin' } },
    })
    expect(scrubEvent(event).request).not.toHaveProperty('data')
  })

  it('removes the query string from the request url and the query_string field', () => {
    const event = baseEvent({
      request: { method: 'GET', url: 'https://a.test/x?phone=905551112233#frag', query_string: 'phone=905551112233' },
    })
    const request = scrubEvent(event).request
    expect(request?.url).toBe('https://a.test/x')
    expect(request).not.toHaveProperty('query_string')
  })

  it('removes cookies and all request headers', () => {
    const event = baseEvent({
      request: {
        method: 'GET',
        url: 'https://a.test/x',
        cookies: { refreshToken: 'abc' },
        headers: { cookie: 'refreshToken=abc', 'x-forwarded-for': '203.0.113.9', authorization: 'Bearer t' },
      },
    })
    const request = scrubEvent(event).request
    expect(request).not.toHaveProperty('cookies')
    expect(request).not.toHaveProperty('headers')
  })

  it('removes the user field including ip address and email', () => {
    const event = baseEvent({ user: { id: 'u1', email: 'a@b.test', ip_address: '203.0.113.9' } })
    expect(scrubEvent(event)).not.toHaveProperty('user')
  })

  it('removes extra data attached to the event', () => {
    const event = baseEvent({ extra: { customerPhone: '+905551112233' } })
    expect(scrubEvent(event)).not.toHaveProperty('extra')
  })

  it('keeps only method, status and query-less url in http breadcrumbs', () => {
    const event = baseEvent({
      breadcrumbs: [
        {
          category: 'http',
          data: { url: 'https://a.test/x?token=secret', method: 'GET', status_code: 200, body: 'phone=905551112233' },
        },
      ],
    })
    expect(scrubEvent(event).breadcrumbs?.[0].data).toEqual({
      url: 'https://a.test/x',
      method: 'GET',
      status_code: 200,
    })
  })

  it('keeps the request method and the path so the error stays debuggable', () => {
    const request = scrubEvent(baseEvent()).request
    expect(request).toEqual({ method: 'POST', url: 'https://api.beautyossapp.com/api/v1/tenants/x/customers' })
  })

  it('does not fail on events without a request', () => {
    expect(() => scrubEvent({ type: undefined, message: 'x' } as ErrorEvent)).not.toThrow()
  })
})
