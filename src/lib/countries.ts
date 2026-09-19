export type Country = { code: string; name: string; flag: string };

/** Lista curta e prática (lusofonia + países com mais jogadores). */
export const COUNTRIES: Country[] = [
  { code: "MZ", name: "Moçambique", flag: "🇲🇿" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "BR", name: "Brasil", flag: "🇧🇷" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "CV", name: "Cabo Verde", flag: "🇨🇻" },
  { code: "GW", name: "Guiné-Bissau", flag: "🇬🇼" },
  { code: "ST", name: "São Tomé e Príncipe", flag: "🇸🇹" },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "ZA", name: "África do Sul", flag: "🇿🇦" },
  { code: "ZW", name: "Zimbabué", flag: "🇿🇼" },
  { code: "TZ", name: "Tanzânia", flag: "🇹🇿" },
  { code: "MW", name: "Maláui", flag: "🇲🇼" },
  { code: "ZM", name: "Zâmbia", flag: "🇿🇲" },
  { code: "KE", name: "Quénia", flag: "🇰🇪" },
  { code: "NG", name: "Nigéria", flag: "🇳🇬" },
  { code: "GH", name: "Gana", flag: "🇬🇭" },
  { code: "ES", name: "Espanha", flag: "🇪🇸" },
  { code: "FR", name: "França", flag: "🇫🇷" },
  { code: "DE", name: "Alemanha", flag: "🇩🇪" },
  { code: "GB", name: "Reino Unido", flag: "🇬🇧" },
  { code: "US", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "CA", name: "Canadá", flag: "🇨🇦" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "IN", name: "Índia", flag: "🇮🇳" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "JP", name: "Japão", flag: "🇯🇵" },
];

export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function countryFlag(code: string | null | undefined): string {
  if (!code) return "🏳️";
  return BY_CODE.get(code)?.flag ?? "🏳️";
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "País não definido";
  return BY_CODE.get(code)?.name ?? code;
}
