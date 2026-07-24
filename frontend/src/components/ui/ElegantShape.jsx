import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'

/**
 * Floating blurred bar used behind the onboarding hero.
 *
 * Two nested motion layers on purpose: the outer one flies the shape in from
 * above once, the inner one keeps drifting forever. Combining both on a single
 * element would make the entry animation fight the idle loop.
 *
 * `gradient` accepts the Tailwind-style token from the original design
 * ("from-indigo-500/[0.15]"); since this project has no Tailwind, the token is
 * mapped to the colour it stands for. Opacities are lifted from the original
 * 0.15 so the pills stay visible on the light theme's pale background.
 */

const GRADIENTS = {
  'from-indigo-500/[0.15]': 'rgba(99, 102, 241, 0.28)',
  'from-rose-500/[0.15]':   'rgba(244, 63, 94, 0.24)',
  'from-violet-500/[0.15]': 'rgba(139, 92, 246, 0.26)',
  'from-amber-500/[0.15]':  'rgba(245, 158, 11, 0.24)',
  'from-cyan-500/[0.15]':   'rgba(6, 182, 212, 0.26)',
  'from-white/[0.08]':      'rgba(37, 99, 235, 0.14)',
}

export function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = 'from-white/[0.08]',
}) {
  const from = GRADIENTS[gradient] || gradient

  return (
    <motion.div
      initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.99],
        opacity: { duration: 1.2 },
      }}
      className={cn('elegant-shape', className)}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width, height }}
        className="elegant-shape-inner"
      >
        <div
          className="elegant-shape-fill"
          style={{ backgroundImage: `linear-gradient(to right, ${from}, transparent)` }}
        />
      </motion.div>
    </motion.div>
  )
}

export default ElegantShape
