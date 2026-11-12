"use client";

import { openCookieSettings } from "@plainconceptsplatform/ui-components/cookie-consent";

/** Reopens the consent banner, so a visitor can change or withdraw their choice at any time. */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="cursor-pointer text-left text-xs text-fd-muted-foreground hover:text-fd-foreground"
    >
      Cookie settings
    </button>
  );
}
