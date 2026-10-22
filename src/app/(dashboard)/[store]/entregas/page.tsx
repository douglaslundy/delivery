import { Suspense } from "react";
import EntregasPageClient from "./client";

export default function EntregasPage() {
  return (
    <Suspense fallback={null}>
      <EntregasPageClient />
    </Suspense>
  );
}
