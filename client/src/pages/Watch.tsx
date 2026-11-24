import { useParams } from 'react-router-dom'
import PageShell from '../components/PageShell.tsx'

export default function Watch() {
  const { id } = useParams()
  return (
    <PageShell title="Watch">
      <p className="text-neutral-400">Player and Ask the Video panel for video {id} go here.</p>
    </PageShell>
  )
}
