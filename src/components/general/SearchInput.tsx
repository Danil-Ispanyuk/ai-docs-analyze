import { Input } from "@/elements/input";

interface ISearchInput {
	placeholder: string;
}

export function SearchInput({ placeholder }: ISearchInput) {
	return (
		<Input name="Search document" className="max-w-[500]" type="search" placeholder={placeholder} />
	);
}
