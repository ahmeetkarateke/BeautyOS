import type { PermissionKey } from '@beautyos/shared'

/**
 * Yetki kapilarinin tek tablosu (S1-K5). Her satir kaynakta bir `requirePermission` / `ensurePermission`
 * cagrisina karsilik gelir; `permission-gates-scan.test.ts` kaynagi tarayip bu tabloyla birebir karsilastirir:
 * yeni bir kapi eklenip tabloya yazilmazsa ya da yanlis anahtar kullanilirsa test kirmizi olur.
 */
export interface Gate {
  /** routes/<file>.route.ts */
  file: string
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  /** Router dosyasindaki yol (kaynakta yazildigi gibi) */
  route: string
  /** /api/v1/tenants/:slug altindaki tam yol (parametreler doldurulmus) */
  url: string
  permission: PermissionKey
}

const ID = '00000000-0000-4000-8000-000000000001'

export const GATES: Gate[] = [
  { file: 'appointment-approval', method: 'patch', route: '/appointments/:id/approve', url: `/appointments/${ID}/approve`, permission: 'appointment.approve' },
  { file: 'appointment-approval', method: 'patch', route: '/appointments/:id/reject', url: `/appointments/${ID}/reject`, permission: 'appointment.approve' },
  { file: 'appointment-approval', method: 'get', route: '/appointments/:id/customer-candidates', url: `/appointments/${ID}/customer-candidates`, permission: 'appointment.approve' },

  { file: 'current-accounts', method: 'get', route: '/current-accounts', url: '/current-accounts', permission: 'current_account.read' },
  { file: 'current-accounts', method: 'get', route: '/current-accounts/:partyType/:partyId/entries', url: `/current-accounts/customer/${ID}/entries`, permission: 'current_account.read' },
  { file: 'current-accounts', method: 'post', route: '/current-accounts/entries', url: '/current-accounts/entries', permission: 'current_account.write' },
  { file: 'current-accounts', method: 'delete', route: '/current-accounts/entries/:id', url: `/current-accounts/entries/${ID}`, permission: 'current_account.write' },

  { file: 'customer-enrichment', method: 'get', route: '/anamnesis-questions', url: '/anamnesis-questions', permission: 'health.view' },
  { file: 'customer-enrichment', method: 'get', route: '/customers/:customerId/anamnesis', url: `/customers/${ID}/anamnesis`, permission: 'health.view' },
  { file: 'customer-enrichment', method: 'put', route: '/customers/:customerId/anamnesis', url: `/customers/${ID}/anamnesis`, permission: 'health.write' },
  { file: 'customer-enrichment', method: 'get', route: '/customers/:customerId/photos', url: `/customers/${ID}/photos`, permission: 'customer.photo.view' },
  { file: 'customer-enrichment', method: 'post', route: '/customers/:customerId/photos', url: `/customers/${ID}/photos`, permission: 'customer.photo.write' },
  { file: 'customer-enrichment', method: 'delete', route: '/photos/:id', url: `/photos/${ID}`, permission: 'customer.photo.write' },

  { file: 'financial-accounts', method: 'get', route: '/accounts', url: '/accounts', permission: 'finance.account.read' },
  { file: 'financial-accounts', method: 'get', route: '/accounts/:id', url: `/accounts/${ID}`, permission: 'finance.account.read' },
  { file: 'financial-accounts', method: 'post', route: '/accounts', url: '/accounts', permission: 'finance.account.write' },
  { file: 'financial-accounts', method: 'patch', route: '/accounts/:id', url: `/accounts/${ID}`, permission: 'finance.account.write' },
  { file: 'financial-accounts', method: 'delete', route: '/accounts/:id', url: `/accounts/${ID}`, permission: 'finance.account.write' },
  { file: 'financial-accounts', method: 'post', route: '/transactions', url: '/transactions', permission: 'finance.account.write' },
  { file: 'financial-accounts', method: 'post', route: '/transactions/transfer', url: '/transactions/transfer', permission: 'finance.account.write' },
  { file: 'financial-accounts', method: 'delete', route: '/transactions/:id', url: `/transactions/${ID}`, permission: 'finance.account.write' },

  { file: 'purchase-invoices', method: 'get', route: '/purchase-invoices', url: '/purchase-invoices', permission: 'purchase_invoice.read' },
  { file: 'purchase-invoices', method: 'get', route: '/purchase-invoices/:id', url: `/purchase-invoices/${ID}`, permission: 'purchase_invoice.read' },
  { file: 'purchase-invoices', method: 'post', route: '/purchase-invoices', url: '/purchase-invoices', permission: 'purchase_invoice.write' },
  { file: 'purchase-invoices', method: 'post', route: '/purchase-invoices/:id/post', url: `/purchase-invoices/${ID}/post`, permission: 'purchase_invoice.write' },
  { file: 'purchase-invoices', method: 'post', route: '/purchase-invoices/:id/cancel', url: `/purchase-invoices/${ID}/cancel`, permission: 'purchase_invoice.write' },
  { file: 'purchase-invoices', method: 'delete', route: '/purchase-invoices/:id', url: `/purchase-invoices/${ID}`, permission: 'purchase_invoice.write' },

  { file: 'stock', method: 'get', route: '/suppliers', url: '/suppliers', permission: 'supplier.read' },

  { file: 'tenant', method: 'post', route: '/finance/close-day', url: '/finance/close-day', permission: 'finance.close_day' },
  { file: 'tenant', method: 'get', route: '/reports/daily', url: '/reports/daily', permission: 'finance.report.daily' },
  { file: 'tenant', method: 'get', route: '/reports/staff-commissions', url: '/reports/staff-commissions', permission: 'finance.report.commissions' },
  { file: 'tenant', method: 'post', route: '/revenues', url: '/revenues', permission: 'finance.revenue.create' },
  { file: 'tenant', method: 'patch', route: '/customers/:customerId', url: `/customers/${ID}`, permission: 'customer.write' },

  { file: 'waitlist', method: 'get', route: '/', url: '/waitlist', permission: 'waitlist.view' },
  { file: 'waitlist', method: 'post', route: '/', url: '/waitlist', permission: 'waitlist.write' },
  { file: 'waitlist', method: 'patch', route: '/:id', url: `/waitlist/${ID}`, permission: 'waitlist.write' },
  { file: 'waitlist', method: 'delete', route: '/:id', url: `/waitlist/${ID}`, permission: 'waitlist.write' },
  { file: 'waitlist', method: 'post', route: '/:id/notify', url: `/waitlist/${ID}/notify`, permission: 'waitlist.write' },
  { file: 'waitlist', method: 'post', route: '/:id/book', url: `/waitlist/${ID}/book`, permission: 'waitlist.write' },
  { file: 'waitlist', method: 'post', route: '/:id/expire', url: `/waitlist/${ID}/expire`, permission: 'waitlist.write' },
]
