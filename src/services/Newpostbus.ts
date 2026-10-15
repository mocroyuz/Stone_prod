// src/services/newPostBus.ts
//
// Pont entre la sidebar et NewPostModal.
// La sidebar appelle `requestNewPost(channelKey)`. La page qui possède l'état
// `isOpen` du modal écoute avec `useNewPostRequest` et ouvre le modal ;
// NewPostModal lit ensuite la demande en attente et présélectionne le bon canal.
//
// Si personne n'écoute (on est sur une page qui ne contient pas le modal),
// la demande reste en attente quelques secondes : la sidebar navigue vers
// « schedule », la page se monte, lit la demande et ouvre le modal.

import { useEffect, useRef } from "react";

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
 * @returns `true` si quelqu'un écoute déjà (la page courante gère l'ouverture),
 *          `false` sinon (l'appelant doit alors naviguer vers la page qui contient le modal).
 */
export function requestNewPost(channelKey: string): boolean {
  pending = { channelKey, at: Date.now() };
  const handledBy = subscribers;
  listeners.forEach((listener) => listener());
  return handledBy > 0;
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

/** Abonnement bas niveau. Retourne la fonction de désabonnement. */
export function subscribeNewPostRequests(listener: () => void): () => void {
  listeners.add(listener);
  subscribers += 1;

  return () => {
    listeners.delete(listener);
    subscribers -= 1;
  };
}

/**
 * À utiliser dans la page qui possède l'état `isOpen` du modal :
 *
 *   const [newPostOpen, setNewPostOpen] = useState(false);
 *   useNewPostRequest(() => setNewPostOpen(true));
 *
 * Le callback est appelé à chaque clic sur le « + » d'un canal dans la sidebar,
 * y compris si la demande est arrivée juste avant le montage de la page.
 */
export function useNewPostRequest(onRequest: () => void): void {
  const ref = useRef(onRequest);
  ref.current = onRequest;

  useEffect(() => {
    const handle = () => {
      if (peekNewPostRequest()) ref.current();
    };

    const unsubscribe = subscribeNewPostRequests(handle);
    handle(); // demande arrivée avant le montage
    return unsubscribe;
  }, []);
}