import { Suspense } from "react";
import PipelineClient from "./PipelineClient";

export default function PipelinePage() {
  return (
    <Suspense fallback={null}>
      <PipelineClient />
    </Suspense>
  );
}
