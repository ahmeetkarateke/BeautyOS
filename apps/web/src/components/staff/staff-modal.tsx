'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/ui/toaster'
import { STAFF_COLORS } from '@/lib/staff-colors'
import { cn } from '@/lib/utils'

interface StaffMember {
  id: string
  fullName: string
  title: string
  colorCode?: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  staff?: StaffMember
}

const createSchema = z.object({
  fullName: z.string().min(2, 'En az 2 karakter'),
  email: z.string().email('Geçerli e-posta giriniz'),
  password: z.string().min(8, 'En az 8 karakter'),
  title: z.string().min(2, 'Unvan giriniz'),
  colorCode: z.number().int().min(0).max(7),
})

const editSchema = z.object({
  title: z.string().min(2, 'Unvan giriniz'),
  bio: z.string().optional(),
  colorCode: z.number().int().min(0).max(7),
})

type CreateValues = z.infer<typeof createSchema>
type EditValues = z.infer<typeof editSchema>

function ColorPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {STAFF_COLORS.map((color, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className={cn(
            'w-8 h-8 rounded-full border-2 transition-transform',
            value === i ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105',
          )}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  )
}

export function StaffModal({ open, onOpenChange, tenantSlug, staff }: Props) {
  const qc = useQueryClient()
  const isEdit = !!staff

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { fullName: '', email: '', password: '', title: '', colorCode: 0 },
  })

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { title: '', bio: '', colorCode: 0 },
  })

  useEffect(() => {
    if (open && isEdit) {
      editForm.reset({ title: staff.title, bio: '', colorCode: staff.colorCode ?? 0 })
    }
    if (open && !isEdit) {
      createForm.reset({ fullName: '', email: '', password: '', title: '', colorCode: 0 })
    }
  }, [open, staff, isEdit]) // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: (data: CreateValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/staff`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', tenantSlug] })
      toast('Personel eklendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  const editMutation = useMutation({
    mutationFn: (data: EditValues) =>
      apiFetch(`/api/v1/tenants/${tenantSlug}/staff/${staff!.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff', tenantSlug] })
      toast('Personel güncellendi')
      onOpenChange(false)
    },
    onError: (err: Error) => toast(err.message, 'error'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Personel Düzenle' : 'Yeni Personel'}</DialogTitle>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={editForm.handleSubmit((d) => editMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="st-title">Unvan</Label>
              <Input id="st-title" placeholder="Nail Artist" error={editForm.formState.errors.title?.message} {...editForm.register('title')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-bio">Biyografi (isteğe bağlı)</Label>
              <Textarea id="st-bio" placeholder="Kısa tanıtım..." {...editForm.register('bio')} />
            </div>
            <div className="space-y-2">
              <Label>Renk</Label>
              <ColorPicker value={editForm.watch('colorCode')} onChange={(v) => editForm.setValue('colorCode', v)} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>İptal</Button>
              <Button type="submit" disabled={editMutation.isPending} className="flex-1">
                {editMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="st-name">Ad Soyad</Label>
              <Input id="st-name" placeholder="Ayşe Kaya" error={createForm.formState.errors.fullName?.message} {...createForm.register('fullName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-email">E-posta</Label>
              <Input id="st-email" type="email" placeholder="ayse@demo-salon.app" error={createForm.formState.errors.email?.message} {...createForm.register('email')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-pass">Şifre</Label>
              <Input id="st-pass" type="password" placeholder="••••••••" error={createForm.formState.errors.password?.message} {...createForm.register('password')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="st-title2">Unvan</Label>
              <Input id="st-title2" placeholder="Nail Artist" error={createForm.formState.errors.title?.message} {...createForm.register('title')} />
            </div>
            <div className="space-y-2">
              <Label>Renk</Label>
              <ColorPicker value={createForm.watch('colorCode')} onChange={(v) => createForm.setValue('colorCode', v)} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>İptal</Button>
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Ekleniyor...' : 'Personel Ekle'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
