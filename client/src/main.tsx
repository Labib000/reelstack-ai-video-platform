import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import '@fontsource-variable/outfit'
import './index.css'
import App from '@/App'
import AuthProvider from '@/auth/AuthProvider'
import { Toaster } from '@/components/ui/sonner'
import { initializeTheme } from '@/hooks/use-appearance'

initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* reducedMotion="user": no animations when the OS asks for reduced motion. */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
