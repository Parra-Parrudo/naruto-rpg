/**
 * Naruto RPG Active Effect Sheet
 * @author Kirlian Silvestre
 * @extends {ActiveEffectConfig}
 */

import {
  EFFECT_TARGET_TYPES,
  RESOURCE_TYPES,
  MANEUVER_STAT_TYPES,
  parseEffectKey,
  buildEffectKey,
  isManeuverTechniqueEffectType,
  isManeuverSpecificEffectType,
} from "./effect-types.mjs";

const ActiveEffectConfig = foundry.applications.sheets.ActiveEffectConfig;

export class NarutoRpgEffectSheet extends ActiveEffectConfig {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["naruto-rpg", "effect-sheet"],
  };

  /** @override */
  static PARTS = {
    ...super.PARTS,
    changes: { template: "systems/naruto-rpg/templates/effects/effect-changes-tab.hbs" },
  };

  /** @override */
  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);

    if (partId === "changes") {
      partContext.effectTargetTypes = this._getEffectTargetTypes();
      partContext.resourceTypes = this._getResourceTypes();
      partContext.traits = this._getAvailableTraits();
      partContext.techniques = this._getAvailableTechniques();
      partContext.maneuvers = this._getAvailableManeuvers();

      partContext.parsedChanges = partContext.source.changes.map((change, index) => {
        const parsed = parseEffectKey(change.key);
        return {
          ...change,
          index,
          targetType: parsed?.type || EFFECT_TARGET_TYPES.TRAIT,
          targetId: parsed?.targetId || "",
          stat: parsed?.stat || "",
        };
      });
    }

    return partContext;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this._restoreTargetSelections();
    const activeTab =
      this._tabs?.sheet?.active ??
      this.element.querySelector(".sheet-tabs .active")?.dataset.tab ?? "details";
    // keep the Tabs controller in sync
    if (this._tabs?.sheet) {
      this._tabs.sheet.active = activeTab;
    }
    // ensure both nav and content reflect the active tab
    this.element
      .querySelectorAll(".sheet-tabs .item")
      .forEach((item) => item.classList.toggle("active", item.dataset.tab === activeTab));
    this.element
      .querySelectorAll('.tab[data-group="sheet"]')
      .forEach((section) => section.classList.toggle("active", section.dataset.tab === activeTab));
  }


  /**
   * Restore target ID selections after render
   * @private
   */
  _restoreTargetSelections() {
    const html = this.element;
    if (!html) return;

    const rows = html.querySelectorAll("li.effect-change");
    rows.forEach((row) => {
      const targetType = row.dataset.targetType;
      const targetId = row.dataset.targetId;

      if (!targetId) return;

      if (targetType === EFFECT_TARGET_TYPES.TRAIT || targetType === EFFECT_TARGET_TYPES.ROLL_TRAIT) {
        const traitSelect = row.querySelector(".trait-target-select");
        if (traitSelect) {
          traitSelect.value = targetId;
        }
      } else if (targetType === EFFECT_TARGET_TYPES.RESOURCE_MAX) {
        const resourceSelect = row.querySelector(".resource-target-select");
        if (resourceSelect) {
          resourceSelect.value = targetId;
        }
      }
    });
  }

  /**
   * Get effect target types for dropdown
   * @returns {Array<{value: string, label: string}>}
   * @private
   */
  _getEffectTargetTypes() {
    return [
      { value: EFFECT_TARGET_TYPES.TRAIT, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.trait") },
      { value: EFFECT_TARGET_TYPES.RESOURCE_MAX, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.resourceMax") },
      { value: EFFECT_TARGET_TYPES.ROLL_ALL, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.rollAll") },
      { value: EFFECT_TARGET_TYPES.ROLL_TRAIT, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.rollTrait") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_SPEED, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueSpeed") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_DAMAGE, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueDamage") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_TECHNIQUE_MOVEMENT, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverTechniqueMovement") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_SPEED, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificSpeed") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_DAMAGE, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificDamage") },
      { value: EFFECT_TARGET_TYPES.MANEUVER_SPECIFIC_MOVEMENT, label: game.i18n.localize("NARUTO_RPG.ActiveEffects.TargetTypes.maneuverSpecificMovement") },
    ];
  }

  /**
   * Get resource types for dropdown
   * @returns {Array<{value: string, label: string}>}
   * @private
   */
  _getResourceTypes() {
    return [
      { value: RESOURCE_TYPES.HEALTH, label: game.i18n.localize("NARUTO_RPG.Resources.health") },
      { value: RESOURCE_TYPES.CHI, label: game.i18n.localize("NARUTO_RPG.Resources.chi") },
      { value: RESOURCE_TYPES.WILLPOWER, label: game.i18n.localize("NARUTO_RPG.Resources.willpower") },
      { value: RESOURCE_TYPES.SOAK, label: game.i18n.localize("NARUTO_RPG.Combat.soak")}
    ];
  }

  /**
   * Get available traits from world items
   * @returns {Array<{id: string, name: string, type: string}>}
   * @private
   */
  _getAvailableTraits() {
    const traits = [];
    const traitTypes = ["attribute", "ability", "technique", "background"];

    for (const item of game.items) {
      if (traitTypes.includes(item.type)) {
        traits.push({
          id: item.system.sourceId || item.id,
          name: item.name,
          type: item.type,
        });
      }
    }

    return traits.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get available techniques for maneuver effect targeting
   * @returns {Array<{id: string, name: string}>}
   * @private
   */
  _getAvailableTechniques() {
    const techniques = [];

    for (const item of game.items) {
      if (item.type === "technique") {
        techniques.push({
          id: item.system.sourceId || item.name.toLowerCase(),
          name: item.name,
        });
      }
    }

    return techniques.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get available maneuvers for specific maneuver effect targeting
   * Returns maneuvers from the effect's parent actor if available
   * @returns {Array<{id: string, name: string}>}
   * @private
   */
  _getAvailableManeuvers() {
    const maneuvers = [];
    const parentActor = this.document.parent;

    if (parentActor && parentActor instanceof Actor) {
      for (const item of parentActor.items) {
        if (item.type === "specialManeuver") {
          maneuvers.push({
            id: item.id,
            name: item.name,
          });
        }
      }
    }

    for (const item of game.items) {
      if (item.type === "specialManeuver") {
        maneuvers.push({
          id: item.id,
          name: `[World] ${item.name}`,
        });
      }
    }

    return maneuvers.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** @override */
  _onChangeForm(formConfig, event) {
    super._onChangeForm(formConfig, event);

    const target = event.target;
    if (target?.matches('select.change-target-type')) {
      const targetType = target.value;
      const row = target.closest("li.effect-change");

      if (row) {
        const traitSelect = row.querySelector(".change-trait-select");
        const resourceSelect = row.querySelector(".change-resource-select");
        const rollAllSelect = row.querySelector(".change-rollall-select");
        const techniqueSelect = row.querySelector(".change-technique-select");
        const maneuverSelect = row.querySelector(".change-maneuver-select");

        if (traitSelect) {
          traitSelect.style.display =
            targetType === EFFECT_TARGET_TYPES.TRAIT || targetType === EFFECT_TARGET_TYPES.ROLL_TRAIT
              ? ""
              : "none";
        }

        if (resourceSelect) {
          resourceSelect.style.display =
            targetType === EFFECT_TARGET_TYPES.RESOURCE_MAX ? "" : "none";
        }

        if (rollAllSelect) {
          rollAllSelect.style.display =
            targetType === EFFECT_TARGET_TYPES.ROLL_ALL ? "" : "none";
        }

        if (techniqueSelect) {
          techniqueSelect.style.display =
            isManeuverTechniqueEffectType(targetType) ? "" : "none";
        }

        if (maneuverSelect) {
          maneuverSelect.style.display =
            isManeuverSpecificEffectType(targetType) ? "" : "none";
        }
      }
    }
  }

  /** @override */
  _processFormData(event, form, formData) {
    const processedData = super._processFormData(event, form, formData);

    if (processedData.changes) {
      const changesArray = Object.values(processedData.changes || []);

      processedData.changes = changesArray.map((change) => {
        const targetType = change.targetType || EFFECT_TARGET_TYPES.TRAIT;
        let targetId = "";

        if (targetType === EFFECT_TARGET_TYPES.TRAIT || targetType === EFFECT_TARGET_TYPES.ROLL_TRAIT) {
          targetId = change.traitTargetId || "";
        } else if (targetType === EFFECT_TARGET_TYPES.RESOURCE_MAX) {
          targetId = change.resourceTargetId || "";
        } else if (isManeuverTechniqueEffectType(targetType)) {
          targetId = change.techniqueTargetId || "";
        } else if (isManeuverSpecificEffectType(targetType)) {
          targetId = change.maneuverTargetId || "";
        }

        return {
          key: buildEffectKey(targetType, targetId),
          mode: change.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD,
          value: change.value || "0",
        };
      });
    }

    return processedData;
  }
}
