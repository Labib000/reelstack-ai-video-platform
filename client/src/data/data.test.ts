import { describe, expect, it } from 'vitest'

import { askVideo, getTranscript, getVideosByIds, listShelves, searchMoments } from './index'

describe('placeholder data layer', () => {
  it('builds an ordered transcript inside the video', async () => {
    const segments = await getTranscript('jwt-rotation')
    expect(segments.length).toBeGreaterThan(5)
    expect(segments.map((s) => s.start)).toEqual([...segments.map((s) => s.start)].sort((a, b) => a - b))
  })

  it('answers with citations when the video covers the question', async () => {
    const answer = await askVideo('jwt-rotation', 'What happens if a refresh token is stolen?')
    expect(answer.covered).toBe(true)
    expect(answer.citations.length).toBeGreaterThan(0)
  })

  it('says when a question is not covered', async () => {
    const answer = await askVideo('jwt-rotation', 'best pizza dough hydration')
    expect(answer.covered).toBe(false)
    expect(answer.citations).toEqual([])
  })

  it('finds moments across videos', async () => {
    const moments = await searchMoments('event horizon')
    expect(moments[0]?.video.id).toBe('black-holes')
  })

  it('narrows shelves to a category', async () => {
    const shelves = await listShelves('Lectures')
    expect(shelves.every((sh) => sh.items.every((v) => v.category === 'Lectures'))).toBe(true)
  })

  it('returns videos by id in the given order', async () => {
    const videos = await getVideosByIds(['black-holes', 'nope', 'jwt-rotation'])
    expect(videos.map((v) => v.id)).toEqual(['black-holes', 'jwt-rotation'])
  })
})
