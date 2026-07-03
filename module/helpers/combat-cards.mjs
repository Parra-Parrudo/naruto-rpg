/**
 * Naruto RPG - Cartas de Combate
 * Integra as manobras/jutsus do personagem com o sistema de Cards do Foundry:
 * gera uma "mao" de cartas por personagem (1 carta por manobra, com os valores
 * calculados) e uma pilha compartilhada "Mesa de Combate" para a fase de selecao.
 * Carta jogada na Mesa durante a Fase de Selecao = manobra selecionada no combate
 * (a iniciativa/ordem de execucao passa a ser a Velocidade da carta).
 */

import { prepareActorManeuvers, calculateManeuverStats, canAffordManeuver } from "./maneuver-calculator.mjs";
import { getEffectiveTraitValue } from "./effect-helpers.mjs";
import { COMBAT_PHASE, calculateSpeedTiebreaker } from "../combat/combat-phases.mjs";

/**
 * Get (or create, GM only) the shared combat table pile
 * @returns {Promise<Cards|null>}
 */
export async function getCombatTable() {
  const name = game.i18n.localize("NARUTO_RPG.Cards.tableName");
  let table = game.cards.getName(name);
  if (!table && game.user.isGM) {
    table = await Cards.create({
      name,
      type: "pile",
      img: "icons/svg/card-hand.svg",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    });
  }
  return table ?? null;
}

/**
 * Create or refresh the combat cards hand for an actor.
 * One card per special maneuver, with calculated Speed/Damage/Movement.
 * @param {Actor} actor
 * @returns {Promise<{hand: Cards, count: number}|null>}
 */
