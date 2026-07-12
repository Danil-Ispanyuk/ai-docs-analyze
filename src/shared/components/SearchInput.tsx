import { Input } from "@/shared/ui/input";

interface ISearchInput {
	placeholder: string;
}

export function SearchInput({ placeholder }: ISearchInput) {
	return (
		<Input
			name="Search document"
			className="mx-auto hidden w-full max-w-md sm:block"
			type="search"
			placeholder={placeholder}
		/>
	);
}
