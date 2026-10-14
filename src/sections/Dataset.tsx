import { lazy, Suspense } from 'react'
import { scaleLinear } from 'd3-scale'
import { basins } from '../data/network'
import { dataset, tpl } from '../data/content'
import { mv } from '../lib/metrics'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { Rich } from '../components/Rich'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'
import { LazyMount } from '../components/LazyMount'
import { bankfull, bedSlope, hydraulics, manningN, profile, sectionNode, stageMax, stageMin } from '../lib/section'
import { gaugeName } from '../lib/graph'
import { useMeasure } from '../lib/useMeasure'
import { fmt } from '../lib/format'
import { useSite } from '../state'

const CrossSection = lazy(() => import('../three/CrossSection'))
const HELD = new Set(['basin_07', 'basin_08'])

/** The section as a surveyed profile: the static equivalent of the 3D view. */
function Profile() {
  const [ref, width] = useMeasure<HTMLDivElement>(520)
  const stage = useSite((s) => s.stageM)
  const hy = hydraulics(stage)
  const height = Math.max(200, Math.min(260, width * 0.42))
  const m = { t: 16, r: 12, b: 30, l: 40 }
  const xs = profile.map((p) => p[0])
  const x = scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([m.l, width - m.r])
  const y = scaleLinear().domain([-0.2, stageMax + 0.3]).range([height - m.b, m.t])
  const bed = profile.map(([px, pz]) => `${x(px).toFixed(1)},${y(pz).toFixed(1)}`).join(' ')
  const ground = `M${x(xs[0])},${y(-0.2)} L${bed.replace(/ /g, ' L')} L${x(xs[xs.length - 1])},${y(-0.2)} Z`
  const wet = hy.poly.length > 1 ? `M${hy.poly.map(([px, pz]) => `${x(px).toFixed(1)},${y(pz).toFixed(1)}`).join(' L')} Z` : ''
  const left = hy.poly[0]?.[0]
  const right = hy.poly[hy.poly.length - 1]?.[0]
  return (
    <div ref={ref}>
      <svg width={width} height={height} className="block" role="img" aria-label={`Cross-section profile with water ${fmt(stage, 2)} metres above the bed`}>
        <defs>
          <pattern id="xs-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-soft)" strokeWidth="0.8" opacity="0.5" />
          </pattern>
        </defs>
        {[0, 0.5, 1, 1.5, 2].map((t) => (
          <g key={t}>
            <line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke="var(--paper-line)" />
            <text x={m.l - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} className="num" fill="var(--ink-soft)">
              {t}
            </text>
          </g>
        ))}
        <text x={m.l - 6} y={m.t - 4} textAnchor="end" fontSize={10} fill="var(--ink-soft)">m</text>
        <path d={ground} fill="url(#xs-hatch)" stroke="none" />
        {wet && <path d={wet} fill="var(--w2)" stroke="none" opacity={0.85} />}
        <polyline points={bed} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
        {/* water surface with the engineering mark */}
        {left !== undefined && (
          <g>
            <line x1={x(left)} x2={x(right)} y1={y(stage)} y2={y(stage)} stroke="var(--w5)" strokeWidth={1.5} />
            <path d={`M${x(right) - 22},${y(stage) - 11} h12 l-6,9 z`} fill="none" stroke="var(--w5)" strokeWidth={1.2} />
          </g>
        )}
        {/* bankfull */}
        <line x1={m.l} x2={width - m.r} y1={y(bankfull)} y2={y(bankfull)} stroke="var(--ink-soft)" strokeDasharray="3 3" />
        <text x={width - m.r} y={y(bankfull) - 5} textAnchor="end" fontSize={10} fill="var(--ink-soft)">bankfull</text>
        {/* soundings at the survey points */}
        {profile.map(([px, pz], i) =>
          i % 2 === 0 ? (
            <text key={i} x={x(px)} y={y(pz) + 14} textAnchor="middle" fontSize={9} className="num" fill="var(--ink-soft)">
              {pz.toFixed(1)}
            </text>
          ) : null,
        )}
        <text x={width - m.r} y={height - 6} textAnchor="end" fontSize={10} fill="var(--ink-soft)">
          offset across the channel, {fmt(profile[profile.length - 1][0] - profile[0][0], 0)} m
        </text>
      </svg>
    </div>
  )
}

