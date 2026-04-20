import LoginForm from './LoginForm';

export default function LoginPage({
  searchParams
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  return (
    <div className="mx-auto mt-20 max-w-sm rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold">Heruni CMS</h1>
      <p className="mt-1 text-sm text-heruni-ink/60">Editor sign-in</p>
      <LoginForm callbackUrl={searchParams.callbackUrl ?? '/admin'} />
      {searchParams.error && (
        <p className="mt-3 text-xs text-red-600">Sign-in failed. Check email & password.</p>
      )}
      <p className="mt-6 text-xs text-heruni-ink/50">
        Dev seed accounts: <code>editor@heruni-dict.am</code> / <code>heruni-editor-dev</code>
      </p>
    </div>
  );
}
