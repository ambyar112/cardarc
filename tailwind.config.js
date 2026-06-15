/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '375px',
      },
      colors: {
        'surface-container-lowest': '#0e0d15',
        'surface-container-low':    '#1c1b23',
        'surface-container':        '#201f27',
        'surface-container-high':   '#2a2932',
        'surface-container-highest':'#35343d',
        'surface':       '#13121b',
        'surface-bright':'#3a3841',
        'on-surface':    '#e5e0ed',
        'on-surface-variant': '#c8c4d7',
        'primary':           '#c6bfff',
        'primary-container': '#6c5ce7',
        'on-primary':        '#2900a0',
        'on-primary-container': '#faf6ff',
        'secondary':           '#f8bd45',
        'secondary-container': '#bc8709',
        'on-secondary':        '#412d00',
        'tertiary':            '#47d6ff',
        'tertiary-container':  '#007c98',
        'on-tertiary':         '#003543',
        'error':               '#ffb4ab',
        'error-container':     '#93000a',
        'on-error-container':  '#ffdad6',
        'outline':             '#928ea0',
        'outline-variant':     '#474554',
        'background':          '#13121b',
        'on-background':       '#e5e0ed',
        'inverse-surface':     '#e5e0ed',
        'inverse-on-surface':  '#312f38',
        'inverse-primary':     '#5847d2',
      },
      fontFamily: {
        // Share Tech Mono — tabular-nums, stats/badges/kode, zero layout jitter
        mono:    ['"Share Tech Mono"', 'monospace'],
        // Rajdhani — display/heading, squared & technical, cyberpunk feel
        display: ['Rajdhani', 'sans-serif'],
        // Plus Jakarta Sans — body/UI text, modern & readable
        body:    ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
