/**
 * Naruto RPG - Criador de Personagens Guiado
 * Cap. 3 do livro base. Distribuicao NORMAL travada nos pools; os 15 Pontos de Bonus
 * sao gastos numa ETAPA DEDICADA (modelo do app NarutoRPG_CharacterCreator).
 * Pools: Atributos 7/5/3 (base 1) | Habilidades 9/7/4 | Tecnicas 9 | Antecedentes 5 | Jutsus 7 PJ.
 * Custos de Bonus: atributo 5, habilidade 2, tecnica 5, antecedente 1, jutsu (PJ x4),
 * chakra 1, FV 1, saude 3, renome temp. 1.
 * Requer o Conteudo Oficial importado no mundo.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
import { CLANS, CLAN_BY_NAME, clanRequiredFor } from "../config/clans.mjs";

const BONUS_COST = { attrs: 5, abils: 2, techs: 5, bgs: 1, chakra: 1, willpower: 1, health: 3, tempRenown: 1 };
const JUTSU_BONUS_MULT = 4; // jutsu comprado com bonus custa (PJ x4)
const POOLS = { attrs: { primary: 7, secondary: 5, tertiary: 3 }, abils: { primary: 9, secondary: 7, tertiary: 4 } };
const TECH_POOL = 9, BG_POOL = 5, JUTSU_POOL = 7, BONUS_POOL = 15, RENOWN_POOL = 3;
const CAP_BASE = { attrs: 5, abils: 3, techs: 3, bgs: 5 };   // teto na distribuicao normal
const CAP_TOTAL = { attrs: 5, abils: 5, techs: 8, bgs: 5 };  // teto com bonus somado
const SPECIAL_BG = new Set(["jinchuuriki", "selo_amaldicoado"]); // teto 3 na criacao
const RES_COST = { chakra: 1, willpower: 1, health: 3 };
const RES_CAP = { chakra: 20, willpower: 10, health: 20 };
const ATTR_CATS = ["physical", "social", "mental"];
const ABIL_CATS = ["talents", "skills", "knowledge"];
const BASICS_BY_TECH = { jab: "punch", strong: "punch", fierce: "punch", short: "kick", forward: "kick",
  roundhouse: "kick", block: "block", jab_slash: "armas_brancas", strong_slash: "armas_brancas",
  fierce_slash: "armas_brancas", arremesso_basico: "arremesso" };
const LAST_STEP = 6;

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
      bonus: { attrs: {}, abils: {}, techs: {}, bgs: {}, jutsus: [],
               chakra: 0, willpower: 0, health: 0, tempHonor: 0, tempGlory: 0 },
      filter: "", bfilter: "",
    };
    this._loadWorldData();
  }

  static DEFAULT_OPTIONS = {
    id: "nrpg-chargen",
    classes: ["naruto-rpg", "nrpg-chargen"],
    window: { title: "NARUTO_RPG.Chargen.title", icon: "fas fa-user-ninja", resizable: true },
    position: { width: 880, height: 740 },
    actions: {
      nextStep: NarutoRpgChargen._onNext,
      prevStep: NarutoRpgChargen._onPrev,
      adjust: NarutoRpgChargen._onAdjust,
      adjustBonus: NarutoRpgChargen._onAdjustBonus,
      pickStyle: NarutoRpgChargen._onPickStyle,
      toggleJutsu: NarutoRpgChargen._onToggleJutsu,
      toggleBonusJutsu: NarutoRpgChargen._onToggleBonusJutsu,
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

  /* ------------------------- valores base/bonus/total ------------------------- */
  _capBase(pool, id) { return (pool === "bgs" && SPECIAL_BG.has(id)) ? 3 : CAP_BASE[pool]; }
  _capTotal(pool, id) { return (pool === "bgs" && SPECIAL_BG.has(id)) ? 3 : CAP_TOTAL[pool]; }
  _base(pool, id) { return (pool === "attrs" ? 1 : 0) + (this.cg[pool][id] ?? 0); }
  _bonusOf(pool, id) { return this.cg.bonus[pool][id] ?? 0; }
  _total(pool, id) { return this._base(pool, id) + this._bonusOf(pool, id); }

  _catOf(pool, id) {
    const list = pool === "attrs" ? this.attributes : this.abilities;
    return this._bySource(list, id)?.system.category;
  }

  _finalChakra() { const st = this._bySource(this.styles, this.cg.styleId); return (st?.system.initialChi ?? 0) + this.cg.bonus.chakra; }
  _finalWillpower() { const st = this._bySource(this.styles, this.cg.styleId); return (st?.system.initialWillpower ?? 0) + this.cg.bonus.willpower; }
  _finalHealth() { return 10 + this.cg.bonus.health; }

  /* ------------------------- motor de pontos ------------------------- */
  calc() {
    const s = this.cg;
    const c = { cat: {}, bonusSpent: 0 };

    // pools de atributos/habilidades por categoria (apenas incrementos base)
    for (const pool of ["attrs", "abils"]) {
      const cats = pool === "attrs" ? ATTR_CATS : ABIL_CATS;
      for (const cat of cats) {
        const limit = POOLS[pool][s.prio[pool][cat]];
        let used = 0;
        for (const [id, n] of Object.entries(s[pool])) if (this._catOf(pool, id) === cat) used += n;
        c.cat[`${pool}.${cat}`] = { used, limit };
      }
    }
    // tecnicas / antecedentes (pool unico)
    for (const [pool, limit] of [["techs", TECH_POOL], ["bgs", BG_POOL]]) {
      const used = Object.values(s[pool]).reduce((a, b) => a + b, 0);
      c.cat[pool] = { used, limit };
    }
    // Pontos de Jutsu (pool fixo 7)
    const pjUsed = s.jutsus.reduce((a, j) => a + (this._jutsuCost(j) ?? 0), 0);
    c.jutsu = { used: pjUsed, limit: JUTSU_POOL, over: Math.max(0, pjUsed - JUTSU_POOL) };

    // Pontos de Bonus gastos
    let bs = 0;
    for (const n of Object.values(s.bonus.attrs)) bs += n * BONUS_COST.attrs;
    for (const n of Object.values(s.bonus.abils)) bs += n * BONUS_COST.abils;
    for (const n of Object.values(s.bonus.techs)) bs += n * BONUS_COST.techs;
    for (const n of Object.values(s.bonus.bgs)) bs += n * BONUS_COST.bgs;
    for (const j of s.bonus.jutsus) bs += (this._jutsuCost(j) ?? 0) * JUTSU_BONUS_MULT;
    bs += s.bonus.chakra * BONUS_COST.chakra + s.bonus.willpower * BONUS_COST.willpower +
          s.bonus.health * BONUS_COST.health + (s.bonus.tempHonor + s.bonus.tempGlory) * BONUS_COST.tempRenown;
    c.bonusSpent = bs;
    c.bonusLeft = BONUS_POOL - bs;
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
    const s = this.cg;
    const has = (id) => s.jutsus.includes(id) || s.bonus.jutsus.includes(id);
    const missing = [];
    for (const p of m.system.prerequisites ?? []) {
      if (p.type === "maneuver" || p.requiredManeuverId) {
        const rid = p.requiredManeuverId ?? p.id;
        const okBasic = rid in BASICS_BY_TECH ? this._total("techs", BASICS_BY_TECH[rid]) >= 1 : false;
        const okMove = rid === "movement";
        if (!has(rid) && !okBasic && !okMove) {
          const req = this._bySource(this.maneuvers, rid);
          missing.push(req?.name ?? rid);
        }
      } else {
        const tid = p.id ?? p.traitId;
        const min = p.value ?? p.minimumValue ?? 1;
        let val = 0;
        if (this._bySource(this.attributes, tid)) val = this._total("attrs", tid);
        else if (this._bySource(this.abilities, tid)) val = this._total("abils", tid);
        else if (this._bySource(this.techniques, tid)) val = this._total("techs", tid);
        else if (this._bySource(this.backgrounds, tid)) val = this._total("bgs", tid);
        if (val < min) {
          const item = this._bySource([...this.attributes, ...this.abilities, ...this.techniques, ...this.backgrounds], tid);
          missing.push(`${item?.name ?? tid} ${min}`);
        }
      }
    }
    // Gate de cla: jutsus exclusivos exigem o cla correspondente selecionado
    const reqClan = clanRequiredFor(m.system.sourceId);
    if (reqClan && s.profile.cla !== reqClan) missing.push(`Cla ${reqClan}`);
    return missing;
  }

  /* ------------------------- contexto ------------------------- */
  async _prepareContext() {
    const s = this.cg;
    const c = this.calc();
    const L = (k) => game.i18n.localize(`NARUTO_RPG.Chargen.${k}`);
    const style = s.styleId ? this._bySource(this.styles, s.styleId) : null;
    const claName = s.profile.cla || "";
    const selectedClan = CLAN_BY_NAME[claName] || null;
    const clanOpt = (c) => ({ name: c.name, emoji: c.emoji, selected: c.name === claName });
    const clanBase = CLANS.filter((c) => !c.expansion).map(clanOpt);
    const clanExp = CLANS.filter((c) => c.expansion).map(clanOpt);

    const prioOptions = ["primary", "secondary", "tertiary"].map((p) => ({ key: p, label: L(`prio_${p}`) }));
    const catLabel = (key) => game.i18n.localize(CONFIG.NARUTO_RPG.maneuverCategories?.[key] ?? "NARUTO_RPG.Maneuver.Categories.other");

    // linhas da distribuicao normal (mostram o valor BASE)
    const baseRows = (pool, list) => list.map((i) => ({
      id: i.system.sourceId, name: i.name, value: this._base(pool, i.system.sourceId), pool,
    }));
    // linhas da etapa de bonus (mostram o TOTAL e o quanto veio de bonus)
    const bonusRows = (pool, list) => list.map((i) => {
      const id = i.system.sourceId;
      return { id, name: i.name, pool, total: this._total(pool, id), bonus: this._bonusOf(pool, id),
        canInc: this._total(pool, id) < this._capTotal(pool, id) && c.bonusLeft >= BONUS_COST[pool],
        canDec: this._bonusOf(pool, id) > 0 };
    });

    // catalogo de jutsus (pool) e jutsus de bonus
    const buildJutsuRows = (selectedList, filterText, isBonus) => this.maneuvers
      .filter((m) => { const f = (filterText ?? "").toLowerCase(); return !f || m.name.toLowerCase().includes(f); })
      .map((m) => {
        const id = m.system.sourceId;
        const cost = this._jutsuCost(id);
        const miss = this._checkPrereqs(m);
        const inOther = isBonus ? s.jutsus.includes(id) : s.bonus.jutsus.includes(id);
        const selected = selectedList.includes(id);
        const payCost = isBonus ? (cost != null ? cost * JUTSU_BONUS_MULT : null) : cost;
        const affordable = isBonus ? (payCost != null && c.bonusLeft >= payCost) : true;
        return { id, name: m.name, category: catLabel(m.system.category), cost, payCost,
          unavailable: cost === null, missing: miss, missingText: miss.join(", "),
          selected, inOther, ok: cost !== null && miss.length === 0 && !inOther && affordable };
      })
      .sort((a, b) => (b.selected - a.selected) || (b.ok - a.ok) || a.name.localeCompare(b.name))
      .slice(0, 80);

    return {
      ready: this.ready,
      state: s, calc: c,
      steps: [0,1,2,3,4,5,6].map((i) => ({ i, label: (i === 6 ? L("step6") : L(`step${i}`)), active: i === s.step, done: i < s.step })),
      isStep: Object.fromEntries([0,1,2,3,4,5,6].map((i) => [i, s.step === i])),
      styles: this.styles.map((st) => ({ id: st.system.sourceId, name: st.name, chi: st.system.initialChi, wp: st.system.initialWillpower, selected: st.system.sourceId === s.styleId })),
      clanBase, clanExp, selectedClan,
      styleDesc: style?.system?.description ?? "",
      attrsByCat: ATTR_CATS.map((cat) => ({
        cat, label: game.i18n.localize(`NARUTO_RPG.Categories.${cat}`), prioKey: `attrs.${cat}`,
        prioOptions: prioOptions.map((o) => ({ ...o, selected: o.key === s.prio.attrs[cat] })),
        pool: c.cat[`attrs.${cat}`], rows: baseRows("attrs", this.attributes.filter((a) => a.system.category === cat)),
      })),
      abilsByCat: ABIL_CATS.map((cat) => ({
        cat, label: game.i18n.localize(`NARUTO_RPG.Categories.${cat}`), prioKey: `abils.${cat}`,
        prioOptions: prioOptions.map((o) => ({ ...o, selected: o.key === s.prio.abils[cat] })),
        pool: c.cat[`abils.${cat}`], rows: baseRows("abils", this.abilities.filter((a) => a.system.category === cat)),
      })),
      techRows: baseRows("techs", this.techniques),
      bgRows: baseRows("bgs", this.backgrounds),
      jutsuRows: buildJutsuRows(s.jutsus, s.filter, false),
      // bonus step data
      bonusAttrs: bonusRows("attrs", this.attributes),
      bonusAbils: bonusRows("abils", this.abilities),
      bonusTechs: bonusRows("techs", this.techniques),
      bonusBgs: bonusRows("bgs", this.backgrounds),
      bonusJutsuRows: buildJutsuRows(s.bonus.jutsus, s.bfilter, true),
      resChakra: this._finalChakra(), resWillpower: this._finalWillpower(), resHealth: this._finalHealth(),
      style,
      finalChakra: this._finalChakra(), finalWillpower: this._finalWillpower(), finalHealth: this._finalHealth(),
      canFinish: this.ready && c.bonusLeft >= 0 && c.jutsu.over === 0 && c.renownSpent <= RENOWN_POOL && !!s.profile.name && !!s.styleId,
      isLastStep: s.step === LAST_STEP,
      isFirstStep: s.step === 0,
    };
  }

  /* ------------------------- listeners ------------------------- */
  _onRender(context, options) {
    super._onRender?.(context, options);
    this.element.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("change", (ev) => {
        foundry.utils.setProperty(this.cg, ev.currentTarget.dataset.field, ev.currentTarget.value);
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
    const bindSearch = (sel, key) => {
      const el = this.element.querySelector(sel);
      if (!el) return;
      el.addEventListener("input", (ev) => {
        this.cg[key] = ev.currentTarget.value;
        clearTimeout(this._ft);
        this._ft = setTimeout(() => this.render(), 250);
      });
    };
    bindSearch(".nrpg-jutsu-search", "filter");
    bindSearch(".nrpg-bjutsu-search", "bfilter");
    const claSel = this.element.querySelector("[data-cla-select]");
    if (claSel) claSel.addEventListener("change", (ev) => { this.cg.profile.cla = ev.currentTarget.value; this.render(); });
  }

  static _onNext() { if (this.cg.step < LAST_STEP) { this.cg.step++; this.render(); } }
  static _onPrev() { if (this.cg.step > 0) { this.cg.step--; this.render(); } }

  /** distribuicao NORMAL (travada no pool) + renome */
  static _onAdjust(event, target) {
    const { pool, id } = target.dataset;
    const delta = Number(target.dataset.delta);
    const s = this.cg;
    if (pool === "renown") {
      const next = Math.max(0, (s.renown[id] ?? 0) + delta);
      const other = id === "honor" ? "glory" : "honor";
      if (next + s.renown[other] <= RENOWN_POOL) s.renown[id] = next;
      this.render();
      return;
    }
    const c = this.calc();
    if (delta > 0) {
      if (this._base(pool, id) >= this._capBase(pool, id)) return; // teto do trait
      const catKey = (pool === "attrs" || pool === "abils") ? `${pool}.${this._catOf(pool, id)}` : pool;
      const cc = c.cat[catKey];
      if (cc && cc.used >= cc.limit) return; // pool esgotado -> use Pontos de Bonus
      s[pool][id] = (s[pool][id] ?? 0) + 1;
    } else {
      s[pool][id] = Math.max(0, (s[pool][id] ?? 0) - 1);
    }
    this.render();
  }

  /** etapa de PONTOS DE BONUS (traits/recursos/renome temporario) */
  static _onAdjustBonus(event, target) {
    const { kind, pool, id } = target.dataset;
    const delta = Number(target.dataset.delta);
    const s = this.cg;
    const c = this.calc();
    if (kind === "trait") {
      if (delta > 0) {
        if (this._total(pool, id) >= this._capTotal(pool, id)) return;
        if (c.bonusLeft < BONUS_COST[pool]) return;
        s.bonus[pool][id] = (s.bonus[pool][id] ?? 0) + 1;
      } else {
        s.bonus[pool][id] = Math.max(0, (s.bonus[pool][id] ?? 0) - 1);
      }
    } else if (kind === "res") {
      const cost = RES_COST[id], cap = RES_CAP[id];
      const final = id === "chakra" ? this._finalChakra() : id === "willpower" ? this._finalWillpower() : this._finalHealth();
      if (delta > 0) {
        if (c.bonusLeft < cost || final >= cap) return;
        s.bonus[id] = (s.bonus[id] ?? 0) + 1;
      } else {
        s.bonus[id] = Math.max(0, (s.bonus[id] ?? 0) - 1);
      }
    } else if (kind === "renown") {
      if (delta > 0) {
        if (c.bonusLeft < BONUS_COST.tempRenown) return;
        s.bonus[id] = (s.bonus[id] ?? 0) + 1;
      } else {
        s.bonus[id] = Math.max(0, (s.bonus[id] ?? 0) - 1);
      }
    }
    this.render();
  }

  static _onPickStyle(event, target) {
    this.cg.styleId = target.dataset.styleId;
    this.render();
  }

  /** jutsus comprados com o POOL de Pontos de Jutsu (7) */
  static _onToggleJutsu(event, target) {
    const id = target.dataset.jutsuId;
    const s = this.cg;
    if (s.jutsus.includes(id)) {
      s.jutsus = s.jutsus.filter((j) => j !== id);
      this._pruneBrokenJutsus();
    } else {
      const m = this._bySource(this.maneuvers, id);
      if (!m || this._checkPrereqs(m).length || this._jutsuCost(id) === null || s.bonus.jutsus.includes(id)) return;
      s.jutsus.push(id);
    }
    this.render();
  }

  /** jutsus comprados com PONTOS DE BONUS (PJ x4) */
  static _onToggleBonusJutsu(event, target) {
    const id = target.dataset.jutsuId;
    const s = this.cg;
    const c = this.calc();
    if (s.bonus.jutsus.includes(id)) {
      s.bonus.jutsus = s.bonus.jutsus.filter((j) => j !== id);
      this._pruneBrokenJutsus();
    } else {
      const m = this._bySource(this.maneuvers, id);
      const cost = this._jutsuCost(id);
      if (!m || cost === null || this._checkPrereqs(m).length || s.jutsus.includes(id)) return;
      if (c.bonusLeft < cost * JUTSU_BONUS_MULT) return;
      s.bonus.jutsus.push(id);
    }
    this.render();
  }

  /** remove jutsus cujos pre-requisitos deixaram de ser atendidos (encadeados) */
  _pruneBrokenJutsus() {
    const s = this.cg;
    let changed = true;
    while (changed) {
      changed = false;
      for (const list of ["jutsus", "bonus"]) {
        const arr = list === "jutsus" ? s.jutsus : s.bonus.jutsus;
        for (const jid of [...arr]) {
          const m = this._bySource(this.maneuvers, jid);
          if (m && this._checkPrereqs(m).length) {
            if (list === "jutsus") s.jutsus = s.jutsus.filter((x) => x !== jid);
            else s.bonus.jutsus = s.bonus.jutsus.filter((x) => x !== jid);
            changed = true;
          }
        }
      }
    }
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
        data.system.value = this._total(pool, i.system.sourceId);
        if (pool !== "bgs" || data.system.value > 0) items.push(data);
      }
    };
    pushTrait(this.attributes, "attrs");
    pushTrait(this.abilities, "abils");
    pushTrait(this.techniques, "techs");
    pushTrait(this.backgrounds, "bgs");
    items.push(style.toObject());
    const allJutsus = [...new Set([...s.jutsus, ...s.bonus.jutsus])];
    for (const jid of allJutsus) {
      const m = this._bySource(this.maneuvers, jid);
      if (m) items.push(m.toObject());
    }
    const allBasics = game.items.filter((i) => i.type === "specialManeuver" &&
      (i.system.sourceId in BASICS_BY_TECH || i.system.sourceId === "movement"));
    for (const b of allBasics) {
      const sid = b.system.sourceId;
      if (sid === "movement" || this._total("techs", BASICS_BY_TECH[sid]) >= 1) items.push(b.toObject());
    }
    const chi = this._finalChakra();
    const wp = this._finalWillpower();
    const hp = this._finalHealth();
    try {
      const actor = await Actor.create({
        name: s.profile.name, type: "fighter",
        ownership: { [game.user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
        system: {
          profile: { characterName: s.profile.name, chronicleName: "", schoolName: s.profile.vila,
            fightingTeam: s.profile.time, stable: s.profile.cla, concept: s.profile.concept, signature: s.profile.nindo },
          resources: { health: { value: hp, max: hp }, chi: { value: chi, max: chi }, willpower: { value: wp, max: wp } },
          renown: { honor: { permanent: s.renown.honor, temporary: s.bonus.tempHonor },
                    glory: { permanent: s.renown.glory, temporary: s.bonus.tempGlory } },
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

  try {
    await app.render({ force: true });
  } catch (err) {
    console.error("Naruto RPG | Falha ao renderizar o Criador de Personagens:", err);
    ui.notifications.error(`Naruto RPG | Erro ao renderizar o Criador: ${err.message}`, { permanent: true });
  }
}
