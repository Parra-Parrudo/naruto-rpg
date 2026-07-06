/**
 * Naruto RPG - Criador de Personagens Guiado
 * Assistente de criacao seguindo o Capitulo 3 do livro basico:
 * Atributos 7/5/3 (base 1, max 5) | Habilidades 9/7/4 (max 3) | Tecnicas 9 (max 3)
 * Antecedentes 5 | Jutsus 7 Pontos de Jutsu | Renome 3 | Pontos de Bonus 15
 * Excedentes das etapas consomem Pontos de Bonus automaticamente (tabela do livro).
 * Requer o Conteudo Oficial importado no mundo.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const BONUS_COST = { attrs: 5, abils: 2, techs: 5, bgs: 1, jutsuPoint: 4, chakra: 1, willpower: 1, health: 3, tempRenown: 1 };
const POOLS = { attrs: { primary: 7, secondary: 5, tertiary: 3 }, abils: { primary: 9, secondary: 7, tertiary: 4 } };
const TECH_POOL = 9, BG_POOL = 5, JUTSU_POOL = 7, BONUS_POOL = 15, RENOWN_POOL = 3;
const CAPS = { attrs: 5, abilsCreation: 3, abilsMax: 5, techsCreation: 3, techsMax: 5, bgs: 5 };
const ATTR_CATS = ["physical", "social", "mental"];
const ABIL_CATS = ["talents", "skills", "knowledge"];
const BASICS_BY_TECH = { jab: "punch", strong: "punch", fierce: "punch", short: "kick", forward: "kick",
  roundhouse: "kick", block: "block", jab_slash: "armas_brancas", strong_slash: "armas_brancas",
  fierce_slash: "armas_brancas", arremesso_basico: "arremesso" };

export class NarutoRpgChargen extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.cg = {
      step: 0,
      profile: { name: "", concept: "", vila: "", time: "", cla: "", nindo: "" },
      styleId: null,
      prio: { attrs: { physical: "primary", social: "secondary", mental: "tertiary" },
              abils: { talents: "primary", skills: "secondary", knowledge: "tertiary" } },
      attrs: {}, abils: {}, techs: {}, bgs: {},
      jutsus: [],
      renown: { honor: 2, glory: 1 },
      buys: { jutsuPoints: 0, chakra: 0, willpower: 0, health: 0, tempHonor: 0, tempGlory: 0 },
      filter: "",
    };
    this._loadWorldData();
  }

  static DEFAULT_OPTIONS = {
    id: "nrpg-chargen",
    classes: ["naruto-rpg", "nrpg-chargen"],
    window: { title: "NARUTO_RPG.Chargen.title", icon: "fas fa-user-ninja", resizable: true },
    position: { width: 860, height: 720 },
    actions: {
      nextStep: NarutoRpgChargen._onNext,
      prevStep: NarutoRpgChargen._onPrev,
      adjust: NarutoRpgChargen._onAdjust,
      pickStyle: NarutoRpgChargen._onPickStyle,
      toggleJutsu: NarutoRpgChargen._onToggleJutsu,
      finish: NarutoRpgChargen._onFinish,
    },
  };

  static PARTS = { body: { template: "systems/naruto-rpg/templates/apps/chargen.hbs" } };

  /* ------------------------- dados do mundo ------------------------- */
  _loadWorldData() {
    const byType = (t) => game.items.filter((i) => i.type === t && i.system.sourceId);
    this.attributes = byType("attribute");
    this.abilities = byType("ability");
    this.techniques = byType("technique");
    this.backgrounds = byType("background");
    this.styles = byType("fightingStyle");
    this.maneuvers = byType("specialManeuver").filter((m) => !(m.system.sourceId in BASICS_BY_TECH) && m.system.sourceId !== "movement");
    this.ready = this.attributes.length >= 9 && this.techniques.length >= 6 && this.styles.length >= 1;
  }

  _bySource(list, id) { return list.find((i) => i.system.sourceId === id); }

  /* ------------------------- motor de pontos ------------------------- */
  _traitValue(pool, id) {
    const base = pool === "attrs" ? 1 : 0;
    return base + (this.cg[pool][id] ?? 0);
  }

  _catOf(pool, id) {
    const list = pool === "attrs" ? this.attributes : this.abilities;
    return this._bySource(list, id)?.system.category;
  }

  _spentByCategory(pool) {
    const spent = {};
    for (const [id, n] of Object.entries(this.cg[pool])) {
      const cat = this._catOf(pool, id);
      spent[cat] = (spent[cat] ?? 0) + n;
    }
    return spent;
  }

  calc() {
    const s = this.cg;
    const c = { bonusSpent: 0, cat: {} };
    for (const pool of ["attrs", "abils"]) {
      const spent = this._spentByCategory(pool);
      const cats = pool === "attrs" ? ATTR_CATS : ABIL_CATS;
      for (const cat of cats) {
        const limit = POOLS[pool][s.prio[pool][cat]];
        const used = spent[cat] ?? 0;
        const over = Math.max(0, used - limit);
        c.cat[`${pool}.${cat}`] = { used: Math.min(used, limit), limit, over };
        c.bonusSpent += over * BONUS_COST[pool];
      }
    }
    for (const [pool, limit] of [["techs", TECH_POOL], ["bgs", BG_POOL]]) {
      const used = Object.values(s[pool]).reduce((a, b) => a + b, 0);
      const over = Math.max(0, used - limit);
      c.cat[pool] = { used: Math.min(used, limit), limit, over };
      c.bonusSpent += over * BONUS_COST[pool];
    }
    const pjLimit = JUTSU_POOL + s.buys.jutsuPoints;
    const pjUsed = s.jutsus.reduce((a, j) => a + (this._jutsuCost(j) ?? 0), 0);
    c.jutsu = { used: pjUsed, limit: pjLimit, over: Math.max(0, pjUsed - pjLimit) };
    c.bonusSpent += s.buys.jutsuPoints * BONUS_COST.jutsuPoint;
    c.bonusSpent += s.buys.chakra * BONUS_COST.chakra + s.buys.willpower * BONUS_COST.willpower +
      s.buys.health * BONUS_COST.health + (s.buys.tempHonor + s.buys.tempGlory) * BONUS_COST.tempRenown;
    c.bonusLeft = BONUS_POOL - c.bonusSpent;
    c.renownSpent = s.renown.honor + s.renown.glory;
    return c;
  }

  _jutsuCost(id) {
    const m = this._bySource(this.maneuvers, id);
    if (!m) return null;
    const sc = m.system.stylePowerPointCosts ?? {};
    if (this.cg.styleId && sc[this.cg.styleId] != null) return sc[this.cg.styleId];
    const d = m.system.defaultPowerPointCost ?? 0;
    return d > 0 ? d : null;
  }

  _checkPrereqs(m) {
    const missing = [];
    for (const p of m.system.prerequisites ?? []) {
      if (p.type === "maneuver" || p.requiredManeuverId) {
        const rid = p.requiredManeuverId ?? p.id;
        const okBasic = rid in BASICS_BY_TECH ? this._traitValue("techs", BASICS_BY_TECH[rid]) >= 1 : false;
        const okMove = rid === "movement";
        if (!this.cg.jutsus.includes(rid) && !okBasic && !okMove) {
          const req = this._bySource(this.maneuvers, rid);
          missing.push(req?.name ?? rid);
        }
      } else {
        const tid = p.id ?? p.traitId;
        const min = p.value ?? p.minimumValue ?? 1;
        let val = 0;
        if (this._bySource(this.attributes, tid)) val = this._traitValue("attrs", tid);
        else if (this._bySource(this.abilities, tid)) val = this._traitValue("abils", tid);
        else if (this._bySource(this.techniques, tid)) val = this._traitValue("techs", tid);
        else if (this._bySource(this.backgrounds, tid)) val = this._traitValue("bgs", tid);
        if (val < min) {
          const item = this._bySource([...this.attributes, ...this.abilities, ...this.techniques, ...this.backgrounds], tid);
          missing.push(`${item?.name ?? tid} ${min}`);
        }
      }
    }
    return missing;
  }

  /* ------------------------- contexto ------------------------- */
  async _prepareContext() {
    const s = this.cg;
    const c = this.calc();
    const L = (k) => game.i18n.localize(`NARUTO_RPG.Chargen.${k}`);
    const style = s.styleId ? this._bySource(this.styles, s.styleId) : null;

    const mkRows = (pool, list) => list.map((i) => ({
      id: i.system.sourceId, name: i.name, value: this._traitValue(pool, i.system.sourceId),
      pool, category: i.system.category,
    }));

    const prioOptions = ["primary", "secondary", "tertiary"].map((p) => ({ key: p, label: L(`prio_${p}`) }));

    const catLabel = (key) => game.i18n.localize(CONFIG.NARUTO_RPG.maneuverCategories?.[key] ?? "NARUTO_RPG.Maneuver.Categories.other");
    const filter = (s.filter ?? "").toLowerCase();
    const jutsuRows = this.maneuvers
      .filter((m) => !filter || m.name.toLowerCase().includes(filter))
      .map((m) => {
        const id = m.system.sourceId;
        const cost = this._jutsuCost(id);
        const missing = this._checkPrereqs(m);
        return {
          id, name: m.name, category: catLabel(m.system.category), cost,
          unavailable: cost === null, missing, missingText: missing.join(", "),
          selected: s.jutsus.includes(id),
          ok: cost !== null && missing.length === 0,
        };
      })
      .sort((a, b) => (b.selected - a.selected) || (b.ok - a.ok) || a.name.localeCompare(b.name))
      .slice(0, 80);

    return {
      state: s, calc: c, ready: this.ready,
      steps: [0,1,2,3,4,5].map((i) => ({ i, label: L(`step${i}`), active: i === s.step, done: i < s.step })),
      isStep: Object.fromEntries([0,1,2,3,4,5].map((i) => [i, s.step === i])),
      styles: this.styles.map((st) => ({
        id: st.system.sourceId, name: st.name, chi: st.system.initialChi, wp: st.system.initialWillpower,
        selected: st.system.sourceId === s.styleId,
      })),
      attrsByCat: ATTR_CATS.map((cat) => ({
        cat, label: game.i18n.localize(`NARUTO_RPG.Categories.${cat}`),
        prio: s.prio.attrs[cat], prioKey: `attrs.${cat}`, prioOptions:
          prioOptions.map((o) => ({ ...o, selected: o.key === s.prio.attrs[cat] })),
        pool: c.cat[`attrs.${cat}`],
        rows: mkRows("attrs", this.attributes.filter((a) => a.system.category === cat)),
      })),
      abilsByCat: ABIL_CATS.map((cat) => ({
        cat, label: game.i18n.localize(`NARUTO_RPG.Categories.${cat}`),
        prio: s.prio.abils[cat], prioKey: `abils.${cat}`, prioOptions:
          prioOptions.map((o) => ({ ...o, selected: o.key === s.prio.abils[cat] })),
        pool: c.cat[`abils.${cat}`],
        rows: mkRows("abils", this.abilities.filter((a) => a.system.category === cat)),
      })),
      techRows: mkRows("techs", this.techniques),
      bgRows: mkRows("bgs", this.backgrounds),
      jutsuRows,
      style,
      finalChakra: (style?.system.initialChi ?? 0) + s.buys.chakra,
      finalWillpower: (style?.system.initialWillpower ?? 0) + s.buys.willpower,
      finalHealth: 10 + s.buys.health,
      canFinish: this.ready && c.bonusLeft >= 0 && c.jutsu.over === 0 && c.renownSpent <= RENOWN_POOL && !!s.profile.name && !!s.styleId,
      isLastStep: s.step === 5,
      isFirstStep: s.step === 0,
    };
  }

  /* ------------------------- listeners ------------------------- */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("change", (ev) => {
        const path = ev.currentTarget.dataset.field;
        foundry.utils.setProperty(this.cg, path, ev.currentTarget.value);
      });
    });
    this.element.querySelectorAll("[data-prio]").forEach((el) => {
      el.addEventListener("change", (ev) => {
        const [pool, cat] = ev.currentTarget.dataset.prio.split(".");
        const newP = ev.currentTarget.value;
        const prio = this.cg.prio[pool];
        const other = Object.keys(prio).find((k) => k !== cat && prio[k] === newP);
        if (other) prio[other] = prio[cat];
        prio[cat] = newP;
        this.render();
      });
    });
    const search = this.element.querySelector(".nrpg-jutsu-search");
    if (search) {
      search.addEventListener("input", (ev) => {
        this.cg.filter = ev.currentTarget.value;
        clearTimeout(this._ft);
        this._ft = setTimeout(() => this.render(), 250);
      });
    }
  }

  static _onNext() { if (this.cg.step < 5) { this.cg.step++; this.render(); } }
  static _onPrev() { if (this.cg.step > 0) { this.cg.step--; this.render(); } }

  static _onAdjust(event, target) {
    const { pool, id } = target.dataset;
    const delta = Number(target.dataset.delta);
    const s = this.cg;
    if (pool === "renown") {
      const next = Math.max(0, (s.renown[id] ?? 0) + delta);
      const otherKey = id === "honor" ? "glory" : "honor";
      if (next + s.renown[otherKey] <= RENOWN_POOL) s.renown[id] = next;
    } else if (pool === "buys") {
      s.buys[id] = Math.max(0, (s.buys[id] ?? 0) + delta);
    } else {
      const cur = s[pool][id] ?? 0;
      const val = this._traitValue(pool, id);
      const caps = { attrs: CAPS.attrs, abils: CAPS.abilsMax, techs: CAPS.techsMax, bgs: CAPS.bgs };
      if (delta > 0 && val >= caps[pool]) return;
      s[pool][id] = Math.max(0, cur + delta);
    }
    this.render();
  }

  static _onPickStyle(event, target) {
    this.cg.styleId = target.dataset.styleId;
    this.render();
  }

  static _onToggleJutsu(event, target) {
    const id = target.dataset.jutsuId;
    const s = this.cg;
    if (s.jutsus.includes(id)) {
      s.jutsus = s.jutsus.filter((j) => j !== id);
      let changed = true;
      while (changed) {
        changed = false;
        for (const jid of [...s.jutsus]) {
          const m = this._bySource(this.maneuvers, jid);
          if (m && this._checkPrereqs(m).length) { s.jutsus = s.jutsus.filter((x) => x !== jid); changed = true; }
        }
      }
    } else {
      const m = this._bySource(this.maneuvers, id);
      if (!m || this._checkPrereqs(m).length || this._jutsuCost(id) === null) return;
      s.jutsus.push(id);
    }
    this.render();
  }

  static async _onFinish() {
    const s = this.cg;
    const c = this.calc();
    if (c.bonusLeft < 0 || c.jutsu.over > 0) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Chargen.overBudget")); return;
    }
    if (!s.profile.name || !s.styleId) {
      ui.notifications.warn(game.i18n.localize("NARUTO_RPG.Chargen.missingBasics")); return;
    }
    const style = this._bySource(this.styles, s.styleId);
    const items = [];
    const pushTrait = (list, pool) => {
      for (const i of list) {
        const data = i.toObject();
        data.system.value = this._traitValue(pool, i.system.sourceId);
        if (pool !== "bgs" || data.system.value > 0) items.push(data);
      }
    };
    pushTrait(this.attributes, "attrs");
    pushTrait(this.abilities, "abils");
    pushTrait(this.techniques, "techs");
    pushTrait(this.backgrounds, "bgs");
    items.push(style.toObject());
    for (const jid of s.jutsus) {
      const m = this._bySource(this.maneuvers, jid);
      if (m) items.push(m.toObject());
    }
    const allBasics = game.items.filter((i) => i.type === "specialManeuver" &&
      (i.system.sourceId in BASICS_BY_TECH || i.system.sourceId === "movement"));
    for (const b of allBasics) {
      const sid = b.system.sourceId;
      if (sid === "movement" || this._traitValue("techs", BASICS_BY_TECH[sid]) >= 1) items.push(b.toObject());
    }
    const chi = (style.system.initialChi ?? 0) + s.buys.chakra;
    const wp = (style.system.initialWillpower ?? 0) + s.buys.willpower;
    const hp = 10 + s.buys.health;
    try {
      const actor = await Actor.create({
        name: s.profile.name, type: "fighter",
        ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
        system: {
          profile: { characterName: s.profile.name, chronicleName: "", schoolName: s.profile.vila,
            fightingTeam: s.profile.time, stable: s.profile.cla, concept: s.profile.concept, signature: s.profile.nindo },
          resources: { health: { value: hp, max: hp }, chi: { value: chi, max: chi }, willpower: { value: wp, max: wp } },
          renown: { honor: { permanent: s.renown.honor, temporary: s.buys.tempHonor },
                    glory: { permanent: s.renown.glory, temporary: s.buys.tempGlory } },
          experience: { total: 0, spent: 0 },
        },
        items,
      });
      ui.notifications.info(game.i18n.format("NARUTO_RPG.Chargen.created", { name: actor.name }));
      this.close();
      actor.sheet.render(true);
    } catch (e) {
      console.error("Naruto RPG | Chargen:", e);
      ui.notifications.error(game.i18n.localize("NARUTO_RPG.Chargen.createFailed"));
    }
  }
}

