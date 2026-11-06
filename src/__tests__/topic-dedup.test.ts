import { describe, expect, it } from 'vitest';
import { isTopicCovered } from '@/lib/seo-engine/topic-dedup';

const HAIR = {
  topic: 'Perawatan Rambut dan Kulit Kepala di Klinik: Pilihan untuk Rambut Rontok dan Ketombe',
  keyword: 'perawatan rambut jogja',
};

describe('isTopicCovered', () => {
  it('catches a topic whose LLM title differs from the queue text', () => {
    expect(isTopicCovered(HAIR, ['perawatan-rambut-jogja-rontok-ketombe-mw47kqd5'])).toBe(true);
  });

  it('catches a reworded title through the topic words when the keyword is absent', () => {
    expect(
      isTopicCovered(
        { topic: 'Urutan Perawatan Wajah di Klinik untuk Pemula: Mulai dari Mana?', keyword: 'perawatan wajah jogja' },
        ['urutan-perawatan-wajah-di-klinik-untuk-pemula']
      )
    ).toBe(true);
  });

  it('leaves an unwritten topic alone', () => {
    expect(
      isTopicCovered(
        { topic: 'Body Spa dan Massage di Jogja: Manfaat Nyata untuk Pemulihan Tubuh', keyword: 'body spa jogja' },
        ['perawatan-rambut-jogja-rontok-ketombe-mw47kqd5', 'urutan-perawatan-wajah-di-klinik-untuk-pemula']
      )
    ).toBe(false);
  });

  it('is not fooled by the words every Jogja article shares', () => {
    expect(
      isTopicCovered({ topic: 'Botox di Jogja', keyword: 'botox jogja' }, ['perawatan-rambut-jogja-rontok-ketombe'])
    ).toBe(false);
  });
});
