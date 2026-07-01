/**
 * Naruto RPG System - Shared Utilities
 * @author Kirlian Silvestre
 */

/**
 * Check if the current user can interact with a chat message's buttons
 * Returns true if user is GM or the message author
 * @param {ChatMessage} message - The chat message to check
 * @returns {boolean}
 */
export function canInteractWithChatMessage(message) {
  if (game.user.isGM) return true;
  return message.author?.id === game.user.id;
}

/**
 * Find a world item by its sourceId
 * @param {string} sourceId - The sourceId to search for
 * @param {string|string[]} types - Optional item type(s) to filter by
 * @returns {Item|null}
 */
export function findWorldItemBySourceId(sourceId, types = null) {
  if (!sourceId) return null;
  
  const typeArray = types ? (Array.isArray(types) ? types : [types]) : null;
  
  return game.items.find((item) => {
    const matchesSourceId = item.system.sourceId === sourceId;
    const matchesType = !typeArray || typeArray.includes(item.type);
    return matchesSourceId && matchesType;
  }) || null;
}

/**
 * Get the Foundry item ID from a sourceId
 * @param {string} sourceId - The sourceId to search for
 * @param {string|string[]} types - Optional item type(s) to filter by
 * @returns {string|null}
 */
export function getWorldItemId(sourceId, types = null) {
  const item = findWorldItemBySourceId(sourceId, types);
  return item?.id || null;
}

/**
 * Create Active Effects from library data format
 * @param {Item} item - The item to add effects to
 * @param {Array} effects - Array of effect data from library format
 * @returns {Promise<void>}
 */
export async function createActiveEffectsFromData(item, effects) {
  if (!effects || !Array.isArray(effects) || effects.length === 0) return;
  
  const activeEffects = effects.map((effect) => ({
    name: effect.type || "Effect",
    icon: "icons/svg/aura.svg",
    origin: item.uuid,
    changes: [
      {
        key: `system.${effect.type}`,
        mode: CONST.ACTIVE_EFFECT_MODES.ADD,
        value: JSON.stringify({ targets: effect.targets, value: effect.value }),
      },
    ],
  }));
  
  await item.createEmbeddedDocuments("ActiveEffect", activeEffects);
}

/**
 * Calculate modifier value based on maneuver rules
 * @param {string} modifierStr - The modifier string (e.g., "+2", "-1", "None")
 * @param {number} baseStat - The base stat value
 * @returns {string}
 */
export function calculateModifier(modifierStr, baseStat) {
  if (!modifierStr || modifierStr === "") return "—";
  
  if (modifierStr.startsWith("+") || modifierStr.startsWith("-")) {
    const modValue = parseInt(modifierStr);
    if (!isNaN(modValue)) {
      return String(baseStat + modValue);
    }
  }
  
  const lowerMod = modifierStr.toLowerCase().trim();
  if (lowerMod === "nenhum" || lowerMod === "none") return "—";
  if (lowerMod === "um" || lowerMod === "one") return "1";
  if (lowerMod === "dois" || lowerMod === "two") return "2";
  
  const value = parseInt(modifierStr);
  if (!isNaN(value)) return String(value);
  
  return "*";
}

/**
 * Format original modifier for display in parentheses
 * @param {string} modifierStr - The original modifier string
 * @returns {string} Formatted string for display
 */
export function formatOriginalModifier(modifierStr) {
  if (!modifierStr || modifierStr === "") return "—";
  
  if (modifierStr.startsWith("+") || modifierStr.startsWith("-")) {
    return modifierStr;
  }
  
  const lowerMod = modifierStr.toLowerCase().trim();
  if (lowerMod === "nenhum" || lowerMod === "none") return "—";
  if (lowerMod === "um" || lowerMod === "one") return "1";
  if (lowerMod === "dois" || lowerMod === "two") return "2";
  
  const value = parseInt(modifierStr);
  if (!isNaN(value)) return modifierStr;
  
  return "*";
}

/**
 * Create an import button element for directory headers
 * @param {string} className - CSS class for the button
 * @param {string} labelKey - i18n key for the button label
 * @param {string} iconClass - FontAwesome icon class
 * @param {Function} onClick - Click handler
 * @returns {HTMLButtonElement}
 */
export function createImportButton(className, labelKey, iconClass, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.innerHTML = `<i class="${iconClass}"></i> ${game.i18n.localize(labelKey)}`;
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Generate a sourceId from a name
 * Converts to lowercase, removes accents, replaces spaces with underscores
 * @param {string} name - The item name
 * @param {string} suffix - Suffix to append (default: "foundry")
 * @returns {string} - The generated sourceId
 */
export function generateSourceId(name, suffix = "foundry") {
  const baseId = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return `${baseId}_${suffix}`;
}

/**
 * Get all non-optional traits from world items
 * @returns {Item[]} Array of world items that are non-optional traits
 */
export function getNonOptionalTraits() {
  const traitTypes = ["attribute", "ability", "technique", "background"];
  
  return game.items.filter((item) => {
    if (!traitTypes.includes(item.type)) return false;
    return item.system.isOptional === false;
  });
}

/**
 * Add non-optional traits to an actor that don't already exist
 * @param {Actor} actor - The actor to add traits to
 * @param {Set<string>} existingSourceIds - Set of sourceIds already on the actor
 * @returns {Promise<Item[]>} Array of created embedded items
 */
export async function addNonOptionalTraitsToActor(actor, existingSourceIds = new Set()) {
  const nonOptionalTraits = getNonOptionalTraits();
  const itemsToCreate = [];

  for (const trait of nonOptionalTraits) {
    const sourceId = trait.system.sourceId;
    
    if (existingSourceIds.has(sourceId)) continue;
    
    const traitData = trait.toObject();
    traitData.system.value = trait.type === "attribute" ? 1 : 0;
    itemsToCreate.push(traitData);
  }

  if (itemsToCreate.length > 0) {
    console.log(`Naruto RPG | Adding ${itemsToCreate.length} non-optional traits to ${actor.name}`);
    return await actor.createEmbeddedDocuments("Item", itemsToCreate);
  }

  return [];
}
