import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from './Breadcrumbs'

export function PageHero(props: { title: string; crumbs: Crumb[]; eyebrow?: string; children?: ReactNode }) {
  return (
    <div className="page-hero">
      <div className="wrap">
        <Breadcrumbs items={props.crumbs} />
        <div className="eyebrow">{props.eyebrow ?? 'IEOR · IIT Bombay'}</div>
        <h1>{props.title}</h1>
        {props.children}
      </div>
    </div>
  )
}
