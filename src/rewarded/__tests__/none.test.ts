import { describe, expect, it, vi } from 'vitest'
import { noneAdapter } from '../none'

describe('noneAdapter', () => {
  it('ne propose jamais de pub', async () => {
    expect(await noneAdapter.init()).toBe(false)
  })

  it('refuse d’en montrer une, sans toucher au son', async () => {
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() }
    expect(await noneAdapter.showRewarded(hooks)).toBe('unavailable')
    expect(hooks.onStart).not.toHaveBeenCalled()
    expect(hooks.onEnd).not.toHaveBeenCalled()
  })
})
