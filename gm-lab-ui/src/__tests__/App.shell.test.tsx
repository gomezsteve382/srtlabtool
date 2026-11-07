/* App shell + registry smoke tests (jsdom). */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from '@/App';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('GM LAB shell', () => {
  it('renders the wordmark and every registry tab in the rail', () => {
    render(<App />);
    expect(screen.getByText('LAB')).toBeTruthy();
    for (const id of ['dashboard', 'security', 'vincensus', 'vinwrite', 'mileage', 'marry', 'pin', 'applets', 'emulator', 'analyzer', 'doip']) {
      expect(screen.getByTestId(`rail-${id}`), `rail tab ${id}`).toBeTruthy();
    }
  });

  it('lands on the dashboard with the module survey', () => {
    render(<App />);
    expect(screen.getByTestId('dashboard-tab')).toBeTruthy();
    expect(screen.getByTestId('module-survey')).toBeTruthy();
  });

  it('deep-links ?tab=security to the Security Console', () => {
    window.history.replaceState(null, '', '?tab=security');
    render(<App />);
    expect(screen.getByTestId('security-tab')).toBeTruthy();
    expect(screen.getByTestId('cgm-lane')).toBeTruthy();
  });

  it('renders the dashboard hero artwork (original SVG, no external assets)', () => {
    render(<App />);
    expect(document.querySelector('.hero-art')).toBeTruthy();
    expect(document.querySelector('.hero-art')?.getAttribute('aria-label')).toContain('SUV');
  });
});
