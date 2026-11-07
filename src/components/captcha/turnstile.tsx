"use client";
import { useCallback, useEffect, useState } from "react";

/**
 * Cloudflare Turnstile bot check. Supabase Auth verifies the token on its side
 * (Authentication → Bot and Abuse Protection), so bots can't skip it by calling
 * Supabase directly. Shown only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set;
 * without it, forms work exactly as before.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const isCaptchaEnabled = Boolean(TURNSTILE_SITE_KEY);

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global { interface Window { turnstile?: TurnstileApi } }

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    s.onerror = () => { scriptPromise = null; reject(new Error("Turnstile didn't load")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * const captcha = useCaptcha();
 * <captcha.Widget />  …  options: { captchaToken: captcha.token }  …  captcha.reset() after each attempt
 * Tokens are single-use, so reset after every submit, successful or not.
 */
export function useCaptcha() {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [widget, setWidget] = useState<string | null>(null);

  const reset = useCallback(() => {
    setToken(undefined);
    if (widget && window.turnstile) window.turnstile.reset(widget);
  }, [widget]);

  // The widget's container, set by <CaptchaBox>; the widget renders once it exists.
  const [el, mount] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el || !isCaptchaEnabled) return;
    let cancelled = false;
    let id: string | null = null;
    loadTurnstile().then((ts) => {
      if (cancelled) return;
      id = ts.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "auto",
        size: "flexible",
        callback: (t: string) => { setToken(t); setFailed(false); },
        "expired-callback": () => setToken(undefined),
        "error-callback": () => { setToken(undefined); setFailed(true); },
      });
      setWidget(id);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
      setWidget(null);
    };
  }, [el]);

  return {
    enabled: isCaptchaEnabled,
    /** Undefined when disabled or not solved yet. */
    token,
    /** True when the form may be submitted (solved, or captcha not in use). */
    ready: !isCaptchaEnabled || Boolean(token),
    failed,
    reset,
    mount,
  };
}

export function CaptchaBox({ captcha }: { captcha: ReturnType<typeof useCaptcha> }) {
  const { enabled, failed, mount } = captcha;
  if (!enabled) return null;
  return (
    <div className="grid gap-1.5">
      <div ref={mount} className="min-h-[65px]" />
      {failed && <p className="text-xs text-danger">The security check couldn&apos;t load. Check your connection or turn off content blockers, then reload the page.</p>}
    </div>
  );
}
