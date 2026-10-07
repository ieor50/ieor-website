'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/academics', label: 'Academics' },
  { href: '/admissions', label: 'Admissions' },
  { href: '/research', label: 'Research' },
  { href: '/people', label: 'People' },
  { href: '/news', label: 'News & events' },
  { href: '/about', label: 'About' },
]

export function Nav() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="menu-toggle"
        type="button"
        aria-controls="site-nav"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Menu
      </button>
      <nav className={open ? 'nav open' : 'nav'} id="site-nav" aria-label="Main navigation">
        {NAV_LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
