'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { ModulesPanel } from './modules-panel'
import { X } from 'lucide-react'

interface ModulesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
}

export function ModulesDialog({ open, onOpenChange, tenantSlug }: ModulesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-salon-border dark:border-white/8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl">Aktif Modüller</DialogTitle>
              <p className="text-sm text-salon-muted dark:text-white/60 mt-1">
                Menüde görünmesini istediğiniz modülleri seçin
              </p>
            </div>
            <DialogClose
              className="w-8 h-8 flex items-center justify-center rounded-md text-salon-muted hover:bg-salon-bg dark:hover:bg-white/5 transition-colors"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
          <ModulesPanel tenantSlug={tenantSlug} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
