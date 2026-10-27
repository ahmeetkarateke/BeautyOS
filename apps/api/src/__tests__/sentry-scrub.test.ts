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

describe('scrubEvent: Telegram bot token in the url path', () => {
  const TOKEN = '123456789:AAFakeToken_abc-DEF'
  const TELEGRAM_URL = `https://api.telegram.org/bot${TOKEN}/sendMessage`

  it('masks the token in the request url', () => {
    const event = baseEvent({ request: { method: 'POST', url: TELEGRAM_URL } })
    expect(scrubEvent(event).request?.url).toBe('https://api.telegram.org/bot[redacted]/sendMessage')
  })

  it('masks the token in breadcrumb urls', () => {
    const event = baseEvent({ breadcrumbs: [{ category: 'http', data: { url: TELEGRAM_URL, method: 'POST' } }] })
    expect(scrubEvent(event).breadcrumbs?.[0].data?.url).toBe('https://api.telegram.org/bot[redacted]/sendMessage')
  })

  it('masks the token in the breadcrumb message', () => {
    const event = baseEvent({ breadcrumbs: [{ category: 'console', message: `POST ${TELEGRAM_URL}` }] })
    expect(JSON.stringify(scrubEvent(event).breadcrumbs)).not.toContain(TOKEN)
  })

  it('masks the token in span descriptions and drops their query string', () => {
    const event = baseEvent({
      spans: [{ span_id: 'a', trace_id: 'b', start_timestamp: 1, description: `POST ${TELEGRAM_URL}?chat_id=42` }],
    } as Partial<ErrorEvent>)
    expect(scrubEvent(event).spans?.[0].description).toBe('POST https://api.telegram.org/bot[redacted]/sendMessage')
  })

  it('masks the token in span data urls and drops other span data keys', () => {
    const event = baseEvent({
      spans: [
        { span_id: 'a', trace_id: 'b', start_timestamp: 1, data: { 'http.url': TELEGRAM_URL, 'http.method': 'POST', body: 'x' } },
      ],
    } as Partial<ErrorEvent>)
    expect(scrubEvent(event).spans?.[0].data).toEqual({
      'http.url': 'https://api.telegram.org/bot[redacted]/sendMessage',
      'http.method': 'POST',
    })
  })

  it('masks the token in exception messages and the event message', () => {
    const event = baseEvent({
      message: `failed ${TELEGRAM_URL}`,
      exception: { values: [{ type: 'AxiosError', value: `Request failed for ${TELEGRAM_URL}` }] },
    })
    expect(JSON.stringify(scrubEvent(event))).not.toContain(TOKEN)
  })

  it('strips query strings from the root span data (contexts.trace.data)', () => {
    const event = baseEvent({
      contexts: {
        trace: {
          trace_id: 't',
          span_id: 's',
          data: {
            'http.target': '/api/v1/tenants/x/customers?search=Ayse%20Yilmaz&phone=905551112233',
            'url.full': 'https://api.beautyossapp.com/api/v1/x?phone=905551112233',
            'http.query': '?phone=905551112233',
            'http.method': 'GET',
          },
        },
      },
    })
    const data = scrubEvent(event).contexts?.trace?.data
    expect(data).toEqual({
      'http.target': '/api/v1/tenants/x/customers',
      'url.full': 'https://api.beautyossapp.com/api/v1/x',
      'http.method': 'GET',
    })
  })

  it('leaves urls without a bot token untouched', () => {
    const event = baseEvent({ request: { method: 'GET', url: 'https://api.beautyossapp.com/api/v1/bottles/1' } })
    expect(scrubEvent(event).request?.url).toBe('https://api.beautyossapp.com/api/v1/bottles/1')
  })
})
