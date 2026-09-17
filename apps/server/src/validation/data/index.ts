import animal from './animal.json' with { type: 'json' };
import car from './car.json' with { type: 'json' };
import city from './city.json' with { type: 'json' };
import color from './color.json' with { type: 'json' };
import country from './country.json' with { type: 'json' };
import family from './family.json' with { type: 'json' };
import flower from './flower.json' with { type: 'json' };
import food from './food.json' with { type: 'json' };
import fruit from './fruit.json' with { type: 'json' };
import job from './job.json' with { type: 'json' };
import name from './name.json' with { type: 'json' };
import object from './object.json' with { type: 'json' };

/** Raw word lists keyed by category id; see packages/shared categories.ts. */
export const WORD_LISTS: Record<string, readonly string[]> = {
  animal,
  car,
  city,
  color,
  country,
  family,
  flower,
  food,
  fruit,
  job,
  name,
  object,
};
