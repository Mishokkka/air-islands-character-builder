const MODULE_ID = "air-islands-character-importer";
const CONFIG_KEY = "campaign-config";

Hooks.once("ready", async () => {
  if (!game.user?.isGM) return;
  const stored = structuredClone(game.settings.get(MODULE_ID, CONFIG_KEY) ?? {});
  if (!Array.isArray(stored.enabledKin) || stored.enabledKin.includes("mortar")) return;
  stored.enabledKin.push("mortar");
  try {
    await game.settings.set(MODULE_ID, CONFIG_KEY, stored);
    console.log(`${MODULE_ID} | enabled Mortar kin in existing campaign config`);
  } catch (error) {
    console.warn(`${MODULE_ID} | could not migrate Mortar kin setting`, error);
  }
});
