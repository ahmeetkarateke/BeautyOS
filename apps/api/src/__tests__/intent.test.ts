import { describe, it, expect } from 'vitest'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { IntentService, TEST_SALON } from '../ai/intent.service'
import type { ConversationSession } from '../session/session.service'

// Her satır: { input, expected } — 20 Türkçe konuşma
const testCases = [
  { input: 'randevu almak istiyorum', expected: 'book' },
  { input: 'yarın boş yeriniz var mı', expected: 'query_availability' },
  { input: 'iptal etmek istiyorum', expected: 'cancel' },
  { input: 'merhaba', expected: 'general' },
  { input: 'rndy almak istiyorum', expected: 'book' },            // yazım hatası
  { input: 'kaç para protez tırnak', expected: 'query_price' },
  { input: 'manikür ne kadar tutar', expected: 'query_price' },
  { input: 'bugün müsait misiniz', expected: 'query_availability' },
  { input: 'randevumu iptal etmem lazım', expected: 'cancel' },
  { input: 'teşekkürler', expected: 'general' },
  { input: 'saç kestirmek istiyorum', expected: 'book' },
  { input: 'ne zaman açıksınız', expected: 'general' },
  { input: 'pedikür randevusu almak istiyorum', expected: 'book' },
  { input: 'salı günü uygun mu', expected: 'query_availability' },
  { input: 'röfle fiyatı nedir', expected: 'query_price' },
  { input: 'yarın saat 14 için randevu', expected: 'book' },
  { input: 'randevumdan vazgeçmek istiyorum', expected: 'cancel' },
  { input: 'iyi günler', expected: 'general' },
  { input: 'pzrtsi için rnvu almk istyrm', expected: 'book' },   // ağır yazım hatası
  { input: 'protez tırnak yaptırmak istiyorum', expected: 'book' },
]

function mockSession(): ConversationSession {
  return {
    sessionId: 'test-intent',
    tenantId: 'test',
    channelType: 'whatsapp',
    from: '+905001234567',
    currentIntent: null,
    entities: {},
    messages: [],
    turnCount: 0,
    clarifyCount: 0,
    step: 'idle',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
  }
}

describe('IntentService — Türkçe intent tespiti (GERÇEK Gemini API)', () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
  const service = new IntentService(genAI)

  it('20 Türkçe mesajda %85+ doğruluk sağlamalı (17/20 geçmeli)', async () => {
    const results: Array<{ input: string; expected: string; got: string; pass: boolean }> = []

    for (const tc of testCases) {
      const session = mockSession()
      const result = await service.detect(session, tc.input, TEST_SALON)
      results.push({ input: tc.input, expected: tc.expected, got: result.intent, pass: result.intent === tc.expected })
    }

    const passed = results.filter((r) => r.pass).length
    const failed = results.filter((r) => !r.pass)

    if (failed.length > 0) {
      console.log('\nBaşarısız testler:')
      failed.forEach((f) =>
        console.log(`  "${f.input}"\n    beklenen: ${f.expected} | alınan: ${f.got}`),
      )
    }
    console.log(`\nSonuç: ${passed}/${testCases.length} geçti (%${Math.round((passed / testCases.length) * 100)})`)

    expect(passed).toBeGreaterThanOrEqual(17)
  }, 120_000) // 20 API çağrısı için 2 dk
})
