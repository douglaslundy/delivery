import { Suspense } from "react";
import KdsBoard from "./kds-board";

export default function KdsPage() {
  return (
    <Suspense fallback={<p>Carregando...</p>}>
      <KdsBoard />
    </Suspense>
  );
}
