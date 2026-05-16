/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark theme surface layers
        surface: {
          900: '#12141A',   // deepest bg (sidebar)
          800: '#1A1D24',   // main bg
          700: '#22262E',   // card bg
          600: '#2A2F38',   // elevated card / hover
          500: '#333842',   // borders, dividers
          400: '#3E4450',   // subtle borders
        },
        // Text hierarchy
        ink: {
          50:  '#F0F2F5',   // primary text
          100: '#D4D8E0',   // secondary text
          200: '#A0A8B8',   // muted text
          400: '#6B7385',   // subtle text
          600: '#4A5163',   // disabled
          800: '#2A2F3A',
          900: '#12141A',
        },
        // Teal accent
        accent: {
          50:  '#E6FAF6',
          100: '#B3F0E6',
          200: '#80E6D6',
          300: '#4DDCC6',
          400: '#1AD2B6',
          500: '#00B4A0',   // primary teal
          600: '#009688',
          700: '#007A6F',
        },
        // Status colors
        status: {
          prep:    '#F59E0B',  // amber — preparation
          active:  '#3B82F6',  // blue — in production
          done:    '#10B981',  // green — complete
          danger:  '#EF4444',  // red — problem
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        glow: '0 0 20px rgba(0,180,160,0.15)',
      }
    }
  },
  plugins: []
};
