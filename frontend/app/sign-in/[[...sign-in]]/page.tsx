"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-h1 font-bold text-navy">
            Welcome back
          </h1>
          <p className="mt-2 text-body text-text-secondary">
            Sign in to Narrowli
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-md rounded-xl border border-border-default bg-white",
              headerTitle: "font-sans font-semibold text-navy",
              headerSubtitle: "font-sans text-text-secondary",
              formButtonPrimary:
                "bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md",
              formFieldInput:
                "border-border-default rounded-md font-sans focus:ring-2 focus:ring-indigo-600",
              footerActionLink: "text-indigo-600 hover:text-indigo-700 font-medium",
            },
          }}
          fallbackRedirectUrl="/"
          signUpUrl="/sign-up"
        />
      </div>
    </main>
  );
}
