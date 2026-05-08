import { Suspense } from "react";
import CallsClient from "./CallsClient";

export default function CallsPage() {
  return (
    <Suspense fallback={null}>
      <CallsClient />
    </Suspense>
  );
}
