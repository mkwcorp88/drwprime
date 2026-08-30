import { describe, expect, it } from 'vitest';
import {
  DOKTER,
  PERAWAT,
  TERAPIS_OR_PERAWAT,
  TREATMENT_PROTOCOLS,
  type ProtocolSeed,
} from '../../prisma/protocol-master';

describe('treatment protocol master', () => {
  it('contains exactly 7 protocols and 41 steps', () => {
    expect(TREATMENT_PROTOCOLS).toHaveLength(7);
    const totalSteps = TREATMENT_PROTOCOLS.reduce((sum, protocol) => sum + protocol.steps.length, 0);
    expect(totalSteps).toBe(41);
  });

  it('has unique protocol codes and step codes', () => {
    const protocolCodes = new Set(TREATMENT_PROTOCOLS.map((protocol) => protocol.code));
    expect(protocolCodes.size).toBe(TREATMENT_PROTOCOLS.length);

    const stepCodes = TREATMENT_PROTOCOLS.flatMap((protocol) => protocol.steps.map((step) => step.stepCode));
    expect(new Set(stepCodes).size).toBe(stepCodes.length);
  });

  it('keeps steps ordered and roles within the allowed proposals', () => {
    const allowedRoles = new Set([TERAPIS_OR_PERAWAT, PERAWAT, DOKTER]);
    for (const protocol of TREATMENT_PROTOCOLS) {
      protocol.steps.forEach((step, index) => {
        expect(step.sequence).toBe(index + 1);
        expect(allowedRoles.has(step.defaultRole)).toBe(true);
      });
    }
  });

  it('contains the confirmed Dermapen protocols referenced by the fee mapping', () => {
    const codes = new Set(TREATMENT_PROTOCOLS.map((protocol) => protocol.code));
    expect(codes.has('PRT-DERMA-PRP')).toBe(true);
    expect(codes.has('PRT-DERMA-DNA-MELASMA')).toBe(true);

    const dermapenPrp = TREATMENT_PROTOCOLS.find((protocol) => protocol.code === 'PRT-DERMA-PRP') as ProtocolSeed;
    expect(dermapenPrp.steps).toHaveLength(6);
    expect(dermapenPrp.steps[4].defaultRole).toBe(DOKTER);
    expect(dermapenPrp.steps[1].defaultRole).toBe(PERAWAT);
  });
});
