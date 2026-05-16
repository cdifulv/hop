import { auth } from "../../auth/config"
import { isConfiguredHost } from "../../utils/domains"

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  if (config.appDomain && !isConfiguredHost(event, config.appDomain)) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" })
  }

  return auth.handler(toWebRequest(event))
})
