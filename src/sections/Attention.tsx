import { lazy, Suspense, type KeyboardEvent } from 'react'
import { attention } from '../data/network'
import { attentionCopy, tpl } from '../data/content'
import { Section } from '../components/Section'
import { SectionHead } from '../components/SectionHead'
import { Rich } from '../components/Rich'
import { ClaimBlock } from '../components/ClaimBlock'
import { claims } from '../data/claims'
import { LazyMount } from '../components/LazyMount'
import { AttentionPanel } from '../components/AttentionPanel'
import { ForecastWindow } from '../components/ForecastWindow'
import { NetworkPlan } from '../components/NetworkPlan'
import { confluence, hasAttention, incomingAll, incomingRouting, nodeById, rolloutSteps, walk } from '../lib/graph'
import { fmt } from '../lib/format'
import { useSite, type AggMode } from '../state'

const AttentionScene = lazy(() => import('../three/AttentionScene'))

function ModeToggle() {
  const mode = useSite((s) => s.aggMode)
  const set = useSite((s) => s.setAggMode)
  const opts: AggMode[] = ['uniform', 'learned']
  return (
    <div role="group" aria-label="Aggregation" className="inline-flex border-hair border-abyss-line p-0.5">
      {opts.map((o) => {
        const disabled = o === 'learned' && !hasAttention
        const on = mode === o
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => set(o)}
            className={`relative px-3 py-1.5 text-small transition-colors duration-200 motion-reduce:transition-none ${on ? 'bg-foam text-abyss' : 'text-foam-soft hover:text-foam'} ${disabled ? 'pending-hatch cursor-not-allowed' : ''}`}
          >
            <span className="relative">
              {attentionCopy.modes[o]}
              {disabled ? ' — pending' : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function StepScrubber() {
  const step = useSite((s) => s.step)
  const set = useSite((s) => s.setStep)
  return (
    <label className="flex items-center gap-3 text-small text-foam-soft">
      <span>{attentionCopy.stepLabel}</span>
      <input
        type="range"
        className="range w-36 sm:w-44"
        min={0}
        max={rolloutSteps - 1}
        step={1}
        value={step}
        onChange={(e) => set(Number(e.target.value))}
        aria-valuetext={`t plus ${step + 1} hours`}
      />
      <output className="num w-14 text-foam">t+{step + 1} h</output>
    </label>
  )
}

/** All twelve rollout hours at the confluence, as a table. */
function ConfluenceTable() {
  const att = attention
  if (!att || !confluence) return null
  const inc = incomingAll.get(confluence.id) ?? []
  return (
    <details className="mt-6 text-small text-foam-soft">
      <summary className="cursor-pointer hover:text-foam">{attentionCopy.tableToggle}</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left">
          <caption className="pb-2 text-left text-micro">
            Learned weight on each message into <span className="num">{confluence.label}</span>, by rollout hour (mean of {att.seeds} seeds)
          </caption>
          <thead>
            <tr className="border-b-hair border-abyss-line text-micro">
              <th scope="col" className="py-1 pr-3 font-normal">From</th>
              <th scope="col" className="py-1 pr-3 font-normal">Travel</th>
              {Array.from({ length: att.steps }, (_, k) => (
                <th key={k} scope="col" className="num py-1 pr-2 text-right font-normal">
                  +{k + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inc.map((e) => (
              <tr key={e.id} className="border-b-hair border-abyss-line">
                <th scope="row" className="num py-1 pr-3 font-normal text-foam">
                  {nodeById.get(e.source)!.label}
                </th>
                <td className="num py-1 pr-3">{fmt(e.travelTimeHours, 1)} h</td>
                {att.mean.map((row, k) => (
                  <td key={k} className="num py-1 pr-2 text-right text-signal-lift">
                    {fmt(row[e.id], 2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** The focused node's discharge over the model window, on a strip of chart paper. */
function WindowStrip() {
  const selected = useSite((s) => s.selected)
  const hovered = useSite((s) => s.hovered)
  const step = useSite((s) => s.step)
  const id = hovered ?? selected
  const node = nodeById.get(id)
  if (!node) return null
  return (
    <div className="ground-paper border-t-hair border-abyss-line px-5 py-4 sm:px-6">
      <p className="text-small font-semibold text-ink">{tpl(attentionCopy.hydroTitle, { label: node.label })}</p>
      <ForecastWindow nodeId={node.id} step={step} />
      <p className="text-micro text-ink-soft">{attentionCopy.hydroNote}</p>
    </div>
  )
}

export function Attention() {
  const setSelected = useSite((s) => s.setSelected)
  const selected = useSite((s) => s.selected)
  const setHovered = useSite((s) => s.setHovered)

  const ups = confluence ? (incomingRouting.get(confluence.id) ?? []) : []
  const main = ups.find((e) => nodeById.get(e.source)!.branch === 'main')
  const trib = ups.find((e) => nodeById.get(e.source)!.branch !== 'main')
  const vars = {
    conf: confluence?.label ?? '',
    ttMain: main ? fmt(main.travelTimeHours, 1) : '—',
    ttTrib: trib ? fmt(trib.travelTimeHours, 1) : '—',
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      setHovered(null)
      setSelected(walk(selected || confluence.id, e.key))
    } else if (e.key === 'Escape') {
      setSelected('')
    }
  }

  return (
    <Section id="attention" ground="abyss">
      <SectionHead section="attention" id="attention-h">
        {attentionCopy.heading}
      </SectionHead>
      <ClaimBlock claim={claims.junction} size="h3" className="mb-10" />
      <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
        {attentionCopy.paragraphs.map((p, i) => (
          <p key={i} className={`max-w-measure text-body ${i === 2 ? 'text-foam lg:col-span-2' : 'text-foam-soft'}`}>
            <Rich text={p} vars={vars} />
          </p>
        ))}
        {!hasAttention && <p className="pending-hatch p-3 text-small text-foam-soft lg:col-span-2">{attentionCopy.pendingLearned}</p>}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ModeToggle />
        <StepScrubber />
        <button
          type="button"
          onClick={() => setSelected(confluence.id)}
          className="text-small text-foam underline decoration-foam-soft underline-offset-4 hover:decoration-foam"
        >
          {attentionCopy.toConfluence} <span className="num">{confluence.label}</span>
        </button>
      </div>

      <figure className="mt-5 grid grid-cols-1 border-hair border-abyss-line lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div
            tabIndex={0}
            onKeyDown={onKey}
            aria-label={`Attention network. ${attentionCopy.keyboard} Escape shows the whole network.`}
            aria-describedby="attention-kbd"
            className="relative h-attn"
          >
            <LazyMount className="h-full" placeholder={<NetworkPlan mode="attention" className="h-full w-full opacity-40" onSelect={setSelected} />}>
              <Suspense fallback={<NetworkPlan mode="attention" className="h-full w-full opacity-40" onSelect={setSelected} />}>
                <AttentionScene label={attentionCopy.sceneLabel} className="h-full" />
              </Suspense>
            </LazyMount>
            <p id="attention-kbd" className="pointer-events-none absolute bottom-3 left-3 max-w-caption text-micro text-foam-soft">
              {attentionCopy.keyboard}
            </p>
          </div>
          <WindowStrip />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <AttentionPanel />
        </div>
        <figcaption className="sr-only">{attentionCopy.sceneLabel}</figcaption>
      </figure>
      <ConfluenceTable />
    </Section>
  )
}
