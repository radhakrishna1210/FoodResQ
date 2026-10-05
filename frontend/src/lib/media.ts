/** Food-rescue photography (Unsplash licence, self-hosted in /public/images). */
export interface Slide {
  src: string;
  alt: string;
  /** Short headline shown over the slider. */
  title: string;
  /** One-line supporting caption. */
  caption: string;
  /** CSS object-position, to keep the subject in frame when cropped. */
  position?: string;
}

export const SLIDES: Slide[] = [
  {
    src: '/images/packing-food.jpg',
    alt: 'Volunteers in gloves packing meals into bags at a donation table',
    title: 'Surplus meals, packed in minutes',
    caption: 'Volunteers turn leftover food into ready-to-collect meal packs.',
    position: '50% 40%',
  },
  {
    src: '/images/truck-produce.jpg',
    alt: 'Volunteers loading crates of fresh strawberries onto a truck',
    title: 'Fresh produce, saved from the bin',
    caption: 'Farm and market surplus finds a Receiver before it spoils.',
    position: '50% 50%',
  },
  {
    src: '/images/handing-plate.jpg',
    alt: 'A smiling woman handing a plate of food to another woman',
    title: 'Every handover is a human moment',
    caption: 'A 4-digit code confirms each rescue, so impact is measured.',
    position: '50% 35%',
  },
  {
    src: '/images/sorting-donations.jpg',
    alt: 'Volunteers sorting canned food donations',
    title: 'Verified NGOs and shelters',
    caption: 'Only checked Receivers get offers, ranked by the best fit.',
    position: '50% 45%',
  },
  {
    src: '/images/kitchen-team.jpg',
    alt: 'A kitchen team in aprons and gloves preparing meals',
    title: 'Kitchens that give back',
    caption: 'Restaurants, hostels and caterers post surplus in one short form.',
    position: '50% 45%',
  },
];

export const IMG = {
  cookedMeal: '/images/cooked-meal.jpg',
  vegMarket: '/images/veg-market.jpg',
  packingBags: '/images/packing-bags.jpg',
  handingPlate: '/images/handing-plate.jpg',
  kitchenTeam: '/images/kitchen-team.jpg',
  truckProduce: '/images/truck-produce.jpg',
  sorting: '/images/sorting-donations.jpg',
  packingFood: '/images/packing-food.jpg',
} as const;
