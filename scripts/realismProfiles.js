const fs = require("fs");
const path = require("path");
const ts = require("typescript");

require.extensions[".ts"] = function loadTypeScriptModule(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });

  module._compile(output.outputText, filename);
};

const { resolveRoomRealismProfile } = require("../src/utils/roomRealismProfiles.ts");

const presetRoomMetadataFiles = [
  "../assets/mockups/landscape/Calm and cozy modern living room.json",
  "../assets/mockups/landscape/Serene minimalist interior landscape.json",
  "../assets/mockups/landscape/Minimalist still life with soft lighting.json",
  "../assets/mockups/landscape/Minimalist industrial gallery interior.json",
  "../assets/mockups/portrait/Serene minimalist living room interior.json",
  "../assets/mockups/portrait/Serene minimalist living room.json",
  "../assets/mockups/portrait/Modern Slate Interior.json",
];

function formatNumber(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function formatDirection(direction) {
  return `x ${formatNumber(direction.x)}, y ${formatNumber(direction.y)}`;
}

function formatLimit(limit) {
  return `${formatNumber(limit.min)}-${formatNumber(limit.max)} step ${formatNumber(limit.step)}`;
}

function printSliderLimits(limits) {
  const rows = [
    ["Shadow strength", limits.shadowStrength],
    ["Shadow softness", limits.shadowSoftness],
    ["Shadow distance", limits.shadowDistance],
    ["Frame depth", limits.frameDepth],
    ["Mat bevel depth", limits.matBevelDepth],
    ["Mat bevel softness", limits.matBevelSoftness],
    ["Inner lip contrast", limits.innerLipContrast],
    ["Artwork brightness", limits.artworkBrightness],
    ["Reflection strength", limits.reflectionStrength],
  ];

  rows.forEach(([label, limit]) => {
    console.log(`    ${label}: ${formatLimit(limit)}`);
  });
}

function printProfile(scene) {
  const profile = resolveRoomRealismProfile(scene, "presetRoom");

  console.log(`${scene.title}`);
  console.log(`  Scene: ${scene.id}`);
  console.log(`  Profile: ${profile.profileId}`);
  console.log(
    `  Shadow: direction ${formatDirection(profile.shadow.direction)}, strength ${formatNumber(
      profile.shadow.strength
    )}, softness ${formatNumber(profile.shadow.softness)}px, distance ${formatNumber(
      profile.shadow.distance
    )}px`
  );
  console.log(
    `  Material: frame depth ${formatNumber(
      profile.material.frameDepth
    )}, mat bevel ${formatNumber(profile.material.matBevelDepth)}, bevel softness ${formatNumber(
      profile.material.matBevelSoftness
    )}, inner lip ${formatNumber(profile.material.innerLipContrast)}`
  );
  console.log(
    `  Artwork: brightness ${formatNumber(
      profile.material.artworkBrightness
    )}, glass ${profile.material.glassEnabled ? "on" : "off"}, reflection ${formatNumber(
      profile.material.reflectionStrength
    )}`
  );
  console.log("  Slider limits:");
  printSliderLimits(profile.sliderLimits);
  console.log("");
}

console.log("Resolved Room Realism Profiles");
console.log("Values are diagnostics only and are not wired into Room View rendering.\n");

presetRoomMetadataFiles
  .map((metadataFile) => require(path.resolve(__dirname, metadataFile)))
  .forEach(printProfile);

