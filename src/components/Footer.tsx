import Link from 'next/link'

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Explore',
    links: [
      ['/academics', 'Academics'],
      ['/admissions', 'Admissions'],
      ['/research', 'Research'],
      ['/people', 'People'],
    ],
  },
  {
    title: 'Engage',
    links: [
      ['/news', 'News & events'],
      ['/opportunities', 'Opportunities'],
      ['/people?category=alumni', 'Alumni'],
      ['/about', 'About'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['/academics/courses', 'Course catalog'],
      ['/research/publications', 'Publications'],
      ['/news?kind=announcement', 'Announcements'],
      ['/resources', 'Forms and resources'],
    ],
  },
]

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-grid">
          <div>
            <h2>IEOR · IIT Bombay</h2>
            <p>
              Department of Industrial Engineering and Operations Research
              <br />
              Indian Institute of Technology Bombay
              <br />
              Powai, Mumbai 400076, India
            </p>
            <p>
              <a href="mailto:office.ieor@iitb.ac.in">office.ieor@iitb.ac.in</a>
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} IEOR, IIT Bombay</span>
          <span>
            <a href="https://www.iitb.ac.in/">IIT Bombay</a>
          </span>
        </div>
      </div>
    </footer>
  )
}
