import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { QuoteTrackingPage } from "@/features/crm/live/quote-tracking";
import { WithParams } from "@/components/shared/with-params";

export const metadata: Metadata = { title: "Theo dõi báo giá" };
export const instant = false;

export default function TrackingPage({ params }: { params: Promise<{ lane: string; id: string }> }) {
  return <WithParams params={params}>{({ lane, id }) => {
    if (lane !== "vn" && lane !== "global") notFound();
    return <QuoteTrackingPage key={`${lane}-${id}`} potentialId={id} lane={lane} />;
  }}</WithParams>;
}
