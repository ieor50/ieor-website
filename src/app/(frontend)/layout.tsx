import type { Metadata, Viewport } from 'next'
import { DM_Sans, Manrope } from 'next/font/google'
import React from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import './styles.css'

const body = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' })
const head = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-head' })

export const metadata: Metadata = {
  title: { default: 'IEOR @ IIT Bombay', template: '%s · IEOR @ IIT Bombay' },
  description: 'Department of Industrial Engineering and Operations Research, IIT Bombay.',
  icons: { icon: '/assets/favicon.svg' },
}

export const viewport: Viewport = { themeColor: '#0a314e' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${head.variable}`}>
      <body>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
