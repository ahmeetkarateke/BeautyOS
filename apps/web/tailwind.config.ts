import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6B48FF',
          50: '#F0ECFF',
          100: '#E0D8FF',
          200: '#C2B2FF',
          300: '#A38BFF',
          400: '#8565FF',
          500: '#6B48FF',
          600: '#4E28FF',
          700: '#3A10FA',
          800: '#2D0DC7',
          900: '#200B93',
        },
        success: '#28A745',
        whatsapp: '#25D366',
        salon: {
          bg: '#FAFAFA',
          card: '#FFFFFF',
          border: '#E5E7EB',
          muted: '#6B7280',
        },
        auth: {
          bg: '#0D0D1A',
          orb3: '#4F8EFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        glass: '0 8px 40px rgba(107, 72, 255, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-primary': '0 0 20px rgba(107, 72, 255, 0.5)',
        'glow-input': '0 0 0 2px rgba(107, 72, 255, 0.4)',
      },
    },
  },
  plugins: [forms],
}

export default config
