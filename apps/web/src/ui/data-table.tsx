import type { ReactNode } from 'react'
import { cn } from './cn'

// Prototip karşılığı: .tablo + .satir. Masaüstünde tablo (12 px gri başlık, zebra yok, sayılar sağa yaslı tabular, toplam tfoot'ta);
// 640 px altında satıra döner: ana sütun başlık, diğer alanlar etiketiyle 2. satıra iner. Alan düşürülmez.
export type Column<Row> = {
  key: string
  header: string
  cell: (row: Row) => ReactNode
  align?: 'left' | 'right'
  /** Telefonda satır başlığı olan sütun (kimlik). Verilmezse ilk sütun. */
  primary?: boolean
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  footer,
  onRowPress,
  'aria-label': ariaLabel,
  className,
}: {
  columns: readonly Column<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** Sütun anahtarına göre toplam satırı. */
  footer?: Partial<Record<string, ReactNode>>
  onRowPress?: (row: Row) => void
  'aria-label': string
  className?: string
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0]
  const secondary = columns.filter((c) => c !== primary)

  return (
    <div className={className}>
      <div className="max-sm:hidden overflow-x-auto rounded-card border border-border bg-surface">
        <table aria-label={ariaLabel} className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('px-4 py-3 text-xs leading-4 font-medium text-text-muted', c.align === 'right' && 'text-right')}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowPress ? () => onRowPress(row) : undefined}
                className={cn('border-b border-border-subtle last:border-b-0', onRowPress && 'cursor-pointer hover:bg-surface-subtle')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3 text-text', c.align === 'right' && 'text-right tabular-nums')}
                  >
                    {onRowPress && c === primary ? (
                      // Klavye ve ekran okuyucu için gerçek düğme; satırın tamamındaki onClick yalnız fare kolaylığıdır.
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onRowPress(row)
                        }}
                        className="cursor-pointer rounded-control text-left font-medium text-text hover:underline"
                      >
                        {c.cell(row)}
                      </button>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer ? (
            <tfoot>
              <tr className="border-t border-border font-semibold">
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 text-text', c.align === 'right' && 'text-right tabular-nums')}>
                    {footer[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <ul data-row-list aria-label={ariaLabel} className="m-0 grid list-none gap-2 p-0 sm:hidden">
        {rows.map((row) => {
          const body = (
            <>
              <span className="text-base leading-6 font-medium text-text">{primary.cell(row)}</span>
              <span className="grid gap-0.5">
                {secondary.map((c) => (
                  <span key={c.key} className="flex justify-between gap-3 text-sm leading-5">
                    <span className="text-text-muted">{c.header}</span>
                    <span className="text-text tabular-nums">{c.cell(row)}</span>
                  </span>
                ))}
              </span>
            </>
          )
          return (
            <li key={rowKey(row)} data-row-card className="rounded-card border border-border bg-surface">
              {onRowPress ? (
                <button type="button" onClick={() => onRowPress(row)} className="grid w-full cursor-pointer gap-1 p-3 text-left">
                  {body}
                </button>
              ) : (
                <div className="grid gap-1 p-3">{body}</div>
              )}
            </li>
          )
        })}
        {footer ? (
          <li className="flex flex-wrap justify-between gap-x-4 rounded-card bg-surface-active px-3 py-2 text-sm font-semibold text-text">
            {columns.map((c) =>
              footer[c.key] === undefined ? null : (
                <span key={c.key}>{c === primary ? footer[c.key] : <>{c.header}: {footer[c.key]}</>}</span>
              ),
            )}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
