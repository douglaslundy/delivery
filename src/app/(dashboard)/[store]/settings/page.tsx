import { Suspense } from "react";
import SettingsPageClient from "./client";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageClient />
    </Suspense>
  );
}
