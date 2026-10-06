import type { ThemeName } from '../types.js'

export interface Theme {
  name: ThemeName
  /** Built-in D2 theme id used as the base for diagram renders. */
  d2Theme: number
  colors: {
    bg: string
    surface: string
    surfaceAlt: string
    border: string
    text: string
    muted: string
    accent: string
    accentSoft: string
    onAccent: string
    success: string
    danger: string
  }
}

export const themes: Record<ThemeName, Theme> = {
  'technical-light': {
    name: 'technical-light',
    d2Theme: 0,
    colors: {
      bg: '#f6f8fb',
      surface: '#ffffff',
      surfaceAlt: '#eef2f7',
      border: '#d5dce6',
      text: '#152033',
      muted: '#5b6779',
      accent: '#2563eb',
      accentSoft: '#e3ecfd',
      onAccent: '#ffffff',
      success: '#15803d',
      danger: '#c2410c',
    },
  },
  'technical-dark': {
    name: 'technical-dark',
    d2Theme: 200,
    colors: {
      bg: '#0d1321',
      surface: '#161e30',
      surfaceAlt: '#1e2940',
      border: '#2c3a57',
      text: '#e8edf7',
      muted: '#97a3b9',
      accent: '#60a5fa',
      accentSoft: '#1c2f52',
      onAccent: '#0d1321',
      success: '#4ade80',
      danger: '#fb923c',
    },
  },
  'minimal-light': {
    name: 'minimal-light',
    d2Theme: 1,
    colors: {
      bg: '#ffffff',
      surface: '#ffffff',
      surfaceAlt: '#f4f4f5',
      border: '#d9d9de',
      text: '#18181b',
      muted: '#6b6b76',
      accent: '#18181b',
      accentSoft: '#ededf0',
      onAccent: '#ffffff',
      success: '#166534',
      danger: '#b91c1c',
    },
  },
  portfolio: {
    name: 'portfolio',
    d2Theme: 0,
    colors: {
      bg: '#faf7f2',
      surface: '#ffffff',
      surfaceAlt: '#f1ebe1',
      border: '#e0d6c6',
      text: '#231f1a',
      muted: '#6f665a',
      accent: '#c2410c',
      accentSoft: '#fbe6d8',
      onAccent: '#ffffff',
      success: '#3f7d3a',
      danger: '#b3261e',
    },
  },
}
