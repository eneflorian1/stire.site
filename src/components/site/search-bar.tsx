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
      className={`flex items-center gap-2 transition-all ${isMinimal
        ? 'rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm hover:shadow-md focus-within:border-blue-400 focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-100'
        : 'rounded-3xl border border-slate-200 bg-white p-2 shadow-sm hover:shadow-md focus-within:border-blue-400 focus-within:shadow-lg'
        } ${className}`}
    >
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full text-sm text-slate-700 outline-none ${isMinimal
          ? 'bg-transparent px-2 py-0.5 placeholder:text-slate-400'
          : 'rounded-2xl border border-transparent bg-slate-50 px-4 py-2 transition-all focus:border-slate-200 focus:bg-white focus:shadow-sm'
          }`}
      />
      <button
        type="submit"
        className={`flex shrink-0 items-center justify-center transition-all ${isMinimal
          ? 'h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 active:scale-95'
          : 'h-10 w-10 rounded-2xl bg-gradient-to-br from-[#5678ff] to-[#4a63d9] text-white shadow-md hover:shadow-lg hover:from-[#4a63d9] hover:to-[#3d52b8] active:scale-95'
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
