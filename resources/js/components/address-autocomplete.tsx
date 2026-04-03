import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapPinIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface AddressParts {
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
}

interface Suggestion {
    placeId: string;
    description: string;
}

interface Props {
    value: string;
    onChange: (value: string) => void;
    onSelect: (parts: AddressParts) => void;
    className?: string;
    placeholder?: string;
    id?: string;
}

async function fetchSuggestions(input: string): Promise<Suggestion[]> {
    const res = await fetch(`/work-with-us/address-suggestions?input=${encodeURIComponent(input)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions || [];
}

async function fetchPlaceDetails(placeId: string): Promise<AddressParts | null> {
    const res = await fetch(`/work-with-us/place-details/${encodeURIComponent(placeId)}`);
    if (!res.ok) return null;
    return await res.json();
}

export default function AddressAutocomplete({ value, onChange, onSelect, className, placeholder = 'Start typing your address...', id }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const skipFetchRef = useRef(false);

    // Fetch suggestions when value changes
    useEffect(() => {
        if (!value || value.length < 3 || skipFetchRef.current) {
            if (skipFetchRef.current) skipFetchRef.current = false;
            if (!value || value.length < 3) setSuggestions([]);
            return;
        }

        const timer = setTimeout(() => {
            fetchSuggestions(value).then((results) => {
                setSuggestions(results);
                setShowDropdown(results.length > 0);
                setActiveIndex(-1);
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [value]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const selectPlace = useCallback(
        async (placeId: string) => {
            const parts = await fetchPlaceDetails(placeId);
            if (parts) {
                skipFetchRef.current = true;
                onChange(parts.address);
                onSelect(parts);
                setShowDropdown(false);
                setSuggestions([]);
            }
        },
        [onChange, onSelect],
    );

    function handleKeyDown(e: React.KeyboardEvent) {
        if (!showDropdown || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            selectPlace(suggestions[activeIndex].placeId);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    }

    return (
        <div className="relative">
            <div className="relative">
                <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <Input
                    ref={inputRef}
                    id={id}
                    type="text"
                    autoComplete="off"
                    className={cn('pl-9', className)}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {showDropdown && suggestions.length > 0 && (
                <div ref={dropdownRef} className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
                    {suggestions.map((s, i) => (
                        <button
                            key={s.placeId}
                            type="button"
                            className={cn(
                                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                                i === activeIndex ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50',
                            )}
                            onMouseDown={() => selectPlace(s.placeId)}
                            onMouseEnter={() => setActiveIndex(i)}
                        >
                            <MapPinIcon className="size-3.5 shrink-0 text-gray-400" />
                            {s.description}
                        </button>
                    ))}
                    <div className="border-t border-gray-100 px-3 py-1.5">
                        <span className="text-xs text-gray-400">Powered by Google</span>
                    </div>
                </div>
            )}
        </div>
    );
}
