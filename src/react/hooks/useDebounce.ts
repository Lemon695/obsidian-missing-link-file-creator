import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState<T>(value);
	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}
