import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In | Word Is Bond',
  description:
    'Sign in to your Word Is Bond account to access call monitoring, analytics, and AI-powered insights.',
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children
}
