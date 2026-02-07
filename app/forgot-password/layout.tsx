import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Forgot Password | Word Is Bond',
  description:
    'Reset your Word Is Bond account password. Enter your email to receive a password reset link.',
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
