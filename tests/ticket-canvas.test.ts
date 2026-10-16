import assert from 'node:assert/strict';
import test from 'node:test';
import { loadImage } from '@napi-rs/canvas';
import { renderTicketOpeningCard, renderTicketPanelCard } from '../src/render/ticketCards.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const [name, render] of [
  ['panel banner', () => renderTicketPanelCard(0xe2702f)],
  ['ticket opening summary', () => renderTicketOpeningCard({
    accent: 0x5865f2,
    displayName: 'Rayan',
  })],
] as const) {
  test(`renders ${name} as a valid 1000×300 PNG`, async () => {
    const imageBuffer = await render();
    assert.deepEqual(imageBuffer.subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE);
    const image = await loadImage(imageBuffer);
    assert.equal(image.width, 1000);
    assert.equal(image.height, 300);
  });
}
