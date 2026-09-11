const MODULE_ID = "air-islands-character-importer";
const timers = new Map();
let bodyTemplatePromise = null;

const STARTER_ITEMS = [
  {
    key: "armor",
    item: {
      name: "Врожденный доспех мортара",
      type: "armor",
      img: "WhitetransparentICONS/Other/blackbackground/layered-armor.svg",
      system: {
        bonus: { value: 2, max: 2 },
        rawMaterials: "",
        time: "",
        talent: "",
        tools: "",
        rollModifiers: {},
        artifactBonus: "0",
        drawback: "",
        description: "",
        appearance: "",
        effect: "",
        quantity: 1,
        cost: "0",
        part: "other",
        features: "<p>Металлическое тело мортара, все еще уязвимое, пусть и не такое мягкое, как плоть.&nbsp;<br>Может терять качество как и обычный доспех, может быть починено во время MAITENANCE с помощью Обычных Запчастей.</p>",
        supply: "",
        weight: "none"
      },
      effects: [],
      flags: {}
    }
  },
  {
    key: "ordinary-spares",
    item: {
      name: "Обычные запчасти",
      type: "gear",
      img: "WhitetransparentICONS/Other/blackbackground/SparePartsRegular.webp",
      system: {
        bonus: { value: 0, max: 0 },
        rawMaterials: "-",
        time: "-",
        talent: "-",
        tools: "-",
        rollModifiers: {},
        artifactBonus: "",
        drawback: "",
        description: "",
        appearance: "",
        effect: "<p style=\"text-align: justify;\"><em>Большой набор из кусков жести, крышек, латок, болтов и гаек, и прочего крепежа неизвестного происхождения и возраста.&nbsp;</em></p>",
        quantity: 1,
        cost: "-",
        supply: "-",
        weight: "regular"
      },
      effects: [],
      flags: {
        "fbl-resource-dice": {
          weightByDie: { "4": "light", "6": "regular", "8": "regular", "10": "regular", "12": "heavy" },
          die: 10
        }
      }
    }
  },
  {
    key: "precision-spares",
    item: {
      name: "Точные запчасти",
      type: "gear",
      img: "WhitetransparentICONS/Other/blackbackground/SparePartsPrescise.webp",
      system: {
        bonus: { value: 0, max: 0 },
        rawMaterials: "-",
        time: "-",
        talent: "-",
        tools: "-",
        rollModifiers: {},
        artifactBonus: "",
        drawback: "",
        description: "",
        appearance: "",
        effect: "<p style=\"text-align: justify;\"><em>Ящик с хорошо сохранившимися подшиниками, суставами, поворотными шестернями и стеклянными линзами, дополненный непонятными металлическими деталями.&nbsp;</em></p>",
        quantity: 1,
        cost: "-",
        supply: "-",
        weight: "regular"
      },
      effects: [],
      flags: {
        "fbl-resource-dice": {
          weightByDie: { "4": "light", "6": "regular", "8": "regular", "10": "regular", "12": "heavy" },
          die: 8
        }
      }
    }
  }
];

function isImportedMortar(actor) {
  return actor?.documentName === "Actor" && actor.flags?.[MODULE_ID]?.profile?.identity?.kinId === "mortar";
}

function schedule(actor) {
  if (!game.user?.isGM || !isImportedMortar(actor)) return;
  const key = actor.uuid ?? actor.id;
  const previous = timers.get(key);
  if (previous) clearTimeout(previous);
  timers.set(key, setTimeout(() => {
    timers.delete(key);
    finalizeMortar(actor).catch(error => console.error(`${MODULE_ID} | Mortar post-import failed`, error));
  }, 250));
}

Hooks.once("ready", () => {
  if (!game.user?.isGM) return;
  Hooks.on("createActor", actor => schedule(actor));
  Hooks.on("updateActor", actor => schedule(actor));
  Hooks.on("createItem", item => schedule(item.parent));
  Hooks.on("deleteItem", item => schedule(item.parent));
});

async function loadMechanicalBodyTemplate() {
  bodyTemplatePromise ??= fetch(`modules/${MODULE_ID}/data/air-islands-rules.json`, { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(`Не удалось загрузить bundled rules: HTTP ${response.status}`);
      return response.json();
    })
    .then(rules => {
      const entry = rules.catalogs?.talents?.items?.find(item => item.builderRole === "mortar-body");
      if (!entry?.snapshot) throw new Error("В bundled rules отсутствует Механическое Тело.");
      const item = foundry.utils.deepClone(entry.snapshot);
      delete item._id;
      item.system ??= {};
      item.system.rank = 1;
      return item;
    });
  return bodyTemplatePromise;
}

async function finalizeMortar(actor) {
  if (!isImportedMortar(actor)) return;
  await ensureStarterItems(actor);
  const completed = actor.flags?.[MODULE_ID]?.mortarPostCreation?.completed === true;
  if (!completed) await resolvePostCreationRolls(actor);
}

async function ensureStarterItems(actor) {
  const existingNames = new Set(actor.items.map(item => item.name));
  const specs = [...STARTER_ITEMS];
  if (!existingNames.has("Механическое Тело")) {
    specs.unshift({ key: "body", item: await loadMechanicalBodyTemplate() });
  }

  const create = [];
  for (const spec of specs) {
    if (existingNames.has(spec.item.name)) continue;
    const item = foundry.utils.deepClone(spec.item);
    item.flags ??= {};
    item.flags[MODULE_ID] = { ...(item.flags[MODULE_ID] ?? {}), mortarStarter: spec.key };
    create.push(item);
    existingNames.add(item.name);
  }
  if (create.length) await actor.createEmbeddedDocuments("Item", create);
}

async function resolvePostCreationRolls(actor) {
  const killer = await new Roll("1d2").evaluate();
  await killer.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: "Мортар: проверка Reputation «Убийца» (1 на D2 даёт +1 Reputation)"
  });

  let reputationAdded = false;
  if (Number(killer.total) === 1) {
    const currentEntries = foundry.utils.deepClone(actor.flags?.["fbl-quick-access"]?.reputationEntries ?? []);
    if (!currentEntries.some(entry => entry?.id === "mortar-killer")) {
      currentEntries.unshift({ id: "mortar-killer", amount: 1, description: "Убийца", location: "" });
      const currentRep = Number(actor.system?.bio?.reputation?.value ?? 0) || 0;
      await actor.update({
        "system.bio.reputation.value": currentRep + 1,
        "flags.fbl-quick-access.reputationEntries": currentEntries
      });
      reputationAdded = true;
    }
  }

  const defectRoll = await new Roll("1d100").evaluate();
  const tableNames = ["Дефекты мортаров", "Дефекты мортара", "Mortar Defects"];
  const table = game.tables?.find(candidate => tableNames.includes(candidate.name));
  if (table) {
    await table.draw({ roll: defectRoll, displayChat: true });
  } else {
    await defectRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: "Мортар: дефект (D100). Сверьте результат с таблицей дефектов."
    });
  }

  await actor.update({
    [`flags.${MODULE_ID}.mortarPostCreation`]: {
      completed: true,
      killerRoll: Number(killer.total) || null,
      killerReputationAdded: reputationAdded,
      defectRoll: Number(defectRoll.total) || null,
      resolvedAt: new Date().toISOString()
    }
  });
}
