/**
 * useIdleTimeout.js — 15-minute inactivity auto-logout
 * ======================================================
 * Monitors: mousemove, mousedown, keydown, touchstart, scroll, click.
 * On idle timeout: calls onTimeout() which logs out and clears auth state.
 * Warning shown at 13 minutes (2-minute countdown before logout).
 *
 * PHI compliance: CNIC and session tokens must not remain active
 * after the clinician leaves the terminal unattended.
 */

import { useEffect, useRef, useState, useCallback } from "react";

const IDLE_MS = 15 * 60 * 1000;   // 15 minutes total
const WARN_MS = 13 * 60 * 1000;   // warn at 13 min (2 min before logout)
const EVENTS  = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export function useIdleTimeout(onTimeout, enabled = true) {
  const [warned, setWarned]       = useState(false);
  const [countdown, setCountdown] = useState(120);
  const idleTimer  = useRef(null);
  const warnTimer  = useRef(null);
  const ticker     = useRef(null);

  const clearAll = useCallback(() => {
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    clearInterval(ticker.current);
  }, []);

  const resetTimers = useCallback(() => {
    if (!enabled) return;
    clearAll();
    setWarned(false);
    setCountdown(120);

    warnTimer.current = setTimeout(() => {
      setWarned(true);
      setCountdown(120);
      ticker.current = setInterval(() => {
        setCountdown(c => (c <= 1 ? (clearInterval(ticker.current), 0) : c - 1));
      }, 1000);
    }, WARN_MS);

    idleTimer.current = setTimeout(() => {
      clearAll();
      setWarned(false);
      onTimeout();
    }, IDLE_MS);
  }, [enabled, onTimeout, clearAll]);

  useEffect(() => {
    if (!enabled) { clearAll(); return; }
    resetTimers();
    EVENTS.forEach(ev => window.addEventListener(ev, resetTimers, { passive: true }));
    return () => {
      clearAll();
      EVENTS.forEach(ev => window.removeEventListener(ev, resetTimers));
    };
  }, [enabled, resetTimers, clearAll]);

  return { warned, countdown, resetTimers };
}
