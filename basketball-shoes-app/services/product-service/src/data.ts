export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  description: string;
  image: string;
  category: string;
  sizes: number[];
  colors: string[];
  inStock: boolean;
}

export const products: Product[] = [
  {
    id: '1',
    name: 'Air Velocity Pro',
    brand: 'SkyBound',
    price: 189.99,
    description: 'High-performance basketball shoes with responsive cushioning and exceptional court grip. Perfect for quick cuts and explosive movements.',
    image: '/images/shoe-1.png',
    category: 'basketball',
    sizes: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12],
    colors: ['Black', 'White', 'Red'],
    inStock: true,
  },
  {
    id: '2',
    name: 'Court Master Elite',
    brand: 'ProHoops',
    price: 159.99,
    description: 'Lightweight design with superior ankle support. Engineered for professional-level play with maximum breathability.',
    image: '/images/shoe-2.png',
    category: 'basketball',
    sizes: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 12],
    colors: ['Blue', 'Black', 'Silver'],
    inStock: true,
  },
  {
    id: '3',
    name: 'Slam Dunk X200',
    brand: 'JumpMax',
    price: 219.99,
    description: 'Premium shoes featuring advanced carbon fiber plate technology for maximum energy return. The choice of champions.',
    image: '/images/shoe-3.png',
    category: 'basketball',
    sizes: [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13],
    colors: ['Gold', 'Black', 'White'],
    inStock: true,
  },
  {
    id: '4',
    name: 'Rebound Force',
    brand: 'SkyBound',
    price: 139.99,
    description: 'Affordable performance with excellent traction pattern. Great for both indoor and outdoor courts.',
    image: '/images/shoe-4.png',
    category: 'basketball',
    sizes: [7, 8, 9, 10, 11, 12],
    colors: ['Red', 'White', 'Navy'],
    inStock: true,
  },
  {
    id: '5',
    name: 'Dribble King Pro',
    brand: 'ProHoops',
    price: 179.99,
    description: 'Designed for point guards with low-profile cushioning and exceptional ball control feel. Ultra-responsive and flexible.',
    image: '/images/shoe-5.png',
    category: 'basketball',
    sizes: [7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11],
    colors: ['Purple', 'Black', 'Orange'],
    inStock: true,
  },
  {
    id: '6',
    name: 'Vertical Boost Max',
    brand: 'JumpMax',
    price: 249.99,
    description: 'Revolutionary jump-enhancing technology with aerospace-grade materials. Increases vertical leap performance.',
    image: '/images/shoe-6.png',
    category: 'basketball',
    sizes: [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12],
    colors: ['Neon Green', 'Black', 'White'],
    inStock: true,
  },
  {
    id: '7',
    name: 'Crossover Classic',
    brand: 'StreetBall',
    price: 129.99,
    description: 'Street-style basketball shoe with durable outsole. Perfect for outdoor play with vintage aesthetics.',
    image: '/images/shoe-7.png',
    category: 'basketball',
    sizes: [7, 8, 9, 10, 11, 12, 13],
    colors: ['Black', 'White', 'Red'],
    inStock: true,
  },
  {
    id: '8',
    name: 'Fast Break Runner',
    brand: 'SkyBound',
    price: 169.99,
    description: 'Lightweight speed-focused design for fast-paced gameplay. Minimal weight with maximum protection.',
    image: '/images/shoe-8.png',
    category: 'basketball',
    sizes: [7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5],
    colors: ['Blue', 'Yellow', 'Black'],
    inStock: true,
  },
];
