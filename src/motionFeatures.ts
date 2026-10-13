// Enter/exit and opacity only — no layout projection, which would measure the
// page on every frame. Loaded asynchronously by LazyMotion so animation features stay off the critical path.
import { domAnimation } from 'framer-motion'
export default domAnimation
