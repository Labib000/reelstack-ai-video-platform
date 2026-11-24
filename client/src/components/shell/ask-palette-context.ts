import { createContext, useContext } from 'react'

export const AskPaletteContext = createContext<{ open: () => void } | null>(null)

export function useAskPalette() {
  const value = useContext(AskPaletteContext)
  if (!value) throw new Error('useAskPalette must be used inside <AskPaletteProvider>')
  return value
}
