/**
 * Naruto RPG System - Constants
 * @author Kirlian Silvestre
 */

/**
 * Maximum values for different trait types
 */
export const TRAIT_MAX_VALUES = {
  attribute: 8,
  ability: 8,
  technique: 8,
  background: 6,
  default: 10,
};

/**
 * Minimum values for different trait types
 */
export const TRAIT_MIN_VALUES = {
  attribute: 1,
  ability: 0,
  technique: 0,
  background: 0,
  default: 0,
};

/**
 * Difficulty constraints for rolls
 */
export const DIFFICULTY = {
  min: 2,
  max: 10,
  default: 6,
};

/**
 * Combat calculation formulas
 * Note: health, chi, willpower max values come from the character data (imported or manual)
 */
export const COMBAT_FORMULAS = {
  initiative: (wits, dexterity) => wits + dexterity,
  soak: (stamina) => stamina,
};

/**
 * Get the maximum value for a trait type
 * @param {string} itemType - The type of item
 * @returns {number} Maximum value
 */
export function getTraitMaxValue(itemType) {
  return TRAIT_MAX_VALUES[itemType] ?? TRAIT_MAX_VALUES.default;
}

/**
 * Get the minimum value for a trait type
 * @param {string} itemType - The type of item
 * @returns {number} Minimum value
 */
export function getTraitMinValue(itemType) {
  return TRAIT_MIN_VALUES[itemType] ?? TRAIT_MIN_VALUES.default;
}

/**
 * Clamp difficulty to valid range
 * @param {number} value - The difficulty value
 * @returns {number} Clamped difficulty
 */
export function clampDifficulty(value) {
  return Math.max(DIFFICULTY.min, Math.min(DIFFICULTY.max, value));
}
