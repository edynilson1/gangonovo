/**
 * Links das redes sociais da XP Arena.
 * Deixa a string vazia enquanto o link ainda não existir — a secção "Siga-nos"
 * mostra o campo como "por configurar" em vez de inventar um endereço.
 */
export type SocialLink = { id: string; label: string; emoji: string; url: string };

export const SOCIAL_LINKS: SocialLink[] = [
  { id: "instagram", label: "Instagram", emoji: "📸", url: "" },
  { id: "facebook", label: "Facebook", emoji: "👍", url: "" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", url: "" },
  { id: "youtube", label: "YouTube", emoji: "▶️", url: "" },
  { id: "whatsapp", label: "WhatsApp", emoji: "💬", url: "" },
];
