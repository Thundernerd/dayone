// Writes .output/THIRD_PARTY_LICENSES on `nuxt build`: the name, version, license
// and license text of every third-party package that ships in the build output.
//
// Nitro ships packages two ways, and both count:
// - inlined into the client and server chunks: collected from the module IDs that
//   Vite (client and SSR) and Nitro's Rollup put into each chunk;
// - traced into .output/server/node_modules: read from that directory, since Nitro
//   copies the code there but not the license files.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { addVitePlugin, defineNuxtModule, useLogger } from 'nuxt/kit'

interface Package {
  name: string
  version: string
  license: string
  /** Where to read the license files from: the package in the project's node_modules. */
  dir: string
}

interface BundleOutput {
  type: 'chunk' | 'asset'
  moduleIds?: readonly string[]
}

const NODE_MODULES = '/node_modules/'
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\b|[.\-_]|$)/i
const RULE = '='.repeat(80)
const THIN_RULE = '-'.repeat(80)

/** A bundler plugin (Vite or Rollup) that records the module IDs of every emitted chunk. */
function moduleIdCollector(moduleIds: Set<string>) {
  return {
    name: 'dayone:third-party-licenses',
    generateBundle(_options: unknown, bundle: Record<string, BundleOutput>) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') for (const id of output.moduleIds ?? []) moduleIds.add(id)
      }
    },
  }
}

/** The package directory a module ID belongs to, or undefined for the app's own and generated code. */
function packageDirOf(moduleId: string): string | undefined {
  const path = moduleId.replace(/^\0/, '').split('?')[0]!.replaceAll('\\', '/')
  const at = path.lastIndexOf(NODE_MODULES)
  if (at < 0) return undefined
  const segments = path.slice(at + NODE_MODULES.length).split('/')
  // node_modules/.cache, .vite and the like hold build-generated code, not packages.
  if (segments[0]!.startsWith('.')) return undefined
  const nameLength = segments[0]!.startsWith('@') ? 2 : 1
  return path.slice(0, at + NODE_MODULES.length) + segments.slice(0, nameLength).join('/')
}

function readManifest(dir: string): Record<string, unknown> | undefined {
  const file = join(dir, 'package.json')
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : undefined
}

function licenseOf(manifest: Record<string, unknown>): string {
  const { license, licenses } = manifest as {
    license?: string | { type?: string }
    licenses?: Array<{ type?: string }>
  }
  if (typeof license === 'string') return license
  if (license?.type) return license.type
  if (Array.isArray(licenses)) return licenses.map(l => l.type).filter(Boolean).join(' OR ')
  return 'UNKNOWN'
}

/** The packages Nitro traced into server/node_modules, at any depth. */
function tracedPackages(dir: string, found: Array<{ name: string, version: string, license: string }> = []) {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry.startsWith('@') || entry === '.nitro') {
      tracedPackages(path, found)
      continue
    }
    const manifest = readManifest(path)
    if (typeof manifest?.name === 'string' && typeof manifest.version === 'string') {
      found.push({ name: manifest.name, version: manifest.version, license: licenseOf(manifest) })
    }
    tracedPackages(join(path, 'node_modules'), found)
  }
  return found
}

/** Returns a resolver from a package's name and version to its directory in the project's node_modules, via the lockfile. */
function projectPackageResolver(rootDir: string) {
  const lockfile = join(rootDir, 'package-lock.json')
  const packages: Record<string, { version?: string }> = existsSync(lockfile)
    ? JSON.parse(readFileSync(lockfile, 'utf8')).packages ?? {}
    : {}
  return (name: string, version: string) => {
    for (const [key, entry] of Object.entries(packages)) {
      if (entry.version === version && key.endsWith(`node_modules/${name}`)) return join(rootDir, key)
    }
    return undefined
  }
}

function licenseText(dir: string): string | undefined {
  if (!existsSync(dir)) return undefined
  const files = readdirSync(dir).filter(file => LICENSE_FILE.test(file)).sort()
  const texts = files.map(file => readFileSync(join(dir, file), 'utf8').trim()).filter(Boolean)
  return texts.length ? texts.join(`\n\n${THIN_RULE}\n\n`) : undefined
}

function render(packages: Package[]): { text: string, withoutText: string[] } {
  const withoutText: string[] = []
  const entries = packages.map(({ name, version, license, dir }) => {
    let text = licenseText(dir)
    if (!text) {
      withoutText.push(`${name} ${version}`)
      text = `${name} ${version} ships no license file. Its package.json declares the license as ${license}.`
    }
    return [RULE, `${name} ${version}`, `License: ${license}`, THIN_RULE, text].join('\n')
  })
  const header = [
    'THIRD-PARTY SOFTWARE NOTICES',
    '',
    'Day One bundles the third-party packages below into its build output. Each',
    'entry gives the package\'s name and version, its license, and the license text',
    'the package ships with.',
  ].join('\n')
  return { text: [header, ...entries].join('\n\n') + '\n', withoutText }
}

export default defineNuxtModule({
  meta: { name: 'third-party-licenses' },
  setup(_options, nuxt) {
    if (nuxt.options.dev) return
    const logger = useLogger('third-party-licenses')
    const moduleIds = new Set<string>()

    addVitePlugin(moduleIdCollector(moduleIds), { client: true, server: true })

    nuxt.hook('nitro:init', (nitro) => {
      nitro.hooks.hook('rollup:before', (_nitro, config) => {
        config.plugins = [config.plugins, moduleIdCollector(moduleIds)]
      })

      nitro.hooks.hook('compiled', () => {
        const packages = new Map<string, Package>()
        const add = (pkg: Package) => packages.set(`${pkg.name}@${pkg.version}`, pkg)

        for (const id of moduleIds) {
          const dir = packageDirOf(id)
          const manifest = dir && readManifest(dir)
          if (!manifest || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') continue
          add({ name: manifest.name, version: manifest.version, license: licenseOf(manifest), dir })
        }

        // The traced copies hold no license files, so read them from the package in
        // the project's node_modules. Not finding it there would leave a gap in the
        // notices, so that fails the build.
        const findInProject = projectPackageResolver(nuxt.options.rootDir)
        for (const pkg of tracedPackages(join(nitro.options.output.serverDir, 'node_modules'))) {
          const dir = findInProject(pkg.name, pkg.version)
          if (!dir) {
            throw new Error(`Cannot find ${pkg.name} ${pkg.version}, which Nitro traced into the server, in package-lock.json, so its license notice is missing`)
          }
          add({ ...pkg, dir })
        }

        const sorted = [...packages.values()].sort((a, b) =>
          a.name.localeCompare(b.name) || a.version.localeCompare(b.version))
        const { text, withoutText } = render(sorted)
        const file = join(nitro.options.output.dir, 'THIRD_PARTY_LICENSES')
        writeFileSync(file, text)

        logger.success(`Wrote ${relative(nuxt.options.rootDir, file)} (${sorted.length} packages)`)
        if (withoutText.length) {
          logger.warn(`These packages ship no license file, so only their declared license is listed: ${withoutText.join(', ')}`)
        }
      })
    })
  },
})
