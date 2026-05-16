export default defineNuxtConfig({
  compatibilityDate: "2026-05-16",
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/globals.css"],
  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
      title: "Somerset Capital Group",
      meta: [
        {
          name: "description",
          content:
            "A Nuxt 4 and Vue app using the Somerset slate-blue brand system.",
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
