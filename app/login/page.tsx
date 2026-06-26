import { redirect } from 'next/navigation'

// The standalone login page was retired — the landing page ("/") carries the
// sign-in modal. Keep this route as a redirect so any lingering /login links
// (signup, forgot/reset password, auth guards) land somewhere valid.
export default function LoginRedirect() {
  redirect('/')
}
