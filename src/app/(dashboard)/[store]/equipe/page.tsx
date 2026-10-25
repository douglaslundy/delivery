import { Suspense } from "react";
import EquipeClient from "./client";

export default function EquipePage() {
  return (
    <Suspense fallback={null}>
      <EquipeClient />
    </Suspense>
  );
}
