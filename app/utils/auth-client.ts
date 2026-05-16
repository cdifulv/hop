import { ssoClient } from "@better-auth/sso/client"
import { createAuthClient } from "better-auth/vue"

export const authClient = createAuthClient({
  plugins: [ssoClient()],
})

export const { signIn, signOut, useSession } = authClient
