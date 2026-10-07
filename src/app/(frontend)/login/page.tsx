export const metadata = { title: 'Sign in | IEOR @ IIT Bombay', robots: { index: false } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>
}) {
  const { sent, error } = await searchParams
  return (
    <section style={{ maxWidth: '28rem', margin: '3rem auto', padding: '0 1rem' }}>
      <h1>Sign in</h1>
      {sent ? (
        <p role="status">If that email is registered, a sign-in link is on its way. It expires in 15 minutes.</p>
      ) : (
        <>
          {error && <p role="alert">That link is invalid or has expired. Request a new one.</p>}
          <p>Enter your IITB email and we will send you a one-time sign-in link.</p>
          <form method="post" action="/api/auth/magic-link">
            <label htmlFor="email">Email</label>{' '}
            <input id="email" name="email" type="email" required autoComplete="email" />{' '}
            <button type="submit">Send link</button>
          </form>
        </>
      )}
    </section>
  )
}
