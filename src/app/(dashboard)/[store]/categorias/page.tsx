import { Suspense } from "react";
import CategoriasClient from "./client";

export default function CategoriasPage() {
  return (
    <Suspense fallback={null}>
      <CategoriasClient />
    </Suspense>
  );
}
