import type { ReactNode } from 'react'

/*
  Equations are MathML: rendered by the browser, read by screen readers, no
  script. Set in Plex Mono (see .eq in index.css), with a plain-language
  translation beside each one.
*/
export function EquationBlock({ name, plain, children }: { name: string; plain: string; children: ReactNode }) {
  return (
    <figure className="grid gap-4 border-t-hair border-rule py-6 md:grid-cols-2 md:gap-10">
      <div className="eq overflow-x-auto overflow-y-hidden pb-1 text-ink">{children}</div>
      <figcaption>
        <p className="text-small font-semibold text-ink">{name}</p>
        <p className="mt-1 text-small text-ink-soft">{plain}</p>
      </figcaption>
    </figure>
  )
}

const I = ({ children }: { children: ReactNode }) => <mi>{children}</mi>
const O = ({ children }: { children: ReactNode }) => <mo>{children}</mo>
const Partial = ({ of, by }: { of: string; by: string }) => (
  <mfrac>
    <mrow>
      <O>∂</O>
      <I>{of}</I>
    </mrow>
    <mrow>
      <O>∂</O>
      <I>{by}</I>
    </mrow>
  </mfrac>
)

export const Continuity = () => (
  <math display="block" aria-label="partial A over partial t plus partial Q over partial x equals q sub l">
    <Partial of="A" by="t" />
    <O>+</O>
    <Partial of="Q" by="x" />
    <O>=</O>
    <msub>
      <I>q</I>
      <I>l</I>
    </msub>
  </math>
)

export const Muskingum = () => (
  <div className="space-y-3">
    <math display="block" aria-label="S equals K times, X I plus 1 minus X times O">
      <I>S</I>
      <O>=</O>
      <I>K</I>
      <O>[</O>
      <I>X</I>
      <I>I</I>
      <O>+</O>
      <O>(</O>
      <mn>1</mn>
      <O>−</O>
      <I>X</I>
      <O>)</O>
      <I>O</I>
      <O>]</O>
    </math>
    <math display="block" aria-label="O at t plus 1 equals C0 I at t plus 1 plus C1 I at t plus C2 O at t">
      <msub>
        <I>O</I>
        <mrow>
          <I>t</I>
          <O>+</O>
          <mn>1</mn>
        </mrow>
      </msub>
      <O>=</O>
      <msub>
        <I>C</I>
        <mn>0</mn>
      </msub>
      <msub>
        <I>I</I>
        <mrow>
          <I>t</I>
          <O>+</O>
          <mn>1</mn>
        </mrow>
      </msub>
      <O>+</O>
      <msub>
        <I>C</I>
        <mn>1</mn>
      </msub>
      <msub>
        <I>I</I>
        <I>t</I>
      </msub>
      <O>+</O>
      <msub>
        <I>C</I>
        <mn>2</mn>
      </msub>
      <msub>
        <I>O</I>
        <I>t</I>
      </msub>
    </math>
  </div>
)

export const Residual = () => (
  <math display="block" aria-label="r i of t equals sum over upstream reaches j into i of Q j, plus q i, minus Q i, minus d S i over d t">
    <msub>
      <I>r</I>
      <I>i</I>
    </msub>
    <O>=</O>
    <munder>
      <O>Σ</O>
      <mrow>
        <I>j</I>
        <O>→</O>
        <I>i</I>
      </mrow>
    </munder>
    <msub>
      <I>Q</I>
      <I>j</I>
    </msub>
    <O>+</O>
    <msub>
      <I>q</I>
      <I>i</I>
    </msub>
    <O>−</O>
    <msub>
      <I>Q</I>
      <I>i</I>
    </msub>
    <O>−</O>
    <mfrac>
      <mrow>
        <I>d</I>
        <msub>
          <I>S</I>
          <I>i</I>
        </msub>
      </mrow>
      <mrow>
        <I>d</I>
        <I>t</I>
      </mrow>
    </mfrac>
  </math>
)

export const GatV2 = () => (
  <div className="space-y-3">
    <math display="block" aria-label="e i j equals a transpose LeakyReLU of W times the concatenation of h i, h j and x i j">
      <msub>
        <I>e</I>
        <mrow>
          <I>i</I>
          <I>j</I>
        </mrow>
      </msub>
      <O>=</O>
      <msup>
        <I>a</I>
        <mo>⊤</mo>
      </msup>
      <mtext>LeakyReLU</mtext>
      <O>(</O>
      <I>W</I>
      <O>[</O>
      <msub>
        <I>h</I>
        <I>i</I>
      </msub>
      <O>‖</O>
      <msub>
        <I>h</I>
        <I>j</I>
      </msub>
      <O>‖</O>
      <msub>
        <I>x</I>
        <mrow>
          <I>i</I>
          <I>j</I>
        </mrow>
      </msub>
      <O>]</O>
      <O>)</O>
    </math>
    <math display="block" aria-label="alpha i j equals exp e i j over the sum over k of exp e i k">
      <msub>
        <I>α</I>
        <mrow>
          <I>i</I>
          <I>j</I>
        </mrow>
      </msub>
      <O>=</O>
      <mfrac>
        <mrow>
          <mtext>exp</mtext>
          <msub>
            <I>e</I>
            <mrow>
              <I>i</I>
              <I>j</I>
            </mrow>
          </msub>
        </mrow>
        <mrow>
          <munder>
            <O>Σ</O>
            <mrow>
              <I>k</I>
              <O>∈</O>
              <I>N</I>
              <O>(</O>
              <I>i</I>
              <O>)</O>
              <O>∪</O>
              <O>{'{'}</O>
              <I>i</I>
              <O>{'}'}</O>
            </mrow>
          </munder>
          <mtext>exp</mtext>
          <msub>
            <I>e</I>
            <mrow>
              <I>i</I>
              <I>k</I>
            </mrow>
          </msub>
        </mrow>
      </mfrac>
    </math>
  </div>
)
