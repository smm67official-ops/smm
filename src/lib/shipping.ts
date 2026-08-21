/** Livraison offerte au-delà de 200 $, 15 $ sinon (voir bandeau « Free Shipping »). */
export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_FLAT_RATE = 15;

export const shippingFor = (subtotal: number) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT_RATE;
