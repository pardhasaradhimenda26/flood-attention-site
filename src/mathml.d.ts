import 'react'

type MathEl = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
  display?: 'block' | 'inline'
  mathvariant?: string
  stretchy?: 'true' | 'false'
  lspace?: string
  rspace?: string
  linethickness?: string
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      math: MathEl
      mi: MathEl
      mo: MathEl
      mn: MathEl
      mrow: MathEl
      mfrac: MathEl
      msub: MathEl
      msup: MathEl
      msubsup: MathEl
      munder: MathEl
      munderover: MathEl
      mtext: MathEl
      mspace: MathEl & { width?: string }
    }
  }
}
