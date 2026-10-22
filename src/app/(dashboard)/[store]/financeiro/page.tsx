import { Suspense } from "react";
import FinanceiroPageClient from "./client";

export default function FinanceiroPage() {
  return (
    <Suspense fallback={null}>
      <FinanceiroPageClient />
    </Suspense>
  );
}
