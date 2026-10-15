// src/services/newPostBus.ts
//
// Pont entre la sidebar et NewPostModal.
// La sidebar appelle `requestNewPost(channelKey)` ; le modal (monté quelque
// part dans l'app) s'abonne, s'ouvre et présélectionne le bon canal.
//
// Si aucun modal n'est monté (ex. on est sur une page qui ne le contient pas),
// la demande reste en attente quelques secondes : la sidebar navigue vers la
// page « schedule », le modal se monte, lit la demande et s'ouvre.

export type NewPostRequest = {
  channelKey: string;
  at: number;
};

/** Une demande plus vieille que ça est considérée comme périmée. */
const MAX_AGE_MS = 10_000;

let pending: NewPostRequest | null = null;
let subscribers = 0;
const listeners = new Set<() => void>();

/**
 * Demande l'ouverture d'un nouveau post pour un canal.
 * @returns `true` si un modal est déjà monté et va traiter la demande,
 *          `false` sinon (l'appelant doit alors naviguer vers la page qui le contient).
 */
export function requestNewPost(channelKey: string): boolean {
  pending = { channelKey, at: Date.now() };
  listeners.forEach((listener) => listener());
  return subscribers > 0;
}

/** Lit la demande en attente (sans la consommer). */
export function peekNewPostRequest(): NewPostRequest | null {
  if (pending && Date.now() - pending.at > MAX_AGE_MS) pending = null;
  return pending;
}

/** Marque la demande comme traitée. */
export function clearNewPostRequest(): void {
  pending = null;
}

/** Abonnement du modal. Retourne la fonction de désabonnement. */
export function subscribeNewPostRequests(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;

  return () => {
    listeners.delete(listener);
    subscribers -= 1;
  };
}
