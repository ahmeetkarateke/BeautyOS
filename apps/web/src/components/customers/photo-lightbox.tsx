'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils'

export interface LightboxPhoto {
  id: string
  url: string
  caption: string | null
  category: string | null
  takenAt: string
}

interface Props {
  photo: LightboxPhoto | null
  onClose: () => void
}

export function PhotoLightbox({ photo, onClose }: Props) {
  return (
    <Dialog open={!!photo} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-3xl p-2 sm:p-3 bg-black border-black">
        <DialogTitle className="sr-only">{photo?.caption ?? 'Fotoğraf'}</DialogTitle>
        {photo && (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption ?? 'Müşteri fotoğrafı'}
              className="max-h-[75vh] w-auto rounded-md object-contain"
            />
            <div className="mt-3 text-center text-sm text-white/90">
              {photo.caption && <p className="font-medium">{photo.caption}</p>}
              <p className="text-xs text-white/60 mt-1">{formatDate(photo.takenAt)}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
