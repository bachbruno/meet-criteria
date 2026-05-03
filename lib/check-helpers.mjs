// Pure helpers for /meet-criteria-check. No I/O, no Figma runtime dependency
// — builders return JS strings to be passed to figma_execute by the
// orchestrating skill. Rules are pure (snapshot) => Finding[] functions.

export class CheckError extends Error {
  constructor(message, { code = 'UNKNOWN', details = null } = {}) {
    super(message)
    this.name = 'CheckError'
    this.code = code
    this.details = details
  }
}
