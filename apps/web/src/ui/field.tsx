import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { ChevronDown, CircleAlert } from 'lucide-react'
import { cn } from './cn'
import { formatNationalPhone, toNationalDigits } from './phone'

// Prototip karşılığı: .alan. Etiket her zaman görünür ve üstte; hata altta (ikon + metin + kırmızı kenar).
// Zorunlu alan işareti yoktur; isteğe bağlı alan "(isteğe bağlı)" yazar. Alanlara `name` verilmez (JS yüklenmezse girdi URL'ye sızmasın).

type FrameProps = {
  label: string
  /** true ise etiketin yanına "(isteğe bağlı)" yazılır. */
  optional?: boolean
  hint?: string
  error?: string
  className?: string
}

type ControlA11y = { id: string; 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }

const controlClass =
  'block w-full min-h-(--size-control) rounded-control border border-border-control bg-surface px-3 text-base text-text ' +
  'placeholder:text-text-muted hover:border-text-muted disabled:cursor-not-allowed disabled:bg-surface-active disabled:text-text-muted ' +
  'aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--color-danger-bg)] ' +
  'lg:pointer-fine:min-h-10'

/** Etiket, ipucu ve hata düzeni; kontrolün id/aria bağlarını üretir. */
function useField({ hint, error }: Pick<FrameProps, 'hint' | 'error'>) {
  const uid = useId()
  const hintId = hint ? `${uid}-hint` : undefined
  const errorId = error ? `${uid}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined
  const control: ControlA11y = {
    id: `${uid}-control`,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }
  return { control, hintId, errorId }
}

function FieldFrame({
  label,
  optional,
  hint,
  error,
  className,
  controlId,
  hintId,
  errorId,
  children,
}: FrameProps & { controlId: string; hintId?: string; errorId?: string; children: ReactNode }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={controlId} className="text-sm leading-5 font-medium text-text">
        {label}
        {optional ? <span className="ml-1 font-normal text-text-muted">(isteğe bağlı)</span> : null}
      </label>
      {children}
      {hint ? (
        <p id={hintId} className="text-xs leading-4 text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm leading-5 text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}

export type InputFieldProps = FrameProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'>

export function InputField({ label, optional, hint, error, className, ...inputProps }: InputFieldProps) {
  const { control, hintId, errorId } = useField({ hint, error })
  return (
    <FieldFrame {...{ label, optional, hint, error, className, hintId, errorId }} controlId={control.id}>
      <input {...inputProps} {...control} className={controlClass} />
    </FieldFrame>
  )
}

export type TextareaFieldProps = FrameProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'name'>

export function TextareaField({ label, optional, hint, error, className, ...textareaProps }: TextareaFieldProps) {
  const { control, hintId, errorId } = useField({ hint, error })
  return (
    <FieldFrame {...{ label, optional, hint, error, className, hintId, errorId }} controlId={control.id}>
      <textarea {...textareaProps} {...control} className={cn(controlClass, 'min-h-22 resize-y py-2.5 leading-6')} />
    </FieldFrame>
  )
}

export type SelectFieldProps = FrameProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'name'>

export function SelectField({ label, optional, hint, error, className, children, ...selectProps }: SelectFieldProps) {
  const { control, hintId, errorId } = useField({ hint, error })
  return (
    <FieldFrame {...{ label, optional, hint, error, className, hintId, errorId }} controlId={control.id}>
      <div className="relative">
        <select {...selectProps} {...control} className={cn(controlClass, 'appearance-none pr-9')}>
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-secondary"
        />
      </div>
    </FieldFrame>
  )
}

export type PhoneFieldProps = FrameProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'value' | 'onChange' | 'type' | 'defaultValue'> & {
    /** Yalnız rakamlar, ulusal biçim (ör. "5321234567"). */
    value: string
    onValueChange: (digits: string) => void
  }

export function PhoneField({
  label,
  optional,
  hint,
  error,
  className,
  value,
  onValueChange,
  ...inputProps
}: PhoneFieldProps) {
  const { control, hintId, errorId } = useField({ hint, error })
  return (
    <FieldFrame {...{ label, optional, hint, error, className, hintId, errorId }} controlId={control.id}>
      <div className="flex">
        <span className="inline-flex items-center rounded-l-control border border-r-0 border-border-control bg-surface-subtle px-3 text-sm whitespace-nowrap text-text-secondary">
          +90
        </span>
        <input
          placeholder="5xx xxx xx xx"
          {...inputProps}
          {...control}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={formatNationalPhone(value)}
          onChange={(event) => onValueChange(toNationalDigits(event.target.value))}
          className={cn(controlClass, 'rounded-l-none')}
        />
      </div>
    </FieldFrame>
  )
}

/** Gönderimde ilk hatalı alana odaklanır (tasarim.md §4). */
export function focusFirstInvalid(form: HTMLElement): void {
  form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
