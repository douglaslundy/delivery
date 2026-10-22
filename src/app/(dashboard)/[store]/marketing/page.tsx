import { Suspense } from "react";
import MarketingPageClient from "./client";

export default function MarketingPage() {
  return (
    <Suspense fallback={null}>
      <MarketingPageClient />
    </Suspense>
  );
}
