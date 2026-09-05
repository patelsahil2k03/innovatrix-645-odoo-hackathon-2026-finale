"use client";

/**
 * Shared search box.
 *
 * ONE component for every search field in the app. The previous build repeated this
 * markup on six pages, which meant six chances to forget the accessible label.
 *
 * Pair with `useDebouncedValue` — this component intentionally does NOT debounce
 * internally, so the input stays responsive while the *fetch* is debounced:
 *
 *   const [search, setSearch] = useState("");
 *   const debounced = useDebouncedValue(search, 300);
 *   <SearchInput value={search} onChange={setSearch} label="Search orders" />
 */

import { SearchIcon } from "@/components/icons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name. A placeholder is NOT a label. */
  label: string;
  placeholder?: string;
}

export function SearchInput({ value, onChange, label, placeholder }: SearchInputProps) {
  return (
    <div className="search-field">
      <SearchIcon />
      <input
        type="search"
        className="input"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
