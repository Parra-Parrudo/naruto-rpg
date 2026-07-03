/**
 * Naruto RPG - Cartas de Combate
 * Integra as manobras/jutsus do personagem com o sistema de Cards do Foundry.
 * Carta jogada na "Mesa de Combate" durante a Fase de Selecao = manobra
 * selecionada no combate (a ordem de execucao passa a ser a Velocidade da carta).
 * As cartas voltam automaticamente para as maos quando uma nova Fase de Selecao
 * comeca ou quando o combate termina.
 */

import { prepareActorManeuvers, calculateManeuverStats, canAffordManeuver } from "./maneuver-calculator.mjs";
import { getEffectiveTraitValue } from "./effect-helpers.mjs";
import { COMBAT_PHASE, SF_HOOKS, calculateSpeedTiebreaker } from "../combat/combat-phases.mjs";

const LOG = "Naruto RPG | Cartas |";

/**
 * Get (or create, GM only) the shared combat table pile
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
  const backName = game.i18n.localize("NARUTO_RPG.Cards.cardBack");

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
      back: { name: backName, img: "icons/svg/card-hand.svg" },
      sort: i * 10,
      flags: { "naruto-rpg": { actorId: actor.id, itemId: m.id, handName: name } },
    };
  });

  await hand.createEmbeddedDocuments("Card", cardsData);
  await getCombatTable();

  ui.notifications.info(game.i18n.format("NARUTO_RPG.Cards.synced", { count: cardsData.length, name }));
  return { hand, count: cardsData.length };
}

/* -------------------------------------------------------------------------- */
/*  Integracao com o combate                                                   */
/* -------------------------------------------------------------------------- */

function _tableName() {
  return game.i18n.localize("NARUTO_RPG.Cards.tableName");
}

function _findCombatantForActor(actorId) {
  const combat = game.combat;
  if (!combat) return null;
  return combat.combatants.find((c) => c.actor?.id === actorId || c.token?.actorId === actorId) ?? null;
}

/**
 * Return all cards on the combat table to their owners' hands (GM only)
 */
export async function returnCombatCards({ silent = false } = {}) {
  if (!game.user.isGM) return;
  const table = game.cards.getName(_tableName());
  if (!table || !table.cards.size) return;

  // Group cards by destination hand
  const groups = new Map();
  for (const card of table.cards) {
    const handName = card.getFlag("naruto-rpg", "handName");
    if (!handName) continue;
    if (!groups.has(handName)) groups.set(handName, []);
    groups.get(handName).push(card.id);
  }

  let returned = 0;
  for (const [handName, ids] of groups.entries()) {
    const hand = game.cards.getName(handName);
    if (!hand) continue;
    try {
      await table.pass(hand, ids, { chatNotification: false });
      returned += ids.length;
    } catch (e) {
      console.warn(LOG, "falha ao devolver cartas para", handName, e);
    }
  }

  if (returned && !silent) {
    ui.notifications.info(game.i18n.format("NARUTO_RPG.Cards.returned", { count: returned }));
  }
}

/**
 * Register the hooks that bridge played cards to the phase-based combat system.
 */
export function registerCombatCardHooks() {
  Hooks.on("createCard", async (card, options, userId) => {
    if (game.user.id !== userId) return;
    if (card.parent?.name !== _tableName()) return;

    const actorId = card.getFlag("naruto-rpg", "actorId");
    const itemId = card.getFlag("naruto-rpg", "itemId");
    console.log(LOG, "carta jogada na Mesa:", card.name, { actorId, itemId, phase: game.combat?.phase });

    if (!actorId || !itemId) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Cards.oldCard"));
      return;
    }

    const combat = game.combat;
    if (!combat) {
      console.log(LOG, "nenhum combate ativo — carta apenas colocada na Mesa.");
      return;
    }

    const combatant = _findCombatantForActor(actorId);
    if (!combatant) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Cards.noCombatant"));
      return;
    }

    if (combat.phase !== COMBAT_PHASE.SELECTION) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Cards.notSelectionPhase"));
      return;
    }

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

    try {
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
    } catch (e) {
      console.error(LOG, "erro ao selecionar manobra pela carta:", e);
      ui.notifications.error(`Cartas de Combate: ${e.message}`);
    }
  });

  Hooks.on("deleteCard", async (card, options, userId) => {
    if (game.user.id !== userId) return;
    if (card.parent?.name !== _tableName()) return;

    const actorId = card.getFlag("naruto-rpg", "actorId");
    const itemId = card.getFlag("naruto-rpg", "itemId");
    if (!actorId) return;

    const combatant = _findCombatantForActor(actorId);
    if (!combatant) return;
    if (game.combat?.phase !== COMBAT_PHASE.SELECTION) return;

    if (combatant.selectedManeuver?.itemId === itemId) {
      await combatant.clearManeuverSelection();
      ui.combat?.render();
    }
  });

  // Nova Fase de Selecao => devolve as cartas do turno anterior (GM)
  Hooks.on(SF_HOOKS.PHASE_CHANGED, async (combat, newPhase) => {
    if (newPhase === COMBAT_PHASE.SELECTION) {
      await returnCombatCards({ silent: true });
    }
  });

  // Fim do combate => devolve tudo (GM)
  Hooks.on("deleteCombat", async (combat, options, userId) => {
    if (game.user.id !== userId) return;
    await returnCombatCards();
  });
}
