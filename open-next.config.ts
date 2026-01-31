import type { OpenNextConfig } from 'open-next/types/open-next'

const config: OpenNextConfig = {
  default: {},
  imageOptimization: {
    disabled: true,
  },
  buildCommand: "npx next build",
}

export default config