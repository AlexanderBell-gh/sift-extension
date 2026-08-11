const KEYWORD_MAP: Record<string, string[]> = {
  Chilled: [
    'yogurt', 'yoghurt', 'yogurts', 'milk', 'cheese', 'cream', 'dairy',
    'eggs', 'butter', 'fromage frais', 'quark', 'sour cream',
    'crème fraîche', 'custard', 'dessert', 'deli', 'sandwich',
    'sandwiches', ' wraps', 'pasta salad', 'coleslaw', 'hummus',
    'dips', 'chilled', 'fresh', 'ham', 'meat', 'beef', 'Salmon, tuna & trout', 'salmon', 'pork belly',
    'berry', 'berries', 'blueberries', 'blueberry', 'strawberries',
    'strawberry', 'raspberries', 'raspberry', 'kiwi',
  ],
  Snacks: [
    'crisps', 'chips', 'nuts', 'snack', 'snacks', 'bar', 'bars',
    'cereal bar', 'granola bar', 'chocolate', 'confectionery',
    'sweets', 'candy', 'biscuits', 'crackers', 'popcorn',
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
    'loaf', 'loaves', 'buns', 'shortcake', 'cookies', 'shortbread (4pk)', 'chocolate cookies x5',
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
    'packet', 'sachet', 'jar', 'bottle', 'oats', 'jumbo oats', 'oreo',
  ],
};

const NON_FOOD_SIGNALS = [
  'wash', 'soap', 'shampoo', 'conditioner', 'lotion', 'moisturis',
  'antibacterial', 'sanitiser', 'deodorant', 'toothpaste', 'cosmetic',
  'skincare', 'beauty', 'perfume', 'fragrance', 'body',
];

const STOP_WORDS = new Set(['and', '&', 'the', 'with', 'in', 'of', 'for']);

function tokenize(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

function tokenizeKeyword(keyword: string): string[] {
  return tokenize(keyword);
}

function keywordMatches(keywordTokens: string[], tokens: string[]): boolean {
  if (keywordTokens.length === 0) return false;
  if (keywordTokens.length === 1) {
    const kw = keywordTokens[0];
    return tokens.some(t => t === kw || (kw.length >= 4 && t.includes(kw)));
  }
  for (let i = 0; i <= tokens.length - keywordTokens.length; i++) {
    let match = true;
    for (let j = 0; j < keywordTokens.length; j++) {
      if (tokens[i + j] !== keywordTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function normalizeCategory(raw: string): string {
  const trimmed = raw.replace(/^Back to\s+/i, '').trim();

  const tokens = tokenize(trimmed);

  if (tokens.some(token => NON_FOOD_SIGNALS.some(s => token.includes(s)))) {
    return 'Other';
  }

  if (tokens.includes('frozen')) return 'Frozen';

  let bestCategory = 'Other';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const keyword of keywords) {
      const keywordTokens = tokenizeKeyword(keyword);
      if (keywordMatches(keywordTokens, tokens)) score += keywordTokens.length >= 2 ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}
