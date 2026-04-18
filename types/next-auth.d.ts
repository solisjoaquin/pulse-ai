import 'next-auth'

declare module 'next-auth' {
  interface Session {
    githubAccessToken?: string
    googleAccessToken?: string
    jiraToken?: string
    jiraDomain?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    githubAccessToken?: string
    googleAccessToken?: string
    jiraToken?: string
    jiraDomain?: string
  }
}
