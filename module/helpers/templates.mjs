/**
 * Naruto RPG Handlebars Templates
 * @author Kirlian Silvestre
 */

/**
 * Preload Handlebars templates for the system
 * @returns {Promise<Handlebars.TemplateDelegate[]>}
 */
export async function preloadHandlebarsTemplates() {
  const templatePaths = [
    "systems/naruto-rpg/templates/actor/actor-fighter-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-fightingStyle-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-clan-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-specialManeuver-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-attribute-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-ability-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-technique-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-background-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-weapon-sheet.hbs",
    "systems/naruto-rpg/templates/item/item-division-sheet.hbs",
    "systems/naruto-rpg/templates/chat/item-card.hbs",
    "systems/naruto-rpg/templates/chat/roll-card.hbs",
    "systems/naruto-rpg/templates/chat/roll-result.hbs",
    "systems/naruto-rpg/templates/chat/trait-chat-card.hbs",
    "systems/naruto-rpg/templates/chat/maneuver-chat-card.hbs",
    "systems/naruto-rpg/templates/chat/maneuver-reveal-card.hbs",
    "systems/naruto-rpg/templates/dialog/roll-dialog.hbs",
    "systems/naruto-rpg/templates/effects/effect-config.hbs",
    "systems/naruto-rpg/templates/effects/effect-changes-tab.hbs",
    "systems/naruto-rpg/templates/item/partials/item-effects-tab.hbs",
    "systems/naruto-rpg/templates/combat/combat-tracker.hbs",
    "systems/naruto-rpg/templates/combat/maneuver-selection-dialog.hbs",
    "systems/naruto-rpg/templates/combat/action-turn-dialog.hbs",
  ];

  return foundry.applications.handlebars.loadTemplates(templatePaths);
}