export async function openChargen() {
  let app;
  try {
    app = new NarutoRpgChargen();
  } catch (err) {
    console.error("Naruto RPG | Falha ao iniciar o Criador de Personagens:", err);
    ui.notifications.error(`Naruto RPG | Erro ao abrir o Criador: ${err.message}`);
    return;
  }

  if (!app.ready) {
    const counts = { atributos: app.attributes?.length ?? 0, tecnicas: app.techniques?.length ?? 0, estilos: app.styles?.length ?? 0 };
    console.warn("Naruto RPG | Criador indisponivel - Conteudo Oficial insuficiente no mundo.", counts);
    ui.notifications.warn(
      `Naruto RPG | Importe o Conteudo Oficial antes de criar personagens. ` +
      `Encontrado: ${counts.atributos} atributos (min 9), ${counts.tecnicas} tecnicas (min 6), ${counts.estilos} estilos (min 1).`,
      { permanent: true }
    );
    return;
  }

  // render() e assincrono: precisamos aguardar para capturar erros de _prepareContext/template
  try {
    await app.render({ force: true });
  } catch (err) {
    console.error("Naruto RPG | Falha ao renderizar o Criador de Personagens:", err);
    ui.notifications.error(`Naruto RPG | Erro ao renderizar o Criador: ${err.message}`, { permanent: true });
  }
}
