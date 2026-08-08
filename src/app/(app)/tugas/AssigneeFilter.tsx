"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SearchableSelect } from "@/components/SearchableSelect";

// Filter "per orang" berdiri sendiri -- dipakai halaman Action Item Rapat,
// yang tidak punya konsep status/level/tipe seperti Daftar Tugas, jadi tidak
// bisa memakai TaskFilters (nanti muncul dropdown yang tak berfungsi).
export function AssigneeFilter({ people }: { people: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setAssignee = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("assignee", value);
    else next.delete("assignee");
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <SearchableSelect
      key={params.get("assignee") ?? "all"}
      options={people.map((p) => ({ value: p.id, label: p.name }))}
      defaultValue={params.get("assignee") ?? ""}
      emptyLabel="Semua Orang"
      className="w-40"
      onValueChange={setAssignee}
    />
  );
}
