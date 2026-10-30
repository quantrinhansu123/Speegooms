export const OPEN_CONTRACT_EVENT = "speego:open-contract";

export type OpenContractDetail = { id: string; lane: "vn" | "global" | null; refType?: string };

export function clearOpenContractParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("id") && !url.searchParams.has("lane")) return;
  url.searchParams.delete("id");
  url.searchParams.delete("lane");
  const query = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", query ? `${url.pathname}?${query}` : url.pathname);
}

export function readOpenContractFromUrl(): OpenContractDetail | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) return null;
  const lane = params.get("lane");
  return { id, lane: lane === "vn" || lane === "global" ? lane : null };
}
