'use client';

import { Search, Menu } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';

type Props = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  className?: string;
  showMenuButton?: boolean;
  variant?: 'default' | 'minimal';
};

const SearchBar = ({
  value,
  placeholder = 'Cauta stiri...',
  onChange,
  onSubmit,
  className = '',
  showMenuButton = false,
  variant = 'default',
}: Props) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const isMinimal = variant === 'minimal';

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex items-center gap-2 ${
        isMinimal
          ? 'rounded-full border border-slate-200 bg-slate-50 px-3 py-1 shadow-none'
          : 'rounded-3xl border border-slate-200 bg-white p-2 shadow-sm'
      } ${className}`}
    >
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full text-sm text-slate-700 outline-none ${
          isMinimal
            ? 'bg-transparent px-2 py-1 placeholder:text-slate-400'
            : 'rounded-2xl border border-transparent bg-slate-50 px-4 py-2 focus:border-slate-200 focus:bg-white'
        }`}
      />
      <button
        type="submit"
        className={`flex items-center justify-center transition ${
          isMinimal
            ? 'h-8 w-8 rounded-full bg-slate-900 text-white hover:bg-slate-800'
            : 'h-10 w-10 rounded-2xl bg-[#5678ff] text-white hover:bg-[#4a63d9]'
        }`}
        aria-label="Cauta"
      >
        <Search className="h-5 w-5" />
      </button>
      {showMenuButton && (
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
          aria-label="Meniu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </form>
  );
};

export default SearchBar;
