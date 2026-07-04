/**
 * Naruto RPG Maneuver Selection Dialog
 * Displays available maneuvers for a combatant to select during the selection phase
 * @author Kirlian Silvestre
 */

import { COMBAT_PHASE, FLAG_SCOPE, COMBAT_FLAGS, calculateSpeedTiebreaker } from "./combat-phases.mjs";
import {
  calculateManeuverStats,
  getCharacterStatsForManeuver,
  canAffordManeuver,
} from "../helpers/maneuver-calculator.mjs";
import { getEffectiveTraitValue } from "../helpers/effect-helpers.mjs";

/**
 * Dialog for selecting a maneuver during combat selection phase
 * @extends {foundry.applications.api.ApplicationV2}
 */
export class ManeuverSelectionDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  /**
   * @param {Combat} combat - The combat document
   * @param {Combatant} combatant - The combatant selecting a maneuver
   * @param {object} options - Application options
   */
  constructor(combat, combatant, options = {}) {
    super(options);
    this.combat = combat;
    this.combatant = combatant;
    this.sortMode = "speed";
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "maneuver-selection-dialog-{id}",
    classes: ["naruto-rpg", "maneuver-selection-dialog"],
    window: {
      frame: true,
      positioned: true,
      title: "NARUTO_RPG.Combat.SelectManeuver",
      icon: "fas fa-fist-raised",
      minimizable: true,
      resizable: true
    },
    position: {
      width: 600,
      height: 500
    },
    actions: {
      selectManeuver: ManeuverSelectionDialog._onSelectManeuver,
      toggleNotes: ManeuverSelectionDialog._onToggleNotes
    }
  };

  /** @override */
  static PARTS = {
    content: {
      template: "systems/naruto-rpg/templates/combat/maneuver-selection-dialog.hbs"
    }
  };

  /** @override */
  get title() {
    return game.i18n.format("NARUTO_RPG.Combat.SelectManeuverFor", {
      name: this.combatant.name
    });
  }

  /** @override */
  async _prepareContext(options) {
    const actor = this.combatant.actor;
    if (!actor) {
      return { maneuvers: [], hasManeuvers: false };
    }

    const maneuvers = this._prepareManeuvers(actor);
    const currentSelection = this.combatant.selectedManeuver;

    const sortOptions = ["speed", "name", "category", "damage", "movement"].map((key) => ({
      key,
      label: game.i18n.localize(`NARUTO_RPG.Combat.SortBy.${key}`),
      selected: key === this.sortMode,
    }));

    return {
      combatant: this.combatant,
      actor: actor,
      maneuvers: maneuvers,
      hasManeuvers: maneuvers.length > 0,
      currentSelection: currentSelection,
      currentSelectionId: currentSelection?.itemId ?? null,
      sortOptions,
    };
  }

  /**
   * Prepare maneuver data with calculated stats using centralized calculator (SSOT)
   * @param {Actor} actor - The actor
   * @returns {object[]}
   * @private
   */
  _prepareManeuvers(actor) {
    const maneuvers = actor.items.filter(item => item.type === "specialManeuver");
    const characterStats = getCharacterStatsForManeuver(actor);

    const catOrder = ["punch", "kick", "block", "grab", "athletics", "focus", "arremesso", "armas_brancas", "other"];
    const catLabel = (key) =>
      game.i18n.localize(CONFIG.NARUTO_RPG.maneuverCategories?.[key] ?? "NARUTO_RPG.Maneuver.Categories.other");

    const prepared = maneuvers.map(maneuver => {
      const data = calculateManeuverStats(actor, maneuver, { characterStats });
      return {
        ...data,
        canAfford: canAffordManeuver(actor, maneuver),
        categoryLabel: catLabel(data.category || maneuver.system.category),
        description: maneuver.system.description || "",
        hasDetails: !!(maneuver.system.description || data.ruleSummary || data.notes),
      };
    });

    const num = (v) => Number(v) || 0;
    const sorters = {
      speed: (a, b) => num(a.calculatedSpeed) - num(b.calculatedSpeed) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      category: (a, b) => (catOrder.indexOf(a.category) - catOrder.indexOf(b.category)) || a.name.localeCompare(b.name),
      damage: (a, b) => num(b.calculatedDamage) - num(a.calculatedDamage) || a.name.localeCompare(b.name),
      movement: (a, b) => num(b.calculatedMovement) - num(a.calculatedMovement) || a.name.localeCompare(b.name),
    };
    return prepared.sort(sorters[this.sortMode] ?? sorters.speed);
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const select = this.element.querySelector(".nrpg-sort-select");
    if (select) {
      select.addEventListener("change", (event) => {
        this.sortMode = event.currentTarget.value;
        this.render();
      });
    }
  }

  /**
   * Handle maneuver selection
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ManeuverSelectionDialog}
   */
  static async _onSelectManeuver(event, target) {
    event.preventDefault();

    const maneuverId = target.dataset.maneuverId;
    if (!maneuverId) return;

    const actor = this.combatant.actor;
    if (!actor) return;

    const maneuver = actor.items.get(maneuverId);
    if (!maneuver) return;

    if (!canAffordManeuver(actor, maneuver)) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.CannotAffordManeuver"));
      return;
    }

    const preparedManeuver = calculateManeuverStats(actor, maneuver);

    // Get wits and perception for tiebreaker calculation
    const findTraitValue = (sourceId) => {
      if (!sourceId) return 0;
      const item = actor.items.find(i => i.system.sourceId === sourceId);
      if (!item) return 0;
      const baseValue = item.system.value || 0;
      const effective = getEffectiveTraitValue(actor, sourceId, baseValue);
      return effective.value;
    };
    const wits = findTraitValue("wits");
    const perception = findTraitValue("perception");
    const speedTiebreaker = calculateSpeedTiebreaker(preparedManeuver.calculatedSpeed, wits, perception);

    await this.combatant.selectManeuver({
      itemId: maneuver.id,
      name: maneuver.name,
      speed: preparedManeuver.calculatedSpeed,
      speedTiebreaker: speedTiebreaker,
      damage: preparedManeuver.calculatedDamage,
      movement: preparedManeuver.calculatedMovement,
      category: preparedManeuver.category,
      chiCost: preparedManeuver.chiCost,
      willpowerCost: preparedManeuver.willpowerCost,
      notes: preparedManeuver.notes
    });

    ui.notifications.info(game.i18n.format("NARUTO_RPG.Combat.ManeuverSelected", {
      name: maneuver.name
    }));

    ui.combat?.render();

    await this.close();
  }

  /**
   * Handle toggling the notes accordion
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   * @this {ManeuverSelectionDialog}
   */
  static _onToggleNotes(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const card = target.closest(".nrpg-maneuver-card");
    if (!card) return;

    const notes = card.querySelector(".nrpg-maneuver-notes");
    if (!notes) return;

    const isCollapsed = notes.classList.contains("collapsed");
    notes.classList.toggle("collapsed", !isCollapsed);
    card.classList.toggle("expanded", isCollapsed);
  }

  /**
   * Show the maneuver selection dialog for a combatant
   * @param {Combat} combat - The combat document
   * @param {Combatant} combatant - The combatant
   * @returns {Promise<ManeuverSelectionDialog>}
   */
  static async show(combat, combatant) {
    if (combat.phase !== COMBAT_PHASE.SELECTION) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.NotInSelectionPhase"));
      return null;
    }

    // Block selection for defeated combatants
    if (combatant.isDefeated) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Combat.CombatantDefeated"));
      return null;
    }

    const existingDialog = Object.values(ui.windows).find(
      w => w instanceof ManeuverSelectionDialog && w.combatant?.id === combatant.id
    );

    if (existingDialog) {
      existingDialog.bringToFront();
      return existingDialog;
    }

    const dialog = new ManeuverSelectionDialog(combat, combatant, {
      id: `maneuver-selection-dialog-${combatant.id}`
    });

    await dialog.render(true);
    return dialog;
  }
}
