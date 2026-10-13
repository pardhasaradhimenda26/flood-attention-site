// jsdom lacks the browser APIs the page relies on; stub the minimum so
// components mount. Nothing here fakes data or behaviour under test.
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => cleanup())

if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  if (!('ResizeObserver' in window)) {
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(window as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
    ;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
  }
  if (!('IntersectionObserver' in window)) {
    class IO {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
    ;(window as unknown as { IntersectionObserver: typeof IO }).IntersectionObserver = IO
    ;(globalThis as unknown as { IntersectionObserver: typeof IO }).IntersectionObserver = IO
  }
}
