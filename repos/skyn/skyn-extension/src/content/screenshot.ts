import type { ContentMessageResponse } from '../shared/types';

export async function captureScreen(): Promise<ContentMessageResponse> {
  return {
    ok: false,
    reason: 'Screenshot capture is disabled by the content-script security constraint.',
  };
}
