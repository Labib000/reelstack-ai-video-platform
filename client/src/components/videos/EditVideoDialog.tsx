import type { OwnVideoDTO, Visibility } from '@reelstack/shared'
import { useState } from 'react'
import { toast } from 'sonner'

import { apiError } from '@/api/http'
import { updateVideo } from '@/api/videos'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import VisibilityPicker from './VisibilityPicker'

/** Edit title, description and visibility. Mount with a `key` per video so fields reset. */
export default function EditVideoDialog({
  video,
  open,
  onOpenChange,
  onSaved,
}: {
  video: OwnVideoDTO
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (v: OwnVideoDTO) => void
}) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description)
  const [visibility, setVisibility] = useState<Visibility>(video.visibility)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved(await updateVideo(video.id, { title, description, visibility }))
      toast.success('Video details saved')
      onOpenChange(false)
    } catch (e) {
      const info = apiError(e)
      setError(info.fieldErrors.title ?? info.fieldErrors.description ?? info.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>Changes show up straight away.</DialogDescription>
        </DialogHeader>
        <form
          id="edit-video"
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
          </div>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
          {error && (
            <p role="alert" className="text-sm text-destructive-foreground">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-video" disabled={busy || !title.trim()}>
            {busy && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
