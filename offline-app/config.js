globalThis.AIR_ISLANDS_CONFIG = {
  builderVersion: "1.5.1",
  rulesManifestUrl: "./rules/manifest.json",
  remoteCheckTimeoutMs: 8000
};

const mortarV2Ui = document.createElement("script");
mortarV2Ui.src = "./mortar-v2-ui.js";
mortarV2Ui.defer = true;
document.head.append(mortarV2Ui);
