import Link from 'next/link'
import { Nav } from './Nav'

export function Header() {
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="utility">
        <div className="wrap">
          <span>Indian Institute of Technology Bombay</span>
          <a href="https://www.iitb.ac.in/">iitb.ac.in</a>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" href="/" aria-label="IEOR IIT Bombay home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/assets/golden-jubilee-logo.png" alt="" width={82} height={82} />
            <span>
              <span className="brand-name">IEOR</span>
              <span className="brand-sub">
                Industrial Engineering &amp;
                <br />
                Operations Research · IIT Bombay
              </span>
            </span>
          </Link>
          <Nav />
          <a className="header-cta" href="mailto:office.ieor@iitb.ac.in">
            Contact IEOR
          </a>
        </div>
      </header>
    </>
  )
}
