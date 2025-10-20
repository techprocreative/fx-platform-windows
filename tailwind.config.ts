import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c3d66',
        },
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#eab308',
          600: '#ca8a04',
        },
        danger: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': {
            transform: 'translateY(10px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg: ['18px', { lineHeight: '28px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
      },
    },
  },
  plugins: [
    // Plugin for custom CSS variables
    function({ addUtilities }: { addUtilities: any }) {
      const newUtilities = {
        '.bg-primary': {
          'background-color': 'rgb(var(--bg-primary))',
        },
        '.bg-secondary': {
          'background-color': 'rgb(var(--bg-secondary))',
        },
        '.bg-tertiary': {
          'background-color': 'rgb(var(--bg-tertiary))',
        },
        '.bg-inverse': {
          'background-color': 'rgb(var(--bg-inverse))',
        },
        '.text-primary': {
          'color': 'rgb(var(--text-primary))',
        },
        '.text-secondary': {
          'color': 'rgb(var(--text-secondary))',
        },
        '.text-tertiary': {
          'color': 'rgb(var(--text-tertiary))',
        },
        '.border-primary': {
          'border-color': 'rgb(var(--border-primary))',
        },
        '.border-secondary': {
          'border-color': 'rgb(var(--border-secondary))',
        },
        '.border-focus': {
          'border-color': 'rgb(var(--border-focus))',
        },
        '.bg-accent-primary': {
          'background-color': 'rgb(var(--accent-primary))',
        },
        '.text-accent-primary': {
          'color': 'rgb(var(--accent-primary))',
        },
        '.theme-transition': {
          'transition': 'var(--theme-transition)',
        },
      };
      
      addUtilities(newUtilities);
    },
  ],
};

export default config;
