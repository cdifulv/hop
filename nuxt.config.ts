export default defineNuxtConfig({
  compatibilityDate: "2026-05-16",
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/globals.css"],
  runtimeConfig: {
    appDomain: process.env.NUXT_APP_DOMAIN,
    shortDomain: process.env.NUXT_SHORT_DOMAIN,
    public: {
      shortDomain: process.env.NUXT_PUBLIC_SHORT_DOMAIN || process.env.NUXT_SHORT_DOMAIN || "localhost:3000",
    },
  },
  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
      title: "hop",
      meta: [
        {
          name: "description",
          content: "A self-hosted URL shortener.",
        },
      ],
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;1,700&display=swap",
        },
      ],
    },
  },
  vite: {
    optimizeDeps: {
      include: ["@vue/devtools-core", "@vue/devtools-kit"],
    },
  },
  typescript: {
    strict: true,
  },
})
