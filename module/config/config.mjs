/**
 * Naruto RPG System Configuration
 * Matches the fslibrary domain structure for import compatibility
 * @author Kirlian Silvestre
 */

export const NARUTO_RPG = {
  actorTypes: {
    fighter: "NARUTO_RPG.Actor.Types.fighter",
  },

  itemTypes: {
    fightingStyle: "NARUTO_RPG.Item.Types.fightingStyle",
    specialManeuver: "NARUTO_RPG.Item.Types.specialManeuver",
    attribute: "NARUTO_RPG.Item.Types.attribute",
    ability: "NARUTO_RPG.Item.Types.ability",
    technique: "NARUTO_RPG.Item.Types.technique",
    background: "NARUTO_RPG.Item.Types.background",
    weapon: "NARUTO_RPG.Item.Types.weapon",
    division: "NARUTO_RPG.Item.Types.division",
    equipment: "NARUTO_RPG.Item.Types.equipment",
  },

  // Attribute categories (physical, social, mental)
  attributeCategories: {
    physical: "NARUTO_RPG.Attributes.Categories.physical",
    social: "NARUTO_RPG.Attributes.Categories.social",
    mental: "NARUTO_RPG.Attributes.Categories.mental",
  },

  // Ability categories (talents, skills, knowledge)
  abilityCategories: {
    talents: "NARUTO_RPG.Trait.Categories.talents",
    skills: "NARUTO_RPG.Trait.Categories.skills",
    knowledge: "NARUTO_RPG.Trait.Categories.knowledge",
  },

  // Physical attributes
  physicalAttributes: {
    strength: "NARUTO_RPG.Attributes.strength",
    dexterity: "NARUTO_RPG.Attributes.dexterity",
    stamina: "NARUTO_RPG.Attributes.stamina",
  },

  // Social attributes
  socialAttributes: {
    charisma: "NARUTO_RPG.Attributes.charisma",
    manipulation: "NARUTO_RPG.Attributes.manipulation",
    appearance: "NARUTO_RPG.Attributes.appearance",
  },

  // Mental attributes
  mentalAttributes: {
    perception: "NARUTO_RPG.Attributes.perception",
    intelligence: "NARUTO_RPG.Attributes.intelligence",
    wits: "NARUTO_RPG.Attributes.wits",
  },

  // Combat techniques
  techniques: {
    punch: "NARUTO_RPG.Techniques.punch",
    kick: "NARUTO_RPG.Techniques.kick",
    block: "NARUTO_RPG.Techniques.block",
    grab: "NARUTO_RPG.Techniques.grab",
    athletics: "NARUTO_RPG.Techniques.athletics",
    focus: "NARUTO_RPG.Techniques.focus",
  },

  // Resources
  resources: {
    health: "NARUTO_RPG.Resources.health",
    chi: "NARUTO_RPG.Resources.chi",
    willpower: "NARUTO_RPG.Resources.willpower",
  },

  // Maneuver categories (matches ManeuverCategory enum)
  maneuverCategories: {
    punch: "NARUTO_RPG.Maneuver.Categories.punch",
    kick: "NARUTO_RPG.Maneuver.Categories.kick",
    block: "NARUTO_RPG.Maneuver.Categories.block",
    grab: "NARUTO_RPG.Maneuver.Categories.grab",
    athletics: "NARUTO_RPG.Maneuver.Categories.athletics",
    focus: "NARUTO_RPG.Maneuver.Categories.focus",
    arremesso: "NARUTO_RPG.Maneuver.Categories.arremesso",
    armas_brancas: "NARUTO_RPG.Maneuver.Categories.armas_brancas",
    other: "NARUTO_RPG.Maneuver.Categories.other",
  },

  // Trait types (attribute, ability, technique, background)
  traitTypes: {
    attribute: "NARUTO_RPG.Trait.Types.attribute",
    ability: "NARUTO_RPG.Trait.Types.ability",
    technique: "NARUTO_RPG.Trait.Types.technique",
    background: "NARUTO_RPG.Trait.Types.background",
  },

  // Trait categories (matches the fslibrary structure)
  traitCategories: {
    // Attributes
    physical: "NARUTO_RPG.Trait.Categories.physical",
    social: "NARUTO_RPG.Trait.Categories.social",
    mental: "NARUTO_RPG.Trait.Categories.mental",
    // Abilities
    talents: "NARUTO_RPG.Trait.Categories.talents",
    skills: "NARUTO_RPG.Trait.Categories.skills",
    knowledge: "NARUTO_RPG.Trait.Categories.knowledge",
    // Techniques
    techniques: "NARUTO_RPG.Trait.Categories.techniques",
    // Backgrounds
    backgrounds: "NARUTO_RPG.Trait.Categories.backgrounds",
  },

  // Prerequisite types for maneuvers
  prerequisiteTypes: {
    techniqueRating: "NARUTO_RPG.Prerequisite.Types.techniqueRating",
    maneuver: "NARUTO_RPG.Prerequisite.Types.maneuver",
    attributeRating: "NARUTO_RPG.Prerequisite.Types.attributeRating",
    abilityRating: "NARUTO_RPG.Prerequisite.Types.abilityRating",
    background: "NARUTO_RPG.Prerequisite.Types.background",
  },

  // Effect types (matches EffectType enum)
  effectTypes: {
    categoryBonus: "NARUTO_RPG.Effect.Types.categoryBonus",
    categoryInitialFixed: "NARUTO_RPG.Effect.Types.categoryInitialFixed",
    categoryInitialMax: "NARUTO_RPG.Effect.Types.categoryInitialMax",
    categoryXpCost: "NARUTO_RPG.Effect.Types.categoryXpCost",
    traitBonus: "NARUTO_RPG.Effect.Types.traitBonus",
    traitInitialFixed: "NARUTO_RPG.Effect.Types.traitInitialFixed",
    traitInitialMax: "NARUTO_RPG.Effect.Types.traitInitialMax",
    traitXpCost: "NARUTO_RPG.Effect.Types.traitXpCost",
    priorityPoints: "NARUTO_RPG.Effect.Types.priorityPoints",
    grantManeuver: "NARUTO_RPG.Effect.Types.grantManeuver",
    bypassPrerequisite: "NARUTO_RPG.Effect.Types.bypassPrerequisite",
    grantDivision: "NARUTO_RPG.Effect.Types.grantDivision",
  },
};
