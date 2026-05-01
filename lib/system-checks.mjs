// Detecção de pré-requisitos do ambiente:
// - Node.js 18+ (requisito do figma-console MCP)
// - Figma Desktop (Bridge plugin não roda em Figma web)
//
// Funções são puras: recebem dependências como parâmetros (DI), não usam
// `process.*` ou `fs.*` diretamente. Isso permite testar sem mocks.

import { existsSync } from 'node:fs'

export const MIN_NODE_MAJOR = 18

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)/

export function checkNodeVersion({ nodeVersion = process.versions.node, minMajor = MIN_NODE_MAJOR } = {}) {
  const m = SEMVER_RE.exec(String(nodeVersion))
  if (!m) {
    return {
      ok: false,
      detected: nodeVersion,
      major: null,
      message: `Não foi possível parsear a versão do Node: "${nodeVersion}"`,
    }
  }
  const major = Number(m[1])
  if (major < minMajor) {
    return {
      ok: false,
      detected: nodeVersion,
      major,
      message: `Node ${nodeVersion} detectado; requer Node ${minMajor}+ para o figma-console MCP.`,
    }
  }
  return { ok: true, detected: nodeVersion, major }
}

const FIGMA_PATHS_BY_PLATFORM = {
  darwin: () => ['/Applications/Figma.app'],
  win32: ({ env }) => {
    const localAppData = env.LOCALAPPDATA
    if (!localAppData) return []
    return [
      `${localAppData}/Figma/Figma.exe`,
      `${localAppData}/Programs/Figma/Figma.exe`,
    ]
  },
}

export function checkFigmaDesktop({
  platform = process.platform,
  env = process.env,
  exists = existsSync,
} = {}) {
  const resolver = FIGMA_PATHS_BY_PLATFORM[platform]
  if (!resolver) {
    return {
      ok: false,
      unsupported: true,
      platform,
      message: `Detecção automática de Figma Desktop não suportada em ${platform === 'linux' ? 'Linux' : platform}. Verifique manualmente que o app desktop esteja aberto antes de seguir.`,
    }
  }
  const candidates = resolver({ env })
  for (const path of candidates) {
    if (exists(path)) return { ok: true, path, platform }
  }
  return {
    ok: false,
    platform,
    message: 'Figma Desktop não encontrado nos caminhos padrão. Instale em https://www.figma.com/downloads/ ou aponte o caminho manualmente.',
    triedPaths: candidates,
  }
}
