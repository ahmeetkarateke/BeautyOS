'use client'

import { createContext, use, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from './cn'

// Prototip karşılıkları: .secenek (Checkbox, Radio) ve .anahtar (Switch).
// Metin ve kutu tek tıklama hedefidir (>= 44 px). Yerel input kullanılır: form gönderimi ve klavye tarayıcıdan gelir.

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'name' | 'id' | 'children' | 'onChange'>

type OptionProps = NativeProps & {
  label: ReactNode
  description?: ReactNode
}

const rowClass = 'flex min-h-(--size-control) cursor-pointer items-start gap-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-60'

const boxClass =
  'peer m-0 mt-0.5 grid size-5 flex-none cursor-pointer appearance-none place-content-center border-[1.5px] border-border-control bg-surface ' +
  'checked:border-primary checked:bg-primary disabled:cursor-not-allowed'

function OptionText({ labelId, descId, label, description }: { labelId: string; descId: string; label: ReactNode; description?: ReactNode }) {
  return (
    <span className="grid gap-0.5">
      <span id={labelId} className="text-base leading-6 text-text">
        {label}
      </span>
      {description ? (
        <span id={descId} className="text-sm leading-5 text-text-muted">
          {description}
        </span>
      ) : null}
    </span>
  )
}

export type CheckboxProps = OptionProps & { onCheckedChange?: (checked: boolean) => void }

export function Checkbox({ label, description, onCheckedChange, className, ...inputProps }: CheckboxProps) {
  const uid = useId()
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative flex-none">
        <input
          {...inputProps}
          type="checkbox"
          aria-labelledby={`${uid}-label`}
          aria-describedby={description ? `${uid}-desc` : undefined}
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          className={cn(boxClass, 'rounded-tag')}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto mt-1.5 hidden size-3 text-on-primary peer-checked:block"
        />
      </span>
      <OptionText labelId={`${uid}-label`} descId={`${uid}-desc`} label={label} description={description} />
    </label>
  )
}

/**
 * Yasal onay kutusu (kullanım koşulları, KVKK, ticari ileti): hiçbir zaman önceden işaretli gelmez.
 * `defaultChecked` tür düzeyinde yasak; çalışma anında gelse de yok sayılır. Kullanıcı kendisi işaretler.
 */
export type LegalCheckboxProps = Omit<CheckboxProps, 'defaultChecked'>

export function LegalCheckbox(props: LegalCheckboxProps) {
  const { defaultChecked: _ignored, ...rest } = props as CheckboxProps
  return <Checkbox {...rest} />
}

type RadioContextValue = { name: string; value: string; onValueChange: (value: string) => void }
const RadioContext = createContext<RadioContextValue | null>(null)

export function RadioGroup({
  legend,
  value,
  onValueChange,
  children,
  className,
}: {
  legend: string
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
}) {
  const uid = useId()
  return (
    <RadioContext value={{ name: uid, value, onValueChange }}>
      <div role="radiogroup" aria-labelledby={`${uid}-legend`} className={className}>
        <span id={`${uid}-legend`} className="text-sm leading-5 font-medium text-text">
          {legend}
        </span>
        {children}
      </div>
    </RadioContext>
  )
}

export function Radio({ value, label, description, className, ...inputProps }: OptionProps & { value: string }) {
  const group = use(RadioContext)
  if (!group) throw new Error('Radio, RadioGroup içinde kullanılmalıdır.')
  const uid = useId()
  return (
    <label className={cn(rowClass, className)}>
      <span className="relative flex-none">
        <input
          {...inputProps}
          type="radio"
          name={group.name}
          value={value}
          checked={group.value === value}
          aria-labelledby={`${uid}-label`}
          aria-describedby={description ? `${uid}-desc` : undefined}
          onChange={() => group.onValueChange(value)}
          className={cn(boxClass, 'rounded-full')}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto hidden size-2 rounded-full bg-on-primary peer-checked:block"
        />
      </span>
      <OptionText labelId={`${uid}-label`} descId={`${uid}-desc`} label={label} description={description} />
    </label>
  )
}

export type SwitchProps = Omit<OptionProps, 'checked' | 'defaultChecked'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

/** Açık/kapalı ayar. Etiket her zaman görünür; açık rengi petrol. */
export function Switch({ label, description, checked, onCheckedChange, className, ...inputProps }: SwitchProps) {
  const uid = useId()
  return (
    <label className={cn(rowClass, 'items-center justify-between', className)}>
      <OptionText labelId={`${uid}-label`} descId={`${uid}-desc`} label={label} description={description} />
      <input
        {...inputProps}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-labelledby={`${uid}-label`}
        aria-describedby={description ? `${uid}-desc` : undefined}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className={cn(
          'relative m-0 h-6.5 w-11 flex-none cursor-pointer appearance-none rounded-full bg-border-control transition-colors duration-(--duration-fast) ease-in-out',
          'checked:bg-primary disabled:cursor-not-allowed',
          "after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-surface after:transition-transform after:duration-(--duration-base) after:ease-(--ease-out) after:content-['']",
          'checked:after:translate-x-[18px]',
        )}
      />
    </label>
  )
}
