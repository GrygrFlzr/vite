import { ResolvedConfig } from '../config'
import { Plugin } from '../plugin'
import aliasPlugin from '@rollup/plugin-alias'
import { jsonPlugin } from './json'
import { resolvePlugin } from './resolve'
import { esbuildPlugin } from './esbuild'
import { importAnalysisPlugin } from './importAnalysis'
import { cssPlugin, cssPostPlugin } from './css'
import { assetPlugin } from './asset'
import { clientInjectionsPlugin } from './clientInjections'
import { htmlInlineScriptProxyPlugin } from './html'
import { wasmPlugin } from './wasm'
import { webWorkerPlugin } from './worker'
import { dynamicImportPolyfillPlugin } from './dynamicImportPolyfill'
import { preAliasPlugin } from './preAlias'
import { definePlugin } from './define'
import { globReload } from './globReload'

export async function resolvePlugins(
  config: ResolvedConfig,
  prePlugins: Plugin[],
  normalPlugins: Plugin[],
  postPlugins: Plugin[]
): Promise<Plugin[]> {
  const isBuild = config.command === 'build'

  const buildPlugins = isBuild
    ? (await import('../build')).resolveBuildPlugins(config)
    : { pre: [], post: [] }

  return [
    isBuild ? null : preAliasPlugin(),
    aliasPlugin({ entries: config.resolve.alias }),
    ...prePlugins,
    config.build.polyfillDynamicImport
      ? dynamicImportPolyfillPlugin(config)
      : null,
    resolvePlugin({
      ...config.resolve,
      root: config.root,
      isProduction: config.isProduction,
      isBuild,
      asSrc: true
    }),
    htmlInlineScriptProxyPlugin(),
    cssPlugin(config),
    config.esbuild !== false ? esbuildPlugin(config.esbuild) : null,
    jsonPlugin(
      {
        namedExports: true,
        ...config.json
      },
      isBuild
    ),
    wasmPlugin(config),
    webWorkerPlugin(config),
    assetPlugin(config),
    ...normalPlugins,
    definePlugin(config),
    cssPostPlugin(config),
    ...buildPlugins.pre,
    ...postPlugins,
    ...buildPlugins.post,
    // internal server-only plugins are always applied after everything else
    ...(isBuild
      ? []
      : [
          clientInjectionsPlugin(config),
          globReload(config),
          importAnalysisPlugin(config)
        ])
  ].filter(Boolean) as Plugin[]
}
