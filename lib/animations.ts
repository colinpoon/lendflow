import { Variants, Transition } from 'framer-motion';

// Subtle fade in with upward movement
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 8
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

// Fade in without movement
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

// Container for staggered children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

// Stagger item (child of staggerContainer)
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 8
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  }
};

// SVG gauge/meter reveal animation
export const gaugeReveal: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 1.5,
      ease: 'easeOut'
    }
  }
};

// Number counter animation config
export const counterTransition: Transition = {
  duration: 1,
  ease: 'easeOut'
};

// Card hover effect - subtle lift and glow
export const cardHover = {
  rest: {
    scale: 1,
    boxShadow: '0 0 0 rgba(120, 200, 220, 0)'
  },
  hover: {
    scale: 1.01,
    boxShadow: '0 0 20px rgba(120, 200, 220, 0.15)',
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  }
};

// Table row hover
export const rowHover = {
  rest: {
    backgroundColor: 'transparent'
  },
  hover: {
    backgroundColor: 'rgba(120, 200, 220, 0.05)',
    transition: {
      duration: 0.15
    }
  }
};

// Page transition
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    y: 10
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.2,
      ease: 'easeIn'
    }
  }
};

// Scale in (for modals, popovers)
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut'
    }
  }
};

// Slide in from right (for sidebars, sheets)
export const slideInRight: Variants = {
  hidden: {
    x: '100%',
    opacity: 0
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn'
    }
  }
};

// Progress bar fill
export const progressFill = (percent: number): Variants => ({
  hidden: { width: 0 },
  visible: {
    width: `${percent}%`,
    transition: {
      duration: 0.8,
      ease: 'easeOut'
    }
  }
});

// Typing/reveal effect for text (character by character)
export const textReveal: Variants = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.03
    }
  })
};
