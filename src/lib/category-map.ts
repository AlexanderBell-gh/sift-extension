const KEYWORD_MAP: Record<string, string[]> = {
  Chilled: [
    'yogurt', 'yoghurt', 'yogurts', 'milk', 'cheese', 'cream', 'dairy',
    'eggs', 'butter', 'fromage frais', 'quark', 'sour cream',
    'crème fraîche', 'custard', 'dessert', 'deli', 'sandwich',
    'sandwiches', ' wraps', 'pasta salad', 'coleslaw', 'hummus',
    'dips', 'chilled', 'fresh', 'ham', 'meat', 'beef', 'Salmon, tuna & trout', 'pork belly',
    'berry', 'berries', 'blueberries', 'blueberry', 'strawberries',
    'strawberry', 'raspberries', 'raspberry',
  ],
  Snacks: [
    'crisps', 'chips', 'nuts', 'snack', 'snacks', 'bar', 'bars',
    'cereal bar', 'granola bar', 'chocolate', 'confectionery',
    'sweets', 'candy', 'biscuits', 'cookies', 'crackers', 'popcorn',
    'pretzels', 'trail mix', 'jerky', 'scratchings',
    'rice cakes', 'corn snacks',
  ],
  Beverages: [
    'drink', 'drinks', 'juice', 'juices', 'water', 'tea', 'coffees',
    'coffee', 'cola', 'beer', 'beers', 'wine', 'wines', 'spirits',
    'soft drink', 'fizzy', 'lemonade', 'energy drink', 'hot drink',
    'cordial', 'smoothie', 'milkshake', 'beverage', 'tonic',
    'sparkling',
  ],
  Produce: [
    'fruit', 'fruits', 'vegetable', 'vegetables', 'veg', 'salad',
    'lettuce', 'apple', 'banana', 'orange',
    'tomato', 'potato', 'onion', 'carrot', 'pepper', 'mushroom',
    'broccoli', 'spinach', 'kale', 'cucumber', 'avocado', 'citrus',
    'melon', 'grapes',
    'produce', 'fresh produce', 'loose',
  ],
  Frozen: [
    'frozen', 'ice cream', 'ice-cream', 'ice creams', 'gelato',
    'sorbet', 'fries', 'chips', 'pizza', 'ready meal',
    'ready meals', 'vegetable', 'peas', 'sweetcorn',
  ],
  Bakery: [
    'bread', 'bakery', 'cake', 'cakes', 'pastry', 'pastries',
    'doughnut', 'doughnuts', 'muffin', 'muffins', 'bagel', 'bagels',
    'croissant', 'croissants', 'brioche', 'roll', 'rolls', 'bap',
    'naan', 'pitta', 'tortilla', 'wrap', 'wraps', 'sourdough',
    'loaf', 'loaves', 'buns', 'shortcake',
  ],
  'Food Cupboard': [
    'pasta', 'rice', 'noodles', 'tin', 'tins', 'can', 'cans',
    'sauce', 'sauces', 'oil', 'vinegar', 'spice', 'spices',
    'herbs', 'seasoning', 'cereal', 'cereals', 'porridge',
    'muesli', 'granola', 'sugar', 'flour', 'baking', 'beans',
    'lentils', 'chickpeas', 'stock', 'bouillon', 'gravy',
    'condiment', 'condiments', 'jam', 'jelly', 'marmalade',
    'peanut butter', 'honey', 'syrup', 'chutney', 'pickle',
    'relish', 'soup', 'broth', 'stock cube', 'bouillon cube',
    'packet', 'sachet', 'jar', 'bottle', 'oats', 'jumbo oats',
  ],
};

const EXACT_OVERRIDES: Record<string, string> = {
  'Berries & Cherries': 'Chilled',
  'Eggs': 'Chilled',
  'Milk': 'Chilled',
  'Ice cream tubs': 'Frozen',
  'Lettuce': 'Produce',
  'Low Fat & Fat Free Yogurt': 'Chilled',
  'Natural, organic & greek yogurt': 'Chilled',
  'Doughnuts and cookies': 'Bakery',
};

const STOP_WORDS = new Set(['and', '&', 'the', 'with', 'in', 'of', 'for']);

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

export function normalizeCategory(raw: string): string {
  const trimmed = raw.replace(/^Back to\s+/i, '').trim();
  const exactKey = Object.keys(EXACT_OVERRIDES).find(
    k => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactKey) return EXACT_OVERRIDES[exactKey];

  const tokens = tokenize(trimmed);

  if (tokens.includes('frozen')) return 'Frozen';

  let bestCategory = 'Other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const token of tokens) {
      if (keywords.some(kw => token.includes(kw) || kw.includes(token))) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}
