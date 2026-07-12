// Single translation hook for the whole app. Call without a namespace and use
// full keys: const t = useT(); t("Auth.signIn"). Works in Server & Client
// Components. Keys are type-safe via src/global.ts.
export { useTranslations as useT } from "next-intl";
