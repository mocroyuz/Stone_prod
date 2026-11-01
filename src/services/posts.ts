import { supabase } from "./supabase";
import type { NewPostPayload, SocialNetworkId } from "../components/Newpostmodal";

export type CalendarPost = {
  id: string;
  network: SocialNetworkId;
  channelKey?: string;
  content: string;
  scheduledAt: string;
  status: "scheduled" | "external" | "published" | "failed" | "draft";
  media: { url: string; kind: "image" | "video" }[];
  tagIds: string[];
};

/** 
 * "bg-[#6366f1]" → "#6366f1". Les classes Tailwind construites à l'exécution
 * ne sont pas générées, donc on passe la couleur en style inline. 
 */
export const tagHex = (color: string): string =>
  color?.match(/#[0-9a-f]{6}/i)?.[0] ?? "#6366f1";

export function isPostPosted(post: CalendarPost, now: Date): boolean {
  return post.status === "published" || new Date(post.scheduledAt).getTime() <= now.getTime();
}

/**
 * Crée les posts en base de données et upload les médias dans le bucket "post-media".
 * Gère aussi les réseaux externes (ex: YouTube déjà programmé via l'API Google).
 */
export async function createPosts(payload: NewPostPayload): Promise<void> {
  // 1. Récupérer l'utilisateur connecté
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error("Utilisateur non authentifié");
9  }
  const userId = user.id;

  // 2. Inclure les réseaux normaux + les réseaux externes (ex: YouTube programmé)
  const nets = [...payload.networks, ...(payload.externalNetworks ?? [])];
  const rows = [];

  for (const network of nets) {
    // Utiliser les médias spécifiques au réseau, ou fallback sur les médias partagés
    const files = payload.mediaByNetwork?.[network] ?? payload.media;

    // 3. Uploader chaque fichier vers Supabase Storage
    const media = await Promise.all(
      files.map(async (f) => {
        // Générer un chemin unique pour éviter les collisions
        const path = `${userId}/${crypto.randomUUID()}-${f.name}`;

        // Upload vers le bucket "post-media"
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, f);

        if (uploadError) {
          console.error("Erreur d'upload Supabase:", uploadError);
          throw new Error(`Échec de l'upload du média : ${uploadError.message}`);
        }

        // Récupérer l'URL publique permanente
        const { data: urlData } = supabase.storage
          .from("post-media")
          .getPublicUrl(path);

        return {
          kind: f.type.startsWith("video/") ? "video" : "image",
          url: urlData.publicUrl,
          path,
        };
      })
    );

    // 4. Construire la ligne pour la table scheduled_posts
    rows.push({
      user_id: userId,
      network,
      channel_key: payload.channelKeys?.[network] ?? null,
      content: payload.contents?.[network] ?? payload.content ?? "",
      media, // Sera automatiquement sérialisé en JSONB par Supabase
      tag_ids: payload.tagIds ?? [],
      scheduled_at: payload.scheduledAt,
      external: payload.externalNetworks?.includes(network) ?? false,
    });
  }

  // 5. Insérer toutes les lignes en base de données
  if (rows.length > 0) {
    const { error: dbError } = await supabase
      .from("scheduled_posts")
      .insert(rows);

    if (dbError) {
      console.error("Erreur d'insertion Supabase:", dbError);
      throw new Error(`Échec de la sauvegarde en base de données : ${dbError.message}`);
    }
  }
}

/**
 * Récupère les posts programmés entre deux dates.
 */
export async function listPosts(from: Date, to: Date): Promise<CalendarPost[]> {
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .gte("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erreur de récupération des posts:", error);
    return [];
  }

  return (data ?? []).map((p: any) => ({
    id: p.id,
    network: p.network,
    channelKey: p.channel_key ?? undefined,
    content: p.content ?? "",
    scheduledAt: p.scheduled_at,
    // Si c'est external, on le marque comme tel, sinon "scheduled" (ou "published" si géré par un webhook plus tard)
    status: p.external ? ("external" as const) : ("scheduled" as const),
    media: Array.isArray(p.media) ? p.media : [],
    tagIds: p.tag_ids ?? [],
  }));
}

/**
 * Supprime un post programmé de la base de données.
 * (Optionnel : vous pourriez aussi vouloir supprimer les fichiers du bucket Storage ici)
 */
export async function deletePost(id: string): Promise<void> {
  // Récupérer d'abord le post pour pouvoir supprimer les fichiers du storage si nécessaire
  const { data: post, error: fetchError } = await supabase
    .from("scheduled_posts")
    .select("media")
    .eq("id", id)
    .single();

  if (fetchError) {
    console.error("Erreur lors de la récupération du post à supprimer:", fetchError);
    throw new Error(`Échec de la suppression : ${fetchError.message}`);
  }

  // Supprimer les fichiers du bucket (nettoyage)
  if (post?.media && Array.isArray(post.media)) {
    const pathsToDelete = post.media.map((m: any) => m.path).filter(Boolean);
    if (pathsToDelete.length > 0) {
      await supabase.storage.from("post-media").remove(pathsToDelete);
    }
  }

  // Supprimer la ligne en base de données
  const { error: deleteError } = await supabase
    .from("scheduled_posts")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error("Erreur de suppression en base:", deleteError);
    throw new Error(`Échec de la suppression en base de données : ${deleteError.message}`);
  }
}