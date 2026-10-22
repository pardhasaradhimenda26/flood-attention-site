import { site } from '../data/content'
import { ciOf, metric, mv } from './metrics'
import { STATUS_WORD } from './status'

/*
  A plain-text account of the findings, built from results.ts at build time
  for the HTML shell: the noscript summary, the meta description and the
  link-preview text. No number is typed here, so the shell cannot claim more
  than the data does.
*/

const word = (id: string) => STATUS_WORD[metric(id)?.status ?? 'pending'].toLowerCase()

export const question =
  'Can a temporal graph attention network forecast river discharge at cross-sections with no gauge, and do its attention weights recover each reach’s hydraulic travel time?'

export function findingsSummary(): { title: string; status: string; text: string }[] {
  return [
    {
      title: 'Accuracy',
      status: word('gat_vs_gcn'),
      text:
        `Attention (GAT) lowered ungauged discharge error by ${mv('gat_vs_gcn', true)} against a GCN, pooled over eight synthetic basins ` +
        `(${ciOf('gat_vs_gcn')}). On the two held-out basins alone, ${mv('gat_vs_gcn_held', true)} (${ciOf('gat_vs_gcn_held')}), ${word('gat_vs_gcn_held')}: transfer is not established.`,
    },
    {
      title: 'Interpretability',
      status: 'did not hold',
      text:
        `Attention does not track travel time: hop-stratified r = ${mv('att_tt_r')} on all message edges and ${mv('att_tt_r_routing')} on routing edges, at chance. ` +
        `Reach length alone scores ${mv('att_confound')}, higher than the learned attention, and attention agrees across seeds at only ${mv('att_seed_r')}.`,
    },
    {
      title: 'Wayanad, modelled',
      status: word('wy_gat_vs_gcn'),
      text:
        `On a HEC-RAS 2D model of the Kabini river in Wayanad (August 2018 inflow; model output, not yet validated against observations), attention lowered ungauged error by ${mv('wy_gat_vs_gcn', true)} against a GCN over five held-out floods (${ciOf('wy_gat_vs_gcn')}), and again did not track measured travel time (r = ${mv('wy_att_tt_r')}, against a reach-length baseline of ${mv('wy_att_confound')}).`,
    },
    {
      title: 'Real gauges',
      status: word('real_gat_vs_gcn'),
      text: 'Results on the real network’s four gauges (H1–H4) do not exist yet. Every number above comes from synthetic basins or from HEC-RAS model output.',
    },
  ]
}

export function metaDescription(): string {
  return (
    `B.Tech thesis by ${site.author}, ${site.institution}. Graph attention for flood forecasting at ungauged river sections: ` +
    `a qualified ${mv('gat_vs_gcn', true)} accuracy gain over a GCN; attention did not learn travel time (r = ${mv('att_tt_r')}, below a reach-length baseline of ${mv('att_confound')}). ` +
    `Real-gauge results pending.`
  )
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The noscript block for index.html. */
export function noscriptHtml(): string {
  const items = findingsSummary()
    .map((f) => `<li><strong>${esc(f.title)}, ${esc(f.status)}.</strong> ${esc(f.text)}</li>`)
    .join('')
  return (
    `<div style="padding:2rem;max-width:62ch;font-family:system-ui,sans-serif;line-height:1.55;color:#dce7ea">` +
    `<h1 style="font-size:1.6rem;line-height:1.2">${esc(site.thesisTitle)}</h1>` +
    `<p>${esc(site.author)} — ${esc(site.degree)}, ${esc(site.institution)}.</p>` +
    `<h2 style="font-size:1.1rem">Research question</h2><p>${esc(question)}</p>` +
    `<h2 style="font-size:1.1rem">What was found</h2><ul>${items}</ul>` +
    `<p>The interactive figures need JavaScript. The run outputs behind every number are in the ` +
    `<a style="color:inherit" href="${esc(site.repo)}/tree/main/provenance">repository</a>.</p></div>`
  )
}
