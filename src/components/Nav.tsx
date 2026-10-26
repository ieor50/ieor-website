'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import menu from '@/data/menu.json'

// The old site's main menu (scripts/import/menu.ts), mapped to new paths.
type Item = { label: string; href?: string; children?: Item[] }
const MENU = menu as Item[]

const isActive = (pathname: string, href?: string) =>
  !!href && href.startsWith('/') && href !== '/' && (pathname === href.split('?')[0] || pathname.startsWith(`${href}/`))

export function Nav() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

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
        {MENU.map((item) => (
          <div className="nav-item" key={item.label}>
            {item.href ? (
              <Link href={item.href} aria-current={isActive(pathname, item.href) ? 'page' : undefined} onClick={close}>
                {item.label}
              </Link>
            ) : (
              <span className="nav-label" tabIndex={0}>
                {item.label}
              </span>
            )}
            {item.children?.length ? (
              <ul className="nav-sub">
                {item.children.map((c) => (
                  <li key={c.label + c.href}>
                    <Link href={c.href || '/'} onClick={close}>
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </nav>
    </>
  )
}
