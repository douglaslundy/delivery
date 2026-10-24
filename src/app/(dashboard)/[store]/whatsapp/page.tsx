import { Suspense } from "react";
import WhatsappClient from "./client";

export default function WhatsappPage() {
  return (
    <Suspense fallback={null}>
      <WhatsappClient />
    </Suspense>
  );
}
