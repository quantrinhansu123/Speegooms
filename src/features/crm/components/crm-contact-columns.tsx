import type { CrmContacts } from "@speego/shared";

export const crmContactColumns = [
  { key: "sale", label: "Sale phụ trách" },
  { key: "sourcing", label: "Sourcing phụ trách" },
  { key: "operations", label: "Vận hành phụ trách" },
] as const;

export function CrmContactHeaders() {
  return crmContactColumns.map(({ key, label }) => (
    <th key={key} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">{label}</th>
  ));
}

export function CrmContactCells({ contacts }: { contacts?: CrmContacts }) {
  return crmContactColumns.map(({ key }) => {
    const name = contacts?.[key]?.trim();
    return (
      <td key={key} className="whitespace-nowrap px-3 py-3">
        {name || <span className="text-muted-foreground" aria-label="Chưa có người phụ trách">—</span>}
      </td>
    );
  });
}
