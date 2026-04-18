import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Google from 'next-auth/providers/google'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            'openid email profile https://www.googleapis.com/auth/calendar.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === 'github' && account.access_token) {
        token.githubAccessToken = account.access_token
      }
      if (account?.provider === 'google' && account.access_token) {
        token.googleAccessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      // Attach GitHub token to session — server-side only, never sent to client
      if (typeof token.githubAccessToken === 'string') {
        session.githubAccessToken = token.githubAccessToken
      }
      // Attach Google token to session — server-side only, never sent to client
      if (typeof token.googleAccessToken === 'string') {
        session.googleAccessToken = token.googleAccessToken
      }
      return session
    },
  },
})
