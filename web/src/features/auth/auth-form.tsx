"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

const initialState: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-5">
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Email
        <input
          required
          autoComplete="email"
          className="form-input"
          name="email"
          type="email"
          maxLength={254}
        />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        Password
        <input
          required
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="form-input"
          name="password"
          type="password"
          minLength={10}
          maxLength={128}
        />
        {isSignup && (
          <span className="block text-xs font-normal text-slate-500">At least 10 characters.</span>
        )}
      </label>
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="form-notice" role="status">
          {state.notice}
        </p>
      )}
      <button className="button-primary w-full" disabled={pending} type="submit">
        {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {isSignup ? "Already have an account?" : "New to Jarvis?"}{" "}
        <Link
          className="font-semibold text-indigo-700 hover:text-indigo-900"
          href={isSignup ? "/login" : "/signup"}
        >
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
