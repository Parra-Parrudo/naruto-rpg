/**
 * Naruto RPG Item Sheet
 * @author Kirlian Silvestre
 * @extends {ItemSheetV2}
 */

const { ItemSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class NarutoRpgItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["naruto-rpg", "sheet", "item"],
    position: {
      width: 600,
      height: 480,
    },
    window: {
      resizable: true,
    },
    actions: {
      editImage: NarutoRpgItemSheet._onEditImage,
      effectCreate: NarutoRpgItemSheet._onEffectCreate,
      effectEdit: NarutoRpgItemSheet._onEffectEdit,
      effectDelete: NarutoRpgItemSheet._onEffectDelete,
      prerequisiteAdd: NarutoRpgItemSheet._onPrerequisiteAdd,
      prerequisiteDelete: NarutoRpgItemSheet._onPrerequisiteDelete,
      styleCostAdd: NarutoRpgItemSheet._onStyleCostAdd,
      styleCostDelete: NarutoRpgItemSheet._onStyleCostDelete,
      backgroundCostAdd: NarutoRpgItemSheet._onBackgroundCostAdd,
      backgroundCostDelete: NarutoRpgItemSheet._onBackgroundCostDelete,
    },
    form: {
      submitOnChange: true,
    },
  };

  /** @inheritDoc */
  static TABS = {
    primary: {
      details: { id: "details", group: "primary", label: "NARUTO_RPG.Tabs.details" },
      effects: { id: "effects", group: "primary", label: "NARUTO_RPG.Tabs.effects" },
    },
  };

  /** @inheritDoc */
  tabGroups = {
    primary: "details",
  };

  /** @inheritDoc */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.form = {
      template: `systems/naruto-rpg/templates/item/item-${this.item.type}-sheet.hbs`,
    };
    return parts;
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Add item reference for template compatibility
    context.item = this.item;
    context.systemData = this.item.system;
    context.config = CONFIG.NARUTO_RPG;
    context.isEditable = this.isEditable;
    context.isOwner = this.item.isOwner;
    context.itemType = this.item.type;
    context.isEmbedded = this.item.isEmbedded;

    const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;
    context.enrichedDescription = await TextEditorImpl.enrichHTML(
      this.item.system.description || "",
      {
        secrets: this.item.isOwner,
        async: true,
        relativeTo: this.item,
      }
    );

    this._prepareTypeSpecificData(context);

    // Prepare tabs
    context.tabs = this._prepareTabs(options);

    return context;
  }

  /**
   * Prepare tab data for rendering
   * @param {object} options
   * @returns {object}
   * @protected
   */
  _prepareTabs(options) {
    const tabs = {};
    for (const [groupId, group] of Object.entries(this.constructor.TABS)) {
      tabs[groupId] = {};
      for (const [tabId, tab] of Object.entries(group)) {
        tabs[groupId][tabId] = {
          ...tab,
          active: this.tabGroups[groupId] === tabId,
          cssClass: this.tabGroups[groupId] === tabId ? "active" : "",
        };
      }
    }
    return tabs;
  }

  /** @inheritDoc */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    return controls;
  }

  /** @inheritDoc */
  async _onChangeForm(formConfig, event) {
    const form = this.form;
    if (!form) return;
    
    const formData = new foundry.applications.ux.FormDataExtended(form);
    const data = foundry.utils.expandObject(formData.object);
    
    await this.document.update(data);
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    this._setupTabListeners();
    this._setupPrerequisiteDropdown(context);

    // Restore active tab after re-render
    if (this.tabGroups.primary && this.tabGroups.primary !== "details") {
      this._activateTab(this.tabGroups.primary);
    }

    // Restore scroll position if saved
    if (this._savedScrollTop !== undefined) {
      const sheetBody = this.element.querySelector(".sheet-body");
      if (sheetBody) {
        sheetBody.scrollTop = this._savedScrollTop;
      }
      delete this._savedScrollTop;
    }
  }

  /** @inheritDoc */
  _preRender(context, options) {
    super._preRender(context, options);
    // Save scroll position before re-render
    const sheetBody = this.element?.querySelector(".sheet-body");
    if (sheetBody) {
      this._savedScrollTop = sheetBody.scrollTop;
    }
  }

  /**
   * Setup the prerequisite dropdown to populate the ID select based on type
   * @param {object} context - The render context
   * @private
   */
  _setupPrerequisiteDropdown(context) {
    const html = this.element;
    if (!html) return;

    const typeSelect = html.querySelector('select[name="newPrereqType"]');
    const idSelect = html.querySelector('select[name="newPrereqId"]');
    const valueInput = html.querySelector('input[name="newPrereqValue"]');
    if (!typeSelect || !idSelect) return;

    const worldTraits = context.worldTraits || [];
    const worldManeuvers = context.worldManeuvers || [];

    const updatePrereqUI = (type) => {
      // Populate ID select
      idSelect.innerHTML = `<option value="">-- ${game.i18n.localize("NARUTO_RPG.Common.select")} --</option>`;
      const items = type === "maneuver" ? worldManeuvers : worldTraits;
      items.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        idSelect.appendChild(option);
      });

      // Hide value input for maneuvers (they don't have levels)
      if (valueInput) {
        valueInput.style.display = type === "maneuver" ? "none" : "";
      }
    };

    // Setup on initial render
    updatePrereqUI(typeSelect.value);

    // Update when type changes
    typeSelect.addEventListener("change", (event) => {
      updatePrereqUI(event.target.value);
    });
  }

  /**
   * Activate a specific tab
   * @param {string} tabName - The tab to activate
   * @private
   */
  _activateTab(tabName) {
    const html = this.element;
    if (!html) return;

    // Update tab navigation
    const tabNav = html.querySelectorAll('.sheet-tabs[data-group="primary"] .item');
    tabNav.forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabName);
    });

    // Update tab content
    const tabContents = html.querySelectorAll('.tab[data-group="primary"]');
    tabContents.forEach((content) => {
      content.classList.toggle("active", content.dataset.tab === tabName);
    });
  }

  /**
   * Setup tab click listeners
   * @private
   */
  _setupTabListeners() {
    const html = this.element;
    if (!html) return;

    const tabs = html.querySelectorAll(".sheet-tabs .item[data-tab]");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        const tabId = tab.dataset.tab;
        const group = tab.closest("[data-group]")?.dataset.group || "primary";
        this._onChangeTab(group, tabId);
      });
    });
  }

  /**
   * Handle tab change
   * @param {string} group - Tab group name
   * @param {string} tabId - Tab ID to activate
   * @private
   */
  _onChangeTab(group, tabId) {
    this.tabGroups[group] = tabId;

    const html = this.element;
    if (!html) return;

    // Update tab navigation
    const tabNav = html.querySelectorAll(`.sheet-tabs[data-group="${group}"] .item`);
    tabNav.forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === tabId);
    });

    // Update tab content
    const tabContents = html.querySelectorAll(`.tab[data-group="${group}"]`);
    tabContents.forEach((content) => {
      content.classList.toggle("active", content.dataset.tab === tabId);
    });
  }

  /**
   * Prepare type-specific data for the item sheet
   * @param {object} context
   * @private
   */
  _prepareTypeSpecificData(context) {
    // Convert effects Collection to array for Handlebars iteration
    context.effects = Array.from(this.item.effects).map(effect => ({
      id: effect.id,
      name: effect.name,
      img: effect.img,
      disabled: effect.disabled,
    }));

    switch (this.item.type) {
      case "specialManeuver":
        this._prepareSpecialManeuverData(context);
        break;
      case "attribute":
        context.attributeCategories = CONFIG.NARUTO_RPG.attributeCategories;
        break;
      case "ability":
        context.abilityCategories = CONFIG.NARUTO_RPG.abilityCategories;
        break;
      case "technique":
      case "background":
      case "fightingStyle":
      case "division":
        break;
      case "weapon":
        this._prepareWeaponData(context);
        break;
    }
  }

  /**
   * Prepare data specific to Weapon items
   * @param {object} context
   * @private
   */
  _prepareWeaponData(context) {
    // Get weapon techniques (isWeaponTechnique = true) - use sourceId for portability
    context.weaponTechniques = game.items
      .filter((i) => i.type === "technique" && i.system.isWeaponTechnique)
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Prepare data specific to Special Maneuver items
   * @param {object} context
   * @private
   */
  _prepareSpecialManeuverData(context) {
    // Get all world items by type
    const worldItems = game.items;

    // Techniques for category dropdown
    context.worldTechniques = worldItems
      .filter((i) => i.type === "technique")
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Fighting styles for stylePowerPointCosts
    context.worldStyles = worldItems
      .filter((i) => i.type === "fightingStyle")
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Backgrounds for backgroundPowerPointCosts
    context.worldBackgrounds = worldItems
      .filter((i) => i.type === "background")
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // All traits for override dropdowns (attributes, abilities, techniques, backgrounds)
    context.worldTraits = worldItems
      .filter((i) => ["attribute", "ability", "technique", "background"].includes(i.type))
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name, type: i.type }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Special maneuvers for prerequisites
    context.worldManeuvers = worldItems
      .filter((i) => i.type === "specialManeuver")
      .map((i) => ({ id: i.system.sourceId || i.id, name: i.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Parse current stylePowerPointCosts and backgroundPowerPointCosts for display
    const styleCosts = context.systemData.stylePowerPointCosts || {};
    context.styleCostEntries = Object.entries(styleCosts).map(([styleId, cost]) => {
      const style = context.worldStyles.find((s) => s.id === styleId);
      return { id: styleId, name: style?.name || styleId, cost };
    });

    const bgCosts = context.systemData.backgroundPowerPointCosts || {};
    context.backgroundCostEntries = Object.entries(bgCosts).map(([bgId, cost]) => {
      const bg = context.worldBackgrounds.find((b) => b.id === bgId);
      return { id: bgId, name: bg?.name || bgId, cost };
    });

    // Parse prerequisites for display
    const prereqs = context.systemData.prerequisites || [];
    context.prerequisiteEntries = prereqs.map((prereq) => {
      if (prereq.type === "maneuver") {
        const maneuver = context.worldManeuvers.find((m) => m.id === prereq.id);
        return { ...prereq, name: maneuver?.name || prereq.id };
      } else {
        const trait = context.worldTraits.find((t) => t.id === prereq.id);
        return { ...prereq, name: trait?.name || prereq.id };
      }
    });
  }

  /**
   * Create a new active effect
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onEffectCreate(event, target) {
    event.preventDefault();
    const effectData = {
      name: this.item.name,
      img: "icons/svg/aura.svg",
      origin: this.item.uuid,
      transfer: true,
    };
    await this.item.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }

  /**
   * Edit an active effect
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onEffectEdit(event, target) {
    event.preventDefault();
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    const effect = this.item.effects.get(effectId);
    effect?.sheet.render(true);
  }

  /**
   * Delete an active effect
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onEffectDelete(event, target) {
    event.preventDefault();
    const effectId = target.closest("[data-effect-id]")?.dataset.effectId;
    await this.item.deleteEmbeddedDocuments("ActiveEffect", [effectId]);
  }

  /**
   * Add a prerequisite
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onPrerequisiteAdd(event, target) {
    event.preventDefault();
    const form = this.form;
    const typeSelect = form.querySelector('select[name="newPrereqType"]');
    const idSelect = form.querySelector('select[name="newPrereqId"]');
    const valueInput = form.querySelector('input[name="newPrereqValue"]');

    const type = typeSelect?.value;
    const id = idSelect?.value;
    const value = parseInt(valueInput?.value) || 1;

    if (!type || !id) return;

    const prerequisites = [...(this.document.system.prerequisites || [])];
    if (prerequisites.some((p) => p.type === type && p.id === id)) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Errors.prerequisiteExists"));
      return;
    }

    prerequisites.push({ type, id, value });
    await this.document.update({ "system.prerequisites": prerequisites });
  }

  /**
   * Delete a prerequisite
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onPrerequisiteDelete(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const prerequisites = [...(this.document.system.prerequisites || [])];
    prerequisites.splice(index, 1);
    await this.document.update({ "system.prerequisites": prerequisites });
  }

  /**
   * Add a style power point cost
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onStyleCostAdd(event, target) {
    event.preventDefault();
    const form = this.form;
    const styleSelect = form.querySelector('select[name="newStyleId"]');
    const costInput = form.querySelector('input[name="newStyleCost"]');

    const styleId = styleSelect?.value;
    const cost = parseInt(costInput?.value) ?? 0;

    if (!styleId) return;

    const styleCosts = { ...(this.document.system.stylePowerPointCosts || {}) };
    styleCosts[styleId] = cost;
    await this.document.update({ "system.stylePowerPointCosts": styleCosts });
  }

  /**
   * Delete a style power point cost
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onStyleCostDelete(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const entries = Object.entries(this.document.system.stylePowerPointCosts || {});
    const [keyToDelete] = entries[index] || [];
    if (!keyToDelete) return;
    
    // Use Foundry's deletion syntax
    await this.document.update({ [`system.stylePowerPointCosts.-=${keyToDelete}`]: null });
  }

  /**
   * Add a background power point cost
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onBackgroundCostAdd(event, target) {
    event.preventDefault();
    const form = this.form;
    const bgSelect = form.querySelector('select[name="newBackgroundId"]');
    const costInput = form.querySelector('input[name="newBackgroundCost"]');

    const bgId = bgSelect?.value;
    const cost = parseInt(costInput?.value) ?? 0;

    if (!bgId) return;

    const bgCosts = { ...(this.document.system.backgroundPowerPointCosts || {}) };
    bgCosts[bgId] = cost;
    await this.document.update({ "system.backgroundPowerPointCosts": bgCosts });
  }

  /**
   * Delete a background power point cost
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onBackgroundCostDelete(event, target) {
    event.preventDefault();
    const index = parseInt(target.dataset.index);
    const entries = Object.entries(this.document.system.backgroundPowerPointCosts || {});
    const [keyToDelete] = entries[index] || [];
    if (!keyToDelete) return;
    
    // Use Foundry's deletion syntax
    await this.document.update({ [`system.backgroundPowerPointCosts.-=${keyToDelete}`]: null });
  }

  /**
   * Handle editing the item image
   * @this {NarutoRpgItemSheet}
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static async _onEditImage(event, target) {
    const field = target.dataset.field || "img";
    const current = foundry.utils.getProperty(this.document, field);
    const fp = new foundry.applications.apps.FilePicker({
      type: "image",
      current: current,
      callback: (path) => this.document.update({ [field]: path }),
    });
    fp.render(true);
  }
}
