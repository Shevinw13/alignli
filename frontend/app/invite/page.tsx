"use client";

import { useClerk } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Suspense } from "react";

type InviteStatus =
  | "loading"
  | "accepting"
  | "success"
  | "expired"
  | "already-accepted"
  | "error";

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const clerk = useClerk();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ticket = searchParams.get("__clerk_ticket");
  const invitationStatus = searchParams.get("__clerk_status");

  useEffect(() => {
    if (!ticket) {
      setStatus("error");
      setErrorMessage(
        "No invitation token found. Please check the invitation link or request a new one."
      );
      return;
    }

    // Check if the invitation has already been used or expired via URL params
    if (invitationStatus === "expired") {
      setStatus("expired");
      return;
    }

    if (invitationStatus === "accepted") {
      setStatus("already-accepted");
      return;
    }

    if (!clerk.loaded) {
      return;
    }

    acceptInvitation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, invitationStatus, clerk.loaded]);

  async function acceptInvitation() {
    if (!ticket || !clerk.loaded) return;

    setStatus("accepting");

    try {
      // Try sign-up with the invitation ticket (new user)
      const signUpResult = await clerk.client.signUp.create({
        strategy: "ticket",
        ticket,
      });

      if (signUpResult.status === "complete") {
        await clerk.setActive({ session: signUpResult.createdSessionId });
        setStatus("success");
        setTimeout(() => router.push("/"), 2000);
        return;
      }
    } catch (err: unknown) {
      // If sign-up fails because account already exists, try sign-in
      const error = err as { errors?: Array<{ code: string; message: string }> };
      const hasExistingAccount = error.errors?.some(
        (e) =>
          e.code === "form_identifier_exists" ||
          e.code === "form_account_exists"
      );

      if (hasExistingAccount) {
        try {
          const signInResult = await clerk.client.signIn.create({
            strategy: "ticket",
            ticket,
          });

          if (signInResult.status === "complete") {
            await clerk.setActive({ session: signInResult.createdSessionId });
            setStatus("success");
            setTimeout(() => router.push("/"), 2000);
            return;
          }
        } catch (signInErr: unknown) {
          handleInviteError(signInErr);
          return;
        }
      }

      handleInviteError(err);
    }
  }

  function handleInviteError(err: unknown) {
    const error = err as { errors?: Array<{ code: string; message: string }> };
    const clerkError = error.errors?.[0];

    if (clerkError?.code === "invitation_expired") {
      setStatus("expired");
    } else if (
      clerkError?.code === "invitation_already_accepted" ||
      clerkError?.code === "invitation_already_revoked"
    ) {
      setStatus("already-accepted");
    } else {
      setStatus("error");
      setErrorMessage(
        clerkError?.message ||
          "Something went wrong accepting your invitation. Please try again or request a new one."
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary-bg px-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border-default bg-white p-8 shadow-md">
          {status === "loading" && (
            <div className="text-center">
              <h2 className="text-title font-semibold text-navy">
                Processing invitation...
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                Please wait while we verify your invitation.
              </p>
            </div>
          )}

          {status === "accepting" && (
            <div className="text-center">
              <h2 className="text-title font-semibold text-navy">
                Accepting invitation...
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                Setting up your account. This will only take a moment.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <svg
                  className="h-6 w-6 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
              </div>
              <h2 className="text-title font-semibold text-navy">
                Invitation accepted
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                You&apos;ve joined the organization. Redirecting you now...
              </p>
            </div>
          )}

          {status === "expired" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <svg
                  className="h-6 w-6 text-amber-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h2 className="text-title font-semibold text-navy">
                Invitation expired
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                This invitation is no longer valid. Please ask your team
                administrator to send a new one.
              </p>
              <a
                href="/sign-in"
                className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Go to Sign In
              </a>
            </div>
          )}

          {status === "already-accepted" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                <svg
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h2 className="text-title font-semibold text-navy">
                Invitation already accepted
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                This invitation has already been used. If you need access,
                please request a new invitation from your team administrator.
              </p>
              <a
                href="/sign-in"
                className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Go to Sign In
              </a>
            </div>
          )}

          {status === "error" && (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <svg
                  className="h-6 w-6 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                  />
                </svg>
              </div>
              <h2 className="text-title font-semibold text-navy">
                Something went wrong
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                {errorMessage}
              </p>
              <a
                href="/sign-in"
                className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Go to Sign In
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-secondary-bg px-4">
          <div className="w-full max-w-md">
            <div className="rounded-xl border border-border-default bg-white p-8 shadow-md text-center">
              <h2 className="text-title font-semibold text-navy">
                Processing invitation...
              </h2>
              <p className="mt-2 text-body text-text-secondary">
                Please wait while we verify your invitation.
              </p>
            </div>
          </div>
        </main>
      }
    >
      <InviteContent />
    </Suspense>
  );
}
