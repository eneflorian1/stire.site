'use client';

import { useState, useEffect } from 'react';

type Props = {
    onSelectionChange?: (selectedIds: string[]) => void;
};

const TopicSelector = ({ onSelectionChange }: Props) => {
    const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/categories');
                if (res.ok) {
                    const data = await res.json();
                    // Ensure data is an array
                    setCategories(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('Error fetching categories:', error);
                setCategories([]); // Set empty array on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchCategories();
    }, []);

    const handleToggle = (slug: string) => {
        const newSelected = selectedCategories.includes(slug)
            ? selectedCategories.filter(s => s !== slug)
            : [...selectedCategories, slug];

        setSelectedCategories(newSelected);
        onSelectionChange?.(newSelected);
    };

    if (isLoading) {
        return (
            <div className="rounded-xl md:rounded-2xl border border-slate-200 bg-white p-3 md:p-6 shadow-sm">
                <div className="text-sm text-slate-500">Se încarcă categoriile...</div>
            </div>
        );
    }

    return (
        <div className="rounded-xl md:rounded-2xl border border-slate-200 bg-white p-3 md:p-6 shadow-sm">
            <div className="flex flex-wrap gap-1.5 md:gap-2">
                {categories.map((category) => {
                    const isSelected = selectedCategories.includes(category.slug);

                    return (
                        <button
                            key={category.slug}
                            type="button"
                            onClick={() => handleToggle(category.slug)}
                            className={`
                                inline-flex items-center rounded-full px-2.5 py-1 md:px-4 md:py-2 text-xs md:text-sm font-medium
                                transition-all duration-200
                                ${isSelected
                                    ? 'bg-violet-600 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }
                            `}
                        >
                            {category.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default TopicSelector;