export async function syncCombatCards(actor) {
  const prepared = prepareActorManeuvers(actor, { sortBySpeed: false });
  if (!prepared.length) {
    ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Cards.noManeuvers"));
    return null;
  }

  const name = game.i18n.format("NARUTO_RPG.Cards.handName", { name: actor.name });
  let hand = game.cards.getName(name);

  try {
    if (!hand) {
      hand = await Cards.create({ name, type: "hand", img: actor.img });
    }
  } catch (e) {
    ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Cards.createDenied"));
    return null;
  }

  // Grant ownership to the actor's owners (players see their own hand)
  const ownership = foundry.utils.deepClone(hand.ownership ?? {});
  for (const [userId, level] of Object.entries(actor.ownership ?? {})) {
    if (userId !== "default" && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) {
      ownership[userId] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
  }
  await hand.update({ ownership });

  // Rebuild all cards (refresh calculated values)
  const oldIds = hand.cards.map((c) => c.id);
  if (oldIds.length) await hand.deleteEmbeddedDocuments("Card", oldIds);

  const catLabel = (key) =>
    game.i18n.localize(CONFIG.NARUTO_RPG.maneuverCategories?.[key] ?? "NARUTO_RPG.Maneuver.Categories.other");

  const cardsData = prepared.map((m, i) => {
    const cat = catLabel(m.system?.category);
    const costs = [];
    if (m.system?.chiCost) costs.push(`${m.system.chiCost} ${game.i18n.localize("NARUTO_RPG.Resources.chi")}`);
    if (m.system?.willpowerCost) costs.push(`${m.system.willpowerCost} ${game.i18n.localize("NARUTO_RPG.Resources.willpower")}`);
    const statsLine =
      `${game.i18n.localize("NARUTO_RPG.Combat.Speed")}: ${m.calculatedSpeed} | ` +
      `${game.i18n.localize("NARUTO_RPG.Combat.Damage")}: ${m.calculatedDamage} | ` +
      `${game.i18n.localize("NARUTO_RPG.Combat.Movement")}: ${m.calculatedMovement}` +
      (costs.length ? ` | ${game.i18n.localize("NARUTO_RPG.Cards.cost")}: ${costs.join(", ")}` : "");

    let description = `<p><strong>${cat}</strong></p><p>${statsLine}</p>`;
    if (m.system?.ruleSummary) description += `<p><strong>${game.i18n.localize("NARUTO_RPG.SpecialManeuver.system")}:</strong> ${m.system.ruleSummary}</p>`;
    if (m.system?.description) description += m.system.description;

    return {
      name: m.name,
      type: "base",
      suit: cat,
      value: Number(m.calculatedSpeed) || 0,
      description,
      faces: [{ name: m.name, img: m.img || "icons/svg/sword.svg", text: statsLine }],
      face: 0,
      sort: i * 10,
      flags: { "naruto-rpg": { actorId: actor.id, itemId: m.id } },
    };
  });

  await hand.createEmbeddedDocuments("Card", cardsData);
  await getCombatTable();

  ui.notifications.info(game.i18n.format("NARUTO_RPG.Cards.synced", { count: cardsData.length, name }));
  return { hand, count: cardsData.length };
}

/* -------------------------------------------------------------------------- */
/*  Integracao com o combate: carta jogada na Mesa = manobra selecionada       */
/* -------------------------------------------------------------------------- */

function _findCombatantForActor(actorId) {
  const combat = game.combat;
  if (!combat) return null;
  return combat.combatants.find((c) => c.actor?.id === actorId) ?? null;
}

/**
 * Register the hooks that bridge played cards to the phase-based combat system.
 * A card played onto the "Mesa de Combate" selects that maneuver for the
 * combatant, so execution order (initiative) comes from the card's Speed.
 */
export function registerCombatCardHooks() {
  Hooks.on("createCard", async (card, options, userId) => {
    if (game.user.id !== userId) return;
    const tableName = game.i18n.localize("NARUTO_RPG.Cards.tableName");
    if (card.parent?.name !== tableName) return;

    const actorId = card.getFlag("naruto-rpg", "actorId");
    const itemId = card.getFlag("naruto-rpg", "itemId");
    if (!actorId || !itemId) return;

    const combatant = _findCombatantForActor(actorId);
    if (!combatant) return;
    if (game.combat?.phase !== COMBAT_PHASE.SELECTION) return;

    const actor = combatant.actor;
    const maneuver = actor?.items.get(itemId);
    if (!maneuver) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.ManeuverNotFound"));
      return;
    }

    if (!canAffordManeuver(actor, maneuver)) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.CannotAffordManeuver"));
      return;
    }

    const prepared = calculateManeuverStats(actor, maneuver);

    const findTraitValue = (sourceId) => {
      if (!sourceId) return 0;
      const item = actor.items.find((i) => i.system.sourceId === sourceId);
      if (!item) return 0;
      const effective = getEffectiveTraitValue(actor, sourceId, item.system.value || 0);
      return effective.value;
    };
    const speedTiebreaker = calculateSpeedTiebreaker(
      prepared.calculatedSpeed,
      findTraitValue("wits"),
      findTraitValue("perception")
    );

    await combatant.selectManeuver({
      itemId: maneuver.id,
      name: maneuver.name,
      speed: prepared.calculatedSpeed,
      speedTiebreaker,
      damage: prepared.calculatedDamage,
      movement: prepared.calculatedMovement,
      category: prepared.category,
      chiCost: prepared.chiCost,
      willpowerCost: prepared.willpowerCost,
      notes: prepared.notes,
    });

    ui.notifications.info(game.i18n.format("NARUTO_RPG.Combat.ManeuverSelected", { name: maneuver.name }));
    ui.combat?.render();
  });

  Hooks.on("deleteCard", async (card, options, userId) => {
    if (game.user.id !== userId) return;
    const tableName = game.i18n.localize("NARUTO_RPG.Cards.tableName");
    if (card.parent?.name !== tableName) return;

    const actorId = card.getFlag("naruto-rpg", "actorId");
    const itemId = card.getFlag("naruto-rpg", "itemId");
    if (!actorId) return;

    const combatant = _findCombatantForActor(actorId);
    if (!combatant) return;
    if (game.combat?.phase !== COMBAT_PHASE.SELECTION) return;

    // Only clear if the removed card is the currently selected maneuver
    if (combatant.selectedManeuver?.itemId === itemId) {
      await combatant.clearManeuverSelection();
      ui.combat?.render();
    }
  });
}
