import { Suspense } from "react";
import MesasClient from "./client";

export default function MesasPage() {
  return (
    <Suspense fallback={null}>
      <MesasClient />
    </Suspense>
  );
}
