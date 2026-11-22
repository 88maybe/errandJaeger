// Feature flags. Turn one on with an env var (e.g. NEXT_PUBLIC_FEATURE_TELL_ME=1 in .env.local), then restart the dev server.
export const FLAGS = {
  // "Tell me what you need today": type a sentence, the AI fills in the plan choices. Off by default.
  tellMe: process.env.NEXT_PUBLIC_FEATURE_TELL_ME === "1",
} as const;
