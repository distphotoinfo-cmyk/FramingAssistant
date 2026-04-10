const { createRunOncePlugin, withPodfile } = require("expo/config-plugins");

const HELPER_NAME = "apply_fmt_consteval_workaround";
const HELPER_SNIPPET = `
def ${HELPER_NAME}(installer)
  fmt_base_header = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
  return unless File.exist?(fmt_base_header)

  contents = File.read(fmt_base_header)
  patched = contents.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')

  if contents != patched
    Pod::UI.puts 'Applying fmt consteval workaround (FMT_USE_CONSTEVAL=0)'
    File.open(fmt_base_header, 'w') { |file| file.write(patched) }
  end

  installer.pods_project.targets.each do |target|
    next unless target.name == 'fmt'

    target.build_configurations.each do |config|
      defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
      defs = [defs] unless defs.is_a?(Array)

      unless defs.include?('FMT_USE_CONSTEVAL=0')
        defs << 'FMT_USE_CONSTEVAL=0'
      end

      config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
    end
  end
end
`;

function withFmtConstevalWorkaround(config) {
  return withPodfile(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes(`def ${HELPER_NAME}`)) {
      contents = contents.replace(
        "prepare_react_native_project!\n",
        `prepare_react_native_project!\n${HELPER_SNIPPET}\n`
      );
    }

    if (!contents.includes(`    ${HELPER_NAME}(installer)`)) {
      contents = contents.replace(
        "    # This is necessary for Xcode 14, because it signs resource bundles by default\n",
        `    ${HELPER_NAME}(installer)\n\n    # This is necessary for Xcode 14, because it signs resource bundles by default\n`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(
  withFmtConstevalWorkaround,
  "withFmtConstevalWorkaround",
  "1.0.0"
);
