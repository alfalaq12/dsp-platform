/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Panda Dark Theme
        panda: {
          dark: {
            DEFAULT: '#0a0a0a',
            50: '#171717',
            100: '#1a1a1a',
            200: '#1f1f1f',
            300: '#262626',
            400: '#2a2a2a',
          },
          gold: {
            DEFAULT: '#CCA700',
            light: '#DAA520',
            dark: '#9A7B00',
            muted: '#BDB76B',
            50: '#FFF8DC',
            100: '#FAEBD7',
          },
          text: {
            DEFAULT: '#FAFAFA',
            muted: '#A3A3A3',
            dark: '#737373',
          }
        },
        primary: {
          50: '#FFF8DC',
          100: '#FAEBD7',
          200: '#F0E68C',
          300: '#DAA520',
          400: '#CCA700',
          500: '#BDB76B',
          600: '#9A7B00',
          700: '#8B6914',
          800: '#6B5300',
          900: '#4A3A00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        // Shadcn animations
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(204, 167, 0, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(204, 167, 0, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

