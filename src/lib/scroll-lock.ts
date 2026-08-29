/**
 * Blocage du défilement de l'arrière-plan.
 *
 * Une CLASSE, et non un style en ligne. Le thème impose
 * `body { overflow: hidden !important }`, que l'on neutralise dans
 * `responsive.css` — également en `!important`, faute de quoi la barre
 * latérale de l'administration ne tient pas. Or une déclaration
 * `!important` d'une feuille de style l'emporte sur un style en ligne
 * SANS `!important` : `document.body.style.overflow = 'hidden'` ne
 * bloquait plus rien.
 *
 * `body.sv-scroll-locked` est plus spécifique que `body`, donc gagne à
 * armes égales.
 *
 * Un COMPTEUR accompagne la classe : deux surfaces superposées — une
 * boîte de dialogue ouverte depuis un tiroir — se fermeraient l'une
 * après l'autre, et la première à partir rendrait le défilement alors
 * que la seconde est encore là.
 */
const CLASS = 'sv-scroll-locked';
let locks = 0;

export function lockScroll(): void {
  locks += 1;
  document.body.classList.add(CLASS);
}

export function unlockScroll(): void {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.body.classList.remove(CLASS);
}
