import { Suspense } from "react";
import OnboardingPageClient from "./client";

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageClient />
    </Suspense>
  );
}
