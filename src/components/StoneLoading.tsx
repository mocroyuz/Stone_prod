/**
 * Écran d'attente affiché pendant la vérification de la session.
 *
 * Il reproduit exactement l'état « vide » de StoneBoot (même fond, même
 * taille et même position du logo, même opacité) : quand l'animation de
 * remplissage démarre, le logo ne bouge pas et se remplit simplement de blanc.
 */
export default function StoneLoading() {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-label="Chargement de Stone"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-[#050505]"
    >
      <div className="flex items-center justify-center">
        <img
          src="/images/icon_nav.png"
          alt=""
          draggable={false}
          className="h-52 w-auto select-none object-contain opacity-[0.12] sm:h-72 md:h-80"
        />
      </div>
    </main>
  );
}
