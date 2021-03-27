import type { ResolvedConfig } from '../config'
import type { Plugin } from '../plugin'
import { LogLevels } from '../logger'
import { dim, yellow } from 'chalk'
import { posix } from 'path'

/** List of module IDs to invalidate */
const watchlist: Set<string> = new Set()

// taken from ../server/hmr.ts
// could be exported from there?
function getShortName(file: string, root: string) {
  return file.startsWith(root + '/') ? posix.relative(root, file) : file
}

/**
 * Server-only plugin which invalidates source files containing
 *
 * - import.meta.glob
 * - import.meta.globEager
 *
 * When files or directories are added or removed.
 */
export const globReload = (_config: ResolvedConfig): Plugin => ({
  name: 'vite:glob-reload',

  /**
   * (Un)watch files that use import.meta.glob
   */
  transform(code, id) {
    if (code.includes('import.meta.glob')) {
      watchlist.add(id)
    } else {
      watchlist.delete(id)
    }

    // preserve existing code
    return undefined
  },

  /**
   * Obtain the server instance and add listeners
   */
  configureServer(server) {
    const root = server.config.root
    const shouldLogInfo =
      LogLevels[server.config.logLevel || 'info'] >= LogLevels.info

    /**
     * Invalidate any modules which contain import.meta.glob
     */
    function invalidate() {
      for (const id of watchlist) {
        const module = server.moduleGraph.getModuleById(id)
        if (module) {
          server.moduleGraph.invalidateModule(module)
          if (shouldLogInfo) {
            server.config.logger.info(
              yellow`force invalidated ` + dim(getShortName(id, root)),
              { timestamp: true }
            )
          }
        }
      }
    }

    // Invalidate on these events
    server.watcher.on('add', invalidate)
    server.watcher.on('addDir', invalidate)
    server.watcher.on('unlink', invalidate)
    server.watcher.on('unlinkDir', invalidate)
  }
})