function Readouts() {
  const stage = useSite((s) => s.stageM)
  const set = useSite((s) => s.setStageM)
  const hy = hydraulics(stage)
  const rows: [string, string, string][] = [
    ['Flow area A', fmt(hy.area, 2), 'm²'],
    ['Wetted perimeter P', fmt(hy.wetted, 2), 'm'],
    ['Hydraulic radius R = A / P', fmt(hy.radius, 3), 'm'],
    ['Top width', fmt(hy.top, 1), 'm'],
    ['Discharge Q', fmt(hy.discharge, hy.discharge < 10 ? 2 : 1), 'm³/s'],
  ]
  return (
    <div>
      <label className="flex flex-wrap items-center gap-3 text-small text-ink-soft">
        <span>{dataset.xs.stage}</span>
        <input
          type="range"
          className="range w-48"
          min={stageMin}
          max={stageMax}
          step={0.01}
          value={stage}
          onChange={(e) => set(Number(e.target.value))}
          aria-valuetext={`${stage.toFixed(2)} metres`}
        />
        <output className="num text-ink">{stage.toFixed(2)} m</output>
      </label>
      <dl className="mt-4 divide-y divide-paper-line border-y-hair border-paper-line" aria-live="polite">
        {rows.map(([k, v, u]) => (
          <div key={k} className="flex items-baseline justify-between py-1.5 text-small">
            <dt className="text-ink-soft">{k}</dt>
            <dd className="num text-ink">
              {v} <span className="text-ink-soft">{u}</span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="eq mt-4 text-ink">
        <math display="block" aria-label="Q equals 1 over n times A times R to the two thirds times S to the one half">
          <mi>Q</mi>
          <mo>=</mo>
          <mfrac>
            <mn>1</mn>
            <mi>n</mi>
          </mfrac>
          <mi>A</mi>
          <msup>
            <mi>R</mi>
            <mrow>
              <mn>2</mn>
              <mo>/</mo>
              <mn>3</mn>
            </mrow>
          </msup>
          <msup>
            <mi>S</mi>
            <mrow>
              <mn>1</mn>
              <mo>/</mo>
              <mn>2</mn>
            </mrow>
          </msup>
        </math>
      </div>
      <p className="num mt-2 text-micro text-ink-soft">
        n = {fmt(manningN, 4)}, S = {fmt(bedSlope, 5)} (dataset, {sectionNode.label})
      </p>
    </div>
  )
}

export function Dataset() {
  const vars = {
    massBalance: mv('mass_balance'),
    kernel: mv('storm_kernel'),
    dryRise: mv('dry_rise'),
    horizon: mv('horizon_ratio'),
    gauged: mv('gauged'),
    nodes: mv('nodes'),
    gaugedPct: mv('gauged_pct'),
  }
  return (
    <Section id="dataset" ground="paper">
      <SectionHead section="dataset" id="dataset-h">
        {dataset.heading}
      </SectionHead>
      <ClaimBlock claim={claims.checkable} size="h3" className="mb-10" />
      <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
        {dataset.paragraphs.map((p, i) => (
          <p key={i} className="max-w-measure text-body">
            <Rich text={p} vars={vars} />
          </p>
        ))}
      </div>
      <p className="mt-10 max-w-measure border-l-2 border-ink pl-4 text-lead text-ink">{dataset.caveat}</p>

      {basins.length > 0 && (
        <div className="mt-14 overflow-x-auto">
          <table className="w-full min-w-figure-sm text-small">
            <caption className="pb-3 text-left text-small text-ink-soft">{dataset.basinsCaption}</caption>
            <thead>
              <tr className="border-b-hair border-ink text-left text-micro text-ink-soft">
                <th scope="col" className="py-1.5 pr-4 font-normal">Basin</th>
                <th scope="col" className="py-1.5 pr-4 font-normal">Character</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-normal">Celerity, m/s</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-normal">Manning n</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-normal">Nodes</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-normal">Edges</th>
                <th scope="col" className="py-1.5 pr-4 text-right font-normal">Tributaries</th>
                <th scope="col" className="py-1.5 text-right font-normal">Gauged</th>
              </tr>
            </thead>
            <tbody>
              {basins.map((b) => (
                <tr key={b.id} className="border-b-hair border-paper-line">
                  <th scope="row" className="num py-1.5 pr-4 text-left font-normal">
                    {b.id}
                    {HELD.has(b.id) && <span className="ml-2 font-sans text-micro text-ink-soft">held out</span>}
                  </th>
                  <td className="py-1.5 pr-4 text-ink-soft">{b.character}</td>
                  <td className="num py-1.5 pr-4 text-right">{fmt(b.celerityMs, 2)}</td>
                  <td className="num py-1.5 pr-4 text-right">{fmt(b.manningN, 3)}</td>
                  <td className="num py-1.5 pr-4 text-right">{b.nodes}</td>
                  <td className="num py-1.5 pr-4 text-right">{b.edges}</td>
                  <td className="num py-1.5 pr-4 text-right">{b.tributaries}</td>
                  <td className="num py-1.5 text-right">{b.gauged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-20 border-t-hair border-ink pt-4">
        <h3 className="text-h3">
          {tpl(dataset.xs.heading, { label: '' })}
          <span className="num">{sectionNode.label}</span>
          <span className="text-ink-soft">
            {' '}
            · gauge <span className="num">{gaugeName.get(sectionNode.id)}</span>
          </span>
        </h3>
        <p className="mt-3 max-w-measure text-body text-ink-soft">{dataset.xs.body}</p>
        <div className="mt-8 grid gap-10 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-7">
            <Profile />
            <LazyMount className="mt-6 h-section3d border-hair border-paper-line" placeholder={<div className="h-full bg-abyss" />}>
              <Suspense fallback={<div className="h-full bg-abyss" />}>
                <CrossSection
                  label={dataset.xs.sceneLabel}
                  className="h-full"
                  fallback={
                    <div className="flex h-full items-center bg-paper-inset p-6 text-small text-ink-soft">
                      The 3D view needs WebGL. The surveyed profile above shows the same section and responds to the same slider.
                    </div>
                  }
                />
              </Suspense>
            </LazyMount>
            <p className="mt-2 text-micro text-ink-soft">3D view: vertical scale ×4. Drag sideways to turn it.</p>
          </div>
          <div className="min-w-0 lg:col-span-5">
            <Readouts />
          </div>
        </div>
      </div>
    </Section>
  )
}
