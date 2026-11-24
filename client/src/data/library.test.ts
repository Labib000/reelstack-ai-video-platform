import { describe, expect, it } from 'vitest'

import { createLibraryStore } from './library'

function memoryStorage() {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data }
}

describe('library store', () => {
  it('keeps the most recent view first, once per video', () => {
    const store = createLibraryStore(memoryStorage())
    store.recordView('u1', 'a', 0.1, new Date('2026-01-01'))
    store.recordView('u1', 'b', 0.2, new Date('2026-01-02'))
    store.recordView('u1', 'a', 0.5, new Date('2026-01-03'))
    expect(store.get('u1').history.map((h) => [h.id, h.progress])).toEqual([
      ['a', 0.5],
      ['b', 0.2],
    ])
  })

  it('records nothing while history is paused', () => {
    const store = createLibraryStore(memoryStorage())
    store.setHistoryPaused('u1', true)
    store.recordView('u1', 'a', 0.3)
    expect(store.get('u1').history).toEqual([])
  })

  it('removes one entry and clears all', () => {
    const store = createLibraryStore(memoryStorage())
    store.recordView('u1', 'a', 0)
    store.recordView('u1', 'b', 0)
    store.removeFromHistory('u1', 'a')
    expect(store.get('u1').history.map((h) => h.id)).toEqual(['b'])
    store.clearHistory('u1')
    expect(store.get('u1').history).toEqual([])
  })

  it('toggles list membership and reports it', () => {
    const store = createLibraryStore(memoryStorage())
    expect(store.toggle('u1', 'liked', 'a')).toBe(true)
    expect(store.toggle('u1', 'liked', 'b')).toBe(true)
    expect(store.get('u1').liked).toEqual(['b', 'a'])
    expect(store.toggle('u1', 'liked', 'a')).toBe(false)
    expect(store.get('u1').liked).toEqual(['b'])
  })

  it('keeps users apart and persists across store instances', () => {
    const storage = memoryStorage()
    createLibraryStore(storage).toggle('u1', 'watchLater', 'a')
    const fresh = createLibraryStore(storage)
    expect(fresh.get('u1').watchLater).toEqual(['a'])
    expect(fresh.get('u2').watchLater).toEqual([])
  })

  it('notifies subscribers on change', () => {
    const store = createLibraryStore(memoryStorage())
    let calls = 0
    const off = store.subscribe(() => calls++)
    store.toggle('u1', 'subscriptions', 'c1')
    off()
    store.toggle('u1', 'subscriptions', 'c2')
    expect(calls).toBe(1)
  })
})
