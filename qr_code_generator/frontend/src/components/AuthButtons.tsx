"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

type Props = {
  className?: string;
  children: React.ReactNode;
};

export function StyledSignInButton({ className, children }: Props) {
  return (
    <SignInButton mode="modal">
      <button className={className}>{children}</button>
    </SignInButton>
  );
}

export function StyledSignUpButton({ className, children }: Props) {
  return (
    <SignUpButton mode="modal">
      <button className={className}>{children}</button>
    </SignUpButton>
  );
}
